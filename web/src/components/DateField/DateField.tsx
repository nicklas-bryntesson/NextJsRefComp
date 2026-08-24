/* DateField — React port of
 * `reference-components/src/partials/components/DateField/DateField.ts` (1179 lines).
 *
 * This is the reference implementation of the popup-field family (TimeField,
 * MonthField, WeekField, DateTimeField follow it), so the notes below are
 * written for the other four porters as much as for a reader of this file.
 *
 * ── What the kernel absorbed ─────────────────────────────────────────────────
 * Every piece of maths is composed, never re-derived (PORTING.md's whole
 * argument for the kernel):
 *   - the month grid, leap years, ISO formatting, segment order → `@/kernel/dates`
 *   - the popover offset / arrow offset / direction            → `@/kernel/popup-position`
 *   - the cyclic Tab trap + wheel-scroll containment           → `@/kernel/popup-interaction`
 *   - the month/year spinner physics                           → `@/kernel/WheelColumn`
 *   - `calc()`/`var()` → px resolution                         → `@/kernel/css-px`
 *   - locale-key collapse                                      → `@/kernel/locale`
 * What is left here is state, wiring and DOM projection.
 *
 * ── `'use client'` is unavoidable ────────────────────────────────────────────
 * ADR-0009's zero-JS end-state route (AffixField) does not apply: this component
 * owns a keyboard model, a popover, a live region, three rect measurements per
 * open and a 60 fps wheel. Only ONE thing is deferred to the client because it
 * genuinely cannot be known on the server — `data-input-mode`, which is
 * `matchMedia('(pointer: coarse)')` (ADR-0006). It is read through
 * `useSyncExternalStore` with an asymmetric server snapshot (`null`), which is
 * both the lint-clean and the faster shape — `useEffect(() => setState(…), [])`
 * is a hard `react-hooks/set-state-in-effect` error and costs a second commit.
 * See CLAUDE.md and `MotionRegion.tsx` / `ScrollArea.tsx`.
 *
 * ── No `<template>`, and that is not optional ────────────────────────────────
 * The contract authors the calendar inside `<template data-template=
 * "datefield-calendar">` and clones it on open. Reproducing that in React is
 * actively WRONG: React's `createElement('template')` appends children as real
 * children of the element instead of into its inert `.content` fragment, so
 * `.popup` would be findable in the DOM while closed and
 * *"calendar does not exist in DOM when closed"* would fail. Conditional
 * rendering into `.rail` is the same end-state by a better mechanism — the
 * template only ever existed to give vanilla JS a clone source (ADR-0009: the
 * contract specifies the DOM, not the computation site).
 *
 * ── The popup stays a descendant of the root ─────────────────────────────────
 * No portal, no top layer. Every rule in the verbatim stylesheet is
 * `.DateField .part` and the suite selects `.popup` / `.grid` / `.arrow`, so a
 * portal breaks the CSS and ADR-0019's `.DateField-popup` escape breaks the
 * selectors. ADR-0012 makes the top-layer escape the consumer's call and we
 * decline it, inheriting the documented ancestor-clipping limitation.
 *
 * ── No entrance animation ────────────────────────────────────────────────────
 * The verbatim CSS has no `transition`/`@keyframes` and none is added. An
 * opacity fade puts popup text below AA for ~150–180 ms and Playwright's
 * auto-wait does not check opacity, so a scoped axe run samples the faded frame.
 * (ToggleTip's stylesheet *does* ship `transition: opacity .15s`, contradicting
 * its own docs — DateField's does not. See findings/DateField.md.)
 *
 * ── Class names are contract ─────────────────────────────────────────────────
 * `.DateField .native .custom .segments .segment .separator .trigger .rail
 * .popup .calendar-header .prev-month .next-month .month-year-trigger .grid
 * .year-month-picker .WheelColumns .Wheel .calendar-footer
 * .calendar-footer-clear .calendar-footer-today .arrow .announce` are all
 * selected by the suite and/or the stylesheet. Preserved verbatim; Tailwind
 * layers alongside in Phase B, never instead (Findings F-008).
 */

"use client";

import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";

import { WheelColumn } from "@/kernel/WheelColumn";
import {
  calculateArrowOffset,
  calculatePopupOffset,
  detectDirection,
  type PopupDirection,
} from "@/kernel/popup-position";
import { trapPopupInteraction } from "@/kernel/popup-interaction";
import {
  clampDayToMonth,
  formatISO,
  getDaysInMonth,
  getFirstWeekdayOfMonth,
  getMonthName,
  getSegmentOrder,
  getWeekdayNames,
  isDayDisabled,
  type DateSegmentType,
} from "@/kernel/dates";
import { resolveLocale } from "@/kernel/locale";
import { resolveCssPx } from "@/kernel/css-px";

/* The wheel visuals are a hard dependency of `WheelColumn` — `Wheel.md` records
   that shipping the JS without the CSS was the original port's
   hardest-to-find bug (unstyled stacked options that also failed contrast). */
import "@/kernel/Wheel.layered.css";
import "./DateField.layered.css";

/* ── Translations ──────────────────────────────────────────────────────────── */
/* Ported from the reference's static table. The `.md` says the authored
   `aria-label="Open calendar"` on `.trigger` is a placeholder to be routed
   through the host's translation system; here the host seam is the `locale`
   prop plus this table. */

interface TranslationStrings {
  day: string;
  month: string;
  year: string;
  openCalendar: string;
  closeCalendar: string;
  prevMonth: string;
  nextMonth: string;
  today: string;
  selected: string;
  notAvailable: string;
  announceSelected: string;
  dateField: string;
  clearButton: string;
  todayButton: string;
  openPicker: string;
  closePicker: string;
}

const TRANSLATIONS: Record<string, TranslationStrings> = {
  en: {
    day: "Day", month: "Month", year: "Year",
    openCalendar: "Open calendar", closeCalendar: "Close calendar",
    prevMonth: "Previous month", nextMonth: "Next month",
    today: "today", selected: "selected", notAvailable: "not available",
    announceSelected: "Selected date:", dateField: "date field",
    clearButton: "Clear", todayButton: "Today",
    openPicker: "Choose month and year", closePicker: "Close month and year picker",
  },
  sv: {
    day: "Dag", month: "Månad", year: "År",
    openCalendar: "Öppna kalender", closeCalendar: "Stäng kalender",
    prevMonth: "Föregående månad", nextMonth: "Nästa månad",
    today: "idag", selected: "valt", notAvailable: "ej tillgängligt",
    announceSelected: "Valt datum:", dateField: "datumfält",
    clearButton: "Rensa", todayButton: "I dag",
    openPicker: "Välj månad och år", closePicker: "Stäng månads- och årsväljaren",
  },
};

const PLACEHOLDER: Record<DateSegmentType, string> = {
  day: "dd",
  month: "mm",
  year: "yyyy",
};

const DEFAULT_MIN_YEAR = 1900;
const DEFAULT_MAX_YEAR = 2100;

/* Only ever used as the `year` argument to `getMonthName`, which ignores it —
   a fixed value keeps the SSR and hydration renders byte-identical where the
   reference would have read `new Date().getFullYear()`. */
const MONTH_NAME_ANCHOR_YEAR = 2024;

/* ── Pure helpers (module scope — no ref reads, no component state) ─────────── */

type SegValues = { day: number | null; month: number | null; year: number | null };

const EMPTY_SEGMENTS: SegValues = { day: null, month: null, year: null };

function parseISODate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isNaN(d.getTime()) ? null : d;
}

function segmentsFromISO(iso: string): SegValues {
  const d = parseISODate(iso);
  if (!d) return EMPTY_SEGMENTS;
  return { day: d.getDate(), month: d.getMonth() + 1, year: d.getFullYear() };
}

function segmentLimits(
  type: DateSegmentType,
  seg: SegValues,
  minYear: number,
  maxYear: number,
): { min: number; max: number } {
  if (type === "month") return { min: 1, max: 12 };
  if (type === "year") return { min: minYear, max: maxYear };
  const year = seg.year ?? new Date().getFullYear();
  const max = seg.month != null ? getDaysInMonth(year, seg.month - 1) : 31;
  return { min: 1, max };
}

/**
 * Set one segment, clamping the day to the resulting month's length.
 *
 * [PORT FIX] The reference clamps only when the MONTH changes
 * (`_setSegmentValue`, the `type === 'month'` branch). Changing the YEAR from a
 * leap year to a common one with 29 February selected leaves the segments
 * reading `29/02/2025` while `_trySyncToNative` writes `2025-03-01` to the
 * native input, because `new Date(2025, 1, 29)` rolls over. Clamping on both
 * axes is the same rule applied consistently. Recorded in findings/DateField.md.
 */
function withSegment(prev: SegValues, type: DateSegmentType, value: number): SegValues {
  const next: SegValues = { ...prev, [type]: value };
  if ((type === "month" || type === "year") && next.day != null && next.month != null) {
    const dim = getDaysInMonth(next.year ?? new Date().getFullYear(), next.month - 1);
    if (next.day > dim) next.day = dim;
  }
  return next;
}

type DayCell = {
  iso: string;
  date: Date;
  label: number;
  outside: boolean;
  isToday: boolean;
  isSelected: boolean;
  isDisabled: boolean;
};

/** Port of `_renderMonth()`'s cell loop, as a pure function. */
function buildMonth(
  year: number,
  month: number,
  min: Date | null,
  max: Date | null,
  todayISO: string,
  selectedISO: string,
): DayCell[][] {
  const firstDay = getFirstWeekdayOfMonth(year, month);
  const daysInMonth = getDaysInMonth(year, month);

  const prevYear = month === 0 ? year - 1 : year;
  const prevMonth = month === 0 ? 11 : month - 1;
  const prevMonthDays = getDaysInMonth(prevYear, prevMonth);

  const nextYear = month === 11 ? year + 1 : year;
  const nextMonth = month === 11 ? 0 : month + 1;

  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;
  const weeks: DayCell[][] = [];
  let row: DayCell[] = [];
  let dayCount = 1;
  let nextMonthDay = 1;

  for (let i = 0; i < totalCells; i++) {
    if (i > 0 && i % 7 === 0) {
      weeks.push(row);
      row = [];
    }
    let date: Date;
    let outside = false;
    if (i < firstDay) {
      date = new Date(prevYear, prevMonth, prevMonthDays - firstDay + i + 1);
      outside = true;
    } else if (dayCount <= daysInMonth) {
      date = new Date(year, month, dayCount++);
    } else {
      date = new Date(nextYear, nextMonth, nextMonthDay++);
      outside = true;
    }
    const iso = formatISO(date);
    row.push({
      iso,
      date,
      label: date.getDate(),
      outside,
      isToday: iso === todayISO,
      isSelected: selectedISO !== "" && iso === selectedISO,
      isDisabled: isDayDisabled(date, min, max),
    });
  }
  weeks.push(row);
  return weeks;
}

/**
 * Port of `_updateRovingTabindex()` / `_moveFocusIntoCalendar()`, which share one
 * rule: the roving cell is the selected day, else today (only when enabled),
 * else the first in-month enabled day. Never an outside-month or disabled cell.
 */
function defaultRovingISO(weeks: DayCell[][], todayISO: string): string | null {
  const cells = weeks.flat();
  const selected = cells.find((c) => c.isSelected);
  if (selected) return selected.iso;
  const today = cells.find((c) => c.iso === todayISO && !c.isDisabled);
  if (today) return today.iso;
  const first = cells.find((c) => !c.outside && !c.isDisabled);
  return first ? first.iso : null;
}

/* ── `data-input-mode` store (ADR-0006) ────────────────────────────────────── */
/* The server cannot know the pointer type, so its snapshot is `null` — which is
   also the reference's pre-init state (no `data-input-mode` attribute, `.custom`
   still `aria-hidden` and `display: none`). One honest unknown instead of a
   guess, and it doubles as the `data-initialized` gate.
   Divergence worth noting: the reference reads `matchMedia` ONCE at init; this
   subscribes, so a hybrid device that switches pointer type re-resolves. */

const COARSE_QUERY = "(pointer: coarse)";
type InputMode = "custom" | "display";

function subscribeInputMode(onChange: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => {};
  }
  const mq = window.matchMedia(COARSE_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function getInputModeSnapshot(): InputMode {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "custom";
  }
  return window.matchMedia(COARSE_QUERY).matches ? "display" : "custom";
}

function getInputModeServerSnapshot(): null {
  return null;
}

/* ── Props ─────────────────────────────────────────────────────────────────── */

export type DateFieldProps = {
  /** `data-id`, the native input's `id`, and the e2e anchor. Must be unique. */
  id: string;
  /** Visible label. Rendered as the `<label for>` the contract requires. */
  label: ReactNode;
  /** `name` on the native input. Defaults to `id`, as the reference demos do. */
  name?: string;
  /** BCP 47 tag → `data-locale`. Drives segment order and calendar language. */
  locale?: string;
  /** ISO `YYYY-MM-DD`. */
  min?: string;
  /** ISO `YYYY-MM-DD`. */
  max?: string;
  /** Pre-filled value, `YYYY-MM-DD` — the native input's `value` attribute. */
  defaultValue?: string;
  disabled?: boolean;
  /** `data-invalid="true"` + `aria-invalid` on the native input. Never set by JS. */
  invalid?: boolean;
  required?: boolean;
  /** Kitchensink / visual-test only — simulates a CSS pseudo-state. */
  testState?: "hover" | "focus" | "active";
  /** `data-label-field` — fallback `aria-label` for `.segments`. */
  labelField?: string;
  /** Utilities layered ALONGSIDE the structural classes (Phase B seam, F-008). */
  className?: string;
};

/* ── Component ─────────────────────────────────────────────────────────────── */

export function DateField({
  id,
  label,
  name = id,
  locale: localeTagProp = "en",
  min: minAttr,
  max: maxAttr,
  defaultValue = "",
  disabled = false,
  invalid = false,
  required = false,
  testState,
  labelField,
  className,
}: DateFieldProps) {
  /* Two locales off one attribute, and they are NOT interchangeable (upstream
     3c7df5b, F-041):
       - `localeTag` — the raw tag as authored. Everything `Intl` touches gets
         this: segment order, month names, weekday names, date labels.
       - `locale`    — the COLLAPSED translation key (`de-DE` → `en`, because no
         `de` bundle exists). It indexes our own strings and nothing else.
     Falling back to English for a string we wrote is correct; falling back to
     English for a name ICU already knows is the bug F-041 measured. */
  const localeTag = localeTagProp;
  const locale = resolveLocale(localeTag, TRANSLATIONS);
  const t = TRANSLATIONS[locale] ?? TRANSLATIONS.en;

  const min = minAttr ? parseISODate(minAttr) : null;
  const max = maxAttr ? parseISODate(maxAttr) : null;
  const minYear = min ? min.getFullYear() : DEFAULT_MIN_YEAR;
  const maxYear = max ? max.getFullYear() : DEFAULT_MAX_YEAR;

  const { order, separator } = getSegmentOrder(localeTag);

  const labelId = `${id}-label`;
  const announceId = `${id}-announce`;
  const dialogId = `${id}-calendar`;
  const monthTriggerId = `${id}-month`;
  const pickerId = `${id}-picker`;

  /* ── DOM refs ───────────────────────────────────────────────────────────── */
  const rootRef = useRef<HTMLDivElement | null>(null);
  const nativeRef = useRef<HTMLInputElement | null>(null);
  const railRef = useRef<HTMLDivElement | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const monthTriggerRef = useRef<HTMLButtonElement | null>(null);
  const segRefs = useRef<Partial<Record<DateSegmentType, HTMLSpanElement | null>>>({});
  const monthWheelRef = useRef<HTMLDivElement | null>(null);
  const yearWheelRef = useRef<HTMLDivElement | null>(null);
  const wheelsRef = useRef<{ month: WheelColumn; year: WheelColumn } | null>(null);
  const rafRef = useRef<number | null>(null);
  const digitBufferRef = useRef("");
  const digitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pickerEntryRef = useRef({ y: 0, m: 0 });

  /* ── State ──────────────────────────────────────────────────────────────── */

  /* `data-input-mode` — and, because it is the only client-only fact, also the
     `data-initialized` signal. */
  const inputMode = useSyncExternalStore(
    subscribeInputMode,
    getInputModeSnapshot,
    getInputModeServerSnapshot,
  );
  const initialized = inputMode !== null;

  /* The native input's value is the single source of truth for "the committed
     date" — the reference keeps a parallel `selectedDate` field and they can
     drift. `selected` is derived, so they cannot. */
  const [nativeValue, setNativeValue] = useState(defaultValue);
  const selected = parseISODate(nativeValue);
  const selectedISO = selected ? formatISO(selected) : "";

  const [segValues, setSegValues] = useState<SegValues>(() => segmentsFromISO(defaultValue));
  const [activeSeg, setActiveSeg] = useState<DateSegmentType>(order[0]);
  const [focusedSeg, setFocusedSeg] = useState<DateSegmentType | null>(null);
  const [digitDisplay, setDigitDisplay] = useState<{ seg: DateSegmentType; text: string } | null>(null);
  const [announceText, setAnnounceText] = useState("");

  const [open, setOpen] = useState(false);
  const [everOpened, setEverOpened] = useState(false);
  const [direction, setDirection] = useState<PopupDirection | null>(null);
  const [panel, setPanel] = useState<"calendar" | "picker">("calendar");
  const [displayed, setDisplayed] = useState({ y: 0, m: 0 });
  /* `iso` drives the grid's roving tabindex; bumping `focus` asks the effect
     below to move DOM focus there. Two separate concerns — `.prev-month` resets
     the roving cell WITHOUT stealing focus off itself. */
  const [roving, setRoving] = useState<{ iso: string | null; focus: number }>({ iso: null, focus: 0 });

  /* Latest-value mirrors for the two things a `WheelColumn` callback reads after
     its constructing render is gone. Written from an effect, never during
     render. */
  const displayedRef = useRef(displayed);
  const nativeValueRef = useRef(nativeValue);
  useEffect(() => {
    displayedRef.current = displayed;
  }, [displayed]);
  useEffect(() => {
    nativeValueRef.current = nativeValue;
  }, [nativeValue]);

  /* ── Derived calendar model ─────────────────────────────────────────────── */
  /* Computed during render, only reached while the popup is mounted (client
     only), so `new Date()` here cannot cause a hydration mismatch. */
  const todayISO = open ? formatISO(new Date()) : "";
  const weeks = open ? buildMonth(displayed.y, displayed.m, min, max, todayISO, selectedISO) : [];
  const rovingISO = open
    ? (roving.iso && weeks.flat().some((c) => c.iso === roving.iso)
        ? roving.iso
        : defaultRovingISO(weeks, todayISO))
    : null;

  /* ── Value commit ───────────────────────────────────────────────────────── */

  const announceFor = (d: Date) =>
    `${t.announceSelected} ${d.toLocaleDateString(localeTag, { dateStyle: "long" })}`;

  /** Port of `_applyDate()` — calendar / wheel commit. */
  const applyDate = (d: Date) => {
    setNativeValue(formatISO(d));
    setSegValues({ day: d.getDate(), month: d.getMonth() + 1, year: d.getFullYear() });
    setAnnounceText(announceFor(d));
  };

  /** Port of `_setSegmentValue()` + `_trySyncToNative()` — segment commit. */
  const commitSegment = (type: DateSegmentType, value: number) => {
    const next = withSegment(segValues, type, value);
    setSegValues(next);
    if (next.day == null || next.month == null || next.year == null) return;
    const d = new Date(next.year, next.month - 1, next.day);
    if (isNaN(d.getTime())) return;
    if (min && d < min) return;
    if (max && d > max) return;
    setNativeValue(formatISO(d));
    setAnnounceText(announceFor(d));
  };

  const clearAll = () => {
    setNativeValue("");
    setSegValues(EMPTY_SEGMENTS);
    setAnnounceText("");
  };

  /* The native input stays UNCONTROLLED (`defaultValue`), because the contract
     needs a native `change` event on it and React's synthetic `onChange` is not
     that. This effect is the reference's `input.value = …; dispatchEvent(new
     Event('change'))`, expressed once. */
  useEffect(() => {
    const input = nativeRef.current;
    if (!input || input.value === nativeValue) return;
    input.value = nativeValue;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, [nativeValue]);

  /* Inbound native `change` — the display-mode path (the platform picker writes
     the input directly) and any host code that sets `.value` and dispatches.
     A NATIVE listener, not `onChange`: React's synthetic change is deduplicated
     against its own value tracker and never fires for an external
     `dispatchEvent(new Event('change'))`. Our own write above lands here too and
     is idempotent — it only ever runs on a complete, already-mirrored date. */
  useEffect(() => {
    const input = nativeRef.current;
    if (!input || disabled) return;

    const onNativeChange = () => {
      const v = input.value;
      setNativeValue(v);
      setSegValues(segmentsFromISO(v));
    };
    /* [PORT FIX] The reference's `reset` handler clears the segments while the
       browser restores the input's `value` attribute immediately after the
       event, leaving the two disagreeing. Reading the input on the next tick
       keeps them in sync whatever the form restores. */
    const onReset = () => {
      setTimeout(() => {
        const v = input.value;
        setNativeValue(v);
        setSegValues(segmentsFromISO(v));
        setAnnounceText("");
      }, 0);
    };

    const form = input.form;
    input.addEventListener("change", onNativeChange);
    form?.addEventListener("reset", onReset);
    return () => {
      input.removeEventListener("change", onNativeChange);
      form?.removeEventListener("reset", onReset);
    };
  }, [disabled]);

  /* ── Segment keyboard ───────────────────────────────────────────────────── */

  const flushDigitBuffer = (type: DateSegmentType) => {
    const buffer = digitBufferRef.current;
    if (!buffer) return;
    if (digitTimerRef.current) clearTimeout(digitTimerRef.current);
    digitTimerRef.current = null;
    digitBufferRef.current = "";
    setDigitDisplay(null);
    const num = Number(buffer);
    if (type === "year" && buffer.length < 4) {
      setSegValues((prev) => ({ ...prev, year: null }));
      return;
    }
    const { min: lo, max: hi } = segmentLimits(type, segValues, minYear, maxYear);
    commitSegment(type, Math.max(lo, Math.min(hi, num)));
  };

  const focusSegment = (type: DateSegmentType) => {
    setActiveSeg(type);
    segRefs.current[type]?.focus();
  };

  const moveSegment = (from: DateSegmentType, delta: number) => {
    const i = order.indexOf(from);
    const next = order[i + delta];
    if (next) focusSegment(next);
  };

  const handleDigit = (type: DateSegmentType, digit: string) => {
    if (digitTimerRef.current) clearTimeout(digitTimerRef.current);
    digitTimerRef.current = null;

    const buffer = digitBufferRef.current + digit;
    digitBufferRef.current = buffer;
    setDigitDisplay({ seg: type, text: buffer });

    const num = Number(buffer);
    const { min: lo, max: hi } = segmentLimits(type, segValues, minYear, maxYear);

    const commit = (v: number) => {
      digitBufferRef.current = "";
      setDigitDisplay(null);
      commitSegment(type, v);
      moveSegment(type, 1);
    };

    if (type === "year") {
      if (buffer.length === 4) commit(Math.max(lo, Math.min(hi, num)));
      return;
    }
    if (buffer.length === 2) {
      /* In range: commit and advance. Out of range: keep the buffer on screen
         and let blur correct it — the reference's behaviour exactly. */
      if (num >= lo && num <= hi) commit(num);
      return;
    }
    /* Single digit: never fast-advance — the user may be about to type a
       second one. One second, then commit. */
    digitTimerRef.current = setTimeout(() => {
      digitTimerRef.current = null;
      commit(Math.max(lo, Math.min(hi, num)));
    }, 1000);
  };

  const onSegmentKeyDown = (e: ReactKeyboardEvent<HTMLSpanElement>, type: DateSegmentType) => {
    if (disabled) return;
    const { min: lo, max: hi } = segmentLimits(type, segValues, minYear, maxYear);

    switch (e.key) {
      case "ArrowUp":
      case "ArrowDown": {
        e.preventDefault();
        const delta = e.key === "ArrowUp" ? 1 : -1;
        const current = segValues[type];
        const start = current ?? (delta > 0 ? lo - 1 : hi + 1);
        let next = start + delta;
        if (next > hi) next = lo;
        if (next < lo) next = hi;
        commitSegment(type, next);
        break;
      }
      case "ArrowLeft":
        e.preventDefault();
        moveSegment(type, -1);
        break;
      case "ArrowRight":
        e.preventDefault();
        moveSegment(type, 1);
        break;
      case "Backspace": {
        e.preventDefault();
        if (digitTimerRef.current) clearTimeout(digitTimerRef.current);
        digitTimerRef.current = null;
        digitBufferRef.current = "";
        setDigitDisplay(null);
        setSegValues((prev) => ({ ...prev, [type]: null }));
        moveSegment(type, -1);
        break;
      }
      case "Escape":
        if (open) {
          e.preventDefault();
          closeCalendar(true);
        }
        break;
      default:
        if (e.key >= "0" && e.key <= "9" && e.key.length === 1) {
          e.preventDefault();
          handleDigit(type, e.key);
        }
    }
  };

  /* ── Calendar lifecycle ─────────────────────────────────────────────────── */

  const openCalendar = () => {
    const base = selected ?? new Date();
    const y = base.getFullYear();
    const m = base.getMonth();
    const today = formatISO(new Date());
    const weeksNow = buildMonth(y, m, min, max, today, selectedISO);

    /* Direction is measured BEFORE the open render so the popup never paints on
       the wrong side of the trigger. */
    const trigger = triggerRef.current;
    if (trigger) setDirection(detectDirection(trigger.getBoundingClientRect(), window.innerHeight));

    setDisplayed({ y, m });
    setPanel("calendar");
    setRoving({ iso: defaultRovingISO(weeksNow, today), focus: 1 });
    setEverOpened(true);
    setOpen(true);
  };

  /** ADR-0007: `refocusTrigger` is false ONLY on pointer light-dismiss. */
  const closeCalendar = (refocusTrigger: boolean) => {
    setOpen(false);
    setPanel("calendar");
    setRoving({ iso: null, focus: 0 });
    if (refocusTrigger) triggerRef.current?.focus();
  };

  const toggleCalendar = () => {
    if (open) closeCalendar(true);
    else openCalendar();
  };

  /** Port of `_navigateMonth()` — which also COMMITS a date. Kept verbatim. */
  const navigateMonth = (delta: number) => {
    let y = displayed.y;
    let m = displayed.m + delta;
    if (m > 11) { m = 0; y++; }
    if (m < 0) { m = 11; y--; }
    const refDay = selected ? selected.getDate() : new Date().getDate();
    const applied = new Date(y, m, clampDayToMonth(y, m, refDay));
    setDisplayed({ y, m });
    applyDate(applied);
    /* Reset the roving cell to the new month's default, but do NOT move focus —
       it must stay on the prev/next button the user just pressed. */
    setRoving((r) => ({ iso: formatISO(applied), focus: r.focus }));
  };

  /* Port of the picker's `applyPickerDate`. Reads only refs and setters, so the
     copy a `WheelColumn` closure captured is never stale. */
  const applyPickerDate = (y: number, m: number) => {
    const current = parseISODate(nativeValueRef.current);
    const refDay = current ? current.getDate() : new Date().getDate();
    const applied = new Date(y, m, clampDayToMonth(y, m, refDay));
    setDisplayed({ y, m });
    applyDate(applied);
    setRoving((r) => ({ iso: formatISO(applied), focus: r.focus }));
  };

  const openPicker = () => {
    pickerEntryRef.current = { y: displayed.y, m: displayed.m };
    setPanel("picker");
  };

  const closePicker = () => {
    setPanel("calendar");
    monthTriggerRef.current?.focus();
  };

  const selectDate = (cell: DayCell) => {
    if (cell.isDisabled) return;
    if (cell.outside) setDisplayed({ y: cell.date.getFullYear(), m: cell.date.getMonth() });
    applyDate(cell.date);
    closeCalendar(true);
  };

  /* ── Calendar keyboard (grid arrow nav, PageUp/Down, Escape) ─────────────── */

  const focusCalendarDate = (target: Date) => {
    const y = target.getFullYear();
    const m = target.getMonth();
    if (y !== displayed.y || m !== displayed.m) setDisplayed({ y, m });
    setRoving((r) => ({ iso: formatISO(target), focus: r.focus + 1 }));
  };

  const onPopupKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    /* Tab (both panels) and `wheel` belong to the shared kernel trap. */
    if (panel === "picker") {
      if (e.key === "Escape") {
        /* Two-step Escape: cancel the picker back to the month/year it opened
           on and stay in the dialog. A second Escape closes the calendar. */
        e.preventDefault();
        setDisplayed(pickerEntryRef.current);
        closePicker();
      }
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      closeCalendar(true);
      return;
    }

    /* Arrow / Home / End / PageUp / PageDown act on whatever day cell actually
       has DOM focus — read from the DOM, not from `roving`, because the suite
       focuses a cell directly (`days.nth(1).focus()`) without going through us
       (ADR-0009: the contract is the DOM). */
    const focusedISO = popupRef.current
      ?.querySelector<HTMLButtonElement>(".calendar-grid td button:focus")
      ?.dataset.date;
    if (!focusedISO) return;
    const from = parseISODate(focusedISO);
    if (!from) return;

    const arrowDelta: Record<string, number> = {
      ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7,
    };
    const target = new Date(from.getFullYear(), from.getMonth(), from.getDate());

    if (arrowDelta[e.key] !== undefined) {
      e.preventDefault();
      target.setDate(target.getDate() + arrowDelta[e.key]);
      focusCalendarDate(target);
    } else if (e.ctrlKey && e.key === "Home") {
      e.preventDefault();
      focusCalendarDate(new Date(displayed.y, displayed.m, 1));
    } else if (e.ctrlKey && e.key === "End") {
      e.preventDefault();
      focusCalendarDate(new Date(displayed.y, displayed.m, getDaysInMonth(displayed.y, displayed.m)));
    } else if (e.key === "Home") {
      e.preventDefault();
      target.setDate(target.getDate() - ((target.getDay() + 6) % 7));
      focusCalendarDate(target);
    } else if (e.key === "End") {
      e.preventDefault();
      target.setDate(target.getDate() + (6 - ((target.getDay() + 6) % 7)));
      focusCalendarDate(target);
    } else if (e.key === "PageUp" || e.key === "PageDown") {
      e.preventDefault();
      let y = displayed.y;
      let m = displayed.m + (e.key === "PageDown" ? 1 : -1);
      if (m > 11) { m = 0; y++; }
      if (m < 0) { m = 11; y--; }
      setDisplayed({ y, m });
      setRoving((r) => ({
        iso: formatISO(new Date(y, m, clampDayToMonth(y, m, from.getDate()))),
        focus: r.focus + 1,
      }));
    } else if (e.key === "Enter" || e.key === " ") {
      const cell = weeks.flat().find((c) => c.iso === focusedISO);
      if (cell && !cell.isDisabled) {
        e.preventDefault();
        selectDate(cell);
      }
    }
  };

  /* ── Effects: focus, trap, light dismiss, layout, wheels ─────────────────── */

  /* Move DOM focus onto the roving cell whenever `roving.focus` is bumped. Not
     keyed on `rovingISO`, because `.prev-month` changes the roving cell without
     wanting focus. */
  useEffect(() => {
    if (!open || roving.focus === 0 || !rovingISO) return;
    popupRef.current
      ?.querySelector<HTMLButtonElement>(`.calendar-grid td button[data-date="${rovingISO}"]`)
      ?.focus();
    /* `rovingISO` is deliberately read as the value from the render that bumped
       `focus`; adding it to the deps would re-steal focus every time the default
       roving cell changes — e.g. `.prev-month`, which must keep focus itself. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, roving.focus]);

  /* Shared popup hygiene: cyclic Tab trap over the active panel's stops, plus
     wheel-scroll containment. Both listeners die with the AbortController. */
  useEffect(() => {
    if (!open) return;
    const popup = popupRef.current;
    if (!popup) return;
    const controller = new AbortController();
    trapPopupInteraction({
      container: popup,
      tabStops: () => calendarTabStops(popup),
      signal: controller.signal,
    });
    return () => controller.abort();
  }, [open]);

  /* Pointer light dismiss. A document listener — "outside" is by definition not
     in this subtree, so a React handler cannot see it. Armed on the next tick so
     the click that opened the popup does not immediately close it. Per ADR-0007
     this path closes and does NOTHING else: no `trigger.focus()`. */
  useEffect(() => {
    if (!open) return;
    let onDocumentClick: ((e: MouseEvent) => void) | null = null;
    const arm = setTimeout(() => {
      onDocumentClick = (e: MouseEvent) => {
        const root = rootRef.current;
        if (root && !root.contains(e.target as Node)) closeCalendar(false);
      };
      document.addEventListener("click", onDocumentClick);
    }, 0);
    return () => {
      clearTimeout(arm);
      if (onDocumentClick) document.removeEventListener("click", onDocumentClick);
    };
  }, [open]);

  /* Port of `_updateLayout()`. A LAYOUT effect so the offsets land before paint;
     otherwise the first frame shows the popup at the CSS `50%` default.
     Viewport dimensions are passed EXPLICITLY — `popup-position` keeps
     `= window.innerWidth` defaults for fidelity and they are not SSR-safe. */
  useLayoutEffect(() => {
    if (!open) return;
    const root = rootRef.current;
    const rail = railRef.current;
    const popup = popupRef.current;
    const trigger = triggerRef.current;
    if (!root || !rail || !popup || !trigger) return;

    const triggerRect = trigger.getBoundingClientRect();
    const containerRect = rail.getBoundingClientRect();
    const calendarWidth = popup.getBoundingClientRect().width;
    if (!containerRect.width || !calendarWidth) return;

    setDirection(detectDirection(triggerRect, window.innerHeight));

    const triggerCenterX = triggerRect.left + triggerRect.width / 2;
    /* The contract: the popup stays at least half `--SITE--PADDING` from each
       viewport edge. */
    const viewportInset = resolveCssPx(root, "--_df-site-padding") / 2;

    const offset = calculatePopupOffset(
      triggerCenterX,
      containerRect.left,
      containerRect.width,
      calendarWidth,
      window.innerWidth,
      viewportInset,
    );
    root.style.setProperty("--_df-popup-offset", `${offset}%`);

    /* That offset has not reached layout yet, so the popup's left edge is
       computed arithmetically rather than re-measured — as the reference does. */
    const calendarLeft =
      containerRect.left + (offset / 100) * containerRect.width - calendarWidth / 2;
    const arrowOffset = calculateArrowOffset(
      triggerCenterX,
      calendarLeft,
      calendarWidth,
      resolveCssPx(root, "--_df-arrow-corner-radius"),
      resolveCssPx(root, "--_df-arrow-size"),
    );
    root.style.setProperty("--_df-arrow-offset", `${arrowOffset}px`);
  }, [open, panel, direction]);

  /* window resize — rAF-coalesced, as the reference does it. */
  useEffect(() => {
    if (!open) return;
    const onResize = () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const trigger = triggerRef.current;
        if (trigger) {
          setDirection(detectDirection(trigger.getBoundingClientRect(), window.innerHeight));
        }
      });
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [open]);

  /* The month/year wheels. Fresh instances per picker open, exactly as the
     reference rebuilds them — `WheelColumn` owns a rAF physics loop and ~9 DOM
     nodes it mutates per frame, which is precisely the work React should not be
     doing (see the kernel module's own header). Deps are ONLY `open`/`panel`:
     everything else the callbacks need comes through refs or setters, so
     spinning a wheel never re-creates it. */
  useEffect(() => {
    if (!open || panel !== "picker") return;
    const monthHost = monthWheelRef.current;
    const yearHost = yearWheelRef.current;
    if (!monthHost || !yearHost) return;

    const month = new WheelColumn(monthHost, {
      min: 0,
      max: 11,
      value: displayedRef.current.m,
      loop: true,
      format: (v) => getMonthName(displayedRef.current.y, v, localeTag),
      onChange: (m) => applyPickerDate(displayedRef.current.y, m),
    });
    const year = new WheelColumn(yearHost, {
      min: minYear,
      max: maxYear,
      value: displayedRef.current.y,
      loop: false,
      format: (v) => String(v),
      onChange: (y) => applyPickerDate(y, displayedRef.current.m),
    });
    wheelsRef.current = { month, year };
    monthHost.focus();

    return () => {
      month.destroy();
      year.destroy();
      wheelsRef.current = null;
      /* WheelColumn injected `.cylinder` / `.option` / `.band` imperatively, so
         React does not know about them and will not clean them up. */
      monthHost.replaceChildren();
      yearHost.replaceChildren();
    };
    /* The wheels must be constructed ONCE per picker open, not per state change:
       `applyPickerDate` reads only refs and setters, so the copy captured here
       never goes stale, and `locale`/`minYear`/`maxYear` come from props that do
       not change for the life of a field. Adding them would rebuild — and so
       reset — a wheel mid-spin. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, panel]);

  useEffect(() => {
    return () => {
      if (digitTimerRef.current) clearTimeout(digitTimerRef.current);
    };
  }, []);

  /* ── Render helpers ─────────────────────────────────────────────────────── */

  const segmentText = (type: DateSegmentType): string => {
    if (digitDisplay?.seg === type) return digitDisplay.text;
    const v = segValues[type];
    if (v == null) return PLACEHOLDER[type];
    return type === "year" ? String(v) : String(v).padStart(2, "0");
  };

  const segmentValueText = (type: DateSegmentType): string => {
    if (digitDisplay?.seg === type) return digitDisplay.text;
    const v = segValues[type];
    if (v == null) return PLACEHOLDER[type];
    if (type === "month") {
      return getMonthName(segValues.year ?? MONTH_NAME_ANCHOR_YEAR, v - 1, localeTag);
    }
    return String(v);
  };

  const weekdayShort = open ? getWeekdayNames(localeTag) : [];
  const weekdayLong = open
    ? Array.from({ length: 7 }, (_, i) => {
        const anchor = new Date(2024, 0, 1 + i);
        return new Intl.DateTimeFormat(localeTag, { weekday: "long" }).format(anchor);
      })
    : [];

  const todayDisabled = isDayDisabled(new Date(), min, max);
  const monthLabel = open ? `${getMonthName(displayed.y, displayed.m, localeTag)} ${displayed.y}` : "";

  /* ── Markup ─────────────────────────────────────────────────────────────── */

  return (
    <>
      {/* The contract puts the label OUTSIDE the root, and the reference JS
          hunts for `label[for=<id>]` to build `aria-labelledby`. Rendering it
          from the component makes that link a render-time fact instead of a
          post-hydration DOM query — same end-state, no effect, no window in
          which `.segments` is unlabelled. */}
      <label id={labelId} htmlFor={id}>
        {label}
      </label>
      <div
        ref={rootRef}
        className={className ? `DateField ${className}` : "DateField"}
        data-component="DateField"
        data-id={id}
        data-name={name}
        data-locale={localeTag}
        data-min={minAttr}
        data-max={maxAttr}
        data-disabled={disabled ? "true" : undefined}
        data-invalid={invalid ? "true" : undefined}
        data-test-state={testState}
        /* Rendered markup is formed from first paint, so this is true on
           arrival. The CSS gate that read it is dropped (it clips the popup);
           the ATTRIBUTE stays because the suite and `target.js` use it as a
           test target — Findings F-010. */
        data-initialized={initialized ? "true" : undefined}
        data-input-mode={inputMode ?? undefined}
        data-state={open ? "open" : everOpened ? "idle" : undefined}
        data-direction={direction ?? undefined}
      >
        <input
          ref={nativeRef}
          className="native"
          type="date"
          id={id}
          name={name}
          min={minAttr}
          max={maxAttr}
          defaultValue={defaultValue}
          disabled={disabled}
          required={required}
          aria-invalid={invalid ? "true" : undefined}
          /* PRE-HYDRATION HEIGHT RESERVATION — ADR-0008 applied to the state
             the ADR does not cover. Before the input-mode store resolves there
             is no `data-input-mode`, so the stylesheet's default branch paints
             THIS input as the control. Functionally correct (F-046: the native
             control is fully usable pre-hydration) but the WRONG BOX — a native
             date/month input paints well under the 2.5rem the custom layer that
             replaces it is guaranteed, so every instance jumps on hydration.
             That is Cumulative Layout Shift, and on a shared page it also moves
             other components' click targets out from under Playwright's aim
             mid-gesture (F-049). Measured before this: 96px of document shift across 17 instances, CLS 0.031.
             Reading the token rather than hardcoding `2.5rem` tracks what the
             verbatim stylesheet already declares. Dropped once the mode
             resolves; from then on the custom layer owns the box. */
          style={
            inputMode === null
              ? { minBlockSize: "var(--_df-field-min-block-size)" }
              : undefined
          }
        />

        {/* `aria-hidden` is authored `"true"` and removed in custom mode — the
            segments become the accessible control there and the native input is
            hidden from everyone (ADR-0006). Before hydration `inputMode` is
            `null`, so the layer stays hidden AND `display: none`, which is
            exactly the reference's pre-init state. */}
        <div className="custom" aria-hidden={inputMode === "custom" ? undefined : "true"}>
          <div
            className="segments"
            role="group"
            aria-labelledby={labelField ? undefined : labelId}
            aria-label={labelField}
            aria-roledescription={t.dateField}
          >
            {order.map((type, i) => {
              const limits = segmentLimits(type, segValues, minYear, maxYear);
              const value = segValues[type];
              const isBuffering = digitDisplay?.seg === type;
              return (
                <Fragment key={type}>
                  <span
                    ref={(el) => {
                      segRefs.current[type] = el;
                    }}
                    className="segment"
                    role="spinbutton"
                    aria-label={t[type]}
                    data-segment={type}
                    /* Absent, not `="false"` — placeholder is the library's
                       boolean convention (CLAUDE.md). The suite asserts
                       `aria-valuenow` is NULL in the placeholder state, which
                       is why a buffered digit must not commit a value. */
                    data-placeholder={value == null ? "true" : undefined}
                    data-focused={focusedSeg === type ? "true" : undefined}
                    tabIndex={disabled ? -1 : activeSeg === type ? 0 : -1}
                    aria-disabled={disabled ? "true" : undefined}
                    aria-valuemin={limits.min}
                    aria-valuemax={limits.max}
                    aria-valuenow={value ?? undefined}
                    aria-valuetext={segmentValueText(type)}
                    onKeyDown={(e) => onSegmentKeyDown(e, type)}
                    onFocus={() => {
                      /* `_setSegmentFocused` closes the calendar — light
                         dismiss, so no refocus (ADR-0007). */
                      if (open) closeCalendar(false);
                      setActiveSeg(type);
                      setFocusedSeg(type);
                    }}
                    onBlur={() => {
                      setFocusedSeg(null);
                      if (isBuffering) flushDigitBuffer(type);
                    }}
                  >
                    {segmentText(type)}
                  </span>
                  {i < order.length - 1 && (
                    <span className="separator" aria-hidden="true">
                      {separator}
                    </span>
                  )}
                </Fragment>
              );
            })}
            <button
              ref={triggerRef}
              type="button"
              className="trigger"
              aria-label={open ? t.closeCalendar : t.openCalendar}
              aria-expanded={open}
              aria-haspopup="dialog"
              disabled={disabled}
              onClick={toggleCalendar}
            >
              {/* 18px + `display: block` — the family-wide icon metric,
                  ADR-0008. `display: block` comes from the verbatim CSS. */}
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                width="18"
                height="18"
              >
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </button>
          </div>

          <div className="rail" ref={railRef}>
            {open && (
              <div
                ref={popupRef}
                className="popup"
                id={dialogId}
                role="dialog"
                aria-modal="true"
                aria-labelledby={monthTriggerId}
                onKeyDown={onPopupKeyDown}
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
                  {/* No `aria-haspopup`: this swaps an in-dialog panel of
                      spinbutton wheels, not a listbox popup. `aria-controls` +
                      `aria-expanded` instead — and the suite asserts both. */}
                  <button
                    ref={monthTriggerRef}
                    type="button"
                    className="month-year-trigger"
                    id={monthTriggerId}
                    aria-controls={pickerId}
                    aria-expanded={panel === "picker"}
                    aria-label={panel === "picker" ? t.closePicker : t.openPicker}
                    onClick={() => (panel === "picker" ? closePicker() : openPicker())}
                  >
                    {monthLabel}
                  </button>
                  <button
                    type="button"
                    className="next-month"
                    aria-label={t.nextMonth}
                    onClick={() => navigateMonth(1)}
                  >
                    {"›"}
                  </button>
                </div>

                {/* Both panels carry an EXPLICIT `data-active` — this is the
                    documented exception to "true or absent", because the CSS
                    keys `display` off both values and an attribute's removal
                    cannot be transitioned. */}
                <div className="panel" data-panel="calendar" data-active={panel === "calendar"}>
                  <table className="calendar-grid" role="grid">
                    <thead>
                      <tr role="row">
                        {weekdayShort.map((short, i) => (
                          <th key={i} scope="col" aria-label={weekdayLong[i]}>
                            {short}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {weeks.map((week, wi) => (
                        <tr key={wi} role="row">
                          {week.map((cell) => (
                            /* `aria-selected` / `aria-disabled` live on the
                               `td` (the gridcell), never on the button — the
                               suite asserts both halves of that. */
                            <td
                              key={cell.iso}
                              role="gridcell"
                              aria-selected={cell.isSelected}
                              aria-disabled={cell.isDisabled ? "true" : undefined}
                              data-outside-month={cell.outside ? "true" : undefined}
                              data-today={cell.isToday ? "true" : undefined}
                              data-selected={cell.isSelected ? "true" : undefined}
                              data-disabled={cell.isDisabled ? "true" : undefined}
                            >
                              <button
                                type="button"
                                tabIndex={cell.iso === rovingISO ? 0 : -1}
                                data-date={cell.iso}
                                aria-label={
                                  cell.date.toLocaleDateString(localeTag, { dateStyle: "long" }) +
                                  (cell.isToday ? `, ${t.today}` : "") +
                                  (cell.isSelected ? `, ${t.selected}` : "") +
                                  (cell.isDisabled ? `, ${t.notAvailable}` : "")
                                }
                                onClick={() => selectDate(cell)}
                              >
                                {cell.label}
                              </button>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* `WheelColumns` is required, not decorative: the kernel's
                    `Wheel.css` draws the full-width selection band and the
                    top/bottom fade on this class. */}
                <div
                  className="panel year-month-picker WheelColumns"
                  role="group"
                  id={pickerId}
                  data-panel="picker"
                  data-active={panel === "picker"}
                  aria-label={t.openPicker}
                >
                  <div
                    ref={monthWheelRef}
                    className="Wheel"
                    data-picker="month"
                    id={`${id}-picker-month`}
                    tabIndex={0}
                    aria-label={t.month}
                    onKeyDown={(e) => {
                      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
                      e.preventDefault();
                      wheelsRef.current?.month.stepBy(e.key === "ArrowDown" ? 1 : -1);
                    }}
                  />
                  <div
                    ref={yearWheelRef}
                    className="Wheel"
                    data-picker="year"
                    id={`${id}-picker-year`}
                    tabIndex={0}
                    aria-label={t.year}
                    onKeyDown={(e) => {
                      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
                      e.preventDefault();
                      wheelsRef.current?.year.stepBy(e.key === "ArrowDown" ? 1 : -1);
                    }}
                  />
                </div>

                <div className="calendar-footer">
                  <button
                    type="button"
                    className="calendar-footer-clear"
                    disabled={nativeValue === ""}
                    onClick={() => {
                      clearAll();
                      closeCalendar(true);
                    }}
                  >
                    {t.clearButton}
                  </button>
                  <button
                    type="button"
                    className="calendar-footer-today"
                    disabled={todayDisabled}
                    onClick={() => {
                      const today = new Date();
                      applyDate(today);
                      closeCalendar(true);
                    }}
                  >
                    {t.todayButton}
                  </button>
                </div>

                <div className="arrow" />
              </div>
            )}
          </div>
        </div>

        <div className="announce" id={announceId} aria-live="polite" aria-atomic="true">
          {announceText}
        </div>
      </div>
    </>
  );
}

/* ── Tab stops ─────────────────────────────────────────────────────────────── */
/* OUTSIDE the component and taking the popup element as a PARAMETER, per
 * `react-hooks/refs` ("passing a ref to a function may read its value during
 * render"). It is also the more honest shape: the trap calls this at event time,
 * so it must reflect the DOM as it is then, not as some render thought it was.
 *
 * The date grid is a SINGLE composite tab stop (WAI-ARIA grid): roving tabindex
 * inside, so Tab enters and leaves it as a unit and must contribute exactly one
 * stop, not one per day. The picker is a modal-within-modal whose only stops are
 * its two wheels. */
function calendarTabStops(popup: HTMLElement): HTMLElement[] {
  const pickerActive =
    popup.querySelector('[data-panel="picker"]')?.getAttribute("data-active") === "true";

  if (pickerActive) {
    return [
      popup.querySelector<HTMLElement>('.Wheel[data-picker="month"]'),
      popup.querySelector<HTMLElement>('.Wheel[data-picker="year"]'),
    ].filter((el): el is HTMLElement => Boolean(el));
  }

  const gridStop =
    popup.querySelector<HTMLButtonElement>(
      'td:not([data-outside-month]):not([aria-disabled="true"]) button[tabindex="0"]',
    ) ??
    popup.querySelector<HTMLButtonElement>(
      'td:not([data-outside-month]):not([aria-disabled="true"]) button',
    );

  const clearBtn = popup.querySelector<HTMLButtonElement>(".calendar-footer-clear");
  const todayBtn = popup.querySelector<HTMLButtonElement>(".calendar-footer-today");

  const stops: Array<HTMLElement | null> = [
    popup.querySelector<HTMLButtonElement>(".prev-month"),
    popup.querySelector<HTMLButtonElement>(".month-year-trigger"),
    gridStop,
    popup.querySelector<HTMLButtonElement>(".next-month"),
    ...(clearBtn && !clearBtn.disabled ? [clearBtn] : []),
    ...(todayBtn && !todayBtn.disabled ? [todayBtn] : []),
  ];
  return stops.filter((el): el is HTMLElement => el !== null);
}

export default DateField;
