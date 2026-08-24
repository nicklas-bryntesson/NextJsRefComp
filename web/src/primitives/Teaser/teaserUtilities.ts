/* teaserUtilities.ts — STEP 3: Teaser's design values as Tailwind utilities.
 *
 * Same DOM, every structural class name kept: `Teaser`, `LayoutContainer`,
 * `MediaContainer`, `Media`, `StackedSources`, `HorizontalSources`, `Heading`,
 * `heading-link`, `Teaser-link`, `ContentContainer`, `Prose`, `Button`,
 * `Button-text`, `ScreenReaderText`, `Card`. The utilities go alongside them.
 *
 * ── THE HEADLINE: THIS CONVERSION IS PARTIAL, AND THE BOUNDARY IS OWNERSHIP ──
 *
 * Button's and Card's conversions emptied their stylesheets. Teaser's cannot,
 * and the reason is not that anything here is hard to express — it is that
 * **a utility has to be written on an element, and a composition component does
 * not own all the elements its stylesheet styles.**
 *
 * Three groups of rules could not move, each for the same reason:
 *
 *  1. `.Media.StackedSources` / `.Media.HorizontalSources` — the two picture
 *     groups the container query swaps. They are rendered by `MediaFigure`,
 *     which takes ONE `pictureClass` and applies it to BOTH groups, then appends
 *     each group's own `cssClass`. So there is no seam through which Teaser can
 *     give one group `@max-[24.999rem]:block` and the other
 *     `@max-[24.999rem]:hidden`. This is the single most important rule in the
 *     file — it is what makes the component art-directed — and it is the one
 *     rule that structurally cannot be a utility. (`MediaFigure` would need a
 *     per-group class prop. Reported, not added: it is another component's
 *     surface.)
 *  2. `.ContentContainer > time` — the source's documented *body slot*. Whatever
 *     the caller puts there is markup Teaser never sees, so a rule about "a
 *     `<time>` in the slot" has no element to attach to. Exactly the reason
 *     Prose could not be converted at all.
 *  3. The whole `@supports not (container-type: inline-size)` fallback. Half of
 *     it is group 1, so splitting it across two mechanisms would leave a
 *     progressive-enhancement layer that is half utilities and half CSS and
 *     correct only in combination.
 *
 * Everything else moved, including two things worth calling out because the
 * Button port concluded they could not:
 *
 *  · THE PSEUDO-ELEMENT CONVERTED. `.Teaser-link::after` — the stretched link —
 *    is four declarations and became `after:content-[''] after:absolute
 *    after:inset-0 after:cursor-pointer`. The Button port's verdict was "a
 *    pseudo-element cannot carry a class, so a utility cannot reach it", and that
 *    is true of a class but not of Tailwind: the `after:` variant generates the
 *    pseudo-selector. What Button actually could not convert was a pseudo-element
 *    whose value came from the CASCADE (`var(--_paddingBlock)` inherited per
 *    size). The correct rule is narrower than the one recorded: a utility can
 *    reach a pseudo-element; it cannot reach an inherited value.
 *  · CONTAINER QUERIES CONVERTED, exactly. `@container` on the root plus
 *    `@max-[24.999rem]:` / `@min-[25rem]:` variants reproduce both states,
 *    including `grid-template-areas` as an arbitrary property — Tailwind rewrites
 *    `_` to a space, and it does so INSIDE the quoted strings too, so
 *    `[grid-template-areas:'media_heading'_'media_body'_'media_body']` is exactly
 *    the source's three-row template. Nothing about a container query resisted.
 *
 * ── AND THE `@supports` PAIR IS ASYMMETRIC UNDER CONVERSION ─────────────────
 *
 * The POSITIVE gate becomes redundant: `container-type` is an unknown
 * declaration in an engine without container queries (dropped), and an
 * `@container` at-rule cannot match there either, so the utilities are
 * self-gating and `@supports (container-type: inline-size)` earns nothing. The
 * one declaration inside it that is NOT self-gating is `display: grid`, which is
 * why `LAYOUT` below carries `supports-[container-type:inline-size]:grid` rather
 * than a bare `grid`.
 *
 * The NEGATIVE gate is the load-bearing one and it stays in CSS.
 *
 * ── WHAT WAS DELETED: THE OVERRIDE SEAM (F-062, second data point) ──────────
 *
 * Step 2's five `--_*` properties are gone. Unlike Button's, they were not a
 * blank-property gate — they were named values with real defaults, which is the
 * gentler, more defensible version of the idiom, and it makes no difference: once
 * `p-lg` is on the element, `--_padding` has no reader.
 *
 * The loss is worse here than for Button for one specific reason. Button has a
 * `className` prop, so a consumer retains *a* seam (thread conflicting utilities
 * in and hope the generated order favours them). **Teaser has no `className`
 * prop at all** — faithfully, because `TeaserTagHelper` calls
 * `SetAttribute("class", "Teaser")`, which replaces rather than appends. So the
 * custom properties were not one seam among several; they were the only one, and
 * after this file there is none. The worked example in step 2's Teaser.css — a
 * three-line `.FeatureGrid .Teaser { --_padding: … }` rule — now has nothing to
 * attach to.
 *
 * ── AND `--_minMediaSize` BECAME A LITERAL ──────────────────────────────────
 *
 * `minmax(var(--_minMediaSize), 1fr)` and `min-block-size: var(--_minMediaSize)`
 * were ONE value read in two places — a relationship, in ADR-0025's sense: "the
 * media column is never narrower than the media box's own minimum". Converted,
 * `12rem` appears twice, as two literals, in two different files' worth of class
 * strings. They are equal today and nothing keeps them equal. Same shape as the
 * Button port's `calc((var(--_iconSize) / 2) * -1)` → three constants, and the
 * computed-style diff cannot see it: 0 diffs is exactly what a correct-today
 * duplication produces.
 */

/** THE ROOT.
 *
 *  `@container` is Tailwind's `container-type: inline-size`. It replaces the
 *  declaration the source puts inside `@supports (container-type: inline-size)`,
 *  and needs no gate: an engine that does not know the property drops it, which
 *  is what the gate was for. */
export const TEASER_ROOT =
  "@container relative flex flex-col items-start flex-1 p-lg";

/** THE LAYOUT GRID.
 *
 *  `supports-[container-type:inline-size]:grid`, not `grid`. This is the one
 *  declaration in the positive `@supports` branch that is not self-gating — an
 *  engine without container queries must fall through to the CSS fallback, where
 *  `.LayoutContainer` is a block box and `.MediaContainer` gets
 *  `inline-size: 100%`. Emitting a bare `grid` would silently change the
 *  ~3%-of-browsers branch from "block flow" to "single-column grid", which is a
 *  different layout with no test that could see it.
 *
 *  `gap-x-lg` is likewise inside the positive branch upstream; it is inert
 *  without `display: grid` above it, so it needs no gate of its own. */
export const LAYOUT = [
  "flex-1",
  "supports-[container-type:inline-size]:grid",
  "gap-x-lg",
  /* STATE A — flow-vertical. Tailwind rewrites `_` to a space, inside the quoted
     strings as well, so this is `"media" "heading" "body"`. */
  "@max-[24.999rem]:[grid-template-areas:'media'_'heading'_'body']",
  /* STATE B — flow-horizontal. `12rem` is `--_minMediaSize` inlined; see the
     header note on the relationship that is now a duplicated literal. */
  "@min-[25rem]:[grid-template-columns:minmax(12rem,1fr)_2fr]",
  "@min-[25rem]:grid-rows-[auto_auto_1fr]",
  "@min-[25rem]:[grid-template-areas:'media_heading'_'media_body'_'media_body']",
  "@min-[25rem]:h-full",
  "@min-[25rem]:items-stretch",
].join(" ");

/** THE MEDIA FIGURE.
 *
 *  Reachable ONLY because `MediaHelper.BuildFigureHtml` already took
 *  `figureClass` as a parameter and the source already overrides it here. The
 *  seam this conversion needs was in the source's API by luck rather than by
 *  design — and the sibling seam it needs for the two picture GROUPS was not.
 *
 *  `min-h-[12rem]`: the second copy of `--_minMediaSize`. */
export const MEDIA_FIGURE = [
  "rounded-md overflow-hidden",
  "[grid-area:media]",
  "@max-[24.999rem]:mb-sm",
  "@min-[25rem]:min-h-[12rem]",
].join(" ");

/** THE HEADING, placed in the grid. Arrives through `HeadingProps.className`,
 *  which lands on the root — the one thing Heading's contract does let a
 *  composer reach. */
export const HEADING_PLACEMENT = "[grid-area:heading] mb-sm";

/** THE BODY. `[grid-area:body]` is inside the positive `@supports` branch
 *  upstream but is harmless outside a grid, so it needs no gate. The four flex
 *  declarations are in BOTH `@supports` branches upstream, i.e. unconditional in
 *  effect. */
export const CONTENT = "flex flex-col items-start flex-1 [grid-area:body] gap-sm";

/** THE STRETCHED LINK.
 *
 *  Two rows, because `Teaser.css` gates the overlay on
 *  `.Teaser[data-button="false"]` and a utility cannot be gated on an ancestor's
 *  attribute. Teaser knows `button` at render time, so the decision moves into
 *  the component — the Button port's recurring result ("any CSS that relies on a
 *  gate becomes a decision the component must make before rendering"), reached
 *  here for an ANCESTOR gate rather than a self gate.
 *
 *  Note what that costs in kind rather than in pixels: upstream, a consumer can
 *  turn the stretched link off for a subtree with
 *  `.SomeContext .Teaser[data-button="false"] .Teaser-link::after { content: none }`.
 *  After this, the overlay is a class on the anchor and that rule loses. The
 *  attribute is still written, still documented, and no longer styles anything —
 *  the same "an axis can die twice" outcome `Card.css` records for
 *  `data-elevation`. */
export const LINK_BASE = "no-underline text-inherit block";
export const LINK_STRETCHED =
  "after:content-[''] after:absolute after:inset-0 after:cursor-pointer hover:underline";

/** THE CTA's position in state B. Arrives through `LinkButtonProps.className`.
 *
 *  Upstream this is `.Teaser .LayoutContainer .ContentContainer .Button` inside
 *  `@container (min-width: 25rem)` — a four-level descendant selector that says
 *  "a Button in a Teaser's body, when the Teaser is wide". As utilities it says
 *  "this button pushes itself to the bottom-right when its nearest container is
 *  wide", which is the same computed result and a strictly weaker statement: it
 *  is true of THIS button only, and a second button a caller puts in the child
 *  slot does not get it. Upstream, it would. */
export const CTA_PLACEMENT = "@min-[25rem]:mt-auto @min-[25rem]:ml-auto";

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}
