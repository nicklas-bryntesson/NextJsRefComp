/* Isolated conformance target for DateTimeField.
 *
 * `DateTimeField.e2e.test.js` honours `targetPath()` (it is NOT one of the nine
 * specs of F-019 that hard-code `page.goto('/')`), so this route is the fast,
 * unambiguous loop:
 *
 *   cd reference-components
 *   BASE_URL=http://localhost:3200 TARGET_PATH=/kitchen-sink/datetimefield \
 *     npx playwright test src/partials/components/DateTimeField/tests/DateTimeField.e2e.test.js \
 *     --reporter=line --output=../web/tasks/tr-DateTimeField
 *
 * Measure against a PRODUCTION build (F-049); `next dev` is not a valid
 * substrate for this suite.
 */

import { KitchensinkPage } from "@/components/kitchensink-ui";
import { DateTimeFieldKitchensink } from "@/components/DateTimeField/DateTimeField.kitchensink";

export const metadata = { title: "DateTimeField — conformance target" };

export default function Page() {
  return (
    <KitchensinkPage
      title="DateTimeField"
      intro="Editable date AND time segments over a native input[type=datetime-local], with one popup that holds a calendar grid, a month/year wheel picker and hour/minute/second time wheels. The only component in the set that composes two field families behind a single value."
    >
      <DateTimeFieldKitchensink />
    </KitchensinkPage>
  );
}
