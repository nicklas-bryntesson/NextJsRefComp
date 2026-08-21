/* Isolated conformance target for AffixField.
 *
 *   BASE_URL=http://localhost:3000 TARGET_PATH=/kitchen-sink/affixfield \
 *     npx playwright test --grep AffixField
 */

import { KitchensinkPage } from "@/components/kitchensink-ui";
import { AffixFieldKitchensink } from "@/components/AffixField/AffixField.kitchensink";

export const metadata = { title: "AffixField — conformance target" };

export default function Page() {
  return (
    <KitchensinkPage title="AffixField">
      <AffixFieldKitchensink />
    </KitchensinkPage>
  );
}
