/* Teaser.kitchensink.tsx — the inspection surface for the Razor Teaser port.
 *
 * There is no conformance suite for the Razor primitive set, so this page plus
 * the three probes beside it are the entire net. It has one job the Button and
 * Card sinks did not: **Teaser's layout is a container query, so a demo at one
 * width tests half the component.** Every layout block below therefore appears
 * at two widths, straddling the 25rem breakpoint:
 *
 *   · 20rem (320px) — STATE A, flow-vertical: media / heading / body stacked,
 *     `.Media.StackedSources` shown and `.HorizontalSources` hidden.
 *   · 34rem (544px) — STATE B, flow-horizontal: media in a left column spanning
 *     all three rows, `.HorizontalSources` shown at 1:1 and `.StackedSources`
 *     hidden, and the CTA pushed to the bottom-right by `margin: auto`.
 *
 * `max-w-full` on every box is load-bearing for WCAG 1.4.10: at a 320px viewport
 * the 34rem boxes have to collapse, and they do — which incidentally means the
 * reflow sweep exercises the vertical state of every horizontal demo for free.
 *
 * NOT DEMONSTRATED, deliberately:
 *
 *  · The `button` + no-`href` error box. It is `NODE_ENV`-gated and every gate
 *    this repo runs measures a production build, so the cell would be empty on
 *    every surface that can see it. Same call the Card port made.
 *  · `element="li"` with a Card frame. The Card wrapper is a `<div>`, so a
 *    framed `li` Teaser would put `<div><li>` inside a `<ul>` — invalid, and a
 *    real axe `list` violation. The `li` demo is therefore `frame="bare"` inside
 *    a real list, which is the only valid combination the source can produce.
 *    That is a finding about the source's allow-list, not about the demo.
 */

import type { ReactNode } from "react";

import { Block, Cell, Section } from "@/components/kitchensink-ui";
import { ATRIUM, LATTICE, ORCHARD, staticCropUrl } from "../Picture/Picture.fixtures";
import { Teaser } from "./Teaser";
import type { TeaserElement, TeaserFrame } from "./teaserAttributes";

const FRAMES: TeaserFrame[] = ["bordered", "elevated", "bare"];
const ELEMENTS: TeaserElement[] = ["article", "div", "section"];

const EXCERPT =
  "Tab completion that reads the whole file, not the last line. It proposes the multi-line edit and you accept it with one keystroke.";

/* Two fixed widths, both `max-w-full`.
 *
 * A PLAIN BLOCK DIV, and that is load-bearing rather than incidental. The first
 * version of this box was `display: flex` — which looked harmless and made every
 * demo 26 px wide. `.Teaser` declares `align-items: flex-start` and `flex: 1`,
 * so as a flex ITEM its width comes from flex-basis: content, and the whole card
 * shrank to min-content while `.LayoutContainer` overflowed it. As a BLOCK child
 * the Card fills its box and the Teaser stretches. Measured; see findings — the
 * component only works inside a container that gives it a definite inline size.
 *
 * `bg-canvas` is load-bearing too, for the same reason the Card sink records: the
 * shared `Block` chrome is `bg-surface-card`, and so is a Card, so a framed demo
 * would be white-on-white. cursor-DESIGN.md puts a card on cream. */
function Boxed({ width, children }: { width: "narrow" | "wide"; children: ReactNode }) {
  return (
    <div
      className={
        (width === "narrow" ? "w-[20rem] " : "w-[34rem] ") + "max-w-full bg-canvas p-xs"
      }
    >
      {children}
    </div>
  );
}

/** Both container-query states of the same configuration, side by side. */
function BothStates({
  caption,
  children,
}: {
  caption: string;
  children: ReactNode;
}) {
  return (
    <>
      <Cell caption={`${caption} — 20rem (state A, vertical)`}>
        <Boxed width="narrow">{children}</Boxed>
      </Cell>
      <Cell caption={`${caption} — 34rem (state B, horizontal)`}>
        <Boxed width="wide">{children}</Boxed>
      </Cell>
    </>
  );
}

export function TeaserKitchensink() {
  return (
    <>
      <Section id="teaser-live" title="The full composition — the thing being tested">
        <Block title="image + heading + prose + CTA, at both container-query states. Five components in one tree: Card, MediaFigure, Heading, Prose, LinkButton.">
          <BothStates caption="full teaser, button">
            <Teaser
              image={ORCHARD}
              alt="A low sun through the rows of a walled orchard"
              heading="Predict your next edit"
              href="/features/tab"
              excerpt={EXCERPT}
              button
              buttonLabel="Read more"
              cropUrl={staticCropUrl}
            />
          </BothStates>
        </Block>

        <Block title="The same teaser with data-button=&quot;false&quot; — the heading becomes the stretched link and the whole card is clickable. Hover it: the heading underlines, and the pointer is a hand anywhere over the card.">
          <BothStates caption="stretched link">
            <Teaser
              image={ATRIUM}
              alt="The glass atrium of a converted warehouse, seen from the mezzanine"
              heading="One model, every file"
              href="/features/context"
              excerpt={EXCERPT}
              cropUrl={staticCropUrl}
            />
          </BothStates>
        </Block>
      </Section>

      <Section id="teaser-frame" title="frame — the permitted Card combinations">
        <Block title="Teaser owns these; a caller never sets Card props. bordered → padding=none + border. elevated → padding=none + elevation=sm. bare → no Card element at all.">
          {FRAMES.map((frame) => (
            <Cell key={frame} caption={`frame="${frame}"`}>
              <Boxed width="narrow">
                <Teaser
                  frame={frame}
                  image={LATTICE}
                  alt="Concrete lattice screening a stairwell"
                  heading="Frame"
                  href="/x"
                  excerpt="cursor-DESIGN.md specifies hairline-only depth, so elevated and bare paint identically and differ only in the DOM."
                  cropUrl={staticCropUrl}
                />
              </Boxed>
            </Cell>
          ))}
        </Block>
      </Section>

      <Section id="teaser-media" title="data-media — with and without an image">
        <Block title="No image means no .MediaContainer, so the grid loses its media row/column entirely. Both states.">
          <BothStates caption="no media">
            <Teaser
              heading="Text-only teaser"
              href="/x"
              excerpt={EXCERPT}
              button
              cropUrl={staticCropUrl}
            />
          </BothStates>
        </Block>
      </Section>

      <Section id="teaser-body" title="The body slot — excerpt, child content, CTA">
        <Block title="ContentContainer holds up to three things in a fixed order: the Prose excerpt, the caller's child content, then the CTA.">
          <Cell caption="excerpt only">
            <Boxed width="narrow">
              <Teaser heading="Excerpt only" href="/x" excerpt={EXCERPT} />
            </Boxed>
          </Cell>
          <Cell caption="child content only — a <time>">
            <Boxed width="narrow">
              <Teaser heading="Child content only" href="/x">
                <time dateTime="2026-08-24">24 August 2026</time>
              </Teaser>
            </Boxed>
          </Cell>
          <Cell caption="excerpt + child content + CTA">
            <Boxed width="narrow">
              <Teaser heading="All three" href="/x" excerpt={EXCERPT} button buttonLabel="Read the post">
                <time dateTime="2026-08-24">24 August 2026</time>
              </Teaser>
            </Boxed>
          </Cell>
          <Cell caption="heading only — no ContentContainer at all">
            <Boxed width="narrow">
              <Teaser heading="Heading only" href="/x" />
            </Boxed>
          </Cell>
          <Cell caption="no heading, excerpt + CTA — the CTA gets no ScreenReaderText suffix">
            <Boxed width="narrow">
              <Teaser excerpt={EXCERPT} href="/x" button />
            </Boxed>
          </Cell>
        </Block>
      </Section>

      <Section id="teaser-cta" title="buttonLabel and the accessible name">
        <Block title='The CTA appends " about <heading>" inside .Button-text as visually-hidden text, so a list of "Read more" links is distinguishable — WCAG 2.4.4. It is inside the label rather than an aria-label, which would replace it and break 2.5.3 Label in Name.'>
          <Cell caption='buttonLabel="Read more" (default)'>
            <Boxed width="narrow">
              <Teaser heading="Default label" href="/x" excerpt="Inspect the CTA: its accessible name is “Read more about Default label”." button />
            </Boxed>
          </Cell>
          <Cell caption='buttonLabel="See the pricing"'>
            <Boxed width="narrow">
              <Teaser heading="Custom label" href="/x" excerpt="A custom label takes the same suffix." button buttonLabel="See the pricing" />
            </Boxed>
          </Cell>
        </Block>
      </Section>

      <Section id="teaser-element" title="element — the allow-list">
        <Block title="article | div | li | section, with a silent fallback to article. The tag name is the only DOM trace of this axis.">
          {ELEMENTS.map((element) => (
            <Cell key={element} caption={`element="${element}"`}>
              <Boxed width="narrow">
                <Teaser element={element} heading={`<${element}>`} href="/x" excerpt="The frame is always a div; only the Teaser root changes." />
              </Boxed>
            </Cell>
          ))}
          <Cell caption='element="li" — only valid with frame="bare", inside a real list'>
            <Boxed width="narrow">
              {/* `list-none` removes the marker; the Teaser is the list item. A
                  framed `li` would nest inside the Card's `div` and stop being a
                  child of the `ul` — invalid HTML and a real axe `list`
                  violation. */}
              <ul className="m-0 grid w-full list-none gap-sm p-0">
                <Teaser element="li" frame="bare" heading="First" href="/x" excerpt="A bare li teaser inside a ul." />
                <Teaser element="li" frame="bare" heading="Second" href="/x" excerpt="Two list items, one list." />
              </ul>
            </Boxed>
          </Cell>
        </Block>
      </Section>
    </>
  );
}
