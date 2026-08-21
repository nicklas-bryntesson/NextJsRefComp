/* Isolated conformance target for RangeScale.
 *
 * NOTE: RangeScale's spec hard-codes `page.goto('/')`, so `TARGET_PATH` is inert
 * for it and the aggregate kitchensink at `/` is the real target. This route
 * exists for probing one component without the rest of the page in the way:
 *
 *   BASE_URL=http://localhost:3000 \
 *     npx playwright test src/partials/components/RangeScale/tests/RangeScale.e2e.test.js
 */

import { KitchensinkPage } from "@/components/kitchensink-ui";
import { RangeScaleKitchensink } from "@/components/RangeScale/RangeScale.kitchensink";

export const metadata = { title: "RangeScale — conformance target" };

export default function Page() {
  return (
    <KitchensinkPage
      title="RangeScale"
      intro="The lane a RangeField is measured against: the fill, the ticks, the readout and the reference layer, all positioned by one expression."
    >
      <RangeScaleKitchensink />
    </KitchensinkPage>
  );
}
