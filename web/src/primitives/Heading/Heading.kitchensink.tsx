/* Heading.kitchensink.tsx — every axis `HeadingTagHelper` exposes.
 *
 * No conformance suite exists for the Razor primitive set, so this page IS the
 * contract surface: an axis absent here is an axis nothing checks. Enumerated
 * exhaustively — variant × size (nine steps), element, colour, align, wrap,
 * highlight, href, and all three guard branches.
 *
 * Two blocks exist purely to make findings measurable rather than to demo an
 * API: "Child content vs text" (the missing-`font-size` defect) and "Nine steps
 * onto six" (the collapse the bridge performs).
 */

import { Block, Cell, Section } from "@/components/kitchensink-ui";
import { Heading } from "./Heading";
import { HEADING_INNER, cx } from "./headingUtilities";
import type { HeadingAlign, HeadingColor, HeadingElement, HeadingWrap } from "./headingAttributes";

const HEADING_SIZES = ["1", "2", "3", "4", "5", "6"] as const;
const DISPLAY_SIZES = ["1", "2", "3"] as const;
const BODY_SIZES = ["lg", "md", "sm"] as const;
const COLORS: HeadingColor[] = ["primary", "dark", "light", "inherit"];
const ALIGNS: HeadingAlign[] = ["left", "center", "right"];
const WRAPS: HeadingWrap[] = ["balance", "pretty", "stable", "nowrap"];
const NON_HEADING_ELEMENTS: HeadingElement[] = ["span", "div", "p"];

/* Long enough to wrap at every size at 1280 px, which is what makes `text-wrap`
 * and `text-align` observable at all. */
const WRAP_SAMPLE =
  "A quietly confident editorial headline that has to break across at least two lines";

export function HeadingKitchensink() {
  return (
    <>
      <Section id="heading-variant" title="Variant × size — the nine steps">
        <Block title="variant=heading — sizes 1–6, element matched to size">
          {HEADING_SIZES.map((size) => (
            <Cell key={size} caption={`heading / ${size} (h${size})`}>
              <Heading
                element={`h${size}` as HeadingElement}
                variant="heading"
                size={size}
                text={`Heading ${size}`}
              />
            </Cell>
          ))}
        </Block>

        <Block title="variant=display — sizes 1–3. Display is the family collapse: Abril Fatface 400 / 0.95 upstream, Inter 400 / -0.03em here">
          {DISPLAY_SIZES.map((size) => (
            <Cell key={size} caption={`display / ${size}`}>
              <Heading element="h2" variant="display" size={size} text={`Display ${size}`} />
            </Cell>
          ))}
        </Block>

        <Block title="variant=body — sm | md | lg. Only h1–h6 are legal elements for this variant">
          {BODY_SIZES.map((size) => (
            <Cell key={size} caption={`body / ${size}`}>
              <Heading element="h3" variant="body" size={size} text={`Body ${size}`} />
            </Cell>
          ))}
        </Block>

        <Block title="Nine steps side by side — display-1..3 then h1..h6, at one element, to show where the bridge's four display + two title stops actually land">
          <Cell caption="descending">
            {/* `min-w-0` is load-bearing here, and the reason is a CSS subtlety
                worth knowing: `Heading.css`'s reset is `overflow-wrap:
                break-word`, which permits a break to AVOID overflow but does NOT
                reduce the element's min-content contribution — only
                `overflow-wrap: anywhere` does that. So in an intrinsically-sized
                track a long unbroken word still sizes the track. Measured under
                the WCAG 1.4.12 overrides at 320px: the `display-1` `.heading-text`
                reached a 381px right edge against a 320px viewport, 61px of
                document scroll. `min-w-0` lets the track shrink and the
                break-word reset then does its job. Same shape as F-024.

                AND `min-w-0` ALONE IS NOT ENOUGH. Measured under the overrides:
                this div's BOX was correctly 238px while its own
                `grid-template-columns` computed to **340.281px** — the implicit
                auto track sized to max-content and overflowed the box it lives
                in. `min-width: 0` constrains the box, not the track. The same
                defect was found independently in the shared `Cell` chrome and
                fixed there the same way, which makes this a general rule rather
                than a one-off: a grid that is ALSO a grid item needs
                `grid-cols-[minmax(0,1fr)]`, not just `min-w-0`. */}
            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-xxs">
              {DISPLAY_SIZES.map((size) => (
                <Heading
                  key={`d${size}`}
                  element="p"
                  variant="display"
                  size={size}
                  text={`display-${size}`}
                />
              ))}
              {HEADING_SIZES.map((size) => (
                <Heading
                  key={`h${size}`}
                  element="p"
                  variant="heading"
                  size={size}
                  text={`h${size}`}
                />
              ))}
            </div>
          </Cell>
        </Block>
      </Section>

      <Section id="heading-size-resolution" title="Size resolution — the three fallback tiers">
        <Block title="variant=heading with no size — derived from the element (h4 → data-size=4)">
          {HEADING_SIZES.map((size) => (
            <Cell key={size} caption={`element=h${size}, size omitted`}>
              <Heading element={`h${size}` as HeadingElement} text={`h${size} implied`} />
            </Cell>
          ))}
        </Block>

        <Block title="variant=heading on a non-heading element with no size — falls to 2">
          {NON_HEADING_ELEMENTS.map((element) => (
            <Cell key={element} caption={`element=${element}`}>
              <Heading element={element} text={`${element} → size 2`} />
            </Cell>
          ))}
        </Block>

        <Block title="Out-of-range size — display accepts 1–3, so 5 falls to the variant default 2">
          <Cell caption="display / size=5 → 2">
            <Heading variant="display" size="5" text="display size 5" />
          </Cell>
          <Cell caption="body / size=9 → md">
            <Heading element="h3" variant="body" size="9" text="body size 9" />
          </Cell>
          <Cell caption="heading / size=9 → element h2">
            <Heading variant="heading" size="9" text="heading size 9" />
          </Cell>
        </Block>
      </Section>

      <Section id="heading-color" title="Colour — data-color">
        <Block title="Four values. THE SOURCE STYLESHEET HAS NO [data-color] RULE — the axis is inert upstream. Step 2 gives it meaning.">
          {COLORS.map((color) => (
            <Cell key={color} caption={color === "light" ? "light (on an ink ground)" : color}>
              {/* `light` is the source's `--text-inverse` role, and an inverse
                  text colour on a NON-inverse ground is a contrast failure by
                  definition — measured 1.1:1 in dark when this cell first sat on
                  the plain card, and axe reported it as a real 1.4.3 violation.
                  So the cell carries the ground the value exists for. Same
                  reasoning as the Button port's removed disabled-CTA cell: a
                  demo must not manufacture a violation the component would never
                  produce in correct use. */}
              {color === "light" ? (
                <div className="rounded-md bg-ink p-sm">
                  <Heading element="h3" variant="heading" size="3" color={color} text="color light" />
                </div>
              ) : (
                <Heading element="h3" variant="heading" size="3" color={color} text={`color ${color}`} />
              )}
            </Cell>
          ))}
        </Block>

        <Block title="data-color=light at display size on an ink band — the intended use, in both appearances">
          <Cell caption="light on ink">
            <div className="rounded-lg bg-ink p-lg">
              <Heading element="h2" variant="display" size="3" color="light" text="An inverse display heading" />
            </div>
          </Cell>
        </Block>
      </Section>

      <Section id="heading-align-wrap" title="Alignment and wrap strategy">
        <Block title="data-align">
          {ALIGNS.map((align) => (
            <Cell key={align} caption={align}>
              <div className="w-[22rem] max-w-full">
                <Heading element="h4" variant="heading" size="4" align={align} text={WRAP_SAMPLE} />
              </div>
            </Cell>
          ))}
        </Block>

        <Block title="data-wrap — nowrap is accepted by the helper and matched by NO rule upstream; step 2 completes it">
          {WRAPS.map((wrap) => (
            <Cell key={wrap} caption={wrap}>
              <div className="w-[22rem] max-w-full">
                {/* `nowrap` gets a short string ON PURPOSE. The option is a WCAG
                    1.4.10 hazard by construction — an unbreakable heading cannot
                    reflow — and demonstrating it with the long sample would put
                    real horizontal scroll on this route at 320px. The hazard is
                    recorded as a finding instead of shipped as a demo. */}
                <Heading
                  element="h4"
                  variant="heading"
                  size="4"
                  wrap={wrap}
                  text={wrap === "nowrap" ? "No wrapping" : WRAP_SAMPLE}
                />
              </div>
            </Cell>
          ))}
        </Block>
      </Section>

      <Section id="heading-content" title="Content modes">
        <Block title="text vs child content — child content gets NO font-size, because Heading.css only sizes .heading-text / .heading-link">
          <Cell caption="text prop (sized)">
            <Heading element="h2" variant="display" size="1" text="Sized" />
          </Cell>
          <Cell caption="children (unsized — the defect)">
            <Heading element="h2" variant="display" size="1">
              Unsized
            </Heading>
          </Cell>
        </Block>

        <Block title="highlight — comma-separated terms wrapped in <mark>, longest first">
          <Cell caption="single term">
            <Heading
              element="h3"
              variant="heading"
              size="3"
              text="Ship faster with agentic review"
              highlight="agentic"
            />
          </Cell>
          <Cell caption="two terms, case-insensitive">
            <Heading
              element="h3"
              variant="heading"
              size="3"
              text="Agentic review, agentic edits"
              highlight="agentic,edits"
            />
          </Cell>
          <Cell caption="overlapping terms — longest wins">
            <Heading
              element="h3"
              variant="heading"
              size="3"
              text="A code review of the code"
              highlight="code,code review"
            />
          </Cell>
        </Block>

        <Block title="href — renders .heading-link instead of .heading-text">
          <Cell caption="linked heading">
            <Heading
              element="h3"
              variant="heading"
              size="3"
              text="A linked heading"
              href="#heading-content"
            />
          </Cell>
          <Cell caption="linked + highlighted">
            <Heading
              element="h3"
              variant="heading"
              size="3"
              text="A linked, highlighted heading"
              href="#heading-content"
              highlight="highlighted"
            />
          </Cell>
        </Block>

        <Block title="Inline children inherit the metrics — :where(a, span, strong, em, b, i) { font: inherit } is one of the two rules that stayed CSS after step 3">
          <Cell caption="strong / em / a inside .heading-text">
            {/* STEP 3 CHANGED WHAT A CONSUMER MUST WRITE HERE, and this cell is
                the evidence. Before the conversion, `.heading-text { display:
                block }` came from the stylesheet, so hand-written markup got it
                for free. Now the declaration is a utility the COMPONENT applies,
                so hand-written markup must apply it too — `cx("heading-text",
                HEADING_INNER)`. Measured: without it, the computed-style diff
                showed this element's `display` reverting block → inline and its
                `width` 215.391px → auto.

                This is not a kitchensink detail. `TeaserTagHelper.cs` hand-writes
                exactly this markup — see findings/primitives-Heading.md. */}
            <Heading element="h3" variant="heading" size="3">
              <span className={cx("heading-text", HEADING_INNER)}>
                Plain <strong>strong</strong> <em>em</em> <a href="#heading-content">link</a>
              </span>
            </Heading>
          </Cell>
        </Block>
      </Section>

      <Section id="heading-guards" title="Guards — what the helper refuses to render">
        <Block title="No text and no children → nothing at all (SuppressOutput). All three cells below are empty by design.">
          <Cell caption="no props">
            <Heading />
          </Cell>
          <Cell caption="empty string text">
            <Heading text="" />
          </Cell>
          <Cell caption="whitespace children">
            <Heading> </Heading>
          </Cell>
        </Block>

        <Block title="Invalid combinations → the dev-only error marker. Suppressed entirely in production, so these cells are empty on a production build.">
          <Cell caption="text + children">
            <Heading text="Both">Also children</Heading>
          </Cell>
          <Cell caption="href + children">
            <Heading href="#x">Children</Heading>
          </Cell>
          {/* Unreachable upstream too: the no-content guard runs first, so
              `href` with no text and no children suppresses rather than
              erroring. Kept to document the dead branch. */}
          <Cell caption="href without text (suppressed, not an error — dead branch)">
            <Heading href="#x" />
          </Cell>
          <Cell caption="variant=body on a span (body allows h1–h6 only)">
            <Heading element="span" variant="body" text="Illegal pair" />
          </Cell>
        </Block>
      </Section>
    </>
  );
}
