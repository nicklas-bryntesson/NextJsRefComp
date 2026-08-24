/* /primitives/card — the inspection surface for the Razor Card port.
 *
 * Sibling of /primitives/button. Separate route tree from `/kitchen-sink/*`,
 * which belongs to the reference-components ports.
 *
 * Verify with (production server on :3200):
 *   node tasks/probes/card-axe.cjs        both appearances, WCAG 2 AA
 *   node tasks/probes/card-reflow.cjs     320–1280 px, WCAG 1.4.10
 *   node tasks/probes/card-computed.cjs   the step-3 computed-style snapshot
 */

import { KitchensinkPage } from "@/components/kitchensink-ui";
import { CardKitchensink } from "@/primitives/Card/Card.kitchensink";

export const metadata = { title: "Card — Razor primitive port" };

export default function Page() {
  return (
    <KitchensinkPage
      title="Card"
      intro="Ported from the Razor TagHelper app-card: element × padding × border × elevation, the suppression rule and the dev-only error box. Plus the two compositions that matter more than the axes — the frame Teaser writes by hand, and the className seam an inverted card has to arrive through."
    >
      <CardKitchensink />
    </KitchensinkPage>
  );
}
