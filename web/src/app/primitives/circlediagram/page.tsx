/* /primitives/circlediagram — the inspection surface for the CircleDiagram port.
 *
 * Verify with (production server on :3200):
 *   node tasks/probes/orphans-axe.cjs
 *   node tasks/probes/orphans-reflow.cjs
 *   node tasks/probes/orphans-computed.cjs diff tasks/snapshots/orphans-step2-before-tailwind.json
 */

import { KitchensinkPage } from "@/components/kitchensink-ui";
import { CircleDiagramKitchensink } from "@/primitives/CircleDiagram/CircleDiagram.kitchensink";

export const metadata = { title: "CircleDiagram — Razor primitive port" };

export default function Page() {
  return (
    <KitchensinkPage
      title="CircleDiagram"
      intro="A donut chart drawn with one conic-gradient. No TagHelper, but the Razor rich-text block partial is a complete literal template, so the markup contract was as explicit here as the C# was for the Button family. The palette was hardcoded hex with a 'swap for tokens later' comment; step 2 answers that."
    >
      <CircleDiagramKitchensink />
    </KitchensinkPage>
  );
}
