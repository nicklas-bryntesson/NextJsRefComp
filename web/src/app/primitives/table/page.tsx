/* /primitives/table — the inspection surface for `ClientApp/css/04_ui/Tables.css`.
 *
 * NOT a component route. `Tables.css` has no class names and no TagHelper: it is
 * element-level styling for arbitrary table markup, so what is ported is a
 * stylesheet plus a documented markup contract plus one scroll wrapper. See
 * findings/primitives-orphans.md F-070.
 *
 * Verify with (production server on :3200):
 *   node tasks/probes/orphans-axe.cjs
 *   node tasks/probes/orphans-reflow.cjs
 *   node tasks/probes/orphans-computed.cjs diff tasks/snapshots/orphans-step2-before-tailwind.json
 */

import { KitchensinkPage } from "@/components/kitchensink-ui";
import { TableKitchensink } from "@/primitives/Table/Table.kitchensink";

export const metadata = { title: "Tables — Razor primitive port" };

export default function Page() {
  return (
    <KitchensinkPage
      title="Tables"
      intro="Element-level styling for arbitrary table markup — no TagHelper, no class names, no component. Every selector in the source stylesheet is rooted at the bare `table` element, so the contract is 'any HTML table'. The one React artifact is TableScroll, which exists because the stylesheet's own overflow-x: auto on the table box does nothing."
    >
      <TableKitchensink />
    </KitchensinkPage>
  );
}
