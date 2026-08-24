/* CircleDiagram.kitchensink.tsx — every axis the Razor source exposes.
 *
 * There is no conformance suite for this primitive set, so what is not here is
 * not checked by anything. The axes are: segment count (1 → 7, which crosses the
 * source's SIX declared colours and shows what happens on the seventh), title
 * present/absent, subtitle present/absent, long labels, and the two degenerate
 * inputs the source guards (`segments` empty, `total == 0`).
 */

import type { ReactNode } from "react";

import { Block, Cell, Section } from "@/components/kitchensink-ui";
import { CircleDiagram } from "./CircleDiagram";

/* THE DEMO STATES THE WIDTH, not the component.
 *
 * `CircleDiagram` is fluid: the chart is `width: var(--CircleDiagram-size)` capped
 * at `max-inline-size: 100%`, so it fills whatever box it is given. `Cell` sizes
 * its inner grid track `minmax(0, 1fr)` and `Block` is `flex-wrap`, which means a
 * Cell's min-content contribution is ZERO — six of them packed onto one flex line
 * and each got 1/6 of the row. Measured: the 200px donut rendered at 62.27px on a
 * 1280px viewport. Nothing was wrong with the component; the demo gave it 62px.
 * * `w-full max-w-[22rem]` DOES NOT FIX IT, and that is the instructive half:
 * `w-full` is `width: 100%` of a box that is already 62px, so it defends nothing.
 * Measured ancestor chain at a 1280px viewport, innermost first:
 *   .CircleDiagram-chart            w=62
 *   figure.CircleDiagram            w=62   max-width: 100%
 *   div.w-full.max-w-[22rem]        w=62   max-width: 352px   <- inert
 *   div.grid-cols-[minmax(0,1fr)]   w=62   grid-template-columns: 62.2656px
 *   div.grid.min-w-0                w=62
 *   div.flex.flex-wrap              w=1168
 * The Cell's max-content contribution collapses, so `Block`'s flex items take a
 * 62px basis and never wrap. What works is an EXPLICIT width plus `max-w-full` —
 * the exact pattern `Cell`'s own comment prescribes ("so a component can use a
 * plain `w-[28rem] max-w-full` and get reflow for free"). Same shape as the Button
 * port's `Row`: the shared chrome is field-shaped and off-limits, so an
 * intrinsically-sized component states its width at the call site. F-091. */
function Sized({ children }: { children: ReactNode }) {
  return <div className="w-[22rem] min-w-0 max-w-full">{children}</div>;
}

const STACK = [
  { label: "TypeScript", value: 48 },
  { label: "C#", value: 26 },
  { label: "CSS", value: 14 },
  { label: "Razor", value: 8 },
  { label: "Other", value: 4 },
];

export function CircleDiagramKitchensink() {
  return (
    <>
      <Section id="circlediagram-counts" title="Segment count">
        <Block title="1 → 6 segments — the six colours the source declares">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <Cell key={n} caption={`${n} segment${n > 1 ? "s" : ""}`}>
              <Sized>
                <CircleDiagram
                  title={`${n} segments`}
                  segments={Array.from({ length: n }, (_, i) => ({
                    label: `Segment ${i + 1}`,
                    value: n - i,
                  }))}
                />
              </Sized>
            </Cell>
          ))}
        </Block>

        <Block title="7 segments — one past the declared palette">
          {/* The source declares `--CircleDiagram-color-1..6` and indexes them
              by segment ordinal with no wrap, so a seventh segment resolves
              `var(--CircleDiagram-color-7)` to nothing: an invalid conic-gradient
              stop, which invalidates the WHOLE gradient and renders the chart
              blank. Reproduced deliberately. F-074. */}
          <Cell caption="7 segments (source: chart goes blank)">
            <Sized>
              <CircleDiagram
                title="Seven segments"
                subtitle="The seventh colour does not exist in the source palette."
                segments={Array.from({ length: 7 }, (_, i) => ({
                  label: `Segment ${i + 1}`,
                  value: 7 - i,
                }))}
              />
            </Sized>
          </Cell>
        </Block>
      </Section>

      <Section id="circlediagram-caption" title="Caption composition">
        <Block title="title × subtitle">
          <Cell caption="title + subtitle">
            <Sized>
              <CircleDiagram
                title="Codebase by language"
                subtitle="Share of tracked lines, August 2026"
                segments={STACK}
              />
            </Sized>
          </Cell>
          <Cell caption="title only">
            <Sized>
              <CircleDiagram title="Codebase by language" segments={STACK} />
            </Sized>
          </Cell>
          <Cell caption="subtitle only">
            <Sized>
              <CircleDiagram
                subtitle="No title — the figure has no heading"
                segments={STACK}
                accessibleName="Codebase by language, no title"
              />
            </Sized>
          </Cell>
          <Cell caption="neither">
            <Sized>
              <CircleDiagram
                segments={STACK}
                accessibleName="Codebase by language, legend only"
              />
            </Sized>
          </Cell>
        </Block>

        <Block title="Long labels and small shares — the reflow and rounding cases">
          <Cell caption="long labels">
            <Sized>
              <CircleDiagram
                title="Deployment targets"
                subtitle="Long labels wrap inside the legend row without widening the figure"
                segments={[
                  { label: "Umbraco Cloud production environment", value: 40 },
                  { label: "Umbraco Cloud staging environment", value: 33 },
                  {
                    label: "Self-hosted Kubernetes cluster (eu-north-1)",
                    value: 20,
                  },
                  { label: "Local development", value: 7 },
                ]}
              />
            </Sized>
          </Cell>
          <Cell caption="sub-1% shares">
            <Sized>
              <CircleDiagram
                title="Rounding"
                subtitle='0.#% formatting, matching the source&apos;s ToString("0.#")'
                segments={[
                  { label: "Majority", value: 997 },
                  { label: "Rounds to 0.2%", value: 2 },
                  { label: "Rounds to 0.1%", value: 1 },
                ]}
              />
            </Sized>
          </Cell>
        </Block>
      </Section>

      <Section
        id="circlediagram-degenerate"
        title="Degenerate input — the source's two early returns"
      >
        <Block title="Both render nothing, exactly as the Razor does">
          <Cell caption="no segments">
            <Sized>
              <CircleDiagram title="Empty" segments={[]} />
            </Sized>
            <span className="text-caption text-body">(renders null)</span>
          </Cell>
          <Cell caption="all values zero">
            <Sized>
              <CircleDiagram
                title="Zero total"
                segments={[
                  { label: "A", value: 0 },
                  { label: "B", value: 0 },
                ]}
              />
            </Sized>
            <span className="text-caption text-body">(renders null)</span>
          </Cell>
        </Block>
      </Section>
    </>
  );
}
