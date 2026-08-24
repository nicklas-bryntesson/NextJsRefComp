/* /primitives/picture — the inspection surface for the Razor Picture port.
 *
 * Separate route tree from `/kitchen-sink/*`, which belongs to the
 * reference-components ports. Same convention as `/primitives/button`.
 *
 * Verify with (production server on :3200):
 *   node tasks/probes/picture-axe.cjs        both appearances, WCAG 2 AA
 *   node tasks/probes/picture-reflow.cjs     320–1280 px, WCAG 1.4.10
 *   node tasks/probes/picture-cls.cjs        Core Web Vital — the one at risk here
 *   node tasks/probes/picture-negotiate.cjs  which candidate the browser picked
 *   node tasks/probes/picture-computed.cjs   the step-3 computed-style snapshot
 */

import { KitchensinkPage } from "@/components/kitchensink-ui";
import { PictureKitchensink } from "@/primitives/Picture/Picture.kitchensink";

export const metadata = { title: "Picture — Razor primitive port" };

export default function Page() {
  return (
    <KitchensinkPage
      title="Picture"
      intro="Ported from app-picture plus the MediaHelper static behind it. Two presets, three formats per source, and two negotiation modes — HTML art direction for hero, resolution switching for teaser. Every choice is made by the browser from markup; there is no client JavaScript on this route at all."
    >
      <PictureKitchensink />
    </KitchensinkPage>
  );
}
