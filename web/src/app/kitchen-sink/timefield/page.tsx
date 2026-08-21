/* Isolated conformance target for TimeField.
 *
 * TimeField's spec honours `targetPath()`, so this route is the fast, unambiguous
 * loop (F-019 — nine other specs hard-code `goto('/')` and cannot use it):
 *
 *   cd reference-components
 *   BASE_URL=http://localhost:3000 TARGET_PATH=/kitchen-sink/timefield \
 *     npx playwright test src/partials/components/TimeField/tests/TimeField.e2e.test.js \
 *     --reporter=line --output=../web/tasks/tr-TimeField
 */

import { KitchensinkPage } from "@/components/kitchensink-ui";
import { TimeFieldKitchensink } from "@/components/TimeField/TimeField.kitchensink";

export const metadata = { title: "TimeField — conformance target" };

export default function Page() {
  return (
    <KitchensinkPage title="TimeField">
      <TimeFieldKitchensink />
    </KitchensinkPage>
  );
}
