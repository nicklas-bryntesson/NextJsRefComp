/* WeekField — React port of reference-components/src/partials/components/WeekField.
 *
 * `'use client'` is unavoidable. Unlike AffixField (ADR-0009: a component whose JS
 * only *computes attributes* ports to a Server Component), WeekField owns a real
 * keyboard model, a measured popover, four runtime listeners and a feature
 * detection. None of that is an end-state render.
 *
 * ── What the kernel absorbed ────────────────────────────────────────────────
 *   popup-position    → placement + arrow offset (`calculatePopupOffset`,
 *                       `calculateArrowOffset`, `detectDirection`)
 *   popup-interaction → the cyclic Tab trap + wheel containment
 *   dates             → EVERY ISO-week computation. `getISOWeek`,
 *                       `getISOWeekYear`, `getDateOfISOWeek`, `formatWeekISO`,
 *                       `parseWeekISO`, plus the grid helpers. Nothing about
 *                       week numbering is re-derived here — see `weeksInISOYear`
 *                       below, which is the one week helper the kernel does not
 *                       export and which is itself expressed *through* the
 *                       kernel (`getISOWeek(Dec 28)`).
 *   locale            → `readLocale` / `resolveLocale`
 *   css-px            → the `calc()`/`var()` → px probe
 *
 * NOTE: WeekField does NOT use `WheelColumn`. Its `.md` says so explicitly —
 * this is a calendar-grid week picker (matching the native week pickers), and
 * `## Non-goals` lists "No wheel picker" first. There is no `.Wheel` element in
 * the markup and no `.Wheel` selector in its spec, so `@/kernel/Wheel.css` is
 * deliberately NOT imported: it would ship dead CSS. See findings/WeekField.md.
 *
 * ── Positioning stays in normal flow (no portal) ─────────────────────────────
 * ADR-0012 makes the top-layer escape the consuming project's call and we
 * decline it, as ToggleTip did. Every rule in the verbatim stylesheet is
 * `.WeekField .part` and the spec selects `.popup`, `.calendar-grid`,
 * `.calendar-footer-now`; a portal makes those non-descendants and forces
 * ADR-0019's "detached part" renaming, which the selectors do not accept.
 *
 * ── No entrance animation ───────────────────────────────────────────────────
 * Checked: `WeekField.css` ships NO transition, animation or opacity ramp on
 * `.popup` (unlike ToggleTip, which does despite its docs). Nothing is added —
 * an opacity fade puts popup text below AA for ~150–180 ms and Playwright's
 * auto-wait does not check opacity, so a scoped axe run reports false
 * `color-contrast` violations.
 */

"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { ReactNode } from "react";

import {
  calculateArrowOffset,
  calculatePopupOffset,
  detectDirection,
} from "@/kernel/popup-position";
import { trapPopupInteraction } from "@/kernel/popup-interaction";
import { resolveCssPx } from "@/kernel/css-px";
import { resolveLocale } from "@/kernel/locale";
import {
  formatWeekISO,
  getDateOfISOWeek,
  getDaysInMonth,
  getFirstWeekdayOfMonth,
  getISOWeek,
  getISOWeekYear,
  getMonthName,
  getWeekdayNames,
  parseWeekISO,
} from "@/kernel/dates";

import "./WeekField.layered.css";

/* ── Translations ──────────────────────────────────────────────────────────── */

type TranslationStrings = {
  week: string;
  year: string;
  openWeekPicker: string;
  popupLabel: string;
  prevMonth: string;
  nextMonth: string;
  clearButton: string;
  thisWeekButton: string;
  weekAbbrev: string;
  announceSelected: string;
  weekField: string;
  selected: string;
  notAvailable: string;
};

const TRANSLATIONS: Record<string, TranslationStrings> = {
  en: {
    week: "Week",
    year: "Year",
    openWeekPicker: "Open week picker",
    popupLabel: "Choose week",
    prevMonth: "Previous month",
    nextMonth: "Next month",
    clearButton: "Clear",
    thisWeekButton: "This week",
    weekAbbrev: "Wk",
    announceSelected: "Selected week:",
    weekField: "week field",
    selected: "selected",
    notAvailable: "not available",
  },
  sv: {
    week: "Vecka",
    year: "År",
    openWeekPicker: "Öppna veckoväljare",
    popupLabel: "Välj vecka",
    prevMonth: "Föregående månad",
    nextMonth: "Nästa månad",
    clearButton: "Rensa",
    thisWeekButton: "Denna vecka",
    weekAbbrev: "v.",
    announceSelected: "Vald vecka:",
    weekField: "veckofält",
    selected: "vald",
    notAvailable: "ej tillgänglig",
  },
};

/* ── Pure helpers (the reference exports these for its own unit tests) ─────── */

export function formatSegment(n: number): string {
  return String(n).padStart(2, "0");
}

/** Wrap into [min, max] — the week segment wraps at the year boundary. */
export function wrapValue(n: number, min: number, max: number): number {
  if (n > max) return min;
  if (n < min) return max;
  return n;
}

/** Clamp into [min, max] — the year segment clamps at its bounds. */
export function clampValue(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/**
 * Highest ISO week number of a week-numbering year — 52 or 53.
 *
 * Expressed through the kernel rather than re-deriving the rule ("53 weeks iff
 * Jan 1 is a Thursday, or a leap year whose Jan 1 is a Wednesday"): Dec 28 is
 * always in the last ISO week of its own week-year, so `getISOWeek(Dec 28)` IS
 * the answer. The kernel does not export this; it is the one week helper written
 * here, and it is a one-line composition of a kernel-tested function rather than
 * a second implementation of ISO week numbering.
 */
export function weeksInISOYear(weekYear: number): number {
  return getISOWeek(new Date(weekYear, 11, 28));
}

/**
 * Clamp a `YYYY-Www` value against optional `YYYY-Www` bounds.
 *
 * String comparison is safe ONLY because the format is zero-padded — "2026-W09"
 * sorts before "2026-W10". The reference's comment says the same thing; keeping
 * it verbatim because an unpadded variant would silently invert the comparison.
 */
export function clampWeekISO(
  value: string,
  min: string | undefined,
  max: string | undefined,
): string {
  let out = value;
  if (min && out < min) out = min;
  if (max && out > max) out = max;
  return out;
}

/* ── Native `<input type="week">` feature detection + input mode ───────────── */

/** ADR-0005: progressive enhancement only. Chrome/Edge/Android + iOS 18.2+ yes;
 *  Firefox and desktop Safari no. */
export function supportsNativeWeek(): boolean {
  if (typeof document === "undefined") return false;
  const i = document.createElement("input");
  i.type = "week";
  i.value = "x";
  return i.value !== "x";
}

type InputMode = "custom" | "display";

/* ADR-0006's two faces resolved through `useSyncExternalStore` rather than
   `useState` + `useEffect`.
   `useEffect(() => setState(...), [])` is a LINT ERROR under React 19
   (`react-hooks/set-state-in-effect`), and every component in this library that
   emits an init-time attribute points a porter straight at it (Findings, and
   the MotionRegion / ScrollArea precedents). Asymmetric snapshots also fix the
   real problem: the server cannot know the pointer type, so "custom" is the
   honest server snapshot — the same value ADR-0006 calls the safe guess, and
   the value the conformance suite asserts on a fine pointer. */
function subscribeInputMode(onChange: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => {};
  }
  const mq = window.matchMedia("(pointer: coarse)");
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function getInputModeSnapshot(): InputMode {
  const coarse =
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(pointer: coarse)").matches
      : false;
  return coarse && supportsNativeWeek() ? "display" : "custom";
}

const getInputModeServerSnapshot = (): InputMode => "custom";

/* ── Hydration as an external store ─────────────────────────────────────────
 *
 * `data-initialized="true"` is the suite's own starting gate — every spec's
 * `beforeEach` does `waitFor('[data-initialized="true"]')`. Upstream that gate
 * is honest: `attach()` runs from a NON-async `<script type="module">`, which is
 * deferred and therefore DELAYS the `load` event that `page.goto()` waits for,
 * so by the time the suite looks the component is live. Next.js injects every
 * client chunk as `<script async>`, which does NOT delay `load` — so an
 * attribute baked into the SERVER markup would satisfy the gate ~100 ms before
 * hydration wires a single handler, and the first `.trigger` click would land on
 * a dead control. That is a real dead-control window, not just a test artefact.
 *
 * So the attribute is gated on hydration, read through `useSyncExternalStore`
 * with ASYMMETRIC snapshots — server `false`, client `true`. The gate then means
 * what the suite assumes it means, and the retrying `waitFor` covers the whole
 * window with no bootstrap script and no test-side sleep.
 *
 * This is also the lint-clean shape: the literal port of `attach()` —
 * `useEffect(() => setInitialized(true), [])` — is a `react-hooks/
 * set-state-in-effect` ERROR under React 19, not merely unidiomatic. Precedents:
 * `ScrollArea.tsx`, `MotionRegion.tsx`.
 */
const noopSubscribe = () => () => {};
const getHydrated = () => true;
const getHydratedServer = () => false;

/* ── Grid model ────────────────────────────────────────────────────────────── */

type DayCell = { day: number; outsideMonth: boolean; isToday: boolean };
type WeekRow = {
  iso: string;
  weekYear: number;
  week: number;
  label: string;
  selected: boolean;
  disabled: boolean;
  days: DayCell[];
};

function isWeekDisabled(iso: string, minISO?: string, maxISO?: string): boolean {
  if (minISO && iso < minISO) return true;
  if (maxISO && iso > maxISO) return true;
  return false;
}

/**
 * One row per ISO week of the visible month grid.
 *
 * The ISO week-year is ALWAYS derived from the row's Monday via the kernel,
 * never from `viewYear`. That is the whole point of the component: Mon
 * 2025-12-29 renders inside the December 2025 grid but is `2026-W01`, and
 * 2027-01-01 renders inside the January 2027 grid but is `2026-W53`.
 */
function buildWeekRows(
  viewYear: number,
  viewMonth: number,
  /** RAW locale tag — `Intl` must never receive the collapsed translation key. */
  localeTag: string,
  t: TranslationStrings,
  selectedISO: string | null,
  minISO: string | undefined,
  maxISO: string | undefined,
  today: Date,
): WeekRow[] {
  const firstWeekday = getFirstWeekdayOfMonth(viewYear, viewMonth); // 0 = Mon
  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const totalCells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;
  const gridStart = new Date(viewYear, viewMonth, 1 - firstWeekday);
  const todayString = today.toDateString();

  const rows: WeekRow[] = [];
  for (let cell = 0; cell < totalCells; cell += 7) {
    const monday = new Date(gridStart);
    monday.setDate(gridStart.getDate() + cell);

    const weekYear = getISOWeekYear(monday);
    const week = getISOWeek(monday);
    const iso = formatWeekISO(weekYear, week);
    const selected = iso === selectedISO;
    const disabled = isWeekDisabled(iso, minISO, maxISO);

    const days: DayCell[] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + d);
      days.push({
        day: date.getDate(),
        outsideMonth: date.getMonth() !== viewMonth,
        isToday: date.toDateString() === todayString,
      });
    }

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const range = `${monday.toLocaleDateString(localeTag, {
      day: "numeric",
      month: "long",
    })} – ${sunday.toLocaleDateString(localeTag, { day: "numeric", month: "long" })}`;
    const suffixes = `${selected ? `, ${t.selected}` : ""}${
      disabled ? `, ${t.notAvailable}` : ""
    }`;

    rows.push({
      iso,
      weekYear,
      week,
      label: `${t.week} ${week}, ${range}${suffixes}`,
      selected,
      disabled,
      days,
    });
  }
  return rows;
}

/** Roving-tabindex target: the selected row, else today's row, else the first
 *  enabled row. Mirrors `_updateRovingTabindex()`. */
function pickRovingISO(rows: WeekRow[], todayISO: string): string | null {
  const selected = rows.find((r) => r.selected);
  if (selected) return selected.iso;
  const todayRow = rows.find((r) => r.iso === todayISO && !r.disabled);
  if (todayRow) return todayRow.iso;
  return rows.find((r) => !r.disabled)?.iso ?? null;
}

/* ── Layout (module-level so no ref is passed to a function during render) ─── */

/* `react-hooks/refs` — "passing a ref to a function may read its value during
   render". These take the resolved ELEMENTS as parameters and are only ever
   called from an effect or an event handler. */
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

  /* `data-direction` is written imperatively, not rendered. It is derived from a
     rect that only exists after the open render has been laid out, so routing it
     through state would cost a second render and a frame of mis-placed popup.
     Nothing renders this attribute, so React never clobbers it. */
  root.dataset.direction = detectDirection(triggerRect, window.innerHeight);

  const triggerCenterX = triggerRect.left + triggerRect.width / 2;
  /* Viewport dimensions are passed EXPLICITLY: `popup-position` keeps
     `= window.innerWidth` / `innerHeight` parameter defaults for fidelity with
     the reference, and those defaults are not SSR-safe. */
  const offset = calculatePopupOffset(
    triggerCenterX,
    containerRect.left,
    containerRect.width,
    popupWidth,
    window.innerWidth,
    resolveCssPx(root, "--_wf-site-padding") / 2,
  );
  root.style.setProperty("--_wf-popup-offset", `${offset}%`);

  /* The offset has not reached layout yet, so the popup's left edge is computed
     arithmetically rather than re-measured — same as the reference. */
  const popupLeft =
    containerRect.left + (offset / 100) * containerRect.width - popupWidth / 2;
  const arrowOffset = calculateArrowOffset(
    triggerCenterX,
    popupLeft,
    popupWidth,
    resolveCssPx(root, "--_wf-arrow-corner-radius"),
    resolveCssPx(root, "--_wf-arrow-size"),
  );
  root.style.setProperty("--_wf-arrow-offset", `${arrowOffset}px`);
}

/**
 * Ordered tab stops for the kernel trap: prev-nav → grid (ONE composite stop,
 * WAI-ARIA grid pattern) → next-nav → the enabled footer buttons.
 */
function popupTabStops(popup: HTMLElement): HTMLElement[] {
  const gridStop =
    popup.querySelector<HTMLElement>('.calendar-grid tbody tr[tabindex="0"]') ??
    popup.querySelector<HTMLElement>(
      ".calendar-grid tbody tr:not([data-disabled])",
    );
  const clearBtn = popup.querySelector<HTMLButtonElement>(".calendar-footer-clear");
  const nowBtn = popup.querySelector<HTMLButtonElement>(".calendar-footer-now");
  const stops: Array<HTMLElement | null> = [
    popup.querySelector<HTMLElement>(".prev-month"),
    gridStop,
    popup.querySelector<HTMLElement>(".next-month"),
    clearBtn && !clearBtn.disabled ? clearBtn : null,
    nowBtn && !nowBtn.disabled ? nowBtn : null,
  ];
  return stops.filter((el): el is HTMLElement => el !== null);
}

/* ── Props ─────────────────────────────────────────────────────────────────── */

export type WeekFieldProps = {
  /** e2e anchor. Rendered as `data-id` on the root and as `id`/`name` on the
   *  native input. The live instance must be `meeting-week`. */
  id: string;
  /** A real `<label>` is contract — the field has no placeholder name. */
  label: ReactNode;
  /** Overrides the submitted `name` (defaults to `id`). */
  name?: string;
  /** BCP 47. `sv-SE` degrades to the `sv` strings via `resolveLocale`. */
  locale?: string;
  /** Initial `YYYY-Www`. */
  defaultValue?: string;
  /** Inclusive `YYYY-Www` bounds. */
  min?: string;
  max?: string;
  disabled?: boolean;
  /** Styling hook. The author must ALSO set `aria-invalid` — `invalidInput`. */
  invalid?: boolean;
  /** `aria-invalid="true"` on the native input. */
  invalidInput?: boolean;
  required?: boolean;
  /** Forces a pseudo-class appearance for the static state table. */
  testState?: "hover" | "focus" | "active";
  /** Utilities layered ALONGSIDE the structural class names (Phase B seam, F-008). */
  className?: string;
};

type SegmentType = "week" | "year";

const YEAR_SPAN = 100;

/* ── Component ─────────────────────────────────────────────────────────────── */

export function WeekField({
  id,
  label,
  name,
  locale: localeProp,
  defaultValue,
  min: minISO,
  max: maxISO,
  disabled = false,
  invalid = false,
  invalidInput = false,
  required = false,
  testState,
  className,
}: WeekFieldProps) {
  const labelId = `${id}-label`;

  /* `readLocale` needs a live element (`data-locale` → `<html lang>`), which is
     a client-only read and would make the first render differ from the server's.
     The prop IS the `data-locale` attribute, so `resolveLocale` alone is the
     server-safe half of the same resolution and the fallback chain terminates at
     "en" exactly as ADR-0011 wants for demos.

     Two values, never interchangeable (upstream 3c7df5b, F-041):
       - `localeTag` — the raw tag as authored. Every `Intl` call gets this:
         weekday names, month name, the row's date range.
       - `locale`    — the COLLAPSED translation key (`de-DE` → `en`, no `de`
         bundle) and nothing but our own strings. So "Wk" stays English under
         `de-DE` on purpose: it is a string we wrote, not a name ICU knows. */
  const localeTag = localeProp ?? "en";
  const locale = resolveLocale(localeTag, TRANSLATIONS);
  const t = TRANSLATIONS[locale];

  const inputMode = useSyncExternalStore(
    subscribeInputMode,
    getInputModeSnapshot,
    getInputModeServerSnapshot,
  );

  /* False on the server and on the hydrating render; true from the first
     post-hydration render onward. */
  const hydrated = useSyncExternalStore(noopSubscribe, getHydrated, getHydratedServer);

  /* Year bounds: from data-min/data-max, else the current ISO week-year ±100. */
  const parsedMin = minISO ? parseWeekISO(minISO) : null;
  const parsedMax = maxISO ? parseWeekISO(maxISO) : null;

  const [state, setState] = useState(() => {
    const currentWeekYear = getISOWeekYear(new Date());
    const minYear = parsedMin ? parsedMin.weekYear : currentWeekYear - YEAR_SPAN;
    const maxYear = parsedMax ? parsedMax.weekYear : currentWeekYear + YEAR_SPAN;
    const initial = defaultValue ? parseWeekISO(defaultValue) : null;
    let week: number | null = null;
    let year: number | null = null;
    if (initial) {
      year = clampValue(initial.weekYear, minYear, maxYear);
      week = Math.min(initial.week, weeksInISOYear(year));
      const clamped = parseWeekISO(
        clampWeekISO(formatWeekISO(year, week), minISO, maxISO),
      );
      if (clamped) {
        year = clamped.weekYear;
        week = clamped.week;
      }
    }
    return { week, year, minYear, maxYear };
  });
  const { week, year, minYear, maxYear } = state;

  const nativeISO = week != null && year != null ? formatWeekISO(year, week) : "";
  const hasValue = nativeISO !== "";

  /* Digit-entry buffer: shown in place of the value while a multi-digit entry is
     in flight, exactly as `_showBuffer()` does. */
  const [buffer, setBuffer] = useState<{ segment: SegmentType; text: string } | null>(
    null,
  );
  const bufferTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Roving tabindex across the two segments — the pair is ONE tab stop. It
     follows focus and is never cleared: upstream 07bac06 (#52) deleted the `Tab`
     interception and `_focusTrigger()`, so the segment being edited keeps the
     `0` and Shift+Tab from the trigger returns into it. A roving tabindex has to
     rove back or the group becomes keyboard-unreachable (WCAG 2.1.1). */
  const [segTab, setSegTab] = useState<SegmentType>("week");
  const [focusedSegment, setFocusedSegment] = useState<SegmentType | null>(null);

  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => {
    const today = new Date();
    return { year: today.getFullYear(), month: today.getMonth() };
  });
  const [focusedISO, setFocusedISO] = useState<string | null>(null);
  const [previewISO, setPreviewISO] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");

  const rootRef = useRef<HTMLDivElement | null>(null);
  const railRef = useRef<HTMLDivElement | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const nativeRef = useRef<HTMLInputElement | null>(null);
  const weekSegRef = useRef<HTMLSpanElement | null>(null);
  const yearSegRef = useRef<HTMLSpanElement | null>(null);
  const rafRef = useRef<number | null>(null);
  /* The native input is written imperatively (see the sync effect). This flag
     says whether the pending write is a user-visible value change and therefore
     owes an `input` + `change` pair — the reference's `_suppressEvents`, in the
     positive. */
  const emitRef = useRef(false);
  const wantRowFocusRef = useRef(false);

  /* ── Segment bounds ─────────────────────────────────────────────────────── */

  const weekMax = weeksInISOYear(year ?? getISOWeekYear(new Date()));

  function segmentLimits(type: SegmentType) {
    return type === "week"
      ? { min: 1, max: weekMax }
      : { min: minYear, max: maxYear };
  }

  /* ── Value commit ───────────────────────────────────────────────────────── */

  /** Apply a (week, year) pair, re-clamping the week to the year's 52/53 max and
   *  then the pair to `data-min`/`data-max` — `_setSegmentValue` +
   *  `_refreshWeekMax` + `_enforceBounds` collapsed into one transition. */
  function commit(nextWeek: number | null, nextYear: number | null, emit: boolean) {
    let w = nextWeek;
    let y = nextYear;
    if (y != null && w != null) {
      w = Math.min(w, weeksInISOYear(y));
      const clamped = parseWeekISO(clampWeekISO(formatWeekISO(y, w), minISO, maxISO));
      if (clamped) {
        y = clamped.weekYear;
        w = clamped.week;
      }
    } else if (y != null && w == null) {
      y = clampValue(y, minYear, maxYear);
    }
    if (emit && w != null && y != null) {
      emitRef.current = true;
      setAnnounce(`${t.announceSelected} ${t.week} ${w}, ${y}`);
    } else if (emit) {
      emitRef.current = true;
    }
    setState((s) => ({ ...s, week: w, year: y }));
  }

  /* Native value sync + event dispatch.
     The native input is UNCONTROLLED and written through the ref. Two reasons:
     (1) the reference dispatches `input` + `change` ON the native element, and
     a value React has not committed yet cannot carry the right `target.value`;
     (2) React's synthetic `onChange` is deduplicated, so a controlled input
     would swallow re-dispatch of an identical value. */
  useEffect(() => {
    const el = nativeRef.current;
    if (!el) return;
    const shouldEmit = emitRef.current;
    emitRef.current = false;
    if (el.value === nativeISO) return;
    el.value = nativeISO;
    if (shouldEmit) {
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }, [nativeISO]);

  /* Sync FROM the native input. A NATIVE listener, not `onChange`: in display
     mode the OS picker writes the value, and any host code doing
     `el.value = x; el.dispatchEvent(new Event('change'))` is invisible to
     React's synthetic system. */
  useEffect(() => {
    const el = nativeRef.current;
    if (!el || disabled) return;
    const onNativeChange = () => {
      const parsed = parseWeekISO(el.value);
      if (!parsed) return;
      setState((s) => {
        if (s.week === parsed.week && s.year === parsed.weekYear) return s;
        return { ...s, week: parsed.week, year: parsed.weekYear };
      });
    };
    el.addEventListener("change", onNativeChange);
    return () => el.removeEventListener("change", onNativeChange);
  }, [disabled]);

  /* The announce region self-clears, as `_announceValue()` does. */
  useEffect(() => {
    if (!announce) return;
    const timer = setTimeout(() => setAnnounce(""), 300);
    return () => clearTimeout(timer);
  }, [announce]);

  useEffect(
    () => () => {
      if (bufferTimer.current) clearTimeout(bufferTimer.current);
    },
    [],
  );

  /* ── Segment keyboard ───────────────────────────────────────────────────── */

  function flushBuffer() {
    if (bufferTimer.current) {
      clearTimeout(bufferTimer.current);
      bufferTimer.current = null;
    }
    setBuffer(null);
  }

  function focusSegment(type: SegmentType) {
    setSegTab(type);
    setFocusedSegment(type);
    const el = type === "week" ? weekSegRef.current : yearSegRef.current;
    el?.focus();
  }

  function setSegmentValue(type: SegmentType, value: number, emit: boolean) {
    if (type === "week") commit(value, year, emit);
    else commit(week, value, emit);
  }

  function commitDigits(type: SegmentType, num: number) {
    const { min, max } = segmentLimits(type);
    setBuffer(null);
    bufferTimer.current = null;
    setSegmentValue(type, clampValue(num, min, max), true);
    if (type === "week") focusSegment("year");
  }

  function handleDigit(type: SegmentType, digit: string) {
    if (bufferTimer.current) clearTimeout(bufferTimer.current);
    const text = (buffer?.segment === type ? buffer.text : "") + digit;
    const maxLen = type === "year" ? 4 : 2;
    const num = Number(text);
    setBuffer({ segment: type, text });

    if (text.length >= maxLen) {
      commitDigits(type, num);
      return;
    }
    /* Week fast-advance: a first digit that cannot begin a two-digit week
       (> 5, since the max is 52/53) commits immediately. */
    if (type === "week" && text.length === 1 && num >= 6) {
      commitDigits(type, num);
      return;
    }
    bufferTimer.current = setTimeout(() => commitDigits(type, num), 400);
  }

  function onSegmentKeyDown(event: React.KeyboardEvent, type: SegmentType) {
    if (disabled) return;
    const { min, max } = segmentLimits(type);
    const current = type === "week" ? week : year;

    switch (event.key) {
      case "ArrowUp":
      case "ArrowDown": {
        event.preventDefault();
        const delta = event.key === "ArrowUp" ? 1 : -1;
        if (type === "week") {
          /* The week WRAPS at its year's boundary (1 ↔ 52/53). */
          const start = current ?? (delta > 0 ? min - 1 : max + 1);
          setSegmentValue("week", wrapValue(start + delta, min, max), true);
        } else {
          /* The year CLAMPS. */
          const start = current ?? getISOWeekYear(new Date());
          setSegmentValue("year", clampValue(start + delta, min, max), true);
        }
        return;
      }
      case "ArrowLeft":
        event.preventDefault();
        if (type === "year") focusSegment("week");
        return;
      case "ArrowRight":
        event.preventDefault();
        if (type === "week") focusSegment("year");
        return;
      case "Backspace": {
        event.preventDefault();
        flushBuffer();
        if (type === "week") commit(null, year, false);
        else commit(week, null, false);
        if (type === "year") focusSegment("week");
        return;
      }
      default:
        if (event.key >= "0" && event.key <= "9") {
          event.preventDefault();
          handleDigit(type, event.key);
        }
    }
  }

  /* ── Popup open / close ─────────────────────────────────────────────────── */

  function openPopup() {
    /* Point the grid at the selected week's Monday, else today — before the open
       render, so the popup never paints on the wrong month. */
    if (week != null && year != null) {
      const monday = getDateOfISOWeek(year, week);
      setView({ year: monday.getFullYear(), month: monday.getMonth() });
    } else {
      const today = new Date();
      setView({ year: today.getFullYear(), month: today.getMonth() });
    }
    setFocusedISO(null);
    wantRowFocusRef.current = true;
    setOpen(true);
  }

  /* ADR-0007. `refocusTrigger` is FALSE for light dismiss and TRUE for Escape /
     a selection: an outside click's focus target is wherever the pointer landed,
     and `trigger.focus()` there steals the click and scroll-jumps the page. */
  function closePopup(refocusTrigger: boolean) {
    setOpen(false);
    setPreviewISO(null);
    if (refocusTrigger) triggerRef.current?.focus();
  }

  /* Measure and place before paint, so the popup never shows at the CSS `50%`
     default for a frame. */
  useLayoutEffect(() => {
    if (!open) return;
    const root = rootRef.current;
    const rail = railRef.current;
    const popup = popupRef.current;
    const trigger = triggerRef.current;
    if (!root || !rail || !popup || !trigger) return;
    updateLayout(root, rail, popup, trigger);
  }, [open]);

  /* rAF-coalesced resize, as the reference does it. */
  useEffect(() => {
    if (!open) return;
    const onResize = () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
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
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [open]);

  /* Kernel focus trap + scroll containment. The AbortController is created
     inside this effect and aborted in its cleanup, which is what makes the
     kernel safe under StrictMode's double invocation. */
  useEffect(() => {
    if (!open) return;
    const popup = popupRef.current;
    if (!popup) return;
    const controller = new AbortController();
    trapPopupInteraction({
      container: popup,
      tabStops: () => popupTabStops(popup),
      signal: controller.signal,
    });
    return () => controller.abort();
  }, [open]);

  /* Light dismiss. A native `click` listener on `document`: a React handler can
     only see events inside this subtree, which is the opposite of "outside".
     `click`, not `mousedown` — the spec dismisses by dispatching a `click` on
     `document.body`. Registration is deferred a tick exactly as the reference
     does, so the opening click cannot immediately close it. */
  useEffect(() => {
    if (!open) return;
    let handler: ((e: MouseEvent) => void) | null = null;
    const timer = setTimeout(() => {
      handler = (e: MouseEvent) => {
        const root = rootRef.current;
        if (root && !root.contains(e.target as Node)) closePopup(false);
      };
      document.addEventListener("click", handler);
    }, 0);
    return () => {
      clearTimeout(timer);
      if (handler) document.removeEventListener("click", handler);
    };
  }, [open]);

  /* ── Grid ───────────────────────────────────────────────────────────────── */

  const today = new Date();
  const todayISO = formatWeekISO(getISOWeekYear(today), getISOWeek(today));
  const weekdayNames = getWeekdayNames(localeTag);

  const rows = open
    ? buildWeekRows(view.year, view.month, localeTag, t, nativeISO || null, minISO, maxISO, today)
    : [];
  /* The roving row: an explicit arrow-navigation target when it is still in the
     visible grid, otherwise recomputed — which is also what a month change does
     in the reference (`_renderMonth` → `_updateRovingTabindex`). */
  const rovingISO =
    focusedISO && rows.some((r) => r.iso === focusedISO)
      ? focusedISO
      : pickRovingISO(rows, todayISO);

  useLayoutEffect(() => {
    if (!open || !wantRowFocusRef.current) return;
    wantRowFocusRef.current = false;
    const popup = popupRef.current;
    popup
      ?.querySelector<HTMLElement>('.calendar-grid tbody tr[tabindex="0"]')
      ?.focus();
  }, [open, rovingISO, view.year, view.month]);

  function navigateMonth(direction: number) {
    setView((v) => {
      let month = v.month + direction;
      let y = v.year;
      if (month > 11) {
        month = 0;
        y += 1;
      }
      if (month < 0) {
        month = 11;
        y -= 1;
      }
      return { year: y, month };
    });
    setFocusedISO(null);
  }

  /** Move the roving focus to the ISO week containing `date`, re-pointing the
   *  visible month when that week is not in the current grid. */
  function focusWeekOf(date: Date) {
    const weekYear = getISOWeekYear(date);
    const wk = getISOWeek(date);
    const iso = formatWeekISO(weekYear, wk);
    if (!rows.some((r) => r.iso === iso)) {
      const monday = getDateOfISOWeek(weekYear, wk);
      setView({ year: monday.getFullYear(), month: monday.getMonth() });
    }
    setFocusedISO(iso);
    wantRowFocusRef.current = true;
  }

  function selectWeek(weekYear: number, wk: number) {
    commit(wk, clampValue(weekYear, minYear, maxYear), true);
    closePopup(true);
  }

  function handleThisWeek() {
    const now = new Date();
    const iso = clampWeekISO(
      formatWeekISO(getISOWeekYear(now), getISOWeek(now)),
      minISO,
      maxISO,
    );
    const parsed = parseWeekISO(iso);
    if (parsed) selectWeek(parsed.weekYear, parsed.week);
  }

  function handleClear() {
    commit(null, null, true);
    setFocusedISO(null);
  }

  function onRowKeyDown(event: React.KeyboardEvent, row: WeekRow) {
    const monday = getDateOfISOWeek(row.weekYear, row.week);
    /* Whole-week model: ALL FOUR arrows move by a week. There is no single-day
       focus in a week picker (WeekField.md, O5). */
    switch (event.key) {
      case "ArrowUp":
      case "ArrowLeft": {
        event.preventDefault();
        const target = new Date(monday);
        target.setDate(monday.getDate() - 7);
        focusWeekOf(target);
        return;
      }
      case "ArrowDown":
      case "ArrowRight": {
        event.preventDefault();
        const target = new Date(monday);
        target.setDate(monday.getDate() + 7);
        focusWeekOf(target);
        return;
      }
      case "PageUp": {
        event.preventDefault();
        const target = new Date(monday);
        target.setMonth(monday.getMonth() - 1);
        focusWeekOf(target);
        return;
      }
      case "PageDown": {
        event.preventDefault();
        const target = new Date(monday);
        target.setMonth(monday.getMonth() + 1);
        focusWeekOf(target);
        return;
      }
      case "Enter":
      case " ":
        event.preventDefault();
        if (!row.disabled) selectWeek(row.weekYear, row.week);
        return;
      default:
    }
  }

  /* ── Segment rendering ──────────────────────────────────────────────────── */

  function segmentProps(type: SegmentType) {
    const value = type === "week" ? week : year;
    const { min, max } = segmentLimits(type);
    const buffered = buffer?.segment === type ? buffer.text : null;
    const placeholder = type === "year" ? "----" : "--";

    /* `aria-valuetext` carries a human label so AT announces "Week 27, 2026"
       rather than a bare "27" (WeekField.md, O1). */
    let valueText: string;
    if (buffered !== null) valueText = buffered;
    else if (value == null) valueText = "--";
    else if (type === "week") valueText = year == null ? `${t.week} ${value}` : `${t.week} ${value}, ${year}`;
    else valueText = week == null ? String(value) : `${t.week} ${week}, ${value}`;

    let text: string;
    if (buffered !== null) text = buffered;
    else if (value == null) text = placeholder;
    else text = type === "week" ? formatSegment(value) : String(value);

    return {
      className: "segment",
      role: "spinbutton" as const,
      "data-segment": type,
      "aria-label": t[type],
      "aria-valuemin": min,
      "aria-valuemax": max,
      "aria-valuenow": value ?? undefined,
      "aria-valuetext": valueText,
      "aria-disabled": disabled ? ("true" as const) : undefined,
      "data-placeholder": value == null && buffered === null ? "true" : undefined,
      "data-focused": focusedSegment === type ? "true" : undefined,
      /* Roving tabindex — never two tab stops. */
      tabIndex: disabled ? -1 : segTab === type ? 0 : -1,
      children: text,
    };
  }

  /* The three handlers stay OUT of `segmentProps`.
     `segmentProps()` is CALLED during render, and `react-hooks/refs` follows the
     call: a closure defined in its body that touches `bufferTimer.current` is
     reported as "passing a ref to a function may read its value during render",
     even though the closure only ever runs from a real DOM event. Hoisting them
     to the component body — referenced from JSX, never invoked during render —
     is the fix the rule is asking for, not a workaround for it. */
  function onSegmentFocus(type: SegmentType) {
    setSegTab(type);
    setFocusedSegment(type);
  }

  function onSegmentBlur(type: SegmentType) {
    setFocusedSegment(null);
    /* Commit a half-typed value on blur — `_flushDigitBuffer()`. */
    if (buffer?.segment === type) {
      const { min, max } = segmentLimits(type);
      flushBuffer();
      setSegmentValue(type, clampValue(Number(buffer.text), min, max), true);
    }
  }

  const monthLabelId = `${id}-monthlabel`;

  return (
    <>
      {/* The label is a SIBLING of the root, as in the reference markup, and
          carries a deterministic id so `.segments` can point `aria-labelledby`
          at it without a `label[for=…]` DOM query. */}
      <label htmlFor={id} id={labelId}>
        {label}
      </label>
      <div
        ref={rootRef}
        className={className ? `WeekField ${className}` : "WeekField"}
        data-component="WeekField"
        data-id={id}
        data-name={name ?? id}
        data-locale={localeProp}
        /* Booleans are `="true"` or ABSENT — `undefined` is React's "absent". */
        data-disabled={disabled ? "true" : undefined}
        data-invalid={invalid ? "true" : undefined}
        data-test-state={testState}
        data-min={minISO}
        data-max={maxISO}
        data-value={defaultValue}
        data-input-mode={inputMode}
        data-open={open ? "true" : undefined}
        data-has-value={hasValue ? "true" : undefined}
        /* The CSS gate that read this is dropped (it clips the popup); the
           ATTRIBUTE stays because the suite waits on it — Findings F-010. React
           renders formed markup, so by hydration it genuinely IS initialised. */
        data-initialized={hydrated ? "true" : undefined}
      >
        <input
          ref={nativeRef}
          className="native"
          type="week"
          id={id}
          name={name ?? id}
          defaultValue={nativeISO}
          min={minISO}
          max={maxISO}
          disabled={disabled}
          required={required || undefined}
          aria-invalid={invalidInput ? "true" : undefined}
          /* In custom mode the native input is the value carrier only, and is
             hidden from everyone (ADR-0006). In display mode it becomes the
             accessible, interactive control. */
          aria-hidden={inputMode === "custom" ? "true" : undefined}
          tabIndex={inputMode === "custom" ? -1 : undefined}
        />

        <div
          className="overlay"
          aria-hidden={inputMode === "display" ? "true" : undefined}
        >
          <div
            className="segments"
            role="group"
            aria-labelledby={labelId}
            /* So AT announces the pair as a week field, not a date field. */
            aria-roledescription={t.weekField}
          >
            {/* No `{" "}` between these. The reference builds them with
                `createElement` + `appendChild`, which produces NO whitespace text
                nodes either — the Handlebars soft-wrap trap that bites segmented
                fields authored in markup does not apply to a JS-built row, and
                adding separators here would be a divergence, not a fix. */}
            <span className="prefix" aria-hidden="true">
              {t.weekAbbrev}
            </span>
            <span
              ref={weekSegRef}
              {...segmentProps("week")}
              onKeyDown={(e) => onSegmentKeyDown(e, "week")}
              onFocus={() => onSegmentFocus("week")}
              onBlur={() => onSegmentBlur("week")}
            />
            <span className="separator" aria-hidden="true">
              /
            </span>
            <span
              ref={yearSegRef}
              {...segmentProps("year")}
              onKeyDown={(e) => onSegmentKeyDown(e, "year")}
              onFocus={() => onSegmentFocus("year")}
              onBlur={() => onSegmentBlur("year")}
            />
          </div>

          <button
            ref={triggerRef}
            type="button"
            className="trigger"
            aria-label={t.openWeekPicker}
            aria-expanded={open}
            aria-haspopup="dialog"
            aria-controls={open ? `${id}-popup` : undefined}
            aria-disabled={disabled ? "true" : undefined}
            disabled={disabled}
            onClick={() => (open ? closePopup(false) : openPopup())}
          >
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
            {open && (
              <div
                ref={popupRef}
                className="popup"
                id={`${id}-popup`}
                role="dialog"
                aria-modal="true"
                aria-label={t.popupLabel}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.preventDefault();
                    closePopup(true);
                  }
                }}
              >
                <div className="calendar-header">
                  <button
                    type="button"
                    className="prev-month"
                    aria-label={t.prevMonth}
                    onClick={() => navigateMonth(-1)}
                  >
                    {"‹"}
                  </button>
                  <span className="calendar-month-year" id={monthLabelId}>
                    {`${getMonthName(view.year, view.month, localeTag)} ${view.year}`}
                  </span>
                  <button
                    type="button"
                    className="next-month"
                    aria-label={t.nextMonth}
                    onClick={() => navigateMonth(1)}
                  >
                    {"›"}
                  </button>
                </div>

                <table className="calendar-grid" role="grid">
                  <thead>
                    <tr role="row">
                      <th scope="col" className="week-number-head" aria-label={t.week}>
                        {t.weekAbbrev}
                      </th>
                      {weekdayNames.map((short, i) => {
                        const anchor = new Date(2024, 0, 1 + i); // 2024-01-01 is a Monday
                        return (
                          <th
                            key={short + i}
                            scope="col"
                            aria-label={new Intl.DateTimeFormat(localeTag, {
                              weekday: "long",
                            }).format(anchor)}
                          >
                            {short}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr
                        key={row.iso}
                        role="row"
                        data-week={row.iso}
                        data-weekyear={row.weekYear}
                        data-weeknum={row.week}
                        data-selected={row.selected ? "true" : undefined}
                        data-disabled={row.disabled ? "true" : undefined}
                        data-preview={previewISO === row.iso ? "true" : undefined}
                        aria-selected={row.selected}
                        aria-disabled={row.disabled ? "true" : undefined}
                        aria-label={row.label}
                        /* The grid is ONE composite tab stop: roving tabindex on
                           the ROW, because the whole week is the selectable unit. */
                        tabIndex={row.iso === rovingISO ? 0 : -1}
                        onClick={() => {
                          if (!row.disabled) selectWeek(row.weekYear, row.week);
                        }}
                        onMouseEnter={() => {
                          if (!row.disabled) setPreviewISO(row.iso);
                        }}
                        onMouseLeave={() => {
                          if (!row.disabled) setPreviewISO(null);
                        }}
                        onKeyDown={(e) => onRowKeyDown(e, row)}
                      >
                        <td
                          role="rowheader"
                          className="week-number-cell"
                          data-weeknum={row.week}
                        >
                          {row.week}
                        </td>
                        {row.days.map((cell, i) => (
                          <td
                            key={i}
                            role="gridcell"
                            data-outside-month={cell.outsideMonth ? "true" : undefined}
                            data-today={cell.isToday ? "true" : undefined}
                          >
                            {cell.day}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="calendar-footer">
                  <button
                    type="button"
                    className="calendar-footer-clear"
                    disabled={!hasValue}
                    onClick={handleClear}
                  >
                    {t.clearButton}
                  </button>
                  <button
                    type="button"
                    className="calendar-footer-now"
                    onClick={handleThisWeek}
                  >
                    {t.thisWeekButton}
                  </button>
                </div>

                <div className="arrow" />
              </div>
            )}
          </div>
        </div>

        <div
          className="announce"
          id={`${id}-announce`}
          aria-live="polite"
          aria-atomic="true"
        >
          {announce}
        </div>
      </div>
    </>
  );
}

export default WeekField;
