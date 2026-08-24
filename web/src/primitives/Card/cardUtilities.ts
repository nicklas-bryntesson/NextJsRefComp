/* cardUtilities.ts — STEP 3: Card's design values as Tailwind utilities.
 *
 * Same DOM, same class name. `Card` is still on the element — it is the
 * component's ENTIRE public identity (there are no `Card-*` parts; see
 * `Card.tsx`), it is what `Teaser.css` selects to lay itself out inside the
 * frame, and it is the key the computed-style probe walks. The utilities go
 * alongside it.
 *
 * ── HOW THIS COMPARES WITH THE BUTTON CONVERSION ───────────────────────────
 *
 * The Button port's three costs were: the cascade becoming a lookup table
 * (9 enumerated emphasis × intent rows), every state written twice (`hover:` AND
 * `data-[test-state=hover]:`), and relationships becoming constants
 * (`calc(var(--_iconSize) / 2 * -1)` → three literals).
 *
 * NONE OF THE THREE APPLIES HERE, and the reason is structural rather than
 * lucky:
 *
 *   · Card's axes do not compose. `padding`, `border` and `elevation` each own
 *     different properties, so no gate ever overrode another gate and there is
 *     nothing for a lookup table to disambiguate. The tables below are lookups
 *     only because a class name has to be a literal (see the note under
 *     CARD_PADDING) — not because the cascade was doing work.
 *   · Card has no states. `Card.css` has no `:hover`, no `:focus-visible`, no
 *     `[data-test-state]`, so there is nothing to write twice.
 *   · Card has no relationships. Every value is a token reference or a literal;
 *     there is no `calc()` in the file at all.
 *
 * So the conversion is clean — and that is a finding about which stylesheets
 * convert cheaply, not about Tailwind. A component whose axes are ORTHOGONAL and
 * STATELESS converts one-for-one. Button's axes were neither.
 *
 * ── AND CARD.CSS IS NOW EMPTY ──────────────────────────────────────────────
 *
 * Every one of the source's nine declarations moved. `Button.css` kept its
 * `[data-test-state="debug"]` pseudo-elements, which no utility can reach; Card
 * has no pseudo-element, so nothing is left. `Card.css` survives as a header
 * with no rules, which is worth keeping: it is the file a future porter diffs
 * against the source, and deleting it would delete that trail.
 *
 * ── WHAT THE CONVERSION DOES TO THE OVERRIDE SEAM ──────────────────────────
 *
 * Step 2 measured something F-062 did not predict: a consumer's plain
 * `className="bg-ink"` ALREADY lost before step 3, because Tailwind emits
 * utilities inside `@layer utilities` and a module-imported component stylesheet
 * is unlayered — and unlayered normal declarations beat every layer, whatever
 * their specificity. `:where(.Card)` is specificity zero precisely so one
 * consumer class can win, and it could not.
 *
 * Step 3 moves Card's own values INTO the utilities layer, so consumer and
 * component are finally in the same layer and the contest becomes an ordering
 * one. Whether that helps is measured, not assumed — see findings.
 */

import type { CardElevation, CardPadding } from "./cardAttributes";

/** Every `.Card` carries these regardless of axis.
 *
 *  `overflow-hidden` is the one to be careful about: it is what clips a Teaser's
 *  full-bleed media to the frame's radius, and Teaser is not on this route, so
 *  the computed-style probe measures `overflow-x` / `overflow-y` explicitly to
 *  keep it from being dropped silently by a component that cannot see its own
 *  most important consumer. */
export const CARD_ROOT = "overflow-hidden flex flex-col gap-sm rounded-lg bg-surface-card";

/* Literals, not built strings. Tailwind v4 finds candidates by scanning the raw
 * TEXT of source files, so `p-${step}` generates nothing — no error, no warning,
 * just an unstyled component. The Button port lost a build cycle to this; the
 * tables here are deliberately spelled out for the same reason, even though a
 * four-entry map is exactly the shape a helper would tidy up. */
export const CARD_PADDING: Record<CardPadding, string> = {
  none: "p-0",
  sm: "p-base", /* 16px — derived; the doc has no small card */
  md: "p-lg", /*   24px — feature-card / comparison-card / testimonial-card */
  lg: "p-xl", /*   32px — pricing-tier-card */
};

/** `border` is `border-width: 1px`; Tailwind's preflight already supplies
 *  `border-style: solid`, which is why the source's `border: 1px solid …`
 *  shorthand becomes two utilities and not three. */
export const CARD_BORDER: Record<"true" | "false", string> = {
  true: "border border-hairline",
  false: "",
};

/** THE INERT AXIS, AND IT CONVERTS TO NOTHING.
 *
 *  Step 2 resolved all four elevation gates to `box-shadow: none` because
 *  cursor-DESIGN.md rules out elevation tiers by name. `none` is already the
 *  computed default, so there is no utility to emit — not even `shadow-none`,
 *  which would be a class that changes nothing.
 *
 *  The table is kept, with its empty strings, because deleting it would hide the
 *  outcome. What the conversion makes visible is that an axis emptied by a design
 *  decision leaves NO TRACE in the styling layer at all: `data-elevation` is
 *  still written to the DOM, still documented, still selectable by a consumer —
 *  and after step 3 there is no longer any code anywhere in the component that
 *  reads it. In step 2 the four dead gates were at least still in the
 *  stylesheet, visible to anyone opening the file. */
export const CARD_ELEVATION: Record<CardElevation | "absent", string> = {
  absent: "",
  none: "",
  sm: "",
  md: "",
  lg: "",
};

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}
