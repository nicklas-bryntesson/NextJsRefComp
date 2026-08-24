/* CircleDiagram.kitchensink.tsx — every axis the Razor source exposes.
 *
 * There is no conformance suite for this primitive set, so what is not here is
 * not checked by anything. The axes are: segment count (1 → 7, which crosses the
 * source's SIX declared colours and shows what happens on the seventh), title
 * present/absent, subtitle present/absent, long labels, and the two degenerate
 * inputs the source guards (`segments` empty, `total == 0`).
 */

import { Block, Cell, Section } from "@/components/kitchensink-ui";
import { CircleDiagram } from "./CircleDiagram";

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
              <CircleDiagram
                title={`${n} segments`}
                segments={Array.from({ length: n }, (_, i) => ({
                  label: `Segment ${i + 1}`,
                  value: n - i,
                }))}
              />
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
            <CircleDiagram
              title="Seven segments"
              subtitle="The seventh colour does not exist in the source palette."
              segments={Array.from({ length: 7 }, (_, i) => ({
                label: `Segment ${i + 1}`,
                value: 7 - i,
              }))}
            />
          </Cell>
        </Block>
      </Section>

      <Section id="circlediagram-caption" title="Caption composition">
        <Block title="title × subtitle">
          <Cell caption="title + subtitle">
            <CircleDiagram
              title="Codebase by language"
              subtitle="Share of tracked lines, August 2026"
              segments={STACK}
            />
          </Cell>
          <Cell caption="title only">
            <CircleDiagram title="Codebase by language" segments={STACK} />
          </Cell>
          <Cell caption="subtitle only">
            <CircleDiagram
              subtitle="No title — the figure has no heading"
              segments={STACK}
              accessibleName="Codebase by language, no title"
            />
          </Cell>
          <Cell caption="neither">
            <CircleDiagram segments={STACK} accessibleName="Codebase by language, legend only" />
          </Cell>
        </Block>

        <Block title="Long labels and small shares — the reflow and rounding cases">
          <Cell caption="long labels">
            <CircleDiagram
              title="Deployment targets"
              subtitle="Long labels wrap inside the legend row without widening the figure"
              segments={[
                { label: "Umbraco Cloud production environment", value: 40 },
                { label: "Umbraco Cloud staging environment", value: 33 },
                { label: "Self-hosted Kubernetes cluster (eu-north-1)", value: 20 },
                { label: "Local development", value: 7 },
              ]}
            />
          </Cell>
          <Cell caption="sub-1% shares">
            <CircleDiagram
              title="Rounding"
              subtitle="0.#% formatting, matching the source's ToString(&quot;0.#&quot;)"
              segments={[
                { label: "Majority", value: 997 },
                { label: "Rounds to 0.2%", value: 2 },
                { label: "Rounds to 0.1%", value: 1 },
              ]}
            />
          </Cell>
        </Block>
      </Section>

      <Section id="circlediagram-degenerate" title="Degenerate input — the source's two early returns">
        <Block title="Both render nothing, exactly as the Razor does">
          <Cell caption="no segments">
            <CircleDiagram title="Empty" segments={[]} />
            <span className="text-caption text-body">(renders null)</span>
          </Cell>
          <Cell caption="all values zero">
            <CircleDiagram
              title="Zero total"
              segments={[
                { label: "A", value: 0 },
                { label: "B", value: 0 },
              ]}
            />
            <span className="text-caption text-body">(renders null)</span>
          </Cell>
        </Block>
      </Section>
    </>
  );
}
