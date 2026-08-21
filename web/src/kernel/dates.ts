/* Kernel primitive — ported from
 * `reference-components/src/kernel/utils/dates.ts` (contract: `utils/dates.md`).
 *
 * PLAIN, FRAMEWORK-AGNOSTIC MODULE. Pure functions, no DOM, no React. Four
 * components declare it (DateField, DateTimeField, MonthField, WeekField), so
 * it is ported ONCE — the kernel README's whole argument is that Dec↔Jan wrap,
 * leap years, the ISO week-numbering year and the min/max clamp must not be
 * re-interpreted per component.
 *
 * Timezone safety is structural: every construction is `new Date(y, m, d)`
 * (local), never a UTC string parse, so a date never shifts a day across
 * timezones. Keep it that way — `new Date('2026-03-05')` is UTC midnight and
 * would render as Mar 4 west of Greenwich.
 *
 * Conformance: `src/kernel/tests/dates.test.ts`, adapted from
 * `reference-components/src/kernel/utils/tests/dates.unit.test.ts`. That file is
 * black-box by its own header ("they exercise the public API of dates.ts with no
 * DOM and no component"), so PORTING.md's blanket exclusion of `*.unit.test.*`
 * does not apply — see findings/kernel.md.
 *
 * `getWeekdayNames`, `getMonthName` and `getSegmentOrder` go through `Intl`, so
 * their output depends on the host's ICU data. See findings/kernel.md for the
 * measured Node-vs-Chromium comparison.
 */

/** Days in a month. `month` is 0-indexed. Day 0 of the next month is the last of this one. */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** Clamp a day number into a month — how the day segment re-clamps on a month/year change. */
export function clampDayToMonth(year: number, month: number, day: number): number {
  return Math.min(day, getDaysInMonth(year, month));
}

/** Weekday of the 1st, **Monday-first**: 0 = Mon … 6 = Sun. The calendar grid assumes this. */
export function getFirstWeekdayOfMonth(year: number, month: number): number {
  const day = new Date(year, month, 1).getDay();
  return (day + 6) % 7; // 0=Mon, 6=Sun
}

/** ISO-8601 week number of a date. */
export function getISOWeek(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  return (
    1 +
    Math.round(
      ((d.getTime() - week1.getTime()) / 86400000 -
        3 +
        ((week1.getDay() + 6) % 7)) /
        7,
    )
  );
}

/** Day-granularity range test. `min` and `max` are **inclusive** — both are selectable. */
export function isDayDisabled(date: Date, min: Date | null, max: Date | null): boolean {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (min) {
    const minDay = new Date(min.getFullYear(), min.getMonth(), min.getDate());
    if (d < minDay) return true;
  }
  if (max) {
    const maxDay = new Date(max.getFullYear(), max.getMonth(), max.getDate());
    if (d > maxDay) return true;
  }
  return false;
}

/** `YYYY-MM-DD` from local fields — the native `<input type="date">` value. */
export function formatISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** `YYYY-MM-DDTHH:mm[:ss]` — the native `<input type="datetime-local">` value. */
export function formatDatetimeISO(date: Date, includeSeconds = false): string {
  const base = formatISO(date);
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  if (includeSeconds) {
    const ss = String(date.getSeconds()).padStart(2, "0");
    return `${base}T${hh}:${mm}:${ss}`;
  }
  return `${base}T${hh}:${mm}`;
}

/** Seven short weekday names, **Monday-first**. 2024-01-01 is a Monday. */
export function getWeekdayNames(locale: string): string[] {
  const monday = new Date(2024, 0, 1);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return new Intl.DateTimeFormat(locale, { weekday: "short" }).format(d);
  });
}

/** Long month name via `Intl`. `month` is 0-indexed. */
export function getMonthName(year: number, month: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: "long" }).format(
    new Date(year, month, 1),
  );
}

/**
 * Format a year + zero-based month as the native `<input type="month">` value.
 * @example formatMonthISO(2026, 5) // "2026-06"
 */
export function formatMonthISO(year: number, month: number): string {
  const m = String(month + 1).padStart(2, "0");
  return `${year}-${m}`;
}

/**
 * Parse a `YYYY-MM` value into a year + zero-based month.
 * Returns `null` for empty or malformed input.
 * @example parseMonthISO("2026-06") // { year: 2026, month: 5 }
 */
export function parseMonthISO(value: string): { year: number; month: number } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  if (month < 0 || month > 11) return null;
  return { year, month };
}

/* ── ISO week helpers (native <input type="week"> value: 'YYYY-Www') ─────────
   The ISO week-*numbering* year can differ from the calendar year near Jan 1 /
   Dec 31 (Mon 2025-12-29 is 2026-W01; 2027-01-01 is 2026-W53). Week↔date
   mapping must go through these — never infer the year from a visible month. */

/** ISO week-numbering year for a date (the calendar year of that week's Thursday). */
export function getISOWeekYear(date: Date): number {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7)); // → Thursday of this ISO week
  return d.getFullYear();
}

/** Monday of the given ISO week. Jan 4 is always in ISO week 1. */
export function getDateOfISOWeek(weekYear: number, week: number): Date {
  const jan4 = new Date(weekYear, 0, 4);
  const week1Monday = new Date(jan4);
  week1Monday.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
  const monday = new Date(week1Monday);
  monday.setDate(week1Monday.getDate() + (week - 1) * 7);
  return monday;
}

/** Format an ISO week-year + week as the native value. @example formatWeekISO(2026, 27) // "2026-W27" */
export function formatWeekISO(weekYear: number, week: number): string {
  return `${weekYear}-W${String(week).padStart(2, "0")}`;
}

/** Parse a 'YYYY-Www' value. Returns null for malformed input or week outside 1–53. */
export function parseWeekISO(value: string): { weekYear: number; week: number } | null {
  const match = /^(\d{4})-W(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const weekYear = Number(match[1]);
  const week = Number(match[2]);
  if (week < 1 || week > 53) return null;
  return { weekYear, week };
}

export type DateSegmentType = "day" | "month" | "year";

/**
 * Derive day/month/year segment order and the separator from
 * `Intl.formatToParts`, stripping bidi control characters. Falls back to
 * `{ order: ['day','month','year'], separator: '/' }` when `Intl` throws (an
 * invalid tag) or yields fewer than three date parts.
 */
export function getSegmentOrder(locale: string): {
  order: DateSegmentType[];
  separator: string;
} {
  try {
    const parts = new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date(2026, 0, 15));

    const order: DateSegmentType[] = [];
    let separator = "/";

    for (const part of parts) {
      if (part.type === "day" || part.type === "month" || part.type === "year") {
        order.push(part.type);
      } else if (
        part.type === "literal" &&
        order.length > 0 &&
        order.length < 3
      ) {
        const stripped = part.value
          .replace(/[\u200B-\u200F\u202A-\u202E\uFEFF]/g, "")
          .trim();
        if (stripped) separator = stripped;
      }
    }

    if (order.length === 3) return { order, separator };
  } catch {
    /* invalid locale tag — fall through to the documented default */
  }

  return { order: ["day", "month", "year"], separator: "/" };
}
