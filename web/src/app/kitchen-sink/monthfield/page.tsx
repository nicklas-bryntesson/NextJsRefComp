/* Isolated conformance target for MonthField.
 *
 *   BASE_URL=http://localhost:3000 TARGET_PATH=/kitchen-sink/monthfield \
 *     npx playwright test src/partials/components/MonthField/tests/MonthField.e2e.test.js
 *
 * MonthField.e2e.test.js DOES honour `targetPath()` (it is not one of the nine
 * specs that hard-code `goto('/')` — F-019), so this route is the fast,
 * unambiguous loop.
 */

import { KitchensinkPage } from "@/components/kitchensink-ui";
import { MonthFieldKitchensink } from "@/components/MonthField/MonthField.kitchensink";

export const metadata = { title: "MonthField — conformance target" };

export default function Page() {
  return (
    <KitchensinkPage title="MonthField">
      <MonthFieldKitchensink />
    </KitchensinkPage>
  );
}
