/* Card.tsx — port of `TagHelpers/CardHelper.cs` (`app-card`).
 *
 * A Server Component with zero client JS. Like the Button family, the whole
 * TagHelper does nothing but compute attributes, which is exactly the case
 * CLAUDE.md wants left on the server.
 *
 * FOUR BEHAVIOURS THAT ARE EASY TO LOSE AND ARE KEPT DELIBERATELY:
 *
 *  1. THE SUPPRESSION RULE, and it is checked FIRST. `ProcessAsync` calls
 *     `output.SuppressOutput()` for empty-or-whitespace child content before it
 *     validates anything — so an empty card with an invalid padding renders
 *     nothing rather than an error. Order reproduced.
 *  2. THE DEV ERROR BOX. An invalid padding or elevation renders a red-outlined
 *     diagnostic in Development and renders NOTHING in Production. React's
 *     equivalent of `env.IsDevelopment()` is `process.env.NODE_ENV`, which Next
 *     inlines at build time, so the box is dead code in the production bundle —
 *     the same as upstream. Note the consequence for this repo: every gate we
 *     run measures a production build, so no probe on this route can ever see
 *     the box. See findings.
 *  3. THE ELEMENT IS AN ALLOW-LIST WITH A SILENT FALLBACK. `element="aside"`
 *     renders an `<article>` and says nothing. `CTABlock`'s root IS an `<aside>`,
 *     so it cannot be expressed as a Card — and measurement says the allow-list
 *     is right and CTABlock is wrong: a faithful `<aside>` demo put a real
 *     `landmark-complementary-is-top-level` violation on this route, which is
 *     exactly what the source produces inside `<main>`. See findings.
 *  4. `data-border="false"` IS WRITTEN, NOT OMITTED. See `cardAttributes.ts`.
 *
 * ONE THING THE SOURCE DOES NOT HAVE: parts. `Card.css` styles the root and
 * nothing else — there is no `.Card-header`, `.Card-body` or `.Card-media`. The
 * card is a flex column with a gap, and the children are whatever the caller
 * puts in. That is what makes it composable by Teaser, and it means this port
 * has exactly ONE structural class name to preserve through step 3: `Card`.
 */

import { createElement, type ReactNode } from "react";
import "./Card.layered.css";
import {
  cardAttributes,
  cardClassName,
  resolveCardElement,
  validateCard,
  type CardElevation,
  type CardElement,
  type CardPadding,
} from "./cardAttributes";
/* Imported rather than duplicated. `IsEmptyOrWhiteSpace` has to mean the same
 * thing in every helper that branches on it, and the Button port already
 * translated it once; a second copy would be a second definition of the
 * suppression rule. The cost is that Card is no longer deletable without
 * Button — recorded in findings rather than papered over. */
import { hasContent } from "../Button/hasContent";
import { CARD_BORDER, CARD_ELEVATION, CARD_PADDING, CARD_ROOT, cx } from "./cardUtilities";

export type CardProps = {
  /** Source default: `"article"`. Allow-list — anything else silently becomes
   *  `article`. */
  element?: CardElement;
  /** Source default: `"md"`. */
  padding?: CardPadding;
  /** Source default: `false`. Reaches CSS as `data-border="false"`. */
  border?: boolean;
  /** Source default: none — OMITTING it and passing `"none"` are different.
   *  Omitted writes no `data-elevation` attribute at all; `"none"` writes
   *  `data-elevation="none"`, which matches a rule that sets `box-shadow: none`.
   *  Identical rendering, different DOM, and the DOM is the public API. */
  elevation?: CardElevation;
  /** The source merges the author's `class` after `Card`; same order here. */
  className?: string;
  children?: ReactNode;
};

export function Card({
  element = "article",
  padding = "md",
  border = false,
  elevation,
  className,
  children,
}: CardProps) {
  /* Suppression first — see note 1. */
  if (!hasContent(children)) return null;

  const result = validateCard(padding, elevation ?? null, border);

  if (!result.ok) {
    if (process.env.NODE_ENV === "production") return null;
    return <CardError message={result.message} />;
  }

  /* `createElement`, NOT `const Element = …; <Element>`.
   *
   * The obvious port of `output.TagName = Element` is a capitalised local used as
   * a JSX tag, and React 19's compiler lint REJECTS it:
   *
   *   error  Cannot create components during render   react-hooks/static-components
   *   > const Element = resolveCardElement(element);
   *                    ^ The component is created during render here
   *
   * The rule is pattern-based rather than semantic — JSX compiles to exactly this
   * call — but it is an ERROR, not a warning, so the idiomatic-looking version
   * does not build. `createElement` with a string tag says the same thing and is
   * accepted, at the cost of the JSX reading. Recorded as a finding: a TagHelper
   * whose whole job includes choosing its own tag name has no JSX form in React
   * 19. */
  return createElement(
    resolveCardElement(element),
    {
      /* STEP 3 — the design values live in `cardUtilities.ts` now. `Card` stays
         on the element: with no `Card-*` parts, it is the component's entire
         public identity, the class `Teaser.css` selects, and the probe's key. */
      className: cardClassName(
        cx(
          "Card",
          CARD_ROOT,
          CARD_PADDING[padding],
          CARD_BORDER[border ? "true" : "false"],
          /* Absent elevation and `elevation="none"` are the same styling and a
             different DOM, so the lookup is keyed on the resolved value while
             the attribute is written separately by `cardAttributes`. Both rows
             are empty strings — see CARD_ELEVATION. */
          CARD_ELEVATION[result.elevation ?? "absent"],
        ),
        className,
      ),
      ...cardAttributes({ border, padding, elevation: result.elevation }),
    },
    children,
  );
}

/* `CardTagHelper.RenderError`, reproduced including its inline styles.
 *
 * Deliberately NOT restyled to our tokens in step 2. It is a developer
 * diagnostic that must be impossible to miss and must not depend on the design
 * system being loaded — the same reason the source hardcodes `red`. It is also
 * unreachable in every build this repo measures. Recorded, not repaired. */
function CardError({ message }: { message: string }) {
  return (
    <div style={{ color: "red", border: "2px solid red", padding: "0.5rem" }}>
      {/* The source emits an HTML comment alongside the visible span so the
          diagnostic survives into the page source even if CSS hides it. JSX
          cannot emit a comment node, so only the span is ported — the comment
          is the one byte of the source's output this port cannot reproduce. */}
      <span>{`× app-card: ${message}`}</span>
    </div>
  );
}
