/* /primitives/button — the inspection surface for the Razor Button family port.
 *
 * Separate route tree from `/kitchen-sink/*`, which belongs to the
 * reference-components ports. The two sets share the design tokens and the
 * kitchensink chrome and nothing else.
 *
 * Verify with (production server on :3200):
 *   node tasks/probes/button-axe.cjs        both appearances, WCAG 2 AA
 *   node tasks/probes/button-reflow.cjs     320–1280 px, WCAG 1.4.10
 *   node tasks/probes/button-computed.cjs   the step-3 computed-style snapshot
 */

import { KitchensinkPage } from "@/components/kitchensink-ui";
import { ButtonKitchensink } from "@/primitives/Button/Button.kitchensink";

export const metadata = { title: "Button family — Razor primitive port" };

export default function Page() {
  return (
    <KitchensinkPage
      title="Button family"
      intro="Ported from the Razor TagHelper set: app-action-button, app-link-button and app-cta-link-button. Every axis the source exposes, plus the stylesheet's own data-test-state pins for hover, focus, active and disabled."
    >
      <ButtonKitchensink />
    </KitchensinkPage>
  );
}
