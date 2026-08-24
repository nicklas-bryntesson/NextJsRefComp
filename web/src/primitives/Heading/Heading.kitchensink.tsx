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
            <div className="grid gap-xxs">
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
            <Cell key={color} caption={color}>
              <Heading element="h3" variant="heading" size="3" color={color} text={`color ${color}`} />
            </Cell>
          ))}
        </Block>

        <Block title="data-color=light on a dark ground — the only place an inverse text colour is legible">
          <Cell caption="light on surface-strong">
            <div className="rounded-lg bg-ink p-base">
              <Heading element="h3" variant="heading" size="3" color="light" text="Inverse heading" />
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

        <Block title="data-wrap — note nowrap is accepted by the helper and matched by NO rule in the source stylesheet">
          {WRAPS.map((wrap) => (
            <Cell key={wrap} caption={wrap}>
              <div className="w-[22rem] max-w-full">
                <Heading element="h4" variant="heading" size="4" wrap={wrap} text={WRAP_SAMPLE} />
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

        <Block title="Inline children inherit the metrics — :where(a, span, strong, em, b, i) { font: inherit }">
          <Cell caption="strong / em / a inside .heading-text">
            <Heading element="h3" variant="heading" size="3">
              <span className="heading-text">
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
