/* Kernel primitive — ported verbatim in behaviour from
 * `reference-components/src/kernel/js/popup-position.ts`.
 *
 * PLAIN, FRAMEWORK-AGNOSTIC MODULE. Do not turn this into a hook. Six
 * components in the reference declare it (ToggleTip plus the five popup
 * date/time fields), so it is ported ONCE and every consumer composes the same
 * verified maths. There is no React, no DOM and no side effect in here: the
 * caller reads rects and applies the results.
 *
 * Conformance: `src/kernel/tests/popup-position.test.ts`, adapted from
 * `reference-components/src/kernel/js/tests/popup-position.unit.test.ts`.
 * PORTING.md excludes unit tests from the portable contract because they are
 * white-box; these three are not — the kernel doc calls them "black-box: port
 * the three functions, run this suite against your implementation".
 *
 * Known limitation (kernel doc + ADR-0012): these offsets assume the popup is
 * positioned in normal flow, so an ancestor with `overflow: hidden|auto|scroll`
 * clips it. The escape (top layer / portal) is the consuming project's call and
 * is deliberately NOT baked in here.
 *
 * The default arguments read `window`, so callers on the server must pass
 * `viewportWidth` / `viewportHeight` explicitly. Every call site in this repo
 * runs inside an effect or an event handler, i.e. client-side only.
 */

/**
 * Percentage offset of the bubble along the slide rail, clamped so the bubble
 * never overflows the viewport. Returns a PERCENTAGE of `containerWidth` (the
 * rail), not pixels. When the bubble cannot fit either edge it centres on the
 * viewport instead.
 */
export function calculatePopupOffset(
  triggerCenterX: number,
  containerLeft: number,
  containerWidth: number,
  popupWidth: number,
  viewportWidth: number = window.innerWidth,
  viewportInset: number = 0,
): number {
  const idealLeft = triggerCenterX - containerLeft;
  const minLeft = -containerLeft + popupWidth / 2 + viewportInset;
  const maxLeft = viewportWidth - containerLeft - popupWidth / 2 - viewportInset;
  const clampedLeft =
    minLeft <= maxLeft
      ? Math.max(minLeft, Math.min(idealLeft, maxLeft))
      : viewportWidth / 2 - containerLeft;
  return (clampedLeft / containerWidth) * 100;
}

/**
 * px correction so the arrow points at the trigger centre, clamped to
 * `popupWidth / 2 - borderRadius - arrowSize / 2` so it never detaches from a
 * rounded corner.
 */
export function calculateArrowOffset(
  triggerCenterX: number,
  popupLeft: number,
  popupWidth: number,
  borderRadius: number,
  arrowSize: number,
): number {
  const rawOffset = triggerCenterX - (popupLeft + popupWidth / 2);
  const limit = popupWidth / 2 - borderRadius - arrowSize / 2;
  return Math.max(-limit, Math.min(rawOffset, limit));
}

/**
 * Which side of the trigger has more room. Compares available space only — the
 * component decides what to do with the result. Ties go to `'top'`.
 */
export function detectDirection(
  triggerRect: Pick<DOMRect, "top" | "bottom">,
  viewportHeight: number = window.innerHeight,
): "top" | "bottom" {
  const spaceAbove = triggerRect.top;
  const spaceBelow = viewportHeight - triggerRect.bottom;
  return spaceAbove >= spaceBelow ? "top" : "bottom";
}

/** Direction a popup can take relative to its trigger. */
export type PopupDirection = "top" | "bottom";
