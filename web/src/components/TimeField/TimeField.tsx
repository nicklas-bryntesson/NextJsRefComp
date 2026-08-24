/* TimeField — React port of reference-components/src/partials/components/TimeField.
 *
 * `'use client'` is unavoidable. This is not an end-state component (ADR-0009):
 * it owns a spinbutton keyboard model with a timed digit buffer, a coarse-pointer
 * feature detection, three live rects per popup open, four runtime listeners and
 * three imperative `WheelColumn` instances. Only the *initial* segment fill is
 * pure render — and that part IS rendered on the server, which is strictly more
 * than the reference does (it fills segments after `attach()`).
 *
 * ── What the kernel absorbed ─────────────────────────────────────────────────
 * `WheelColumn`      the three hour/minute/second wheels (physics, ARIA, loop)
 * `popup-position`   `calculatePopupOffset` / `calculateArrowOffset` / `detectDirection`
 * `popup-interaction` the cyclic Tab trap + wheel-scroll containment
 * `locale`           `resolveLocale` for the translation key
 * `css-px`           `resolveCssPx`, the reference's private `_getCSSPx()` probe
 * `Wheel.css`        wheel visuals — imported here because WheelColumn deliberately
 *                    does not import it (see the kernel module header).
 *
 * What is NOT in the kernel and is therefore local: time arithmetic. The contract
 * says so explicitly — "`utils/dates` is **not** used — TimeField does its own
 * time parsing (`parseTimeValue`, `formatSegment`, `wrapValue`)". Those three are
 * exported below, unchanged in behaviour, because the reference exports them.
 *
 * ── What is NOT ported ───────────────────────────────────────────────────────
 * - `_buildSegments()` / `_createSegmentEl()` / `_createSep()` — React renders the
 *   segments as markup instead of `createElement` + `appendChild`. The resulting
 *   DOM is identical, including the absence of whitespace text nodes between the
 *   spans (the reference's DOM has none either, because it builds them in JS).
 * - the `<template data-template="timefield-popup">` — the popup is JSX rendered
 *   when `open`, so the clone-a-template step disappears. The suite's
 *   `toHaveCount(0)` when closed still holds.
 * - the `overflow: hidden` → `[data-initialized="true"]` init gate in the CSS
 *   (dropped, PORTING.md). The ATTRIBUTE is still emitted — F-010.
 * - `destroy()` / `attach()` / `__timeFieldInstance` — effect cleanups and React's
 *   own mounting are the same thing expressed once. Nothing in the suite reads an
 *   instance handle for this component.
 *
 * ── Positioning stays in normal flow (no portal) ─────────────────────────────
 * ADR-0012 leaves the top-layer escape to the consuming project, and the answer
 * here is the same as ToggleTip's: a portal makes `.rail` / `.popup`
 * non-descendants of `.TimeField`, which breaks every `.TimeField .x` rule in the
 * verbatim stylesheet AND every `${TF} .popup` selector in the suite. We inherit
 * the documented ancestor-clipping limitation instead.
 *
 * Class names are contract, not styling (F-008): `.native`, `.overlay`,
 * `.segments`, `.segment`, `.separator`, `.trigger`, `.rail`, `.popup`,
 * `.time-columns`, `.WheelColumns`, `.Wheel`, `.option`, `.footer`,
 * `.footer-clear`, `.footer-now`, `.arrow`, `.announce`. Utilities layer
 * alongside in Phase B, never instead.
 */

"use client";

import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";

import { WheelColumn, type WheelColumnOptions } from "@/kernel/WheelColumn";
import {
  calculateArrowOffset,
  calculatePopupOffset,
  detectDirection,
  type PopupDirection,
} from "@/kernel/popup-position";
import { trapPopupInteraction } from "@/kernel/popup-interaction";
import { resolveLocale } from "@/kernel/locale";
import { resolveCssPx } from "@/kernel/css-px";

import "@/kernel/Wheel.layered.css";
import "./TimeField.layered.css";

/* ── Exported pure utilities ───────────────────────────────────────────────────
   Ported 1:1 from the reference, which exports the same three "for unit tests". */

export function parseTimeValue(value: string): {
  hour: number;
  minute: number;
  second: number | null;
} {
  const parts = value.split(":").map(Number);
  return {
    hour: parts[0] ?? 0,
    minute: parts[1] ?? 0,
    second: parts.length >= 3 ? (parts[2] ?? 0) : null,
  };
}

export function formatSegment(n: number): string {
  return String(n).padStart(2, "0");
}

export function wrapValue(n: number, min: number, max: number): number {
  if (n > max) return min;
  if (n < min) return max;
  return n;
}

/* ── Translations ─────────────────────────────────────────────────────────────
   The reference's `TimeField.translations` static, plus `registerLocale`. Kept as
   a module-level record rather than class statics: the published surface is
   "register strings for a locale tag", and a module is how that is expressed
   without a class. `resolveLocale` (kernel) collapses `en-GB` → `en`. */

export interface TimeFieldStrings {
  hour: string;
  minute: string;
  second: string;
  ampm: string;
  ampmAm: string;
  ampmPm: string;
  openTimePicker: string;
  popupLabel: string;
  clearButton: string;
  nowButton: string;
}

const EN: TimeFieldStrings = {
  hour: "Hour",
  minute: "Minute",
  second: "Second",
  ampm: "AM or PM",
  ampmAm: "AM",
  ampmPm: "PM",
  openTimePicker: "Open time picker",
  popupLabel: "Choose time",
  clearButton: "Clear",
  nowButton: "Now",
};

export const timeFieldTranslations: Record<string, TimeFieldStrings> = {
  en: EN,
  sv: {
    hour: "Timmar",
    minute: "Minuter",
    second: "Sekunder",
    ampm: "FM eller EM",
    ampmAm: "FM",
    ampmPm: "EM",
    openTimePicker: "Öppna tidsväljare",
    popupLabel: "Välj tid",
    clearButton: "Rensa",
    nowButton: "Nu",
  },
};

export function registerTimeFieldLocale(
  locale: string,
  strings: Partial<TimeFieldStrings>,
): void {
  timeFieldTranslations[locale] = { ...EN, ...strings };
}

/* ── Time model ─────────────────────────────────────────────────────────────── */

type SegmentType = "hour" | "minute" | "second" | "ampm";
type WheelSegmentType = "hour" | "minute" | "second";

interface Values {
  hour: number | null;
  minute: number | null;
  second: number | null;
  /** 0 = AM/FM, 1 = PM/EM. Only meaningful for 12h locales. */
  ampm: 0 | 1;
}

const EMPTY: Values = { hour: null, minute: null, second: null, ampm: 0 };

function is12hLocale(locale: string): boolean {
  return (
    new Intl.DateTimeFormat(locale, { hour: "numeric" }).resolvedOptions().hour12 === true
  );
}

function segmentLimits(type: WheelSegmentType, is12h: boolean): { min: number; max: number } {
  if (type === "hour") return is12h ? { min: 1, max: 12 } : { min: 0, max: 23 };
  return { min: 0, max: 59 };
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/** `_syncToNative`'s value computation, extracted as a pure function. Returns
 *  `null` while any ACTIVE segment is empty — partial state leaves the native
 *  input empty, which is the family-wide contract. */
function toTimeString(v: Values, is12h: boolean, showSeconds: boolean): string | null {
  if (v.hour == null || v.minute == null) return null;
  if (showSeconds && v.second == null) return null;

  let h = v.hour;
  if (is12h) {
    h = v.ampm === 0 ? (v.hour === 12 ? 0 : v.hour) : v.hour === 12 ? 12 : v.hour + 12;
  }
  return showSeconds && v.second != null
    ? `${formatSegment(h)}:${formatSegment(v.minute)}:${formatSegment(v.second)}`
    : `${formatSegment(h)}:${formatSegment(v.minute)}`;
}

/** `_syncFromNative`, pure. Mirrors the reference exactly, including the detail
 *  that `second` is only written when the field shows seconds AND the parsed
 *  value carried one. */
function fromTimeString(
  value: string,
  prev: Values,
  is12h: boolean,
  showSeconds: boolean,
): Values {
  const { hour, minute, second } = parseTimeValue(value);

  let displayHour = hour;
  let ampm: 0 | 1 = 0;
  if (is12h) {
    if (hour === 0) {
      displayHour = 12;
      ampm = 0;
    } else if (hour < 12) {
      displayHour = hour;
      ampm = 0;
    } else if (hour === 12) {
      displayHour = 12;
      ampm = 1;
    } else {
      displayHour = hour - 12;
      ampm = 1;
    }
  }

  return {
    hour: displayHour,
    minute,
    second: showSeconds && second != null ? second : prev.second,
    ampm: is12h ? ampm : prev.ampm,
  };
}

/** `_incrementSegment`, pure — including the wrap-chaining (minute 59→0 carries
 *  into hour, second 59→0 into minute). The reference recurses the same way. */
function incrementValue(
  v: Values,
  type: SegmentType,
  delta: number,
  is12h: boolean,
): Values {
  if (type === "ampm") return { ...v, ampm: v.ampm === 0 ? 1 : 0 };

  const { min, max } = segmentLimits(type, is12h);
  const current = v[type];
  const start = current ?? (delta > 0 ? min - 1 : max + 1);
  const raw = start + delta;
  const next = wrapValue(raw, min, max);
  const didWrap = (delta > 0 && raw > max) || (delta < 0 && raw < min);

  let out: Values = { ...v, [type]: next };
  if (didWrap) {
    if (type === "minute") out = incrementValue(out, "hour", delta, is12h);
    else if (type === "second") out = incrementValue(out, "minute", delta, is12h);
  }
  return out;
}

/** Fast-advance when a second digit cannot produce a legal value. */
function shouldFastAdvance(type: WheelSegmentType, firstDigit: number, is12h: boolean): boolean {
  if (type === "hour") return is12h ? firstDigit >= 2 : firstDigit >= 3;
  return firstDigit >= 6;
}

/* ── Ref helpers ──────────────────────────────────────────────────────────────
   These live OUTSIDE the component and take the resolved value as a parameter,
   per the react-hooks/refs rule ("passing a ref to a function may read its value
   during render"). The caller dereferences inside a handler or an effect. */

function focusSegment(
  els: Map<SegmentType, HTMLSpanElement | null>,
  type: SegmentType | undefined,
): void {
  if (!type) return;
  els.get(type)?.focus();
}

function popupTabStops(popup: HTMLElement): HTMLElement[] {
  const wheels = [...popup.querySelectorAll<HTMLElement>('[role="spinbutton"]')];
  const clear = popup.querySelector<HTMLButtonElement>(".footer-clear");
  const now = popup.querySelector<HTMLButtonElement>(".footer-now");
  const buttons = [clear, now].filter(
    (b): b is HTMLButtonElement => b !== null && !b.disabled,
  );
  return [...wheels, ...buttons];
}

/* ── Coarse-pointer detection as an external store ────────────────────────────
 *
 * `data-input-mode` is ADR-0006's single inspectable switch, and it is a fact
 * about the HOST, not React state: `matchMedia('(pointer: coarse)')`. That is
 * exactly `useSyncExternalStore`'s shape, and using it rather than
 * `useState` + `useEffect(() => setMode(...), [])` is not a style preference —
 * the latter is a `react-hooks/set-state-in-effect` ERROR (Findings, "Traps
 * found by the ports themselves") and costs a second passive commit.
 *
 * The SERVER snapshot is `null`, i.e. "no mode yet". That renders exactly the
 * reference's pre-`attach()` markup: `.native { display: block }`, `.overlay
 * { display: none }` — the no-JS end state, in which the native `<input
 * type="time">` is the control. The client snapshot resolves inside the
 * hydration pass, so the mode and `data-initialized` land in ONE commit.
 *
 * Unlike the reference this also SUBSCRIBES, so plugging in a mouse on a hybrid
 * device (or Playwright/DevTools emulating touch) flips the face live. The
 * reference detects once at init and never re-checks.
 */

const COARSE = "(pointer: coarse)";

function subscribeCoarse(onChange: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => {};
  }
  const mq = window.matchMedia(COARSE);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function getInputMode(): "custom" | "display" {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "custom";
  }
  return window.matchMedia(COARSE).matches ? "display" : "custom";
}

function getInputModeServer(): null {
  return null;
}

/* ── Props ─────────────────────────────────────────────────────────────────── */

export interface TimeFieldProps {
  /** `data-id`. Also the native input's `id`, and its `name` unless `name` is set. */
  id: string;
  /** `data-name` — overrides the field name. */
  name?: string;
  /** The field's label. Rendered as a sibling `<label for>` BEFORE the root, which
   *  is exactly where the reference states put it. Rendering it here (rather than
   *  leaving it to the demo page) is what guarantees the `for` / `id` /
   *  `aria-labelledby` triangle the reference wires up in `_initInteractiveMode`
   *  by querying `label[for="…"]`: that query is a client-side DOM read with no
   *  render-time equivalent, so the association is authored instead. */
  label?: ReactNode;
  /** BCP 47. Controls 12h/24h and the segment labels. Default `"en"`. */
  locale?: string;
  /** `HH:mm` or `HH:mm:ss`. Server-rendered initial value. */
  value?: string;
  /** Step in seconds. `< 60` shows the seconds segment. Default `60`. */
  step?: number;
  /** Clamps the popup **Now** button only — never the segments or the native input. */
  min?: string;
  max?: string;
  disabled?: boolean;
  /** Styling hook. The author must ALSO pass `aria-invalid` — the contract is
   *  explicit that `data-invalid` alone is presentation. */
  invalid?: boolean;
  /** Mirrors the native input's `aria-invalid`. */
  ariaInvalid?: boolean;
  required?: boolean;
  /** `data-test-state` — the stylesheet pins :hover / :focus-within for the
   *  kitchensink's interaction-state table. */
  testState?: "hover" | "focus" | "active";
  /** Utilities layered ALONGSIDE the structural class (Phase B seam, F-008). */
  className?: string;
}

/* ── Component ─────────────────────────────────────────────────────────────── */

export function TimeField({
  id,
  name,
  label,
  locale = "en",
  value,
  step = 60,
  min,
  max,
  disabled = false,
  invalid = false,
  ariaInvalid,
  required = false,
  testState,
  className,
}: TimeFieldProps) {
  /* Derived, pure, identical on server and client. `is12h` comes from the RAW
     locale tag (en-GB is 24h, en-US is 12h) while the translation key collapses
     the region — the reference comments on this distinction and it survives. */
  const is12h = is12hLocale(locale);
  const t = timeFieldTranslations[resolveLocale(locale, timeFieldTranslations)];
  const showSeconds = step < 60;

  const segmentTypes: SegmentType[] = ["hour", "minute"];
  if (showSeconds) segmentTypes.push("second");
  if (is12h) segmentTypes.push("ampm");
  const wheelTypes: WheelSegmentType[] = showSeconds
    ? ["hour", "minute", "second"]
    : ["hour", "minute"];

  const labelId = `${id}-label`;
  const announceId = `${id}-announce`;

  /* Initial segment fill happens at RENDER time, not after init — so the
     server-rendered markup already shows "13:45". Same end state, one less
     paint, and `useState`'s initialiser keeps it out of the update path. */
  const [values, setValuesState] = useState<Values>(() =>
    value ? fromTimeString(value, EMPTY, is12h, showSeconds) : EMPTY,
  );
  const [hasValue, setHasValue] = useState<boolean>(() =>
    value ? toTimeString(fromTimeString(value, EMPTY, is12h, showSeconds), is12h, showSeconds) !== null : false,
  );
  const [open, setOpen] = useState(false);
  const [direction, setDirection] = useState<PopupDirection | null>(null);
  const [focused, setFocused] = useState<SegmentType | null>(null);
  /** Roving tabindex: the ONE segment that is a tab stop. It follows focus and is
   *  never cleared — upstream 07bac06 (#52) deleted the `Tab` interception and
   *  `_focusTrigger()`, so the segment you were editing keeps the `0` and
   *  Shift+Tab from the trigger returns into it. A roving tabindex has to rove
   *  back or the group becomes keyboard-unreachable (WCAG 2.1.1). */
  const [roving, setRoving] = useState<SegmentType>(segmentTypes[0]);
  const [buffer, setBufferState] = useState<{ type: SegmentType; text: string } | null>(null);
  const [announce, setAnnounce] = useState("");

  const inputMode = useSyncExternalStore(subscribeCoarse, getInputMode, getInputModeServer);
  const isCustom = inputMode === "custom";

  const rootRef = useRef<HTMLDivElement | null>(null);
  const nativeRef = useRef<HTMLInputElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const railRef = useRef<HTMLDivElement | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);
  const segmentEls = useRef(new Map<SegmentType, HTMLSpanElement | null>());
  const wheelEls = useRef(new Map<WheelSegmentType, HTMLDivElement | null>());
  const wheels = useRef(new Map<WheelSegmentType, WheelColumn>());

  /* Mirrors of state that handlers must read SYNCHRONOUSLY (a keydown may commit
     a value the previous keydown produced in the same tick) and that effects must
     read without re-subscribing on every value change. `setValues` / `setBuffer`
     below are the only writers, so the ref can never drift from the state. */
  const valuesRef = useRef<Values>(values);
  const bufferRef = useRef<{ type: SegmentType; text: string } | null>(null);
  const suppressRef = useRef(false);
  const digitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const announceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);

  function setValues(next: Values) {
    valuesRef.current = next;
    setValuesState(next);
  }
  function setBuffer(next: { type: SegmentType; text: string } | null) {
    bufferRef.current = next;
    setBufferState(next);
  }

  /* ── Value sync ───────────────────────────────────────────────────────────
     `_syncToNative`. The native input stays UNCONTROLLED (`defaultValue`) and is
     written imperatively, for two reasons: the suite reads it with
     `inputValue()` and listens with `addEventListener`, and React's synthetic
     `onChange` is deduplicated so a programmatic `dispatchEvent(new Event(...))`
     never reaches it. Uncontrolled + native events is the only shape where our
     writes and the platform's agree. */
  function commit(next: Values, opts?: { silent?: boolean }) {
    setValues(next);
    const native = nativeRef.current;
    if (!native) return;

    const timeStr = toTimeString(next, is12h, showSeconds);
    if (timeStr == null) {
      native.value = "";
      setHasValue(false);
      return;
    }
    native.value = timeStr;
    setHasValue(true);
    if (!opts?.silent) {
      dispatchValueEvents(native);
      announceTime(timeStr);
    }
  }

  function dispatchValueEvents(native: HTMLInputElement) {
    /* Guards our own `change` against the native-change listener below, which is
       how the reference's `_suppressEvents` flag is used. */
    suppressRef.current = true;
    native.dispatchEvent(new Event("input", { bubbles: true }));
    native.dispatchEvent(new Event("change", { bubbles: true }));
    suppressRef.current = false;
  }

  function announceTime(timeStr: string) {
    setAnnounce(timeStr);
    if (announceTimer.current) clearTimeout(announceTimer.current);
    announceTimer.current = setTimeout(() => setAnnounce(""), 300);
  }

  /* ── Segments ─────────────────────────────────────────────────────────────── */

  function moveFocus(from: SegmentType, delta: number) {
    const i = segmentTypes.indexOf(from);
    const next = segmentTypes[i + delta];
    if (!next) return;
    setRoving(next);
    focusSegment(segmentEls.current, next);
  }

  function flushBuffer() {
    const buf = bufferRef.current;
    if (!buf || buf.type === "ampm") return;
    if (digitTimer.current) clearTimeout(digitTimer.current);
    digitTimer.current = null;
    const { min: lo, max: hi } = segmentLimits(buf.type, is12h);
    setBuffer(null);
    commit({ ...valuesRef.current, [buf.type]: clamp(Number(buf.text), lo, hi) });
  }

  function commitDigit(type: WheelSegmentType, num: number) {
    const { min: lo, max: hi } = segmentLimits(type, is12h);
    setBuffer(null);
    commit({ ...valuesRef.current, [type]: clamp(num, lo, hi) });
    moveFocus(type, 1);
  }

  function handleDigit(type: WheelSegmentType, digit: string) {
    if (digitTimer.current) clearTimeout(digitTimer.current);
    const prev = bufferRef.current?.type === type ? bufferRef.current.text : "";
    const text = prev + digit;
    const num = Number(text);

    setBuffer({ type, text });

    if (text.length === 2 || shouldFastAdvance(type, num, is12h)) {
      commitDigit(type, num);
      return;
    }
    digitTimer.current = setTimeout(() => commitDigit(type, num), 300);
  }

  function handleSegmentKeyDown(e: ReactKeyboardEvent<HTMLSpanElement>, type: SegmentType) {
    if (disabled) return;
    const isFirst = segmentTypes[0] === type;

    switch (e.key) {
      case "ArrowUp":
        e.preventDefault();
        commit(incrementValue(valuesRef.current, type, 1, is12h));
        return;
      case "ArrowDown":
        e.preventDefault();
        commit(incrementValue(valuesRef.current, type, -1, is12h));
        return;
      case "ArrowLeft":
        e.preventDefault();
        moveFocus(type, -1);
        return;
      case "ArrowRight":
        e.preventDefault();
        moveFocus(type, 1);
        return;
      case "Backspace": {
        e.preventDefault();
        if (digitTimer.current) clearTimeout(digitTimer.current);
        digitTimer.current = null;
        setBuffer(null);
        if (type !== "ampm") commit({ ...valuesRef.current, [type]: null });
        if (!isFirst) moveFocus(type, -1);
        return;
      }
      default:
        if (type === "ampm") {
          if (e.key === "A" || e.key === "a") {
            e.preventDefault();
            commit({ ...valuesRef.current, ampm: 0 });
          } else if (e.key === "P" || e.key === "p") {
            e.preventDefault();
            commit({ ...valuesRef.current, ampm: 1 });
          }
          return;
        }
        if (e.key >= "0" && e.key <= "9" && e.key.length === 1) {
          e.preventDefault();
          handleDigit(type, e.key);
        }
    }
  }

  /* ── Popup ────────────────────────────────────────────────────────────────── */

  function measureDirection(): PopupDirection {
    const trigger = triggerRef.current;
    const next = trigger
      ? detectDirection(trigger.getBoundingClientRect(), window.innerHeight)
      : "bottom";
    setDirection(next);
    return next;
  }

  function togglePopup() {
    if (open) {
      setOpen(false);
      return;
    }
    /* Direction is measured BEFORE the open render so the popup never paints on
       the wrong side of the trigger. Both updates batch into one commit. */
    measureDirection();
    setOpen(true);
  }

  function closePopup() {
    setOpen(false);
  }

  function syncWheels(next: Values) {
    wheels.current.forEach((wheel, type) => wheel.setValue(next[type], false));
  }

  function handleClear() {
    const next: Values = { ...valuesRef.current, hour: null, minute: null, second: null };
    setValues(next);
    const native = nativeRef.current;
    if (native) {
      native.value = "";
      setHasValue(false);
      /* Clearing IS a value change — fire both once, matching the set path. The
         reference is explicit about this and the suite asserts the exact
         sequence ['input','change','input','change'] across Now + Clear. */
      dispatchValueEvents(native);
    }
    syncWheels(next);
  }

  function handleNow() {
    const now = new Date();
    let timeStr = showSeconds
      ? `${formatSegment(now.getHours())}:${formatSegment(now.getMinutes())}:${formatSegment(now.getSeconds())}`
      : `${formatSegment(now.getHours())}:${formatSegment(now.getMinutes())}`;
    /* String comparison is correct for zero-padded HH:mm(:ss) and is what the
       reference does. `data-min`/`data-max` clamp THIS button only. */
    if (min && timeStr < min) timeStr = min;
    if (max && timeStr > max) timeStr = max;

    const next = fromTimeString(timeStr, valuesRef.current, is12h, showSeconds);
    setValues(next);
    const native = nativeRef.current;
    if (native) {
      native.value = timeStr;
      setHasValue(true);
      dispatchValueEvents(native);
      announceTime(timeStr);
    }
    syncWheels(next);
  }

  function handlePopupKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    /* Tab / Shift+Tab belong to the kernel's cyclic trap. Escape and the arrow
       stepping stay here — they need component state and the live wheels, which
       is exactly the split `popup-interaction.md` documents. */
    if (e.key === "Escape") {
      e.preventDefault();
      closePopup();
      triggerRef.current?.focus();
      return;
    }
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      const col = (e.target as HTMLElement).closest<HTMLElement>('[role="spinbutton"]');
      if (!col) return;
      e.preventDefault();
      const type = col.dataset.segment as WheelSegmentType | undefined;
      if (!type) return;
      wheels.current.get(type)?.stepBy(e.key === "ArrowUp" ? -1 : 1);
    }
  }

  /* Layout. `--_tf-popup-offset` and `--_tf-arrow-offset` are written straight to
     the root with `setProperty` rather than through the `style` prop: both derive
     from rects that only exist after the open render has been laid out, so
     routing them through state would cost a frame of mis-positioned popup.
     Nothing else writes `style` on this element. */
  function updateLayout() {
    const root = rootRef.current;
    const rail = railRef.current;
    const popup = popupRef.current;
    const trigger = triggerRef.current;
    if (!root || !rail || !popup || !trigger) return;

    const triggerRect = trigger.getBoundingClientRect();
    const containerRect = rail.getBoundingClientRect();
    const popupWidth = popup.getBoundingClientRect().width;
    if (!containerRect.width || !popupWidth) return;

    setDirection(detectDirection(triggerRect, window.innerHeight));

    const triggerCenterX = triggerRect.left + triggerRect.width / 2;
    const offset = calculatePopupOffset(
      triggerCenterX,
      containerRect.left,
      containerRect.width,
      popupWidth,
      window.innerWidth,
      resolveCssPx(root, "--_tf-site-padding") / 2,
    );
    root.style.setProperty("--_tf-popup-offset", `${offset}%`);

    const popupLeft =
      containerRect.left + (offset / 100) * containerRect.width - popupWidth / 2;
    const arrowOffset = calculateArrowOffset(
      triggerCenterX,
      popupLeft,
      popupWidth,
      resolveCssPx(root, "--_tf-arrow-corner-radius"),
      resolveCssPx(root, "--_tf-arrow-size"),
    );
    root.style.setProperty("--_tf-arrow-offset", `${arrowOffset}px`);
  }

  /* ── Effects ──────────────────────────────────────────────────────────────── */

  /* Place the popup before the browser paints it. */
  useLayoutEffect(() => {
    if (open) updateLayout();
  }, [open]);

  /* Wheel columns. Constructed AFTER the open render so CSS (and
     `--_wheel-row-height`) is computed, destroyed on close — mirroring the
     reference's `_openPopup` / `_closePopup` pair. Deps are `open` only: the
     wheels own their own value after construction and are updated through
     `setValue`, so re-running this on every value change would destroy a
     column mid-drag.

     The two omitted deps are deliberate and not risky: `wheelTypes` is derived
     from `showSeconds`, which IS a dep, and `commit` is re-created every render
     but only ever reads refs and stable setters — capturing the open-render
     instance is equivalent to capturing any later one. Including either would
     re-run the effect on every keystroke and tear the wheels down mid-gesture. */
  useEffect(() => {
    if (!open) return;
    /* Recomputed here rather than closed over, so the effect depends on
       `showSeconds` and not on a fresh array identity every render. */
    const types: WheelSegmentType[] = showSeconds
      ? ["hour", "minute", "second"]
      : ["hour", "minute"];
    const created = new Map<WheelSegmentType, WheelColumn>();
    for (const type of types) {
      const el = wheelEls.current.get(type);
      if (!el) continue;
      const { min: lo, max: hi } = segmentLimits(type, is12h);
      const opts: WheelColumnOptions = {
        min: lo,
        max: hi,
        value: valuesRef.current[type],
        onChange: (v: number) => commit({ ...valuesRef.current, [type]: v }),
      };
      created.set(type, new WheelColumn(el, opts));
    }
    wheels.current = created;
    return () => {
      created.forEach((w) => w.destroy());
      wheels.current = new Map();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, is12h, showSeconds]);

  /* Kernel focus trap + scroll containment. The AbortController is created in the
     same effect that calls the primitive and aborted in its cleanup, which is
     what makes StrictMode's double invocation safe (see the module header). */
  useEffect(() => {
    const popup = popupRef.current;
    if (!open || !popup) return;
    const controller = new AbortController();
    trapPopupInteraction({
      container: popup,
      tabStops: () => popupTabStops(popup),
      signal: controller.signal,
    });

    /* An `aria-modal` dialog opened with a MOUSE has to take focus — upstream
       `cbc7598`, and the fix for what this port filed as F-043. The Escape
       handler lives inside the popup, so with focus left on the trigger the key
       never reached it and Escape did nothing at all; a keyboard user was fine
       only because Tab happened to carry them inside. Focus the first tab stop,
       reusing the order the trap already computes, so the entry point and the
       cycle cannot disagree. MonthField and TimeField were the two outliers —
       DateField, DateTimeField and WeekField already did this. */
    popupTabStops(popup)[0]?.focus();

    return () => controller.abort();
  }, [open]);

  /* Outside-click light dismiss. A NATIVE document listener, because "outside"
     is by definition not in this subtree, so a React handler cannot see it. Per
     ADR-0007 this path closes and does NOTHING else — no `trigger.focus()`,
     which would steal the click target and scroll-jump the page. The
     `setTimeout(0)` before registering is the reference's own guard against the
     opening click closing the popup again. */
  useEffect(() => {
    if (!open) return;
    const onDocumentClick = (event: MouseEvent) => {
      const root = rootRef.current;
      if (root && !root.contains(event.target as Node)) setOpen(false);
    };
    const handle = window.setTimeout(() => {
      document.addEventListener("click", onDocumentClick);
    }, 0);
    return () => {
      window.clearTimeout(handle);
      document.removeEventListener("click", onDocumentClick);
    };
  }, [open]);

  /* window resize — rAF-coalesced, as the reference does it. */
  useEffect(() => {
    if (!open) return;
    const onResize = () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        updateLayout();
      });
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [open]);

  /* `_bindValueSync` — the native input changing (the touch/native picker, or a
     spec doing `el.value = x; el.dispatchEvent(new Event('change'))`) feeds the
     segments. MUST be a native listener: React's synthetic `onChange` is
     deduplicated and never fires for a programmatic dispatch. */
  useEffect(() => {
    const native = nativeRef.current;
    if (!native || disabled) return;
    const onNativeChange = () => {
      if (suppressRef.current) return;
      if (!native.value) return;
      const next = fromTimeString(native.value, valuesRef.current, is12h, showSeconds);
      setValues(next);
      setHasValue(true);
    };
    native.addEventListener("change", onNativeChange);
    return () => native.removeEventListener("change", onNativeChange);
  }, [disabled, is12h, showSeconds]);

  /* `_bindFormReset` — a form reset clears the segments as well as the value. */
  useEffect(() => {
    const native = nativeRef.current;
    const form = native?.form;
    if (!native || !form || disabled) return;
    const onReset = () => {
      setValues({ hour: null, minute: null, second: null, ampm: 0 });
      setBuffer(null);
      native.value = "";
      setHasValue(false);
    };
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, [disabled]);

  /* Timers are the one thing React does not clean up for us. */
  useEffect(
    () => () => {
      if (digitTimer.current) clearTimeout(digitTimer.current);
      if (announceTimer.current) clearTimeout(announceTimer.current);
    },
    [],
  );

  /* ── Render ───────────────────────────────────────────────────────────────── */

  function segmentProps(type: SegmentType) {
    const buffered = buffer?.type === type ? buffer.text : null;
    const raw = values[type === "ampm" ? "ampm" : type];
    const placeholder = type !== "ampm" && raw == null;

    let text: string;
    let valueText: string;
    if (buffered != null) {
      text = buffered;
      valueText = buffered;
    } else if (type === "ampm") {
      text = values.ampm === 0 ? t.ampmAm : t.ampmPm;
      valueText = text;
    } else if (placeholder) {
      text = "--";
      valueText = "--";
    } else {
      text = formatSegment(raw as number);
      valueText = text;
    }

    const limits = type === "ampm" ? null : segmentLimits(type, is12h);

    return {
      text,
      /* Booleans are `="true"` or ABSENT — `undefined` is React's "absent". */
      "data-placeholder": placeholder ? ("true" as const) : undefined,
      "data-focused": focused === type ? ("true" as const) : undefined,
      "aria-label": t[type],
      /* Numbers, not strings: React's ARIA typings require `number` for the
         three value properties, and it serialises `0` as "0" — so the DOM the
         suite reads is identical to the reference's `String(min)` writes. */
      "aria-valuenow": placeholder ? undefined : type === "ampm" ? values.ampm : (raw as number),
      "aria-valuetext": valueText,
      "aria-valuemin": limits?.min,
      "aria-valuemax": limits?.max,
      tabIndex: disabled || !isCustom ? -1 : roving === type ? 0 : -1,
      "aria-disabled": disabled ? ("true" as const) : undefined,
    };
  }

  return (
    <>
      {label != null && (
        <label htmlFor={id} id={labelId}>
          {label}
        </label>
      )}
      <div
        ref={rootRef}
        className={className ? `TimeField ${className}` : "TimeField"}
        data-component="TimeField"
        data-id={id}
        data-name={name ?? id}
        data-locale={locale}
        data-value={value}
        data-step={step !== 60 ? String(step) : undefined}
        data-min={min}
        data-max={max}
        data-disabled={disabled ? "true" : undefined}
        data-invalid={invalid ? "true" : undefined}
        data-test-state={testState}
        /* Rendered markup is formed from the first paint, so by the time this
           attribute appears the component IS initialised. The CSS gate that used
           to read it is dropped (it clips the popup); the attribute stays because
           it is contract and every suite waits on it. F-010. */
        data-initialized={inputMode ? "true" : undefined}
        data-input-mode={inputMode ?? undefined}
        data-has-value={hasValue ? "true" : undefined}
        data-open={open ? "true" : undefined}
        data-direction={direction ?? undefined}
      >
        <input
          ref={nativeRef}
          className="native"
          type="time"
          id={id}
          name={name ?? id}
          defaultValue={value}
          step={showSeconds ? step : undefined}
          disabled={disabled}
          required={required || undefined}
          aria-invalid={ariaInvalid ? "true" : undefined}
          /* ADR-0006: in `custom` the native input is a value carrier only and is
             hidden from everyone; in `display` it IS the accessible control. */
          aria-hidden={inputMode === "display" ? undefined : true}
          tabIndex={inputMode === "display" ? undefined : -1}
          /* PRE-HYDRATION HEIGHT RESERVATION — ADR-0008, applied to the state the
             ADR forgot.
             Before the input-mode store resolves there is no `data-input-mode`, so
             the stylesheet's default branch paints this native input as the
             control (`.native { display: block }` / `.overlay { display: none }`).
             That face is functionally correct — see the progressive-enhancement
             finding — but it is the WRONG BOX: the native `<input type="time">`
             paints at its intrinsic 24 px (1.5rem) where the overlay that replaces
             it is 40 px (2.5rem), so every instance jumps +16 px on hydration and
             the document grows 112 px across this page. That is Cumulative Layout
             Shift, and on a shared page it moves other components' click targets
             out from under Playwright's aim mid-gesture.
             ADR-0008 says every field's bordered box is at least 2.5rem. The
             native input IS the field's bordered box until JS lands, so it owes
             the same contract. Reading `--_tf-field-min-block-size` rather than
             hardcoding `2.5rem` means this tracks the token the verbatim
             stylesheet already declares, instead of forking the value.
             Dropped once the mode resolves: from then on the overlay owns the box
             and this input is out of flow (absolute in `custom`, inset-0 in
             `display`), so a min-height on it would be meaningless at best. */
          style={
            inputMode === null
              ? { minBlockSize: "var(--_tf-field-min-block-size)" }
              : undefined
          }
        />
        <div className="overlay" aria-hidden={isCustom ? undefined : true}>
          <div
            className="segments"
            role="group"
            aria-labelledby={label != null ? labelId : undefined}
          >
            {segmentTypes.map((type, i) => {
              const p = segmentProps(type);
              return (
                <Fragment key={type}>
                  {type === "ampm" ? (
                    <span className="separator" aria-hidden="true">
                      {" "}
                    </span>
                  ) : i > 0 ? (
                    <span className="separator" aria-hidden="true">
                      :
                    </span>
                  ) : null}
                  <span
                    ref={(el) => {
                      segmentEls.current.set(type, el);
                    }}
                    className="segment"
                    role="spinbutton"
                    data-segment={type}
                    data-placeholder={p["data-placeholder"]}
                    data-focused={p["data-focused"]}
                    aria-label={p["aria-label"]}
                    aria-valuenow={p["aria-valuenow"]}
                    aria-valuetext={p["aria-valuetext"]}
                    aria-valuemin={p["aria-valuemin"]}
                    aria-valuemax={p["aria-valuemax"]}
                    aria-disabled={p["aria-disabled"]}
                    tabIndex={p.tabIndex}
                    onKeyDown={(e) => handleSegmentKeyDown(e, type)}
                    onFocus={() => {
                      setFocused(type);
                      setRoving(type);
                    }}
                    onBlur={() => {
                      setFocused(null);
                      flushBuffer();
                    }}
                  >
                    {p.text}
                  </span>
                </Fragment>
              );
            })}
          </div>
          <button
            ref={triggerRef}
            type="button"
            className="trigger"
            aria-label={t.openTimePicker}
            aria-expanded={open ? "true" : "false"}
            aria-haspopup="dialog"
            disabled={disabled}
            aria-disabled={disabled ? "true" : undefined}
            onClick={togglePopup}
          >
            <ClockIcon />
          </button>
          <div className="rail" ref={railRef}>
            {open && (
              <div
                ref={popupRef}
                className="popup"
                role="dialog"
                aria-modal="true"
                aria-label={t.popupLabel}
                onKeyDown={handlePopupKeyDown}
              >
                <div className="time-columns WheelColumns">
                  {wheelTypes.map((type, i) => (
                    <div
                      key={type}
                      ref={(el) => {
                        wheelEls.current.set(type, el);
                      }}
                      className="Wheel"
                      /* A UNIQUE id per wheel host is load-bearing and
                         undocumented: WheelColumn derives the
                         `aria-activedescendant` target as `${el.id || "wheel"}-front`,
                         so without one all three columns point at the same
                         "wheel-front" and a screenreader resolves the wrong
                         option. TimeField is the component with the most
                         sibling columns in the family. */
                      id={`${id}-wheel-${type}`}
                      data-segment={type}
                      role="spinbutton"
                      aria-label={t[type]}
                      tabIndex={i === 0 ? 0 : -1}
                    />
                  ))}
                </div>
                <div className="footer">
                  <button
                    type="button"
                    className="footer-clear"
                    disabled={!hasValue}
                    onClick={handleClear}
                  >
                    {t.clearButton}
                  </button>
                  <button type="button" className="footer-now" onClick={handleNow}>
                    {t.nowButton}
                  </button>
                </div>
                <div className="arrow" />
              </div>
            )}
          </div>
        </div>
        <div className="announce" id={announceId} aria-live="polite" aria-atomic="true">
          {announce}
        </div>
      </div>
    </>
  );
}

/* Lucide `clock`, 18px per ADR-0008's trailing-icon half of the field-height
   contract. `display: block` comes from the stylesheet. */
function ClockIcon() {
  return (
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
      className="lucide lucide-clock-icon lucide-clock"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}
