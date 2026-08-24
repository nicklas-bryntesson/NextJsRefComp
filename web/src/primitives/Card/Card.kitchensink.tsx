/* Card.kitchensink.tsx — every axis `app-card` exposes, plus the two
 * compositions that matter more than the axes.
 *
 * There is no conformance suite for the Razor primitive set, so what is not on
 * this page is checked by nothing. `app-card` has a small surface — element ×
 * padding × border × elevation — so it is enumerated exhaustively, and the rest
 * of the page is about the two things Card exists for:
 *
 *   · THE TEASER FRAME. `TeaserTagHelper` does not use `<app-card>`; it writes
 *     `<div class="Card" data-padding="none" data-border="true">` by hand into
 *     `PreElement`. The "Teaser frame" block below renders the three frames
 *     Teaser produces (`bordered` / `elevated` / `bare`) through the React
 *     component, which is the shape the Teaser port will need.
 *   · THE CONSUMER OVERRIDE. `Card.css` wraps everything in `:where(.Card)`, so
 *     its specificity is ZERO and a consumer's one class always wins. That is
 *     the seam `cursor-DESIGN.md`'s inverted `pricing-tier-featured` has to
 *     arrive through, because Card has no variant axis for it. The override cell
 *     is a live experiment on whether that seam survives step 3 — see findings.
 *
 * No `data-test-state` block: `Card.css` has no state rules at all. A card has
 * no hover, focus or disabled appearance in the source, and inventing one would
 * be new design rather than a port.
 */

import type { ReactNode } from "react";

import { Block, Cell, Section } from "@/components/kitchensink-ui";
import { LinkButton } from "../Button/LinkButton";
import { Card } from "./Card";
import type { CardElevation, CardElement, CardPadding } from "./cardAttributes";

const ELEMENTS: CardElement[] = ["article", "section", "li", "div"];
const PADDINGS: CardPadding[] = ["none", "sm", "md", "lg"];
const ELEVATIONS: CardElevation[] = ["none", "sm", "md", "lg"];

/* A Card is a block-level flex column, so unlike a Button it WANTS the full
 * width of its Cell. It does not want the full width of a 1280px viewport, so
 * the demos are boxed — `max-w-full` keeps WCAG 1.4.10 satisfied down to 320px
 * because `Cell` already carries `min-w-0`. */
function Boxed({ children }: { children: ReactNode }) {
  return <div className="w-[17rem] max-w-full">{children}</div>;
}

function Filling({ title, body }: { title: string; body: string }) {
  return (
    <>
      <h4 className="text-title-md text-ink">{title}</h4>
      <p className="text-body-sm text-body">{body}</p>
    </>
  );
}

export function CardKitchensink() {
  return (
    <>
      <Section id="card-axes" title="Card — app-card">
        <Block title="border — the only axis with a visual rule in the source stylesheet">
          <Cell caption='border={false} (default) → data-border="false"'>
            <Boxed>
              <Card>
                <Filling title="No border" body='data-border="false" matches no rule in Card.css.' />
              </Card>
            </Boxed>
          </Cell>
          <Cell caption='border → data-border="true"'>
            <Boxed>
              <Card border>
                <Filling title="Bordered" body="1px hairline, the design's only depth affordance." />
              </Card>
            </Boxed>
          </Cell>
        </Block>

        <Block title="padding — none | sm | md | lg">
          {PADDINGS.map((padding) => (
            <Cell key={padding} caption={`padding="${padding}"${padding === "md" ? " (default)" : ""}`}>
              <Boxed>
                <Card border padding={padding}>
                  <Filling title={padding} body={`padding="${padding}"`} />
                </Card>
              </Boxed>
            </Cell>
          ))}
        </Block>

        <Block title="elevation — omitted vs none | sm | md | lg">
          <Cell caption="omitted → no data-elevation attribute">
            <Boxed>
              <Card border>
                <Filling title="omitted" body="No attribute at all." />
              </Card>
            </Boxed>
          </Cell>
          {ELEVATIONS.map((elevation) => (
            <Cell key={elevation} caption={`elevation="${elevation}"`}>
              <Boxed>
                <Card elevation={elevation}>
                  <Filling title={elevation} body={`data-elevation="${elevation}"`} />
                </Card>
              </Boxed>
            </Cell>
          ))}
        </Block>

        <Block title="border × elevation — ForbiddenCombinations ships empty, so every pair renders">
          {ELEVATIONS.map((elevation) => (
            <Cell key={elevation} caption={`border + elevation="${elevation}"`}>
              <Boxed>
                <Card border elevation={elevation}>
                  <Filling title={`border + ${elevation}`} body="Permitted: the forbidden set is empty." />
                </Card>
              </Boxed>
            </Cell>
          ))}
        </Block>

        <Block title="element — the allow-list. Anything outside it silently becomes <article>">
          {ELEMENTS.map((element) =>
            element === "li" ? (
              /* `li` is in the allow-list, and an `<li>` outside a list owner is
                 an ARIA structure violation that axe reports. The source cannot
                 emit the `<ul>` for you — `element="li"` exists precisely so the
                 CALLER owns the list — so the demo supplies one. */
              <Cell key={element} caption='element="li" (inside a ul the caller owns)'>
                <Boxed>
                  <ul className="grid list-none gap-sm p-0">
                    <Card element="li">
                      <Filling title="li" body="Card renders the <li>; the caller renders the <ul>." />
                    </Card>
                  </ul>
                </Boxed>
              </Cell>
            ) : (
              <Cell key={element} caption={`element="${element}"${element === "article" ? " (default)" : ""}`}>
                <Boxed>
                  <Card element={element} border>
                    <Filling title={element} body={`<${element} class="Card">`} />
                  </Card>
                </Boxed>
              </Cell>
            ),
          )}
        </Block>

        <Block title="Content rules">
          <Cell caption="no children → renders nothing (SuppressOutput)">
            <Boxed>
              <Card border />
            </Boxed>
          </Cell>
          <Cell caption="whitespace-only children → also nothing">
            <Boxed>
              <Card border> </Card>
            </Boxed>
          </Cell>
          <Cell caption='invalid padding → dev error box, nothing in production'>
            <Boxed>
              {/* Deliberately outside the union. The source's dev-only diagnostic
                  is unreachable in a production build, which is the only build
                  any gate in this repo measures — so this cell is empty on
                  :3200 and red under `next dev`. See findings. */}
              <Card border padding={"xl" as CardPadding}>
                <Filling title="unreachable" body="padding='xl'" />
              </Card>
            </Boxed>
          </Cell>
          <Cell caption="className is merged after Card, not instead of it">
            <Boxed>
              <Card border className="outline-2 outline-dashed outline-hairline-strong">
                <Filling title="class merge" body='class="Card outline-…"' />
              </Card>
            </Boxed>
          </Cell>
        </Block>
      </Section>

      <Section id="card-teaser-frame" title="The Teaser frame — what a later port needs from Card">
        <Block title="TeaserTagHelper writes .Card by hand; these are the three frames it produces">
          <Cell caption='frame="bordered" → padding="none" border'>
            <Boxed>
              <Card element="div" padding="none" border>
                <FauxTeaser frame="bordered" />
              </Card>
            </Boxed>
          </Cell>
          <Cell caption='frame="elevated" → padding="none" elevation="sm"'>
            <Boxed>
              <Card element="div" padding="none" elevation="sm">
                <FauxTeaser frame="elevated" />
              </Card>
            </Boxed>
          </Cell>
          <Cell caption='frame="bare" → no Card at all'>
            <Boxed>
              <FauxTeaser frame="bare" />
            </Boxed>
          </Cell>
        </Block>
      </Section>

      <Section
        id="card-override"
        title="The consumer override seam"
      >
        <Block title="cursor-DESIGN.md's pricing-tier-featured inverts to ink — Card has no axis for it, so it can only arrive through className">
          <Cell caption="pricing-tier-card — padding='lg' (32px), the doc's value">
            <Boxed>
              <Card border padding="lg">
                <Filling title="Pro" body="$20 / month. Everything in Hobby, plus unlimited completions." />
              </Card>
            </Boxed>
          </Cell>
          <Cell caption="pricing-tier-featured — the same Card + bg-ink text-canvas">
            <Boxed>
              <Card border padding="lg" className="border-ink bg-ink [&_*]:text-canvas">
                <Filling title="Business" body="$40 / month. The inversion is the consumer's, not the component's." />
              </Card>
            </Boxed>
          </Cell>
        </Block>
      </Section>

      <Section id="card-vs-ctablock" title="CTABlock — the orphan stylesheet">
        <Block title="Left: CTABlock's own markup. Right: the closest Card can get. Three declarations apart.">
          <Cell caption="CTABlock — no TagHelper; an RTE block partial">
            <Boxed>
              {/* Hand-written on purpose: this is `rteCTABlock.cshtml`'s markup,
                  and the cell exists to compare it with what Card can produce.
                  ONE DELIBERATE DEVIATION — the source root is an `<aside>` and
                  this is a `<div>`. Rendering the faithful `<aside>` put a real
                  axe violation on this route in both appearances
                  (`landmark-complementary-is-top-level`, 1 node), because a
                  CTABlock lives inside rich-text content inside `<main>` — which
                  is exactly where the source puts it. The violation is the
                  source's, not the demo's, and it is recorded as a finding
                  rather than displayed. */}
              <div className="my-lg flex flex-col gap-xs rounded-lg border border-hairline p-lg">
                <h4 className="text-title-md text-ink">Try Cursor now</h4>
                <p className="text-body-sm text-body">
                  A self-contained editorial CTA, rendered inline within rich-text content.
                </p>
                <div className="mt-xxs flex flex-wrap gap-xs">
                  <LinkButton href="#card-vs-ctablock">Download</LinkButton>
                  <LinkButton href="#card-vs-ctablock" emphasis="secondary">
                    Read the docs
                  </LinkButton>
                </div>
              </div>
            </Boxed>
          </Cell>
          <Cell caption='Card element="div" border padding="md"'>
            <Boxed>
              <Card element="div" border>
                <h4 className="text-title-md text-ink">Try Cursor now</h4>
                <p className="text-body-sm text-body">
                  Same frame. Wrong element, wrong gap, no block margin.
                </p>
                <div className="flex flex-wrap gap-xs">
                  <LinkButton href="#card-vs-ctablock">Download</LinkButton>
                  <LinkButton href="#card-vs-ctablock" emphasis="secondary">
                    Read the docs
                  </LinkButton>
                </div>
              </Card>
            </Boxed>
          </Cell>
        </Block>
      </Section>
    </>
  );
}

/* A stand-in for the Teaser port: enough structure to show what the Card frame
 * has to survive (a full-bleed media block that the frame's `overflow: hidden`
 * has to clip, and padded content below it). Not the Teaser component — that is
 * a later port and this file must not pre-empt its markup. */
function FauxTeaser({ frame }: { frame: string }) {
  return (
    <div className="flex flex-1 flex-col items-start">
      <div
        aria-hidden="true"
        className="aspect-[16/9] w-full bg-surface-strong"
      />
      <div className="flex flex-col items-start gap-xs p-sm">
        <h4 className="text-title-md text-ink">Teaser heading</h4>
        <p className="text-body-sm text-body">frame=&quot;{frame}&quot;</p>
      </div>
    </div>
  );
}
