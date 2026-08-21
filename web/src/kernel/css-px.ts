/* Kernel primitive — PROMOTED, not ported from a reference kernel module.
 *
 * The reference has no `css-px` module: it duplicates this probe as a private
 * `_getCSSPx()` method in SIX components — ToggleTip, DateField, DateTimeField,
 * TimeField, MonthField and WeekField (grep `_getCSSPx` in the submodule). The
 * ToggleTip port kept it as a local helper and recommended promoting it once a
 * second consumer arrived; the five popup fields are that second consumer, so it
 * lives here now and `ToggleTip.tsx` imports it.
 *
 * WHY A PROBE AND NOT `getComputedStyle`. `getComputedStyle(el)
 * .getPropertyValue('--x')` returns a custom property's *specified* value, not
 * its used value: `calc(…)`, `clamp(…)`, `rem`, and `var()` chains all come back
 * textually unresolved, because a custom property has no type until it is
 * substituted into a real property. The only honest resolution is to let layout
 * do it — substitute the property into a `width`, measure the box, throw the box
 * away.
 *
 * THE PROBE MUST BE APPENDED INSIDE THE COMPONENT ROOT, not to `<body>`. Custom
 * properties inherit, so the value of `--_tt-arrow-size` at `<body>` is not
 * necessarily its value inside the component — a component-scoped or variant
 * override would be invisible from outside. `host` is the element whose
 * cascade you want to read.
 *
 * REACT SAFETY. Append → measure → remove happens synchronously inside one
 * call, so React never observes the extra child: there is no commit, no
 * reconciliation and no effect between the append and the remove.
 * `getBoundingClientRect()` forces a synchronous layout, which is the point —
 * the number is always current — and also the cost, so batch calls rather than
 * calling this in a loop.
 *
 * SSR: safe to import, client-only to call — it needs a live `host` element,
 * and `host.ownerDocument` is used rather than a global `document` so it also
 * works for an element in another document.
 *
 * Conformance: `src/kernel/tests/css-px.test.ts` (mechanics, jsdom — jsdom has
 * no layout engine, so real resolution is verified in Chromium by
 * `web/tasks/probes/css-px-browser.cjs`).
 */

/**
 * Resolve a CSS custom property to pixels, as seen from inside `host`.
 *
 * @param host     the element whose cascade the property is read from — the
 *                 component root, not `document.body`.
 * @param property the custom property name, including the leading `--`.
 * @returns the resolved width in CSS pixels. `0` when the property is unset
 *          (the probe's own `0px` fallback), and `0` in any environment without
 *          a layout engine (jsdom).
 */
export function resolveCssPx(host: HTMLElement, property: string): number {
  const probe = host.ownerDocument.createElement("div");
  probe.style.cssText = `position:absolute;visibility:hidden;pointer-events:none;width:var(${property},0px)`;
  host.appendChild(probe);
  const px = probe.getBoundingClientRect().width;
  host.removeChild(probe);
  return px;
}
