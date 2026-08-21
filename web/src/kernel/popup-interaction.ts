/* Kernel primitive — ported from
 * `reference-components/src/kernel/js/popup-interaction.ts`
 * (contract: `js/popup-interaction.md`).
 *
 * PLAIN, FRAMEWORK-AGNOSTIC MODULE. Do not turn this into a hook. All five
 * popup fields (DateField, DateTimeField, TimeField, MonthField, WeekField)
 * declare it, so it is ported ONCE — per PORTING.md, "no field can drift into
 * leaking focus out of an `aria-modal` dialog or jittering the page behind a
 * wheel".
 *
 * This is the one module in this batch that touches the DOM. Two deliberate
 * decisions, both recorded in findings/kernel.md:
 *
 *  1. NATIVE LISTENERS, not React handlers. `keydown` is registered on the
 *     container with `addEventListener`, and the `wheel` listener MUST be
 *     native — React attaches its `onWheel` delegate passively at the root, so
 *     `preventDefault()` from a synthetic wheel handler is a no-op and Chrome
 *     logs "Unable to preventDefault inside passive event listener". A native
 *     `{ passive: false }` listener is the only way to contain the scroll.
 *     Native listeners also sit *below* React's delegation, so they see the
 *     event before any synthetic handler and are unaffected by React's
 *     batching.
 *
 *  2. SSR-SAFE BY CONSTRUCTION, not by guard. Every argument is supplied by the
 *     caller (`container`, `tabStops`, `signal`) and nothing here reads
 *     `window`, `document` or `navigator` at module scope. `document.activeElement`
 *     is read only inside the keydown handler, which cannot run on the server.
 *     So unlike `popup-position` — whose `= window.innerWidth` defaults make it
 *     unsafe to *call* outside the browser — this module is safe to import from
 *     a server bundle and simply never fires. No `typeof document` guard is
 *     added, because one would only mask a caller passing a bad container.
 *
 * StrictMode: a double-invoked effect calls this twice. That is safe *only*
 * because teardown is an `AbortSignal` — the first invocation's controller is
 * aborted by the cleanup before the second runs, so no duplicate listener
 * survives. Callers must create the AbortController inside the same effect that
 * calls this, and abort it in the cleanup. Reusing one long-lived controller
 * across opens would double-register under StrictMode.
 *
 * Conformance: `src/kernel/tests/popup-interaction.test.ts`.
 */

export interface TrapPopupInteractionOptions {
  /** The popup surface (role="dialog"). Both listeners attach here. */
  container: HTMLElement;
  /**
   * The popup's tab stops in visual/DOM order — wheels first, then footer
   * buttons. Called fresh on every Tab so the order reflects the CURRENT DOM
   * (a disabled/absent Clear button, a hidden seconds wheel). Must return only
   * elements that can receive focus; `tabindex="-1"` is fine, because
   * programmatic `.focus()` works on it, which is what lets this compose with
   * the component's roving-tabindex wheel navigation instead of fighting it.
   */
  tabStops: () => HTMLElement[];
  /** Torn down with the popup — mirror WheelColumn's `{ signal }` teardown. */
  signal: AbortSignal;
}

/* ── Pure tab-stop wrapping ─────────────────────────────────────────────────── */

/**
 * Given the ordered `stops` and the element that currently holds focus, return
 * the element Tab (or Shift+Tab when `backward`) should move to under a cyclic
 * trap. Wraps at both ends. Returns `null` only when there is nowhere to go
 * (empty list). Pure — no DOM side effects.
 *
 * When `current` is not one of the stops (focus sat on some non-stop element,
 * or nothing is focused) it snaps onto an end: the first stop going forward,
 * the last going backward — so a stray Tab always lands back inside the popup.
 */
export function nextTabStop(
  stops: HTMLElement[],
  current: Element | null,
  backward: boolean,
): HTMLElement | null {
  if (stops.length === 0) return null;

  const i = current ? stops.indexOf(current as HTMLElement) : -1;

  if (i === -1) {
    return backward ? stops[stops.length - 1] : stops[0];
  }

  const delta = backward ? -1 : 1;
  const next = (i + delta + stops.length) % stops.length;
  return stops[next];
}

/* ── Wiring ─────────────────────────────────────────────────────────────────── */

/**
 * Install the cyclic focus trap + scroll containment on `container`. Both
 * listeners are removed automatically when `signal` aborts — close the popup by
 * aborting its controller. Call once per popup open.
 *
 * Tab is **always** `preventDefault`ed while the popup is open, which is the
 * correct behaviour for `aria-modal="true"`. The one documented exception: when
 * `tabStops()` returns an EMPTY list the handler returns before
 * `preventDefault`, and Tab leaks to the page. The trap assumes at least one
 * stop.
 */
export function trapPopupInteraction(opts: TrapPopupInteractionOptions): void {
  const { container, tabStops, signal } = opts;

  container.addEventListener(
    "keydown",
    (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const stops = tabStops();
      if (stops.length === 0) return;
      const target = nextTabStop(
        stops,
        container.ownerDocument.activeElement,
        e.shiftKey,
      );
      if (!target) return;
      // Always take over Tab inside an aria-modal dialog — even a single stop
      // (Tab must not leak to the page).
      e.preventDefault();
      target.focus();
    },
    { signal },
  );

  // Contain wheel scroll for the whole surface. The wheel columns
  // preventDefault their own events too; a second preventDefault here is
  // harmless. NOTE: the popup has no legitimately-scrollable inner region
  // today — if one is ever added it must stop propagation (or opt out) before
  // this blanket handler runs, or its own scrolling will be swallowed.
  container.addEventListener(
    "wheel",
    (e: WheelEvent) => {
      e.preventDefault();
    },
    { passive: false, signal },
  );
}
