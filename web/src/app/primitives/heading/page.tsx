/* /primitives/heading — the inspection surface for the `app-heading` port.
 *
 * There is no conformance suite for the Razor primitive set, so this route plus
 * the three probes below are the entire net.
 *
 * Verify with (production server on :3200):
 *   node tasks/probes/heading-computed.cjs diff tasks/snapshots/heading-step2-before-tailwind.json
 *   node tasks/probes/typo-axe.cjs        both appearances, WCAG 2 AA
 *   node tasks/probes/typo-reflow.cjs     320–1280 px, WCAG 1.4.10
 */

import { KitchensinkPage } from "@/components/kitchensink-ui";
import { HeadingKitchensink } from "@/primitives/Heading/Heading.kitchensink";

export const metadata = { title: "Heading — Razor primitive port" };

export default function Page() {
  return (
    <KitchensinkPage
      title="Heading"
      intro="Ported from TagHelpers/HeadingTagHelper.cs (app-heading) — the largest file in the Razor set, and almost all of it validation. Three variants (heading / display / body) over nine size steps, nine legal elements, a per-variant element allowlist, plus colour, alignment, wrap strategy, a comma-separated highlighter and three guard branches."
    >
      <HeadingKitchensink />
    </KitchensinkPage>
  );
}
