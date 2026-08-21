/* Kernel primitive — ported from
 * `reference-components/src/kernel/utils/locale.ts` (contract: `utils/locale.md`).
 *
 * PLAIN, FRAMEWORK-AGNOSTIC MODULE. Do not turn this into a hook. Five
 * components declare it (DateField, DateTimeField, TimeField, MonthField,
 * WeekField), so it is ported ONCE and every consumer resolves a locale the
 * same way. `resolveLocale` is pure; `readLocale` reads two attributes off a
 * live element and is therefore client-side by construction — a caller that has
 * an `HTMLElement` is already in a document.
 *
 * Conformance: `src/kernel/tests/locale.test.ts`. The reference ships NO unit
 * test for this module ("covered via component tests" per the kernel README),
 * so that suite is written from the `.md` contract rather than adapted.
 *
 * One deliberate deviation from the reference, recorded in findings/kernel.md:
 * the reference reads the page language off the module-global `document`; we
 * read it off `el.ownerDocument`. Identical for every real call site, but it
 * removes a global read from a module the five fields import, which keeps the
 * module importable from a server bundle without a `typeof document` guard.
 */

/**
 * Read the *requested* locale for an element: `data-locale` → the owning
 * document's `<html lang>` → `fallback`. Lets a component opt into the page
 * language without authoring `data-locale` on every instance.
 */
export function readLocale(el: HTMLElement, fallback = "en"): string {
  return (
    el.dataset.locale ||
    el.ownerDocument?.documentElement?.lang ||
    fallback
  );
}

/**
 * Resolve `requested` to a key that exists in `available`: exact match → base
 * language → `fallback`. Degrading the region tag first is what makes `sv-SE`
 * find a `sv` translation instead of falling all the way back to English.
 *
 * @example resolveLocale('sv-SE', { en, sv }) // → 'sv'
 * @example resolveLocale('fr',    { en, sv }) // → 'en'
 */
export function resolveLocale(
  requested: string,
  available: Record<string, unknown>,
  fallback = "en",
): string {
  if (available[requested]) return requested;
  const base = requested.split("-")[0];
  if (base !== requested && available[base]) return base;
  return fallback;
}
