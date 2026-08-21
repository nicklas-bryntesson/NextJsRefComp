/* Isolated conformance target for ChoiceField.
 *
 * NOTE: unlike AffixField's spec, ChoiceField.e2e.test.js does `page.goto('/')`
 * — it does not use the TARGET_PATH seam. Playwright resolves '/' against the
 * origin of BASE_URL, so pointing BASE_URL at this path does NOT reach it. Run
 * the suite through the root-mapping proxy in web/tasks/probes/choicefield-proxy.mjs:
 *
 *   node web/tasks/probes/choicefield-proxy.mjs        # :3131 '/' -> this page
 *   cd reference-components && BASE_URL=http://localhost:3131 \
 *     npx playwright test src/partials/components/ChoiceField --reporter=line
 */

import { KitchensinkPage } from "@/components/kitchensink-ui";
import { ChoiceFieldKitchensink } from "@/components/ChoiceField/ChoiceField.kitchensink";

export const metadata = { title: "ChoiceField — conformance target" };

export default function Page() {
  return (
    <KitchensinkPage title="ChoiceField">
      <ChoiceFieldKitchensink />
    </KitchensinkPage>
  );
}
