/* teaserAttributes.ts — the pure-data half of `TagHelpers/TeaserTagHelper.cs`.
 *
 * Same split as `cardAttributes.ts` and `buttonAttributes.ts`: the allow-lists,
 * the silent fallbacks, the one guard and the attribute block live here and are
 * testable without a DOM; only the tree lives in `Teaser.tsx`.
 *
 * THREE THINGS THAT ARE THE SOURCE'S BEHAVIOUR, NOT OURS.
 *
 * 1. `data-button` AND `data-media` ARE BOTH WRITTEN AS `"false"`, NEVER OMITTED.
 *    CLAUDE.md's rule is `="true"` or absent, with an exception when both states
 *    are styled. `Teaser.css` styles `[data-button="false"]` (the stretched-link
 *    block) and NOT `[data-button="true"]`, so for `data-button` the exception
 *    holds in exactly one direction. For `data-media` it does not hold at all —
 *    no rule in the source stylesheet reads `data-media` in either state, so
 *    both values are inert. Reproduced anyway: it is the documented public API,
 *    it is the only DOM trace of the `image` prop, and it is what a consumer's
 *    own stylesheet selects on. Same reasoning `cardAttributes.ts` records for
 *    `data-border="false"`.
 *
 * 2. THE ELEMENT ALLOW-LIST IS THE SAME FOUR VALUES AS CARD'S, AND FAILS
 *    SILENTLY. `article | div | li | section`; anything else becomes `article`
 *    with no diagnostic. The frame allow-list (`bordered | elevated | bare`)
 *    behaves the same way. Two silent fallbacks in one component, next to one
 *    loud dev-only error box for the `button`/`href` guard — the same split
 *    personality `cardAttributes.ts` recorded.
 *
 * 3. THE ONLY HARD GUARD IS `button` WITHOUT `href`. It is checked FIRST, before
 *    either allow-list resolves, so `<app-teaser button element="nonsense">`
 *    reports the missing href and never mentions the element. Order is
 *    observable and reproduced.
 *
 * WHAT IS *NOT* HERE: the frame → Card mapping. `TeaserTagHelper` owns the
 * permitted Card combinations ("callers never set Card props directly"), so the
 * mapping is part of the contract rather than an implementation detail — it is
 * exported below as `CARD_FRAME` and consumed by `Teaser.tsx`.
 */

export type TeaserElement = "article" | "div" | "li" | "section";
export type TeaserFrame = "bordered" | "elevated" | "bare";

/* Case-insensitive membership, matching `HashSet<string>(StringComparer
 * .OrdinalIgnoreCase)`. Unreachable through the TS unions, kept because these
 * values arrive from a CMS in the real app — the same reasoning the Button and
 * Card ports recorded. */
const VALID_ELEMENTS: readonly string[] = ["article", "div", "li", "section"];
const VALID_FRAMES: readonly string[] = ["bordered", "elevated", "bare"];

/** `ValidElements.Contains(Element) ? Element.ToLowerInvariant() : "article"`. */
export function resolveTeaserElement(element: string | undefined): TeaserElement {
  const lower = (element ?? "article").toLowerCase();
  return (VALID_ELEMENTS.includes(lower) ? lower : "article") as TeaserElement;
}

/** `ValidFrames.Contains(Frame) ? Frame.ToLowerInvariant() : "bordered"`. */
export function resolveTeaserFrame(frame: string | undefined): TeaserFrame {
  const lower = (frame ?? "bordered").toLowerCase();
  return (VALID_FRAMES.includes(lower) ? lower : "bordered") as TeaserFrame;
}

/** The `button && !hasHref` guard, as data. `null` = no error. */
export function validateTeaser(button: boolean, href: string | null | undefined): string | null {
  const hasHref = href != null && href.trim() !== "";
  if (button && !hasHref) return 'button="true" requires href';
  return null;
}

/** `output.Attributes.SetAttribute(...)` — the two axes the root carries. */
export function teaserAttributes({
  button,
  hasMedia,
}: {
  button: boolean;
  hasMedia: boolean;
}): Record<string, string> {
  return {
    "data-button": button ? "true" : "false",
    "data-media": hasMedia ? "true" : "false",
  };
}

/** THE FRAME → CARD MAPPING, which is contract rather than detail.
 *
 *  The source writes the Card frame by hand into `PreElement`/`PostElement`
 *  rather than nesting `<app-card>`, with the comment: "Teaser owns the
 *  permitted Card combinations — callers never set Card props directly."
 *
 *  `bare` maps to `null`: no Card element at all, not a Card with no border.
 *  That distinction is the only one of the three frames that changes the DOM's
 *  *shape* rather than its attributes, and it is why the wrapper in `Teaser.tsx`
 *  is a conditional rather than a prop.
 *
 *  Note `elevated` is now a distinction without a difference: cursor-DESIGN.md
 *  specifies hairline-only depth ("no drop shadows, no elevation tiers"), so the
 *  Card port resolved all four `[data-elevation]` gates to nothing. `elevated`
 *  and `bare` therefore render the same *paint* inside a bordered parent, and
 *  differ only in the DOM. Recorded, not repaired — see findings. */
export const CARD_FRAME: Record<
  TeaserFrame,
  { padding: "none"; border?: true; elevation?: "sm" } | null
> = {
  bordered: { padding: "none", border: true },
  elevated: { padding: "none", elevation: "sm" },
  bare: null,
};
