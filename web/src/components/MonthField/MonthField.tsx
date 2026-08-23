/* MonthField — React port of
 * reference-components/src/partials/components/MonthField/MonthField.{ts,html}.
 *
 * `'use client'` is unavoidable. Unlike AffixField (ADR-0009 / F-015) this
 * component's JS does not merely compute attributes: it detects pointer
 * coarseness (ADR-0006), owns a digit-entry buffer with a 400 ms timer, builds
 * and destroys two `WheelColumn` physics instances per popup open, measures
 * three live rects plus three resolved CSS lengths, and dispatches native
 * `input`/`change` events. None of that is an end-state render.
 *
 * ── What the kernel absorbed ─────────────────────────────────────────────────
 *   WheelColumn          the two picker wheels (month loops, year clamps)
 *   popup-position       calculatePopupOffset / calculateArrowOffset / detectDirection
 *   popup-interaction    the cyclic Tab trap + wheel-scroll containment
 *   dates                getMonthName / formatMonthISO / parseMonthISO
 *   locale               resolveLocale
 *   css-px               resolveCssPx — the reference's private `_getCSSPx()` probe
 *   Wheel.css            wheel visuals (required wherever WheelColumn runs)
 * Written here: only what is genuinely MonthField's — the segment spinbutton
 * model, the digit buffer, min/max bounds enforcement and the native value sync.
 *
 * ── Class names are contract, not styling (F-008) ────────────────────────────
 * `.MonthField .native .overlay .segments .segment .separator .trigger .announce
 *  .rail .popup .year-month-picker .WheelColumns .Wheel .footer .footer-clear
 *  .footer-now .arrow` are all selected by either the verbatim stylesheet or
 * MonthField.e2e.test.js. Preserved verbatim; Phase B layers utilities alongside.
 *
 * ── No portal, no top layer (ADR-0012) ───────────────────────────────────────
 * Every rule in the verbatim stylesheet is `.MonthField .part` and the suite
 * selects `${MF} .popup` — a descendant of the root. A portal breaks both, and
 * ADR-0019's "detached part" rename breaks the selectors. We keep the
 * reference's substrate and inherit its documented ancestor-clipping limitation.
 *
 * ── No entrance animation ────────────────────────────────────────────────────
 * The popup appears at full opacity, matching the reference (verified: neither
 * MonthField.css nor Wheel.css contains a `transition`, `animation` or
 * `@keyframes` — unlike ToggleTip, which does fade). An opacity fade would put
 * popup text below AA for ~150–180 ms; Playwright's auto-wait does not check
 * opacity, so the popup-open axe run would report false `color-contrast` hits.
 *
 * ── Why the value lives in a ref AND in state ────────────────────────────────
 * The ref is authoritative, the state is for rendering. Two forces require it:
 *   1. The `WheelColumn` `onChange` / `format` closures are created once per
 *      popup open, inside an effect. Reading render state there would capture
 *      the value as of the open, so every wheel spin would work off a stale
 *      month/year. Reading `valRef.current` is always current.
 *   2. The native `input`/`change` dispatch is a side effect that must happen
 *      exactly once per user action (the suite asserts the exact event
 *      sequence). Deriving it from an effect on state would double-fire under
 *      StrictMode and re-fire on unrelated re-renders.
 * Every mutation goes through `applyValue`, which writes the ref, the DOM value
 * and the render state in one synchronous pass — the same shape as the
 * reference's `_setSegmentValue` → `_enforceBounds` → `_syncToNative` chain.
 */

"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";

import WheelColumn from "@/kernel/WheelColumn";
import {
  calculateArrowOffset,
  calculatePopupOffset,
  detectDirection,
} from "@/kernel/popup-position";
import { trapPopupInteraction } from "@/kernel/popup-interaction";
import { resolveCssPx } from "@/kernel/css-px";
import { formatMonthISO, getMonthName, parseMonthISO } from "@/kernel/dates";
import { resolveLocale } from "@/kernel/locale";

import "@/kernel/Wheel.css";
import "./MonthField.css";

/* ── Exported pure utilities (the reference exports these four) ─────────────── */

export function formatSegment(n: number): string {
  return String(n).padStart(2, "0");
}

/** Wrap a value into [min, max] — the month segment: Dec↔Jan. */
export function wrapValue(n: number, min: number, max: number): number {
  if (n > max) return min;
  if (n < min) return max;
  return n;
}

/** Clamp a value into [min, max] — the year segment. */
export function clampValue(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/** Clamp a `YYYY-MM` string against optional `YYYY-MM` bounds (string compare is safe here). */
export function clampMonthISO(
  value: string,
  min: string | undefined,
  max: string | undefined,
): string {
  let out = value;
  if (min && out < min) out = min;
  if (max && out > max) out = max;
  return out;
}

/* ── Translations ──────────────────────────────────────────────────────────── */

interface TranslationStrings {
  month: string;
  year: string;
  openMonthPicker: string;
  popupLabel: string;
  clearButton: string;
  thisMonthButton: string;
}

/* Ported verbatim from MonthField.translations. `registerLocale` is NOT ported:
   a published imperative registry cannot be React state, and mutating a module
   map after render would not re-render anything that read it. A consumer adds a
   locale by passing `translations` — the declarative equivalent. */
const TRANSLATIONS: Record<string, TranslationStrings> = {
  en: {
    month: "Month",
    year: "Year",
    openMonthPicker: "Open month picker",
    popupLabel: "Choose month",
    clearButton: "Clear",
    thisMonthButton: "This month",
  },
  sv: {
    month: "Månad",
    year: "År",
    openMonthPicker: "Öppna månadsväljare",
    popupLabel: "Välj månad",
    clearButton: "Rensa",
    thisMonthButton: "Denna månad",
  },
};

/** Default year-wheel span when unbounded: current year ±100 (O5). */
const YEAR_SPAN = 100;

/* ── Types ─────────────────────────────────────────────────────────────────── */

type MonthSegmentType = "month" | "year";
type Val = { month: number | null; year: number | null };
type BufferText = { seg: MonthSegmentType; text: string };
type DispatchMode = "silent" | "auto" | "force";

interface Cfg {
  /** RAW locale tag — the only value `Intl` may receive (F-041 / upstream 3c7df5b). */
  localeTag: string;
  minISO?: string;
  maxISO?: string;
  minYear: number;
  maxYear: number;
}

/* ── Pointer coarseness + hydration, as external stores ────────────────────── */
/* `useEffect(() => setState(true), [])` is a react-hooks/set-state-in-effect
   ERROR, and it is exactly where the reference's imperative `_init()` points a
   porter. `useSyncExternalStore` with asymmetric snapshots is the fix and
   resolves inside the hydration pass rather than scheduling a second passive
   commit. Precedents: MotionRegion.tsx, ScrollArea.tsx.

   The server snapshot is `null` — "JS has not run, no mode decided" — which is
   the no-JS end state the reference's pre-init markup shows (native input
   visible, overlay `display: none`). `data-initialized` is gated on the same
   store, so the suite's `[data-initialized="true"]` wait is a true "the mode has
   been detected" gate rather than a literal that is already in the SSR HTML. */

const COARSE = "(pointer: coarse)";

function subscribeCoarse(onChange: () => void): () => void {
  if (typeof window.matchMedia !== "function") return () => {};
  const mq = window.matchMedia(COARSE);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}
function getInputMode(): "custom" | "display" {
  return typeof window.matchMedia === "function" && window.matchMedia(COARSE).matches
    ? "display"
    : "custom";
}
function getInputModeServer(): null {
  return null;
}

/* ── Pure value helpers (module scope: no ref is read during render) ────────── */

function segmentLimits(type: MonthSegmentType, cfg: Cfg): { min: number; max: number } {
  return type === "month"
    ? { min: 0, max: 11 }
    : { min: cfg.minYear, max: cfg.maxYear };
}

/** Port of `_enforceBounds`: clamp the combined YYYY-MM and reflect it back. */
function enforceBounds(val: Val, cfg: Cfg): Val {
  if (!cfg.minISO && !cfg.maxISO) return val;
  if (val.month == null || val.year == null) return val;
  const iso = formatMonthISO(val.year, val.month);
  const clamped = clampMonthISO(iso, cfg.minISO, cfg.maxISO);
  if (clamped === iso) return val;
  const parsed = parseMonthISO(clamped);
  return parsed ? { month: parsed.month, year: parsed.year } : val;
}

/** Port of `_syncInitialValue` → `_syncFromNative`, as a pure function. */
function segmentsFromISO(value: string | undefined, cfg: Cfg): Val {
  const parsed = value ? parseMonthISO(value) : null;
  if (!parsed) return { month: null, year: null };
  return enforceBounds(
    { month: parsed.month, year: clampValue(parsed.year, cfg.minYear, cfg.maxYear) },
    cfg,
  );
}

function isoOf(val: Val): string {
  return val.month == null || val.year == null ? "" : formatMonthISO(val.year, val.month);
}

/** Port of `_valueText` — the human label AT announces (O2), e.g. "June 2026". */
function valueText(type: MonthSegmentType, value: number, val: Val, cfg: Cfg): string {
  if (type === "month") {
    const nameYear = val.year ?? new Date().getFullYear();
    const name = getMonthName(nameYear, value, cfg.localeTag);
    return val.year == null ? name : `${name} ${val.year}`;
  }
  if (val.month == null) return String(value);
  return `${getMonthName(value, val.month, cfg.localeTag)} ${value}`;
}

/* ── Imperative helpers — outside the component, taking values as parameters ──
   `react-hooks/refs` ("passing a ref to a function may read its value during
   render") is satisfied structurally: these take the DEREFERENCED element, and
   every call site is an event handler or an effect. */

function focusEl(el: HTMLElement | null): void {
  el?.focus();
}

function writeNative(
  native: HTMLInputElement | null,
  iso: string,
  dispatch: boolean,
): void {
  if (!native) return;
  native.value = iso;
  if (!dispatch) return;
  /* Native events, not React's synthetic `onChange`: the suite listens with
     `native.addEventListener('input'|'change')` and asserts the exact
     sequence ['input','change']. A React state change dispatches nothing. */
  native.dispatchEvent(new Event("input", { bubbles: true }));
  native.dispatchEvent(new Event("change", { bubbles: true }));
}

/** Port of `_updateLayout`. */
function updateLayout(
  root: HTMLElement,
  rail: HTMLElement,
  popup: HTMLElement,
  trigger: HTMLElement,
): void {
  const triggerRect = trigger.getBoundingClientRect();
  const containerRect = rail.getBoundingClientRect();
  const popupWidth = popup.getBoundingClientRect().width;
  if (!containerRect.width || !popupWidth) return;

  /* popup-position keeps `= window.innerWidth/innerHeight` parameter defaults
     for fidelity, and those are not SSR-safe. Pass them explicitly. */
  root.dataset.direction = detectDirection(triggerRect, window.innerHeight);

  const triggerCenterX = triggerRect.left + triggerRect.width / 2;
  const offset = calculatePopupOffset(
    triggerCenterX,
    containerRect.left,
    containerRect.width,
    popupWidth,
    window.innerWidth,
    resolveCssPx(root, "--_mf-site-padding") / 2,
  );
  root.style.setProperty("--_mf-popup-offset", `${offset}%`);

  /* The offset above has not reached layout yet, so the popup's left edge is
     computed arithmetically rather than re-measured — same as the reference. */
  const popupLeft =
    containerRect.left + (offset / 100) * containerRect.width - popupWidth / 2;
  const arrowOffset = calculateArrowOffset(
    triggerCenterX,
    popupLeft,
    popupWidth,
    resolveCssPx(root, "--_mf-arrow-corner-radius"),
    resolveCssPx(root, "--_mf-arrow-size"),
  );
  root.style.setProperty("--_mf-arrow-offset", `${arrowOffset}px`);
}

/** Port of `_popupTabStops`: wheels in DOM order, then the ENABLED footer
 *  buttons — so Tab never lands on a disabled Clear. */
function popupTabStops(popup: HTMLElement | null): HTMLElement[] {
  if (!popup) return [];
  const wheels = [...popup.querySelectorAll<HTMLElement>('.Wheel[role="spinbutton"]')];
  const buttons = [
    popup.querySelector<HTMLButtonElement>(".footer-clear"),
    popup.querySelector<HTMLButtonElement>(".footer-now"),
  ].filter((b): b is HTMLButtonElement => b !== null && !b.disabled);
  return [...wheels, ...buttons];
}

/* ── Props ─────────────────────────────────────────────────────────────────── */

export interface MonthFieldProps {
  /** Applied as `data-id` on the root and `id` on the native input. */
  dataId: string;
  /** Overrides the field `name`; defaults to `dataId`. */
  name?: string;
  /**
   * BCP 47 tag. The contract's resolution chain is
   * `data-locale` → `<html lang>` → `en`; the middle rung is `readLocale`
   * reading a live element, which a server render cannot do, so it is the
   * host's job to pass the page language. Every reference kitchensink state
   * authors `data-locale` explicitly (ADR-0011), so nothing is lost.
   */
  locale?: string;
  /** Initial `YYYY-MM` value. */
  value?: string;
  /** Minimum allowed month, `YYYY-MM`. */
  min?: string;
  /** Maximum allowed month, `YYYY-MM`. */
  max?: string;
  disabled?: boolean;
  /** Styling hook. The contract requires the author to also set `ariaInvalid`. */
  invalid?: boolean;
  required?: boolean;
  ariaInvalid?: boolean;
  /** id of the `<label for={dataId}>` the segment group is named by. */
  labelId?: string;
  /** Kitchensink-only presentation pin: `hover` | `focus` | `active`. */
  testState?: "hover" | "focus" | "active";
  /** Extra locales, merged over the bundled `en`/`sv`. */
  translations?: Record<string, TranslationStrings>;
  /** Phase B seam — utilities layered ALONGSIDE the structural classes (F-008). */
  className?: string;
}

/* ── Component ─────────────────────────────────────────────────────────────── */

export function MonthField({
  dataId,
  name,
  locale = "en",
  value,
  min,
  max,
  disabled = false,
  invalid = false,
  required = false,
  ariaInvalid = false,
  labelId,
  testState,
  translations,
  className,
}: MonthFieldProps) {
  const uid = useId();

  const inputMode = useSyncExternalStore(
    subscribeCoarse,
    getInputMode,
    getInputModeServer,
  );
  const interactive = inputMode === "custom";

  /* Locale: `resolveLocale` degrades the region tag so `sv-SE` finds `sv`. */
  const strings = translations ? { ...TRANSLATIONS, ...translations } : TRANSLATIONS;
  const localeKey = resolveLocale(locale, strings);
  const t = strings[localeKey];

  /* F-041, fixed upstream in 3c7df5b: the two values are NOT interchangeable.
     `localeKey` (COLLAPSED — `de-DE` → `en`, because there is no `de` bundle)
     indexes our own strings and nothing else; the RAW tag is what `Intl` needs
     to produce German month names. Falling back to English for a string we
     wrote is correct; falling back for a name ICU already knows is the bug.
     ADR-0011 § 4 had already decided this rule and left the names behind. */
  const currentYear = new Date().getFullYear();
  const parsedMin = min ? parseMonthISO(min) : null;
  const parsedMax = max ? parseMonthISO(max) : null;
  const cfg: Cfg = {
    localeTag: locale,
    minISO: min || undefined,
    maxISO: max || undefined,
    minYear: parsedMin ? parsedMin.year : currentYear - YEAR_SPAN,
    maxYear: parsedMax ? parsedMax.year : currentYear + YEAR_SPAN,
  };

  const initial = segmentsFromISO(value, cfg);

  const [val, setValRender] = useState<Val>(initial);
  const [bufferText, setBufferText] = useState<BufferText | null>(null);
  const [focused, setFocused] = useState<MonthSegmentType | null>(null);
  /* Roving tabindex: the ONE segment that is a tab stop. It follows focus and is
     never cleared — upstream 07bac06 (#52) deleted the `Tab` interception and
     `_focusTrigger()`, so the segment being edited keeps the `0` and Shift+Tab
     from the trigger returns into it. A roving tabindex has to rove back or the
     group becomes keyboard-unreachable (WCAG 2.1.1). */
  const [roving, setRoving] = useState<MonthSegmentType>("month");
  const [open, setOpen] = useState(false);
  const [announce, setAnnounce] = useState("");

  const valRef = useRef<Val>(initial);
  const cfgRef = useRef<Cfg>(cfg);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const nativeRef = useRef<HTMLInputElement | null>(null);
  const railRef = useRef<HTMLDivElement | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const monthHostRef = useRef<HTMLDivElement | null>(null);
  const yearHostRef = useRef<HTMLDivElement | null>(null);
  const segRefs = useRef<Record<MonthSegmentType, HTMLSpanElement | null>>({
    month: null,
    year: null,
  });
  const wheelsRef = useRef<Map<MonthSegmentType, WheelColumn> | null>(null);
  const digitRef = useRef<{ buffer: string; timer: ReturnType<typeof setTimeout> | null }>(
    { buffer: "", timer: null },
  );
  const announceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Keep the config the imperative helpers read in step with props. No dep
     array on purpose: this must run after every commit, before the popup effect
     below (effects fire in declaration order within one commit). */
  useEffect(() => {
    cfgRef.current = cfg;
  });

  /* ── The one mutation path ───────────────────────────────────────────────── */
  /* Port of `_setSegmentValue` → `_enforceBounds` → `_syncToNative`, collapsed
     into one synchronous pass. Stable across renders: it reads only refs,
     module functions and useState setters, which is what lets the WheelColumn
     closures created inside the popup effect stay correct forever. */
  function applyValue(next: Val, mode: DispatchMode): Val {
    const bounded = enforceBounds(next, cfgRef.current);
    valRef.current = bounded;
    setValRender(bounded);

    const iso = isoOf(bounded);
    const shouldDispatch =
      mode === "force" || (mode === "auto" && iso !== "");
    writeNative(nativeRef.current, iso, shouldDispatch);

    if (mode !== "silent" && iso !== "") {
      const parsed = parseMonthISO(iso);
      setAnnounce(
        parsed
          ? `${getMonthName(parsed.year, parsed.month, cfgRef.current.localeTag)} ${parsed.year}`
          : iso,
      );
      if (announceTimerRef.current) clearTimeout(announceTimerRef.current);
      announceTimerRef.current = setTimeout(() => setAnnounce(""), 300);
    }
    return bounded;
  }

  function setSegment(type: MonthSegmentType, v: number, mode: DispatchMode = "auto") {
    const prev = valRef.current;
    applyValue(type === "month" ? { ...prev, month: v } : { ...prev, year: v }, mode);
  }

  /* ── Segment focus (roving tabindex — the segments are ONE tab stop) ─────── */

  function moveSegmentFocus(from: MonthSegmentType, delta: number) {
    const order: MonthSegmentType[] = ["month", "year"];
    const next = order[order.indexOf(from) + delta];
    if (!next) return;
    setRoving(next);
    focusEl(segRefs.current[next]);
  }

  /* ── Digit buffer ────────────────────────────────────────────────────────── */

  function clearDigitTimer() {
    if (digitRef.current.timer !== null) clearTimeout(digitRef.current.timer);
    digitRef.current.timer = null;
  }

  function commitDigits(type: MonthSegmentType, num: number, moveOn: boolean) {
    clearDigitTimer();
    digitRef.current.buffer = "";
    setBufferText(null);
    /* Month digit entry is 1-based (the user types 1–12) → stored 0-based. */
    const limits = segmentLimits(type, cfgRef.current);
    const v =
      type === "month" ? clampValue(num, 1, 12) - 1 : clampValue(num, limits.min, limits.max);
    setSegment(type, v, "auto");
    if (moveOn) moveSegmentFocus(type, 1);
  }

  function handleDigit(type: MonthSegmentType, digit: string) {
    clearDigitTimer();
    digitRef.current.buffer += digit;
    const buf = digitRef.current.buffer;
    const num = Number(buf);
    const maxLen = type === "year" ? 4 : 2;

    setBufferText({ seg: type, text: buf });

    if (buf.length >= maxLen) {
      commitDigits(type, num, true);
      return;
    }
    /* Month fast-advance: a first digit ≥ 2 cannot start a two-digit month. */
    if (type === "month" && buf.length === 1 && num >= 2) {
      commitDigits(type, num, true);
      return;
    }
    digitRef.current.timer = setTimeout(() => commitDigits(type, num, true), 400);
  }

  function flushDigitBuffer(type: MonthSegmentType) {
    if (!digitRef.current.buffer) return;
    commitDigits(type, Number(digitRef.current.buffer), false);
  }

  /* ── Segment keyboard ────────────────────────────────────────────────────── */

  function incrementSegment(type: MonthSegmentType, delta: number) {
    const prev = valRef.current;
    const { min: lo, max: hi } = segmentLimits(type, cfgRef.current);
    if (type === "month") {
      const start = prev.month ?? (delta > 0 ? lo - 1 : hi + 1);
      setSegment("month", wrapValue(start + delta, lo, hi), "auto");
      return;
    }
    const start = prev.year ?? new Date().getFullYear();
    setSegment("year", clampValue(start + delta, lo, hi), "auto");
  }

  function clearSegment(type: MonthSegmentType) {
    const prev = valRef.current;
    /* Backspace on a filled field empties the native value and dispatches
       NOTHING — the contract's "Events" section is explicit. */
    applyValue(type === "month" ? { ...prev, month: null } : { ...prev, year: null }, "silent");
  }

  function onSegmentKeyDown(e: ReactKeyboardEvent<HTMLSpanElement>, type: MonthSegmentType) {
    if (disabled) return;
    switch (e.key) {
      case "ArrowUp":
        e.preventDefault();
        incrementSegment(type, 1);
        break;
      case "ArrowDown":
        e.preventDefault();
        incrementSegment(type, -1);
        break;
      case "ArrowLeft":
        e.preventDefault();
        moveSegmentFocus(type, -1);
        break;
      case "ArrowRight":
        e.preventDefault();
        moveSegmentFocus(type, 1);
        break;
      case "Backspace":
        e.preventDefault();
        clearDigitTimer();
        digitRef.current.buffer = "";
        setBufferText(null);
        clearSegment(type);
        if (type !== "month") moveSegmentFocus(type, -1);
        break;
      default:
        if (e.key >= "0" && e.key <= "9") {
          e.preventDefault();
          handleDigit(type, e.key);
        }
        break;
    }
  }

  /* ── Popup footer actions ────────────────────────────────────────────────── */

  function syncWheelsFromSegments(animate: boolean) {
    const wheels = wheelsRef.current;
    if (!wheels) return;
    wheels.get("month")?.setValue(valRef.current.month, animate);
    wheels.get("year")?.setValue(valRef.current.year, animate);
  }

  function handleClear() {
    /* Clearing IS a value change here — fire input + change exactly once,
       matching the set path. (Backspace, by contrast, fires nothing.) */
    applyValue({ month: null, year: null }, "force");
    syncWheelsFromSegments(false);
  }

  function handleThisMonth() {
    const now = new Date();
    const iso = clampMonthISO(
      formatMonthISO(now.getFullYear(), now.getMonth()),
      cfgRef.current.minISO,
      cfgRef.current.maxISO,
    );
    const parsed = parseMonthISO(iso);
    if (!parsed) return;
    applyValue(
      {
        month: parsed.month,
        year: clampValue(parsed.year, cfgRef.current.minYear, cfgRef.current.maxYear),
      },
      "force",
    );
    syncWheelsFromSegments(true);
  }

  function closePopup(refocusTrigger: boolean) {
    setOpen(false);
    /* ADR-0007: Escape (keyboard, from inside) refocuses the trigger; an
       outside-click light dismiss NEVER does — it would steal the click target
       and scroll-jump the page. */
    if (refocusTrigger) focusEl(triggerRef.current);
  }

  function onPopupKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    /* Tab / Shift+Tab belong to the shared cyclic trap (popup-interaction),
       installed as a NATIVE listener below. Only Escape and Arrow stepping are
       local. */
    if (e.key === "Escape") {
      e.preventDefault();
      closePopup(true);
      return;
    }
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    const col = (e.target as HTMLElement).closest<HTMLElement>(
      '.Wheel[role="spinbutton"]',
    );
    if (!col) return;
    e.preventDefault();
    const picker = col.dataset.picker as MonthSegmentType | undefined;
    if (!picker) return;
    wheelsRef.current?.get(picker)?.stepBy(e.key === "ArrowUp" ? -1 : 1);
  }

  /* ── Popup lifecycle: wheels, focus trap, placement ─────────────────────── */
  /* A layout effect so the offsets land before the browser paints the open
     popup — otherwise the first frame shows it at the CSS `50%` default. */
  useLayoutEffect(() => {
    if (!open) return;
    const root = rootRef.current;
    const rail = railRef.current;
    const popup = popupRef.current;
    const trigger = triggerRef.current;
    const monthHost = monthHostRef.current;
    const yearHost = yearHostRef.current;
    if (!root || !rail || !popup || !trigger || !monthHost || !yearHost) return;

    updateLayout(root, rail, popup, trigger);

    const wheels = new Map<MonthSegmentType, WheelColumn>();
    /* Month wheel loops (Dec↔Jan) and shows the localized month NAME (O2); the
       inline month segment shows the padded number. Both carry the human label
       in aria-valuetext. */
    wheels.set(
      "month",
      new WheelColumn(monthHost, {
        min: 0,
        max: 11,
        value: valRef.current.month,
        loop: true,
        format: (v) =>
          getMonthName(
            valRef.current.year ?? new Date().getFullYear(),
            v,
            cfgRef.current.localeTag,
          ),
        onChange: (m) => setSegment("month", m, "auto"),
      }),
    );
    /* Year wheel clamps to min..max and shows the plain number. */
    wheels.set(
      "year",
      new WheelColumn(yearHost, {
        min: cfgRef.current.minYear,
        max: cfgRef.current.maxYear,
        value: valRef.current.year,
        loop: false,
        format: (v) => String(v),
        onChange: (y) => {
          setSegment("year", y, "auto");
          /* The month name is year-independent in the Gregorian calendar, but
             the reference nudges the month wheel to re-render on a year change
             and a non-Gregorian calendar would need it. */
          const monthWheel = wheelsRef.current?.get("month");
          if (monthWheel && monthWheel.value != null) {
            monthWheel.setValue(monthWheel.value, false);
          }
        },
      }),
    );
    wheelsRef.current = wheels;

    /* Shared popup hygiene from the kernel: cyclic Tab trap over
       wheels → enabled footer buttons, plus wheel-scroll containment. The
       controller is created inside THIS effect and aborted in its cleanup,
       which is what makes a StrictMode double-invoke safe. */
    const abort = new AbortController();
    trapPopupInteraction({
      container: popup,
      tabStops: () => popupTabStops(popupRef.current),
      signal: abort.signal,
    });

    return () => {
      abort.abort();
      wheels.forEach((w) => w.destroy());
      wheels.clear();
      wheelsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /* Outside click → light dismiss. A native `document` listener: a React
     handler can only see events inside this subtree, which is the opposite of
     "outside". Deferred a tick so the click that OPENED the popup, still
     propagating, cannot close it again. */
  useEffect(() => {
    if (!open) return;
    const onDocumentClick = (e: MouseEvent) => {
      const root = rootRef.current;
      if (root && !root.contains(e.target as Node)) setOpen(false);
    };
    const handle = setTimeout(() => {
      document.addEventListener("click", onDocumentClick);
    }, 0);
    return () => {
      clearTimeout(handle);
      document.removeEventListener("click", onDocumentClick);
    };
  }, [open]);

  /* window resize — rAF-coalesced, exactly as the reference does it. */
  useEffect(() => {
    if (!open) return;
    let raf: number | null = null;
    const onResize = () => {
      if (raf !== null) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        raf = null;
        const root = rootRef.current;
        const rail = railRef.current;
        const popup = popupRef.current;
        const trigger = triggerRef.current;
        if (root && rail && popup && trigger) updateLayout(root, rail, popup, trigger);
      });
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      if (raf !== null) cancelAnimationFrame(raf);
    };
  }, [open]);

  /* Port of `_bindValueSync` + `_bindFormReset`. NATIVE listeners: in display
     mode the platform picker writes the value, and a spec that drives an input
     with `el.value = x; el.dispatchEvent(new Event('input'))` is invisible to
     React's deduplicated synthetic onChange. Our own dispatches are filtered by
     comparing against the authoritative ref rather than a suppression flag. */
  useEffect(() => {
    const native = nativeRef.current;
    if (!native || disabled) return;
    const onNativeChange = () => {
      const raw = native.value;
      if (!raw || raw === isoOf(valRef.current)) return;
      const parsed = parseMonthISO(raw);
      if (!parsed) return;
      applyValue(
        {
          month: parsed.month,
          year: clampValue(parsed.year, cfgRef.current.minYear, cfgRef.current.maxYear),
        },
        "silent",
      );
    };
    const onReset = () => applyValue({ month: null, year: null }, "silent");
    native.addEventListener("change", onNativeChange);
    const form = native.form;
    form?.addEventListener("reset", onReset);
    return () => {
      native.removeEventListener("change", onNativeChange);
      form?.removeEventListener("reset", onReset);
    };
  }, [disabled]);

  /* Timer hygiene on unmount. */
  useEffect(
    () => () => {
      if (digitRef.current.timer !== null) clearTimeout(digitRef.current.timer);
      if (announceTimerRef.current !== null) clearTimeout(announceTimerRef.current);
    },
    [],
  );

  /* ── Derived render values ───────────────────────────────────────────────── */

  const fieldName = name ?? dataId;
  const complete = val.month != null && val.year != null;
  const monthLimits = segmentLimits("month", cfg);
  const yearLimits = segmentLimits("year", cfg);

  function segmentText(type: MonthSegmentType): string {
    if (bufferText?.seg === type) return bufferText.text;
    if (type === "month") {
      return val.month == null ? "--" : formatSegment(val.month + 1);
    }
    return val.year == null ? "----" : String(val.year);
  }
  function segmentValueText(type: MonthSegmentType): string {
    if (bufferText?.seg === type) return bufferText.text;
    const v = type === "month" ? val.month : val.year;
    return v == null ? "--" : valueText(type, v, val, cfg);
  }
  function segmentTabIndex(type: MonthSegmentType): number {
    if (!interactive || disabled) return -1;
    return roving === type ? 0 : -1;
  }

  /* Static attribute props only. The three HANDLERS are written inline in the
     JSX below rather than returned from here: `react-hooks/refs` treats a
     factory called during render as a render-time call site, so passing a
     ref-reading function (`onSegmentKeyDown`, `flushDigitBuffer`) into one is
     an error — "Passing a ref to a function may read its value during render".
     Inline JSX handlers are not a render-time call. */
  const segmentAria = (type: MonthSegmentType) => {
    const v = type === "month" ? val.month : val.year;
    const limits = type === "month" ? monthLimits : yearLimits;
    return {
      className: "segment",
      role: "spinbutton",
      "data-segment": type,
      "aria-label": t[type],
      "aria-valuemin": limits.min,
      "aria-valuemax": limits.max,
      "aria-valuenow": v == null ? undefined : v,
      "aria-valuetext": segmentValueText(type),
      "aria-disabled": disabled ? ("true" as const) : undefined,
      "data-placeholder": v == null ? ("true" as const) : undefined,
      "data-focused": focused === type ? ("true" as const) : undefined,
      tabIndex: segmentTabIndex(type),
    };
  };

  return (
    <div
      ref={rootRef}
      className={className ? `MonthField ${className}` : "MonthField"}
      data-component="MonthField"
      data-id={dataId}
      data-name={fieldName}
      data-locale={locale}
      data-value={value || undefined}
      data-min={min || undefined}
      data-max={max || undefined}
      /* Booleans are `="true"` or ABSENT — `undefined` is exactly the
         library's "absent". Never `="false"`, never bare. */
      data-disabled={disabled ? "true" : undefined}
      data-invalid={invalid ? "true" : undefined}
      data-test-state={testState}
      data-has-value={complete ? "true" : undefined}
      data-open={open ? "true" : undefined}
      /* The init-gate CSS is dropped (it clips the popup); the ATTRIBUTE is
         contract and a test target — the suite waits on it. F-010. */
      data-initialized={inputMode ? "true" : undefined}
      data-input-mode={inputMode ?? undefined}
    >
      {/* Uncontrolled on purpose. A controlled `value=` would make React the
          owner of a DOM property the contract requires US to write imperatively
          and to fire native events for, and `checked`/`value` without onChange
          silently breaks native behaviour (CLAUDE.md). `defaultValue` seeds the
          form value for a no-JS submit. */}
      <input
        ref={nativeRef}
        className="native"
        type="month"
        id={dataId}
        name={fieldName}
        defaultValue={value ?? ""}
        min={min}
        max={max}
        disabled={disabled}
        required={required || undefined}
        aria-invalid={ariaInvalid ? "true" : undefined}
        aria-hidden={inputMode === "display" ? undefined : "true"}
        tabIndex={inputMode === "display" ? undefined : -1}
      />

      {/* In custom mode the overlay IS the accessible control, so aria-hidden
          comes off; in display mode (and pre-hydration) it stays decorative and
          the native input carries everything. ADR-0006. */}
      <div className="overlay" aria-hidden={interactive ? undefined : "true"}>
        <div className="segments" role="group" aria-labelledby={labelId}>
          {/* No `{" "}` between these. The reference builds the segments with
              appendChild, so its runtime DOM has no whitespace text nodes
              either — and `.segments` is inline-flex, where whitespace children
              are dropped anyway. Adding it would DIVERGE from the reference. */}
          <span
            {...segmentAria("month")}
            ref={(el) => {
              segRefs.current.month = el;
            }}
            onKeyDown={(e) => onSegmentKeyDown(e, "month")}
            onFocus={() => {
              setRoving("month");
              setFocused("month");
            }}
            onBlur={() => {
              setFocused(null);
              flushDigitBuffer("month");
            }}
          >
            {segmentText("month")}
          </span>
          <span className="separator" aria-hidden="true">
            /
          </span>
          <span
            {...segmentAria("year")}
            ref={(el) => {
              segRefs.current.year = el;
            }}
            onKeyDown={(e) => onSegmentKeyDown(e, "year")}
            onFocus={() => {
              setRoving("year");
              setFocused("year");
            }}
            onBlur={() => {
              setFocused(null);
              flushDigitBuffer("year");
            }}
          >
            {segmentText("year")}
          </span>
        </div>

        <button
          ref={triggerRef}
          type="button"
          className="trigger"
          aria-label={t.openMonthPicker}
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-disabled={disabled ? "true" : undefined}
          disabled={disabled}
          onClick={() => setOpen((o) => !o)}
        >
          {/* 18px and `display: block` per the family-wide metric contract,
              ADR-0008 (the CSS carries the display rule). */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="lucide lucide-calendar-icon lucide-calendar"
            aria-hidden="true"
            focusable="false"
          >
            <path d="M8 2v4" />
            <path d="M16 2v4" />
            <rect width="18" height="18" x="3" y="4" rx="2" />
            <path d="M3 10h18" />
          </svg>
        </button>

        <div className="rail" ref={railRef}>
          {/* The reference clones a <template>; React renders conditionally.
              Same end state: the suite asserts `.popup` has count 0 when
              closed. */}
          {open && (
            <div
              ref={popupRef}
              className="popup"
              role="dialog"
              aria-modal="true"
              aria-label={t.popupLabel}
              onKeyDown={onPopupKeyDown}
            >
              <div className="year-month-picker WheelColumns">
                {/* Each `.Wheel` host needs a UNIQUE id: WheelColumn derives
                    `aria-activedescendant` from it, so two hosts sharing one id
                    both point at "wheel-front". Undocumented in
                    WheelColumn.md — see findings/kernel.md. */}
                <div
                  ref={monthHostRef}
                  id={`mf-${uid}-wheel-month`}
                  className="Wheel"
                  data-picker="month"
                  role="spinbutton"
                  tabIndex={0}
                  aria-label={t.month}
                />
                <div
                  ref={yearHostRef}
                  id={`mf-${uid}-wheel-year`}
                  className="Wheel"
                  data-picker="year"
                  role="spinbutton"
                  tabIndex={-1}
                  aria-label={t.year}
                />
              </div>
              <div className="footer">
                <button
                  type="button"
                  className="footer-clear"
                  disabled={!complete}
                  onClick={handleClear}
                >
                  {t.clearButton}
                </button>
                <button type="button" className="footer-now" onClick={handleThisMonth}>
                  {t.thisMonthButton}
                </button>
              </div>
              <div className="arrow" />
            </div>
          )}
        </div>
      </div>

      <div className="announce" id={`${dataId}-announce`} aria-live="polite" aria-atomic="true">
        {announce}
      </div>
    </div>
  );
}

export default MonthField;
