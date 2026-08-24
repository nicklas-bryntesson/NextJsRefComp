/* /primitives/covercomposition — the inspection surface for the CoverComposition port.
 *
 * Verify with (production server on :3200):
 *   node tasks/probes/orphans-axe.cjs
 *   node tasks/probes/orphans-reflow.cjs
 *   node tasks/probes/orphans-computed.cjs diff tasks/snapshots/orphans-step2-before-tailwind.json
 */

import { KitchensinkPage } from "@/components/kitchensink-ui";
import { CoverCompositionKitchensink } from "@/primitives/CoverComposition/CoverComposition.kitchensink";

export const metadata = { title: "CoverComposition — Razor primitive port" };

export default function Page() {
  return (
    <KitchensinkPage
      title="CoverComposition"
      intro="A full-bleed hero with a media background and a content overlay, in an image variant and a video variant. No TagHelper: the markup contract had to be assembled from a Razor partial, a stylesheet with selectors for parts the partial never emits, and a 7-state JS class that injects two of them."
    >
      <CoverCompositionKitchensink />
    </KitchensinkPage>
  );
}
