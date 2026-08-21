/* Isolated conformance target for RangeGroup.
 *
 * NOTE: RangeGroup.e2e.test.js hard-codes `page.goto('/')` and ignores
 * targetPath(), so `TARGET_PATH` is inert for it (CLAUDE.md, "Nine specs
 * hard-code goto('/')"). The real run is against `/`. This route exists for
 * hand probing and axe measurement in isolation:
 *
 *   BASE_URL=http://localhost:3000 \
 *     npx playwright test src/partials/components/RangeGroup/tests/RangeGroup.e2e.test.js
 */

import { KitchensinkPage } from "@/components/kitchensink-ui";
import { RangeGroupKitchensink } from "@/components/RangeGroup/RangeGroup.kitchensink";

export const metadata = { title: "RangeGroup — conformance target" };

export default function Page() {
  return (
    <KitchensinkPage title="RangeGroup">
      <RangeGroupKitchensink />
    </KitchensinkPage>
  );
}
