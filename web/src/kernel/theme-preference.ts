/* theme-preference — kernel primitive, ported from
 * reference-components/src/kernel/js/theme-preference.{md,ts}
 *
 * Which colour appearance applies right now, given what the user chose and what
 * the OS reports. Two pure functions plus a projection predicate: no DOM, no
 * browser globals, and deliberately no colours.
 *
 * Kept as a plain framework-agnostic module rather than a hook, for the same
 * reason `motion-policy` was: the logic is shared by things that are not
 * components. Here that is literal — `resolvePreference` runs on the SERVER
 * (reading the cookie in the root layout) and in the CLIENT (reading the live
 * signal in ThemeSwitch). One implementation, two runtimes.
 *
 * The reason this exists at all, per ADR-0021: the production implementation it
 * models carried three copies of the decision, one of them commented
 * "duplicated from Layout for runtime use". In Next.js the layout/runtime split
 * is structural, so the temptation to duplicate is *stronger* here than in the
 * original — which makes the extraction more valuable, not less.
 */

/** What the user has chosen. `'system'` is not a third colour — it is the
 *  explicit absence of a choice, delegating to the platform signal. */
export type Preference = "system" | "light" | "dark";

/** What that resolves to. Only two appearances exist; `'system'` is never one. */
export type Appearance = "light" | "dark";

const PREFERENCES: readonly Preference[] = ["system", "light", "dark"];

/**
 * Normalise a stored preference into one this library understands.
 *
 * Everything unrecognised resolves to `'system'`: null (never chosen), the empty
 * string, a value written by a future version, a value written by another app
 * sharing the key, or plain corruption. It never throws, because an unnamed
 * preference would render a radio group with nothing checked.
 *
 * Case-sensitive on purpose: `'Dark'` is not a value this library writes, so
 * mapping it to `'dark'` would be guessing at another writer's intent.
 */
export function resolvePreference(stored: string | null | undefined): Preference {
  return PREFERENCES.includes(stored as Preference) ? (stored as Preference) : "system";
}

/**
 * Resolve a preference against the platform signal.
 *
 * Precedence — the whole state machine:
 *   1. `'light'`  → `'light'`  (explicit; the signal is not consulted)
 *   2. `'dark'`   → `'dark'`   (explicit; the signal is not consulted)
 *   3. `'system'` → the signal
 *
 * Steps 1 and 2 are the contract, not an optimisation: an OS change moves
 * nothing for a user who has chosen. Only step 3 reads `prefersDark` at all.
 */
export function resolveAppearance(preference: Preference, prefersDark: boolean): Appearance {
  if (preference === "light") return "light";
  if (preference === "dark") return "dark";
  return prefersDark ? "dark" : "light";
}

/**
 * Whether a preference should be projected onto the document at all.
 *
 * `'system'` projects nothing: an absent attribute is precisely "follow the OS",
 * which `color-scheme: light dark` already does. Writing a resolved appearance
 * for it would mean recomputing on every OS change and, before first paint, an
 * inline script to avoid a flash. Doing less is the correctness argument.
 */
export function shouldProject(preference: Preference): boolean {
  return preference !== "system";
}

/** The persistence key. The reference stores this in `localStorage`; we store it
 *  in a cookie of the same name so the SERVER can read it and render the
 *  resolved appearance into the markup — PORTING.md's preferred, flash-free
 *  structure. ADR-0021 leaves the medium explicitly to the host. */
export const APPEARANCE_COOKIE = "appearance-preference";
