/* Isolated conformance target for WeekField.
 *
 * The WeekField spec honours `targetPath()` (it is not one of the nine that
 * hard-code `goto('/')` — Findings F-019), so this route is the fast, unambiguous
 * loop:
 *
 *   cd reference-components
 *   BASE_URL=http://localhost:3000 TARGET_PATH=/kitchen-sink/weekfield \
 *     npx playwright test src/partials/components/WeekField/tests/WeekField.e2e.test.js \
 *     --reporter=line --output=../web/tasks/tr-WeekField
 */

import { KitchensinkPage } from "@/components/kitchensink-ui";
import { WeekFieldKitchensink } from "@/components/WeekField/WeekField.kitchensink";

export const metadata = { title: "WeekField — conformance target" };

export default function Page() {
  return (
    <KitchensinkPage title="WeekField">
      <WeekFieldKitchensink />
    </KitchensinkPage>
  );
}
