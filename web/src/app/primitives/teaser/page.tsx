/* /primitives/teaser — the inspection surface for the Razor Teaser port.
 *
 * Sibling of /primitives/button and /primitives/card. Teaser is the first
 * component in the set that COMPOSES others, so this route renders Card,
 * MediaFigure, Heading, Prose and LinkButton in one tree and is the test of
 * Findings.md F-039.
 *
 * Verify with (production server on :3260 — other agents own :3200):
 *   node tasks/probes/teaser-axe.cjs        both appearances, WCAG 2 AA
 *   node tasks/probes/teaser-reflow.cjs     320–1280 px, WCAG 1.4.10
 *   node tasks/probes/teaser-computed.cjs   the step-3 computed-style snapshot
 */

import { KitchensinkPage } from "@/components/kitchensink-ui";
import { TeaserKitchensink } from "@/primitives/Teaser/Teaser.kitchensink";

export const metadata = { title: "Teaser — Razor primitive port" };

export default function Page() {
  return (
    <KitchensinkPage
      title="Teaser"
      intro="Ported from the Razor TagHelper app-teaser — the one component in the set that composes four others. Every layout block appears at 20rem and 34rem, straddling the 25rem container query that is the whole of this component's layout logic."
    >
      <TeaserKitchensink />
    </KitchensinkPage>
  );
}
