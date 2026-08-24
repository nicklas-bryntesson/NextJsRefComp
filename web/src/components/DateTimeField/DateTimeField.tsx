/* DateTimeField — React port of
 * `reference-components/src/partials/components/DateTimeField/DateTimeField.ts` (1397 lines).
 *
 * The last of the five popup fields, and the only one that composes TWO
 * families: DateField's calendar + month/year wheel picker AND TimeField's
 * hour/minute/second wheels + AM/PM toggle, behind ONE popup and ONE value.
 *
 * ── What the kernel absorbed ─────────────────────────────────────────────────
 *   month grid, leap years, ISO datetime formatting, segment order → `@/kernel/dates`
 *   popover offset / arrow offset / direction                      → `@/kernel/popup-position`
 *   cyclic Tab trap + wheel-scroll containment                     → `@/kernel/popup-interaction`
 *   the 3D spinner physics — FIVE instances here, two contracts     → `@/kernel/WheelColumn`
 *   `calc()`/`var()` → px                                          → `@/kernel/css-px`
 *   locale-key collapse                                            → `@/kernel/locale`
 * What is left is state, wiring and DOM projection. Nothing about the wheel or
 * the calendar maths is re-derived; see findings/DateTimeField.md for the
 * measured answer to "does composing two families cost anything".
 *
 * ── No `<template>` ─────────────────────────────────────────────────────────
 * The contract authors the popup inside `<template class="calendar-template">`
 * and clones it into `.rail` on open. React CANNOT render into a `<template>`'s
 * inert `.content` fragment — it appends children to the ELEMENT — so `.popup`
 * would be query-visible while closed. Conditional rendering into `.rail` is
 * the same end-state by a better mechanism (ADR-0009: the contract specifies
 * the DOM, not the computation site). Findings F-050.
 *
 * ── The popup stays a descendant of the root ─────────────────────────────────
 * No portal, no top layer: every stylesheet rule is `.DateTimeField .part` and
 * the suite selects `${ROOT} .popup`. ADR-0012 makes the top-layer escape the
 * consumer's call and we decline it, inheriting the documented
 * ancestor-clipping limitation.
 *
 * ── No entrance animation ────────────────────────────────────────────────────
 * Grepped: the verbatim `DateTimeField.css` contains no `transition`, no
 * `animation` and no `@keyframes`. None is added. An opacity fade puts popup
 * text below AA for ~150–180 ms and Playwright's auto-wait does not check
 * opacity, so a scoped axe run would sample the faded frame (F-006/F-043).
 *
 * ── Class names are contract (F-008) ─────────────────────────────────────────
 * `.DateTimeField .native .overlay .segments .segment .separator .trigger
 * .rail .popup .calendar-inner .calendar-left .calendar-header .prev-month
 * .month-year-trigger .calendar-month-year .next-month .calendar-grid
 * .year-month-picker .WheelColumns .Wheel .time-columns .ampm .ampm-option
 * .calendar-footer .calendar-footer-clear .calendar-footer-today
 * .calendar-footer-now .arrow .announce` — all selected by the suite and/or the
 * stylesheet. Preserved verbatim; Tailwind layers alongside in Phase B.
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
  formatDatetimeISO,
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

/* `WheelColumn` deliberately ships no CSS of its own; `Wheel.md` records that
   shipping the JS without the stylesheet was the original port's
   hardest-to-find bug. Verified to emit its own chunk under Next 16. */
import "@/kernel/Wheel.layered.css";
import "./DateTimeField.layered.css";

/* ── Translations ──────────────────────────────────────────────────────────── */
/* Ported verbatim from the reference's static table. `registerLocale()` is NOT
   ported — a published imperative API cannot be React state (F-048); the React
   equivalent is this module-scope registry, populated at import time. */

interface TranslationStrings {
  day: string; month: string; year: string;
  hour: string; minute: string; second: string;
  am: string; pm: string;
  openCalendar: string; closeCalendar: string;
  prevMonth: string; nextMonth: string;
  today: string; now: string;
  selected: string; notAvailable: string;
  announceSelected: string;
  dateTimeField: string;
  clearButton: string; todayButton: string; nowButton: string;
  openPicker: string; closePicker: string;
  hours: string; minutes: string; seconds: string;
}

const TRANSLATIONS: Record<string, TranslationStrings> = {
  en: {
    day: "Day", month: "Month", year: "Year",
    hour: "Hour", minute: "Minute", second: "Second",
    am: "AM", pm: "PM",
    openCalendar: "Open calendar", closeCalendar: "Close calendar",
    prevMonth: "Previous month", nextMonth: "Next month",
    today: "today", now: "now",
    selected: "selected", notAvailable: "not available",
    announceSelected: "Selected date and time:",
    dateTimeField: "date and time field",
    clearButton: "Clear", todayButton: "Today", nowButton: "Now",
    openPicker: "Choose month and year", closePicker: "Close month and year picker",
    hours: "Hours", minutes: "Minutes", seconds: "Seconds",
  },
  sv: {
    day: "Dag", month: "Månad", year: "År",
    hour: "Timme", minute: "Minut", second: "Sekund",
    am: "AM", pm: "PM",
    openCalendar: "Öppna kalender", closeCalendar: "Stäng kalender",
    prevMonth: "Föregående månad", nextMonth: "Nästa månad",
    today: "idag", now: "nu",
    selected: "vald", notAvailable: "inte tillgänglig",
    announceSelected: "Valt datum och tid:",
    dateTimeField: "datum- och tidfält",
    clearButton: "Rensa", todayButton: "I dag", nowButton: "Nu",
    openPicker: "Välj månad och år", closePicker: "Stäng månads- och årsväljare",
    hours: "Timmar", minutes: "Minuter", seconds: "Sekunder",
  },
};

/* ── Segment model ─────────────────────────────────────────────────────────── */

type TimeSegmentType = "hour" | "minute" | "second";
type SegmentType = DateSegmentType | TimeSegmentType | "ampm";
type WheelSegmentType = TimeSegmentType;

const PLACEHOLDER: Record<Exclude<SegmentType, "ampm">, string> = {
  day: "dd", month: "mm", year: "yyyy",
  hour: "--", minute: "--", second: "--",
};

const DEFAULT_MIN_YEAR = 1900;
const DEFAULT_MAX_YEAR = 2100;

/** Only ever the `year` argument to `getMonthName`, which ignores it. A fixed
 *  value keeps the SSR and hydration renders byte-identical. */
const MONTH_NAME_ANCHOR_YEAR = 2024;

type Vals = {
  day: number | null;
  month: number | null;
  year: number | null;
  /** DISPLAY hour: 1–12 in a 12h locale, 0–23 otherwise. */
  hour: number | null;
  minute: number | null;
  second: number | null;
  /** 0 = AM, 1 = PM. Never null — the reference's ampm segment has no
   *  placeholder state, it defaults to AM. */
  ampm: 0 | 1;
};

const EMPTY: Vals = {
  day: null, month: null, year: null,
  hour: null, minute: null, second: null, ampm: 0,
};

/** `YYYY-MM-DDTHH:mm[:ss]` → Date. Port of `_parseDatetime`. */
function parseDatetime(value: string): Date | null {
  const v = value.trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(v);
  if (!m) return null;
  const d = new Date(
    Number(m[1]), Number(m[2]) - 1, Number(m[3]),
    Number(m[4]), Number(m[5]), m[6] ? Number(m[6]) : 0,
  );
  return isNaN(d.getTime()) ? null : d;
}

/** Port of `_syncSegmentsFromDatetime` — a Date to a full segment set. */
function valsFromDatetime(dt: Date, is12h: boolean, showSeconds: boolean): Vals {
  const h = dt.getHours();
  return {
    year: dt.getFullYear(),
    month: dt.getMonth() + 1,
    day: dt.getDate(),
    hour: is12h ? (h === 0 ? 12 : h > 12 ? h - 12 : h) : h,
    ampm: is12h ? (h >= 12 ? 1 : 0) : 0,
    minute: dt.getMinutes(),
    second: showSeconds ? dt.getSeconds() : null,
  };
}

/** Port of `_trySyncToNative`'s completeness gate + 12h → 24h fold. */
function datetimeFromVals(v: Vals, is12h: boolean, showSeconds: boolean): Date | null {
  if (v.day == null || v.month == null || v.year == null) return null;
  if (v.hour == null || v.minute == null) return null;
  if (showSeconds && v.second == null) return null;
  let h = v.hour;
  if (is12h) h = h === 12 ? (v.ampm === 0 ? 0 : 12) : v.ampm === 1 ? h + 12 : h;
  const dt = new Date(v.year, v.month - 1, v.day, h, v.minute, showSeconds ? v.second! : 0);
  return isNaN(dt.getTime()) ? null : dt;
}

function segmentLimits(
  type: SegmentType,
  v: Vals,
  minYear: number,
  maxYear: number,
  is12h: boolean,
): { min: number; max: number } {
  if (type === "day") {
    const year = v.year ?? new Date().getFullYear();
    return { min: 1, max: v.month != null ? getDaysInMonth(year, v.month - 1) : 31 };
  }
  if (type === "month") return { min: 1, max: 12 };
  if (type === "year") return { min: minYear, max: maxYear };
  if (type === "hour") return is12h ? { min: 1, max: 12 } : { min: 0, max: 23 };
  if (type === "minute" || type === "second") return { min: 0, max: 59 };
  return { min: 0, max: 1 }; /* ampm */
}

/**
 * Set one segment, clamping the day to the resulting month's length.
 *
 * [PORT FIX] The reference clamps only when the MONTH changes
 * (`_setSegmentValue`, the `type === 'month'` branch); the `type === 'year'`
 * branch writes the value and returns. So 29 Feb 2024 + ArrowUp on the year
 * leaves the segments reading `29/02/2025` while `_trySyncToNative` writes
 * `2025-03-01` to the native input, because `new Date(2025, 1, 29)` rolls over.
 * The custom face and the submitted value disagree, silently. DateField carries
 * the identical defect and the identical fix; clamping on both axes is the same
 * rule applied consistently.
 */
function withSegment(prev: Vals, type: SegmentType, value: number): Vals {
  const next: Vals = { ...prev, [type]: value } as Vals;
  if ((type === "month" || type === "year") && next.day != null && next.month != null) {
    const dim = getDaysInMonth(next.year ?? new Date().getFullYear(), next.month - 1);
    if (next.day > dim) next.day = dim;
  }
  return next;
}

/* ── Calendar grid model ───────────────────────────────────────────────────── */

type DayCell = {
  iso: string;
  date: Date;
  label: number;
  outside: boolean;
  isToday: boolean;
  isSelected: boolean;
  isDisabled: boolean;
};

/**
 * Port of `_renderMonth()`'s cell loop, as a pure function. The reference emits
 * a partial trailing row only when it needs one; the leading/trailing pad is
 * reproduced exactly (previous month's tail, next month's head).
 */
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

/** Port of `_renderMonth`'s roving rule: the selected day, else the first
 *  in-month enabled day. Outside-month cells are never rovered onto. */
function defaultRovingISO(weeks: DayCell[][]): string | null {
  const cells = weeks.flat();
  const selected = cells.find((c) => c.isSelected && !c.outside);
  if (selected) return selected.iso;
  const first = cells.find((c) => !c.outside && !c.isDisabled);
  return first ? first.iso : null;
}

/* ── `data-input-mode` store (ADR-0006) ────────────────────────────────────── */
/* A fact about the HOST, not React state: `matchMedia('(pointer: coarse)')`.
   `useSyncExternalStore` is exactly its shape — and using it rather than
   `useState` + `useEffect(() => setMode(…), [])` is not stylistic: the latter is
   a hard `react-hooks/set-state-in-effect` error and costs a second passive
   commit (CLAUDE.md).

   The SERVER snapshot is `null` — "no mode yet" — which renders exactly the
   reference's pre-`attach()` markup: `.native { display: block }`, `.overlay
   { display: none }`. That is the no-JS end state, in which the native
   `<input type="datetime-local">` is a fully working control (F-046's
   progressive-enhancement result). The height it paints at is reserved
   explicitly — see the `style` prop on `.native`.

   Unlike the reference this also SUBSCRIBES, so a hybrid device that gains a
   mouse re-resolves. The reference reads `matchMedia` once at init. */

const COARSE = "(pointer: coarse)";
type InputMode = "custom" | "display";

function subscribeCoarse(onChange: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => {};
  }
  const mq = window.matchMedia(COARSE);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function getInputMode(): InputMode {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "custom";
  }
  return window.matchMedia(COARSE).matches ? "display" : "custom";
}

function getInputModeServer(): null {
  return null;
}

/* ── Props ─────────────────────────────────────────────────────────────────── */

export type DateTimeFieldProps = {
  /** `data-id`, the native input's `id`, and the e2e anchor. Must be unique. */
  id: string;
  /** `name` on the native input → `data-name`. Defaults to `id`. */
  name?: string;
  /** Optional visible label. The reference's own states render none; when given,
   *  it becomes `.segments`' accessible name, which the `.md`'s manual
   *  screenreader checklist asks for ("the group label is announced"). */
  label?: ReactNode;
  /** BCP 47 tag → `data-locale`. Drives segment order AND the 12h/24h cycle.
   *  A prop, not `readLocale()`'s `<html lang>` walk — that is a hydration
   *  mismatch by construction (F-048). */
  locale?: string;
  /** `YYYY-MM-DDTHH:mm` — constrains the grid (day granularity) and the year range. */
  min?: string;
  max?: string;
  /** `YYYY-MM-DDTHH:mm[:ss]` — the native input's `value` attribute. */
  defaultValue?: string;
  disabled?: boolean;
  invalid?: boolean;
  required?: boolean;
  /** Seconds. `< 60` shows the second segment and the second wheel. */
  step?: number;
  /** Kitchensink / visual-test only — simulates a CSS pseudo-state. */
  testState?: "hover" | "focus" | "active";
  /** Utilities layered ALONGSIDE the structural classes (Phase B seam, F-008). */
  className?: string;
};

/* ── Component ─────────────────────────────────────────────────────────────── */

export function DateTimeField({
  id,
  name = id,
  label,
  locale: localeTagProp = "en-GB",
  min: minAttr,
  max: maxAttr,
  defaultValue = "",
  disabled = false,
  invalid = false,
  required = false,
  step,
  testState,
  className,
}: DateTimeFieldProps) {
  /* Two locales off one attribute, and they are NOT interchangeable (upstream
     3c7df5b, F-041):
       - `localeTag` — the raw tag. Everything `Intl` touches gets this: hour
         cycle, segment order, month names, weekday names, date-time labels.
       - `locale`    — the COLLAPSED translation key (`de-DE` → `en`, no `de`
         bundle). It indexes our own strings and nothing else.
     F-041 was `de-DE` collapsing to `en` and rendering English month names even
     though `supportedLocalesOf(['de-DE'])` returns `['de-DE']`. */
  const localeTag = localeTagProp;
  const locale = resolveLocale(localeTag, TRANSLATIONS);
  const t = TRANSLATIONS[locale] ?? TRANSLATIONS.en;

  const is12h =
    new Intl.DateTimeFormat(localeTag, { hour: "numeric" }).resolvedOptions().hour12 ?? false;
  const showSeconds = step != null && !isNaN(step) && step < 60;

  const min = minAttr ? parseDatetime(minAttr) : null;
  const max = maxAttr ? parseDatetime(maxAttr) : null;
  const minYear = min ? min.getFullYear() : DEFAULT_MIN_YEAR;
  const maxYear = max ? max.getFullYear() : DEFAULT_MAX_YEAR;

  const { order, separator } = getSegmentOrder(localeTag);
  /* The full segment sequence: locale-ordered date segments, then hour, minute,
     optional second, optional AM/PM. Left-to-right order is the arrow-key and
     digit-advance order. */
  const segmentTypes: SegmentType[] = [...order, "hour", "minute"];
  if (showSeconds) segmentTypes.push("second");
  if (is12h) segmentTypes.push("ampm");

  const labelId = `${id}-label`;
  const announceId = `${id}-announce`;
  const dialogId = `${id}-popup`;
  const monthTriggerId = `${id}-month`;
  const pickerId = `${id}-picker`;

  /* ── Refs ───────────────────────────────────────────────────────────────── */
  const rootRef = useRef<HTMLDivElement | null>(null);
  const nativeRef = useRef<HTMLInputElement | null>(null);
  const railRef = useRef<HTMLDivElement | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const monthTriggerRef = useRef<HTMLButtonElement | null>(null);
  const segRefs = useRef<Partial<Record<SegmentType, HTMLSpanElement | null>>>({});
  const timeWheelEls = useRef(new Map<WheelSegmentType, HTMLDivElement | null>());
  const timeWheels = useRef(new Map<WheelSegmentType, WheelColumn>());
  const monthWheelRef = useRef<HTMLDivElement | null>(null);
  const yearWheelRef = useRef<HTMLDivElement | null>(null);
  const pickerWheels = useRef<{ month: WheelColumn; year: WheelColumn } | null>(null);
  const rafRef = useRef<number | null>(null);
  const digitBufferRef = useRef("");
  const digitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pickerEntryRef = useRef({ y: 0, m: 0 });

  /* ── State ──────────────────────────────────────────────────────────────── */

  const inputMode = useSyncExternalStore(subscribeCoarse, getInputMode, getInputModeServer);
  const isCustom = inputMode === "custom";
  /* `data-initialized` is a BEHAVIOUR gate, not a paint attribute, so it must be
     withheld until hydration or the suite's `beforeEach` barrier gates nothing
     (F-046/F-047). `data-input-mode` is the paint half and is handled by the
     store above. */
  const initialized = inputMode !== null;

  const [nativeValue, setNativeValue] = useState(defaultValue);
  const [vals, setVals] = useState<Vals>(() => {
    const dt = parseDatetime(defaultValue);
    return dt ? valsFromDatetime(dt, is12h, showSeconds) : EMPTY;
  });

  /* Derived, so it cannot drift from the native input the way the reference's
     parallel `selectedDatetime` field can. */
  const selected = parseDatetime(nativeValue);
  const selectedISO = selected ? formatISO(selected) : "";

  const [activeSeg, setActiveSeg] = useState<SegmentType>(segmentTypes[0]);
  const [focusedSeg, setFocusedSeg] = useState<SegmentType | null>(null);
  const [digitDisplay, setDigitDisplay] = useState<{ seg: SegmentType; text: string } | null>(null);
  const [announceText, setAnnounceText] = useState("");

  const [open, setOpen] = useState(false);
  const [direction, setDirection] = useState<PopupDirection | null>(null);
  const [panel, setPanel] = useState<"calendar" | "picker">("calendar");
  const [displayed, setDisplayed] = useState({ y: 0, m: 0 });
  /* `iso` drives the grid's roving tabindex; bumping `focus` asks the effect to
     move DOM focus there. Two concerns: `.prev-month` resets the roving cell
     WITHOUT stealing focus off itself. */
  const [roving, setRoving] = useState<{ iso: string | null; focus: number }>({
    iso: null, focus: 0,
  });

  /* Latest-value mirrors for what a `WheelColumn` callback reads after its
     constructing render is gone. Written from an effect, never during render. */
  const valsRef = useRef(vals);
  const nativeValueRef = useRef(nativeValue);
  const displayedRef = useRef(displayed);
  useEffect(() => { valsRef.current = vals; }, [vals]);
  useEffect(() => { nativeValueRef.current = nativeValue; }, [nativeValue]);
  useEffect(() => { displayedRef.current = displayed; }, [displayed]);

  /* ── Derived calendar model ─────────────────────────────────────────────── */
  /* Only reached while the popup is mounted (client only), so `new Date()` here
     cannot cause a hydration mismatch. */
  const todayISO = open ? formatISO(new Date()) : "";
  const weeks = open ? buildMonth(displayed.y, displayed.m, min, max, todayISO, selectedISO) : [];
  const rovingISO = open
    ? roving.iso && weeks.flat().some((c) => c.iso === roving.iso)
      ? roving.iso
      : defaultRovingISO(weeks)
    : null;

  /* ── Value commit ───────────────────────────────────────────────────────── */

  const announceFor = (dt: Date) =>
    `${t.announceSelected} ${dt.toLocaleString(localeTag, {
      dateStyle: "long",
      timeStyle: showSeconds ? "medium" : "short",
    })}`;

  /**
   * Port of the `_setSegmentValue` → `_trySyncToNative` pair. The reference's
   * `native.value !== next` equality gate is what collapses a cascade (a
   * calendar pick touches up to seven segments) into ONE `change` event and ONE
   * announcement. React supplies both halves for free and the explicit gate is
   * deliberately NOT reproduced here:
   *   - the cascade is already a single `setVals` + `setNativeValue`;
   *   - `setState` with an identical value bails out, so a re-commit of an
   *     unchanged datetime re-announces nothing;
   *   - the one place the gate is still load-bearing — not dispatching a
   *     spurious native `change` — is the write effect below, which compares
   *     against the input's ACTUAL DOM value, a stronger check than the
   *     reference's own.
   * Keeping a `nativeValueRef.current` read here would also put a ref read on
   * the render path of every handler that calls this, which is a
   * `react-hooks/refs` error rather than a style preference.
   */
  const commit = (next: Vals) => {
    setVals(next);
    const dt = datetimeFromVals(next, is12h, showSeconds);
    if (!dt) return;
    setNativeValue(formatDatetimeISO(dt, showSeconds));
    setAnnounceText(announceFor(dt));
  };

  /** Port of `_selectDate` / `_onWheelChange` / `_selectAmpm`'s shared tail. */
  const applyDatetime = (dt: Date) => commit(valsFromDatetime(dt, is12h, showSeconds));

  const clearAll = () => {
    setVals(EMPTY);
    setNativeValue("");
    setAnnounceText("");
  };

  /* The native input stays UNCONTROLLED (`defaultValue`), because the contract
     needs a NATIVE `change` event on it and React's synthetic `onChange` is not
     that (F-032). This effect is the reference's
     `input.value = …; dispatchEvent(new Event('change'))`, expressed once. */
  useEffect(() => {
    const input = nativeRef.current;
    if (!input || input.value === nativeValue) return;
    input.value = nativeValue;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, [nativeValue]);

  /* Inbound native `change` — the display-mode path (the platform picker writes
     the input directly) and any host code doing `el.value = x;
     dispatchEvent(new Event('change'))`. A NATIVE listener, not `onChange`:
     React's synthetic change is deduplicated against its own value tracker and
     never fires for an external dispatch (F-032). */
  useEffect(() => {
    const input = nativeRef.current;
    if (!input || disabled) return;

    const onNativeChange = () => {
      const v = input.value;
      const dt = parseDatetime(v);
      setNativeValue(v);
      setVals(dt ? valsFromDatetime(dt, is12h, showSeconds) : EMPTY);
    };
    /* [PORT FIX] The reference's `reset` handler clears the segments while the
       browser restores the input's `value` ATTRIBUTE immediately after the
       event, leaving the two disagreeing. Reading the input on the next tick
       keeps them in sync whatever the form restores. Same fix as DateField. */
    const onReset = () => {
      setTimeout(() => {
        const v = input.value;
        const dt = parseDatetime(v);
        setNativeValue(v);
        setVals(dt ? valsFromDatetime(dt, is12h, showSeconds) : EMPTY);
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
  }, [disabled, is12h, showSeconds]);

  /* ── Popup lifecycle ────────────────────────────────────────────────────── */

  const openPopup = () => {
    const base = selected ?? new Date();
    const y = base.getFullYear();
    const m = base.getMonth();
    const weeksNow = buildMonth(y, m, min, max, formatISO(new Date()), selectedISO);

    /* Direction measured BEFORE the open render, so the popup never paints on
       the wrong side of the trigger. */
    const trigger = triggerRef.current;
    if (trigger) setDirection(detectDirection(trigger.getBoundingClientRect(), window.innerHeight));

    setDisplayed({ y, m });
    setPanel("calendar");
    setRoving({ iso: defaultRovingISO(weeksNow), focus: 1 });
    setOpen(true);
  };

  /** ADR-0007: `refocusTrigger` is false ONLY on pointer light-dismiss and on
   *  the segment-focus path — refocusing would scroll the viewport back to an
   *  off-screen trigger and steal focus from whatever the user clicked. */
  const closePopup = (refocusTrigger: boolean) => {
    setOpen(false);
    setPanel("calendar");
    setRoving({ iso: null, focus: 0 });
    if (refocusTrigger) triggerRef.current?.focus();
  };

  const togglePopup = () => (open ? closePopup(true) : openPopup());

  const navigateMonth = (delta: number) => {
    let y = displayed.y;
    let m = displayed.m + delta;
    if (m > 11) { m = 0; y++; }
    if (m < 0) { m = 11; y--; }
    /* Faithful to the reference: prev/next month NAVIGATES only — unlike
       DateField's `_navigateMonth`, DateTimeField's handlers do not commit a
       date. See findings/DateTimeField.md. */
    setDisplayed({ y, m });
    setRoving((r) => ({ iso: null, focus: r.focus }));
  };

  /** Port of `_selectDate` — merge the picked DAY into the existing TIME. The
   *  reference does NOT close the popup here (the time still has to be set),
   *  which is the whole reason this component's footer has three buttons. */
  const selectDay = (date: Date, moveDisplayed: boolean) => {
    const time = selected ?? new Date();
    const merged = new Date(
      date.getFullYear(), date.getMonth(), date.getDate(),
      time.getHours(), time.getMinutes(), time.getSeconds(),
    );
    if (moveDisplayed) setDisplayed({ y: merged.getFullYear(), m: merged.getMonth() });
    applyDatetime(merged);
  };

  const selectDate = (cell: DayCell) => {
    if (cell.isDisabled) return;
    selectDay(cell.date, cell.outside);
  };

  /* Port of the picker's `applyPickerDate`. Reads only refs and setters, so the
     copy a `WheelColumn` closure captured is never stale. */
  const applyPickerDate = (y: number, m: number) => {
    const base = parseDatetime(nativeValueRef.current) ?? new Date();
    const next = new Date(
      y, m, clampDayToMonth(y, m, base.getDate()),
      base.getHours(), base.getMinutes(), base.getSeconds(),
    );
    setDisplayed({ y: next.getFullYear(), m: next.getMonth() });
    applyDatetime(next);
    setRoving((r) => ({ iso: formatISO(next), focus: r.focus }));
  };

  const openPicker = () => {
    pickerEntryRef.current = { y: displayed.y, m: displayed.m };
    setPanel("picker");
  };

  const closePicker = () => {
    setPanel("calendar");
    monthTriggerRef.current?.focus();
  };

  /* Port of `_onWheelChange` — the time wheels write into the DATE, so the two
     families meet here. `base` is the committed datetime, or now. */
  const onTimeWheelChange = (type: WheelSegmentType, value: number) => {
    const base = new Date(parseDatetime(nativeValueRef.current) ?? new Date());
    if (type === "hour") {
      if (is12h) {
        const current = parseDatetime(nativeValueRef.current);
        const ampm = current && current.getHours() >= 12 ? 1 : 0;
        base.setHours(value === 12 ? (ampm === 1 ? 12 : 0) : ampm === 1 ? value + 12 : value);
      } else {
        base.setHours(value);
      }
    } else if (type === "minute") {
      base.setMinutes(value);
    } else {
      base.setSeconds(value);
    }
    applyDatetime(base);
  };

  /** Port of `_selectAmpm`. */
  const selectAmpm = (value: 0 | 1) => {
    const base = new Date(selected ?? new Date());
    const h = base.getHours();
    if (value === 0 && h >= 12) base.setHours(h - 12);
    if (value === 1 && h < 12) base.setHours(h + 12);
    applyDatetime(base);
  };

  /** Derived from the committed value, exactly as `_updateAmpmToggle` reads it
   *  off `selectedDatetime` (defaulting to AM when nothing is selected). */
  const ampmActive: 0 | 1 = selected && selected.getHours() >= 12 ? 1 : 0;

  /* ── Segment keyboard ───────────────────────────────────────────────────── */

  const focusSegment = (type: SegmentType) => {
    setActiveSeg(type);
    segRefs.current[type]?.focus();
  };

  const moveSegment = (from: SegmentType, delta: number) => {
    const i = segmentTypes.indexOf(from);
    const next = segmentTypes[i + delta];
    if (next) focusSegment(next);
  };

  const flushDigitBuffer = (type: SegmentType) => {
    const buffer = digitBufferRef.current;
    if (!buffer || type === "ampm") return;
    if (digitTimerRef.current) clearTimeout(digitTimerRef.current);
    digitTimerRef.current = null;
    digitBufferRef.current = "";
    setDigitDisplay(null);
    const num = Number(buffer);
    if (type === "year" && buffer.length < 4) {
      setVals((prev) => ({ ...prev, year: null }));
      return;
    }
    const { min: lo, max: hi } = segmentLimits(type, valsRef.current, minYear, maxYear, is12h);
    commit(withSegment(valsRef.current, type, Math.max(lo, Math.min(hi, num))));
  };

  const handleDigit = (type: SegmentType, digit: string) => {
    if (digitTimerRef.current) clearTimeout(digitTimerRef.current);
    digitTimerRef.current = null;

    const buffer = digitBufferRef.current + digit;
    digitBufferRef.current = buffer;
    setDigitDisplay({ seg: type, text: buffer });

    const num = Number(buffer);
    const { min: lo, max: hi } = segmentLimits(type, vals, minYear, maxYear, is12h);

    const commitBuffer = (v: number) => {
      digitBufferRef.current = "";
      setDigitDisplay(null);
      commit(withSegment(valsRef.current, type, v));
      moveSegment(type, 1);
    };

    /* Reference's fast path: when the first digit already exceeds max/10 no
       valid two-digit completion exists, so commit immediately. */
    if (buffer.length === 1 && num * 10 > hi) {
      commitBuffer(Math.max(lo, Math.min(hi, num)));
      return;
    }
    if (type === "year") {
      if (buffer.length === 4) commitBuffer(Math.max(lo, Math.min(hi, num)));
      return;
    }
    if (buffer.length === 2) {
      if (num >= lo && num <= hi) commitBuffer(num);
      return;
    }
    digitTimerRef.current = setTimeout(() => {
      digitTimerRef.current = null;
      commitBuffer(Math.max(lo, Math.min(hi, num)));
    }, 1000);
  };

  const onSegmentKeyDown = (e: ReactKeyboardEvent<HTMLSpanElement>, type: SegmentType) => {
    if (disabled) return;

    switch (e.key) {
      case "ArrowUp":
      case "ArrowDown": {
        e.preventDefault();
        const delta = e.key === "ArrowUp" ? 1 : -1;
        if (type === "ampm") {
          commit({ ...vals, ampm: vals.ampm === 0 ? 1 : 0 });
          break;
        }
        const { min: lo, max: hi } = segmentLimits(type, vals, minYear, maxYear, is12h);
        const current = vals[type as Exclude<SegmentType, "ampm">];
        const start = current ?? (delta > 0 ? lo - 1 : hi + 1);
        let next = start + delta;
        if (next > hi) next = lo;
        if (next < lo) next = hi;
        commit(withSegment(vals, type, next));
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
      case "Backspace":
        e.preventDefault();
        if (digitTimerRef.current) clearTimeout(digitTimerRef.current);
        digitTimerRef.current = null;
        digitBufferRef.current = "";
        setDigitDisplay(null);
        if (type !== "ampm") setVals((prev) => ({ ...prev, [type]: null }));
        moveSegment(type, -1);
        break;
      case "Escape":
        if (open) {
          e.preventDefault();
          closePopup(true);
        }
        break;
      case "a":
      case "A":
        if (type === "ampm") { e.preventDefault(); commit({ ...vals, ampm: 0 }); }
        break;
      case "p":
      case "P":
        if (type === "ampm") { e.preventDefault(); commit({ ...vals, ampm: 1 }); }
        break;
      default:
        if (type !== "ampm" && e.key.length === 1 && e.key >= "0" && e.key <= "9") {
          e.preventDefault();
          handleDigit(type, e.key);
        }
    }
  };

  /* ── Popup keyboard ─────────────────────────────────────────────────────── */

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
           on and STAY in the dialog. A second Escape closes the popup. */
        e.preventDefault();
        setDisplayed(pickerEntryRef.current);
        closePicker();
      }
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      closePopup(true);
      return;
    }

    /* Grid nav acts on whatever day cell actually has DOM focus — read from the
       DOM, not from `roving`, because the suite focuses a cell directly
       (`.first().focus()`) without going through us (ADR-0009). */
    const focusedISO = popupRef.current
      ?.querySelector<HTMLButtonElement>(".calendar-grid td button:focus")
      ?.dataset.date;
    if (!focusedISO) return;
    const from = parseDatetime(`${focusedISO}T00:00`);
    if (!from) return;

    const arrowDelta: Record<string, number> = {
      ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7,
    };
    const target = new Date(from.getFullYear(), from.getMonth(), from.getDate());

    if (arrowDelta[e.key] !== undefined) {
      e.preventDefault();
      target.setDate(target.getDate() + arrowDelta[e.key]);
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
    } else if (e.key === "Home") {
      e.preventDefault();
      focusCalendarDate(new Date(displayed.y, displayed.m, 1));
    } else if (e.key === "End") {
      e.preventDefault();
      focusCalendarDate(
        new Date(displayed.y, displayed.m, getDaysInMonth(displayed.y, displayed.m)),
      );
    } else if (e.key === "Enter" || e.key === " ") {
      const cell = weeks.flat().find((c) => c.iso === focusedISO);
      if (cell && !cell.isDisabled) {
        e.preventDefault();
        selectDate(cell);
      }
    }
  };

  /* ── Effects ────────────────────────────────────────────────────────────── */

  /* Move DOM focus onto the roving cell whenever `roving.focus` is bumped, and
     on open onto the grid — the reference's
     `querySelector('.calendar-grid td…button, .calendar-footer-today').focus()`.
     Not keyed on `rovingISO`, because `.prev-month` changes the roving cell
     without wanting focus. */
  useEffect(() => {
    if (!open || roving.focus === 0) return;
    const popup = popupRef.current;
    if (!popup) return;
    const target =
      (rovingISO &&
        popup.querySelector<HTMLButtonElement>(
          `.calendar-grid td button[data-date="${rovingISO}"]`,
        )) ||
      popup.querySelector<HTMLButtonElement>(".calendar-footer-today");
    target?.focus();
    /* `rovingISO` is deliberately read as the value from the render that bumped
       `focus`; adding it to the deps would re-steal focus every time the default
       roving cell changes — e.g. `.prev-month`, which must keep focus itself. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, roving.focus]);

  /* Shared popup hygiene: cyclic Tab trap over the ACTIVE panel's stops plus
     wheel-scroll containment. The AbortController is created inside the effect
     and aborted in cleanup, which is what makes StrictMode's double invocation
     safe. `panel` is a dep so switching panels re-registers against the new
     stop list — the trap reads `tabStops()` fresh per Tab, but re-running keeps
     the closure honest if the container is ever replaced. */
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
        if (root && !root.contains(e.target as Node)) closePopup(false);
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
     Viewport dimensions are passed EXPLICITLY — `popup-position` keeps its
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
    const popupWidth = popup.getBoundingClientRect().width;
    if (!containerRect.width || !popupWidth) return;

    setDirection(detectDirection(triggerRect, window.innerHeight));

    const triggerCenterX = triggerRect.left + triggerRect.width / 2;
    /* The contract: the popup stays at least half `--SITE--PADDING` from each
       viewport edge. `resolveCssPx` probes inside the ROOT so the component's
       own `--_dtf-*` tokens resolve — `getComputedStyle().getPropertyValue()`
       returns `calc()`/`var()` unresolved. */
    const viewportInset = resolveCssPx(root, "--_dtf-site-padding") / 2;

    const offset = calculatePopupOffset(
      triggerCenterX,
      containerRect.left,
      containerRect.width,
      popupWidth,
      window.innerWidth,
      viewportInset,
    );
    root.style.setProperty("--_dtf-popup-offset", `${offset}%`);

    /* That offset has not reached layout yet, so the popup's left edge is
       computed arithmetically rather than re-measured — as the reference does. */
    const popupLeft =
      containerRect.left + (offset / 100) * containerRect.width - popupWidth / 2;
    root.style.setProperty(
      "--_dtf-arrow-offset",
      `${calculateArrowOffset(
        triggerCenterX,
        popupLeft,
        popupWidth,
        resolveCssPx(root, "--_dtf-arrow-corner-radius"),
        resolveCssPx(root, "--_dtf-arrow-size"),
      )}px`,
    );
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

  /* The TIME wheels — hour / minute / (second). Constructed once per open, as
     the reference rebuilds them in `_setupTimeWheels`. `WheelColumn` owns a rAF
     physics loop mutating ~9 DOM nodes per frame, which is exactly the work
     React should not be doing. Deps are `open`/`is12h`/`showSeconds` only:
     everything the callbacks need comes through refs, so spinning never
     re-creates the column mid-gesture. */
  useEffect(() => {
    if (!open) return;
    const types: WheelSegmentType[] = showSeconds
      ? ["hour", "minute", "second"]
      : ["hour", "minute"];
    const created = new Map<WheelSegmentType, WheelColumn>();
    const hosts: HTMLDivElement[] = [];
    for (const type of types) {
      const el = timeWheelEls.current.get(type);
      if (!el) continue;
      hosts.push(el);
      const { min: lo, max: hi } = segmentLimits(type, valsRef.current, minYear, maxYear, is12h);
      created.set(
        type,
        new WheelColumn(el, {
          min: lo,
          max: hi,
          value: valsRef.current[type],
          onChange: (v: number) => onTimeWheelChange(type, v),
        }),
      );
    }
    timeWheels.current = created;
    return () => {
      created.forEach((w) => w.destroy());
      timeWheels.current = new Map();
      /* `WheelColumn` injected `.band` / `.option` imperatively, so React does
         not know about them and will not clean them up. */
      hosts.forEach((h) => h.replaceChildren());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, is12h, showSeconds]);

  /* The month/year PICKER wheels — fresh per picker open, as the reference does. */
  useEffect(() => {
    if (!open || panel !== "picker") return;
    const monthHost = monthWheelRef.current;
    const yearHost = yearWheelRef.current;
    if (!monthHost || !yearHost) return;

    const month = new WheelColumn(monthHost, {
      min: 0, max: 11,
      value: displayedRef.current.m,
      loop: true,
      format: (v) => getMonthName(displayedRef.current.y, v, localeTag),
      onChange: (m) => applyPickerDate(displayedRef.current.y, m),
    });
    const year = new WheelColumn(yearHost, {
      min: minYear, max: maxYear,
      value: displayedRef.current.y,
      loop: false,
      format: (v) => String(v),
      onChange: (y) => applyPickerDate(y, displayedRef.current.m),
    });
    pickerWheels.current = { month, year };
    monthHost.focus();

    return () => {
      month.destroy();
      year.destroy();
      pickerWheels.current = null;
      monthHost.replaceChildren();
      yearHost.replaceChildren();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, panel]);

  useEffect(() => () => {
    if (digitTimerRef.current) clearTimeout(digitTimerRef.current);
  }, []);

  /* ── Render helpers ─────────────────────────────────────────────────────── */

  const segmentText = (type: SegmentType): string => {
    if (digitDisplay?.seg === type) return digitDisplay.text;
    if (type === "ampm") return vals.ampm === 0 ? t.am : t.pm;
    const v = vals[type];
    if (v == null) return PLACEHOLDER[type];
    return type === "year" ? String(v) : String(v).padStart(2, "0");
  };

  const segmentValueText = (type: SegmentType): string => {
    if (digitDisplay?.seg === type) return digitDisplay.text;
    if (type === "ampm") return vals.ampm === 0 ? t.am : t.pm;
    const v = vals[type];
    if (v == null) return PLACEHOLDER[type];
    if (type === "month") return getMonthName(vals.year ?? MONTH_NAME_ANCHOR_YEAR, v - 1, localeTag);
    if (type === "day" || type === "year") return String(v);
    return String(v).padStart(2, "0");
  };

  const segmentLabel = (type: SegmentType): string => {
    if (type === "ampm") return `${t.am}/${t.pm}`;
    return t[type];
  };

  /* The separator that follows each segment, mirroring the reference's
     `_appendSep` calls: locale separator between date segments, ", " before the
     hour, ":" between time parts, " " before AM/PM. */
  const separatorAfter = (index: number): string | null => {
    const type = segmentTypes[index];
    const next = segmentTypes[index + 1];
    if (!next) return null;
    if (next === "hour") return ", ";
    if (next === "ampm") return " ";
    if (type === "hour" || type === "minute") return ":";
    return separator;
  };

  const weekdayShort = open ? getWeekdayNames(localeTag) : [];
  const monthLabel = open ? `${getMonthName(displayed.y, displayed.m, localeTag)} ${displayed.y}` : "";

  /* ── Markup ─────────────────────────────────────────────────────────────── */

  return (
    <>
      {label != null && (
        <label id={labelId} htmlFor={id}>
          {label}
        </label>
      )}
      <div
        ref={rootRef}
        className={className ? `DateTimeField ${className}` : "DateTimeField"}
        data-component="DateTimeField"
        data-id={id}
        data-name={name}
        data-locale={localeTag}
        data-min={minAttr}
        data-max={maxAttr}
        data-step={step != null ? String(step) : undefined}
        data-disabled={disabled ? "true" : undefined}
        data-invalid={invalid ? "true" : undefined}
        data-test-state={testState}
        /* BEHAVIOUR gate — withheld until hydration so the suite's
           `[data-initialized="true"]` barrier gates something (F-046). The CSS
           that read it is dropped; the attribute stays (F-010). */
        data-initialized={initialized ? "true" : undefined}
        /* PAINT attribute — the stylesheet keys `.overlay`'s and `.native`'s
           visibility off it, so it must appear as soon as it is known (F-047).
           `null` before hydration is the reference's own pre-`attach()` state. */
        data-input-mode={inputMode ?? undefined}
        data-open={open ? "true" : undefined}
        data-direction={direction ?? undefined}
      >
        <input
          ref={nativeRef}
          className="native"
          type="datetime-local"
          id={id}
          name={name}
          min={minAttr}
          max={maxAttr}
          step={step}
          defaultValue={defaultValue}
          disabled={disabled}
          required={required}
          /* ADR-0006: in `custom` the native input is a value carrier hidden
             from everyone; in `display` it IS the accessible control. */
          aria-hidden={inputMode === "display" ? undefined : true}
          tabIndex={inputMode === "display" ? undefined : -1}
          aria-invalid={invalid ? "true" : undefined}
          /* PRE-HYDRATION HEIGHT RESERVATION — ADR-0008 applied to the state the
             ADR forgot. Before the input-mode store resolves there is no
             `data-input-mode`, so the stylesheet's default branch paints THIS
             input as the control (`.native { display: block }` / `.overlay
             { display: none }`). Functionally correct, but the WRONG BOX: a
             native `<input type="datetime-local">` paints well under the 2.5rem
             the overlay that replaces it is guaranteed, so every instance would
             jump on hydration — Cumulative Layout Shift, and on a shared page it
             moves other components' click targets out from under Playwright's
             aim mid-gesture (F-049). Reading
             `--_dtf-field-min-block-size` rather than hardcoding `2.5rem` tracks
             the token the verbatim stylesheet already declares. Dropped once the
             mode resolves: from then on the overlay owns the box and this input
             is out of flow. */
          style={
            inputMode === null
              ? { minBlockSize: "var(--_dtf-field-min-block-size)" }
              : undefined
          }
        />

        <div className="overlay" aria-hidden={isCustom ? undefined : true}>
          <div
            className="segments"
            role="group"
            aria-labelledby={label != null ? labelId : undefined}
            aria-roledescription={t.dateTimeField}
          >
            {segmentTypes.map((type, i) => {
              const sep = separatorAfter(i);
              const isAmpm = type === "ampm";
              const limits = isAmpm
                ? null
                : segmentLimits(type, vals, minYear, maxYear, is12h);
              const value = isAmpm ? vals.ampm : vals[type];
              const placeholder = !isAmpm && value == null && digitDisplay?.seg !== type;
              return (
                <Fragment key={type}>
                  <span
                    ref={(el) => {
                      segRefs.current[type] = el;
                    }}
                    className="segment"
                    role="spinbutton"
                    data-segment={type}
                    aria-label={segmentLabel(type)}
                    /* Absent, not `="false"` — the library's boolean convention.
                       The suite asserts `aria-valuenow` is null in the
                       placeholder state, so a buffered digit must not commit. */
                    data-placeholder={placeholder ? "true" : undefined}
                    data-focused={focusedSeg === type ? "true" : undefined}
                    tabIndex={disabled ? -1 : activeSeg === type ? 0 : -1}
                    aria-disabled={disabled ? "true" : undefined}
                    /* The AM/PM segment gets only valuenow/valuetext — it is a
                       2-state toggle, not a range. The `.md` says so and the
                       suite reads valuemin/max off `hour` only. */
                    aria-valuemin={limits?.min}
                    aria-valuemax={limits?.max}
                    aria-valuenow={placeholder ? undefined : (value as number)}
                    aria-valuetext={segmentValueText(type)}
                    onKeyDown={(e) => onSegmentKeyDown(e, type)}
                    onFocus={() => {
                      /* `_setSegmentFocused` closes the popup — light dismiss,
                         so no refocus (ADR-0007). */
                      if (open) closePopup(false);
                      setActiveSeg(type);
                      setFocusedSeg(type);
                    }}
                    onBlur={() => {
                      setFocusedSeg(null);
                      if (digitDisplay?.seg === type) flushDigitBuffer(type);
                    }}
                  >
                    {segmentText(type)}
                  </span>
                  {sep && (
                    <span className="separator" aria-hidden="true">
                      {sep}
                    </span>
                  )}
                </Fragment>
              );
            })}
          </div>

          <button
            ref={triggerRef}
            type="button"
            className="trigger"
            aria-label={open ? t.closeCalendar : t.openCalendar}
            aria-expanded={open}
            /* Deliberately NO `aria-haspopup` — the reference's `_bindTrigger`
               sets only the label and `aria-expanded`. */
            disabled={disabled}
            onClick={togglePopup}
          >
            {/* 18px + `display: block` — the family-wide icon metric, ADR-0008. */}
            <svg
              aria-hidden="true"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </button>
        </div>

        {/* `.rail` is a root-level sibling of `.overlay` (not nested, unlike
            DateField's) — the stylesheet positions it absolutely against the
            root and the popup is measured against its box. */}
        <div className="rail" ref={railRef}>
          {open && (
            <div
              ref={popupRef}
              className="popup"
              id={dialogId}
              role="dialog"
              aria-modal="true"
              /* The reference labels the dialog with its OPEN label
                 ("Open calendar"), not the month heading. Kept verbatim. */
              aria-label={t.openCalendar}
              onKeyDown={onPopupKeyDown}
            >
              <div className="calendar-inner">
                <div className="calendar-left">
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
                        `aria-expanded` instead — the suite asserts both. */}
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
                      <span className="calendar-month-year">{monthLabel}</span>
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

                  {/* Both panels carry an EXPLICIT `data-active` — the documented
                      exception to "true or absent", because the CSS keys
                      `display` off both values and an attribute's removal cannot
                      be transitioned. */}
                  <div className="Panel" data-panel="calendar" data-active={panel === "calendar"}>
                    <table className="calendar-grid" role="grid">
                      <thead>
                        <tr>
                          {weekdayShort.map((short, i) => (
                            <th key={i} scope="col">
                              {short}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {weeks.map((week, wi) => (
                          <tr key={wi}>
                            {week.map((cell) => (
                              /* `data-outside-month` and `aria-disabled` on the
                                 `td`, `aria-pressed` on the button — plus
                                 `data-today` and `data-disabled`, which the
                                 stylesheet styles
                                 (`td[data-today="true"] button` bold,
                                 `td[data-disabled="true"] button` muted) and
                                 upstream's `_renderMonth()` never set, so today
                                 was not bold and an out-of-range day looked
                                 ordinary. The aria half was already right, which
                                 is why no axe or keyboard test could see it.
                                 Fixed upstream in f7ab857 (#56); DateField and
                                 WeekField set both. */
                              <td
                                key={cell.iso}
                                data-outside-month={cell.outside ? "true" : undefined}
                                data-today={cell.isToday ? "true" : undefined}
                                data-disabled={cell.isDisabled ? "true" : undefined}
                                aria-disabled={cell.isDisabled ? "true" : undefined}
                              >
                                <button
                                  type="button"
                                  tabIndex={cell.iso === rovingISO ? 0 : -1}
                                  data-date={cell.outside ? undefined : cell.iso}
                                  aria-pressed={cell.isSelected ? true : undefined}
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
                      `Wheel.css` draws the selection band and the top/bottom
                      fade on this class. */}
                  <div
                    className="Panel year-month-picker WheelColumns"
                    role="group"
                    id={pickerId}
                    data-panel="picker"
                    data-active={panel === "picker"}
                    aria-label={t.openPicker}
                  >
                    {/* Every `.Wheel` host needs a UNIQUE id —
                        `aria-activedescendant` derives from it and defaults to
                        `wheel-front`, which would collide across five wheels and
                        thirteen instances. Undocumented. */}
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
                        pickerWheels.current?.month.stepBy(e.key === "ArrowDown" ? 1 : -1);
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
                        pickerWheels.current?.year.stepBy(e.key === "ArrowDown" ? 1 : -1);
                      }}
                    />
                  </div>
                </div>

                <div className="time-columns WheelColumns">
                  {(["hour", "minute", "second"] as WheelSegmentType[]).map((type) => (
                    <div
                      key={type}
                      ref={(el) => {
                        timeWheelEls.current.set(type, el);
                      }}
                      className="Wheel"
                      data-segment={type}
                      id={`${id}-wheel-${type}`}
                      tabIndex={0}
                      aria-label={
                        type === "hour" ? t.hours : type === "minute" ? t.minutes : t.seconds
                      }
                      /* The reference keeps the seconds host in the DOM and
                         toggles `style.display`; with no `WheelColumn` attached
                         it also carries no `role="spinbutton"`, so the tab-stop
                         query skips it either way. */
                      style={type === "second" && !showSeconds ? { display: "none" } : undefined}
                      onKeyDown={(e) => {
                        if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
                        e.preventDefault();
                        timeWheels.current.get(type)?.stepBy(e.key === "ArrowDown" ? 1 : -1);
                      }}
                    />
                  ))}

                  {/* Rendered in both locales and hidden by the `hidden`
                      attribute in 24h ones, exactly as `_setupAmpmToggle` does —
                      the suite asserts `.ampm` is HIDDEN in en-GB, which is a
                      statement about an element that exists. */}
                  <div
                    className="ampm"
                    role="group"
                    aria-label={`${t.am}/${t.pm}`}
                    hidden={!is12h}
                  >
                    {is12h &&
                      ([0, 1] as const).map((v) => (
                        <button
                          key={v}
                          type="button"
                          className="ampm-option"
                          data-ampm={String(v)}
                          aria-pressed={ampmActive === v}
                          onClick={() => selectAmpm(v)}
                        >
                          {v === 0 ? t.am : t.pm}
                        </button>
                      ))}
                  </div>
                </div>
              </div>

              <div className="calendar-footer">
                {/* Actionable only when there is something to clear.
                    `calendarTabStops` already filters on `!b.disabled`, so the
                    code expected this state to exist while nothing produced it —
                    Clear sat enabled on an empty field offering an action that
                    does nothing, while the other four fields in the family
                    disable it. Fixed upstream in c2d12c2 (#57). */}
                <button
                  type="button"
                  className="calendar-footer-clear"
                  disabled={nativeValue === ""}
                  onClick={() => {
                    clearAll();
                    closePopup(true);
                  }}
                >
                  {t.clearButton}
                </button>
                <button
                  type="button"
                  className="calendar-footer-today"
                  /* Port of the reference's `todayBtn` → `_selectDate(today)`:
                     it keeps the popup OPEN (the time still has to be set) and
                     preserves the existing time. Unlike `.calendar-footer-now`,
                     which sets both halves and closes. */
                  onClick={() => selectDay(new Date(), true)}
                >
                  {t.todayButton}
                </button>
                <button
                  type="button"
                  className="calendar-footer-now"
                  onClick={() => {
                    applyDatetime(new Date());
                    closePopup(true);
                  }}
                >
                  {t.nowButton}
                </button>
              </div>

              <div className="arrow" />
            </div>
          )}
        </div>

        {/* Last child of the root, as the contract requires. */}
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
 * Order is the reference's `_calendarTabStops`: prev → month/year → next → the
 * grid (ONE composite stop, WAI-ARIA grid pattern) → time wheels → AM/PM →
 * footer. The picker panel is a modal-within-modal whose only stops are its two
 * wheels. Hidden wheels and absent buttons are excluded so Tab never lands on
 * an unreachable control. */
function popupTabStops(popup: HTMLElement): HTMLElement[] {
  const pickerActive =
    popup.querySelector('[data-panel="picker"]')?.getAttribute("data-active") === "true";

  if (pickerActive) {
    return [
      popup.querySelector<HTMLElement>('.Wheel[data-picker="month"]'),
      popup.querySelector<HTMLElement>('.Wheel[data-picker="year"]'),
    ].filter((el): el is HTMLElement => Boolean(el));
  }

  const grid = popup.querySelector<HTMLElement>(".calendar-grid");
  const gridStop = grid
    ? grid.querySelector<HTMLButtonElement>(
        'td:not([data-outside-month]):not([aria-disabled]) button[tabindex="0"]',
      ) ??
      grid.querySelector<HTMLButtonElement>(
        'td:not([data-outside-month]):not([aria-disabled]) button',
      )
    : null;

  const timeWheels = Array.from(
    popup.querySelectorAll<HTMLElement>('.Wheel[data-segment][role="spinbutton"]'),
  ).filter((w) => w.style.display !== "none");

  const ampm = Array.from(popup.querySelectorAll<HTMLButtonElement>(".ampm-option"));

  const footer = (["clear", "today", "now"] as const)
    .map((k) => popup.querySelector<HTMLButtonElement>(`.calendar-footer-${k}`))
    .filter((b): b is HTMLButtonElement => b !== null && !b.disabled);

  const stops: Array<HTMLElement | null> = [
    popup.querySelector<HTMLButtonElement>(".prev-month"),
    popup.querySelector<HTMLButtonElement>(".month-year-trigger"),
    popup.querySelector<HTMLButtonElement>(".next-month"),
    gridStop,
    ...timeWheels,
    ...ampm,
    ...footer,
  ];
  return stops.filter((el): el is HTMLElement => el !== null);
}

export default DateTimeField;
