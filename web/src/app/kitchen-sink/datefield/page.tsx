/* Isolated conformance target for DateField.
 *
 * `DateField.e2e.test.js` honours `targetPath()`, so this route is the fast,
 * unambiguous loop (Findings F-019 lists the nine specs that do NOT):
 *
 *   cd reference-components
 *   BASE_URL=http://localhost:3000 TARGET_PATH=/kitchen-sink/datefield \
 *     npx playwright test src/partials/components/DateField/tests/DateField.e2e.test.js \
 *     --reporter=line --output=../web/tasks/tr-DateField
 */

import { KitchensinkPage } from "@/components/kitchensink-ui";
import { DateFieldKitchensink } from "@/components/DateField/DateField.kitchensink";

export const metadata = { title: "DateField — conformance target" };

export default function Page() {
  return (
    <KitchensinkPage
      title="DateField"
      intro="Editable day/month/year segments over a native input[type=date], with a calendar popover and a month/year wheel picker. The reference implementation of the popup-field family."
    >
      <DateFieldKitchensink />
    </KitchensinkPage>
  );
}
