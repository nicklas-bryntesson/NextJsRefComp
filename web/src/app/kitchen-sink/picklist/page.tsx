/* Isolated conformance target for Picklist.
 *
 * NOTE: `Picklist.e2e.test.js` hard-codes `await page.goto('/')`, so
 * `TARGET_PATH` is silently inert for it (CLAUDE.md — nine specs do this) and
 * the real conformance run happens against `/`, which serves the aggregate
 * kitchensink. The same is true of the site-level `tests/appearance.e2e.test.js`,
 * which addresses `.Picklist[data-id="single"]` and `#Picklist`.
 *
 * This route exists anyway, for reading one component in isolation and for
 * bisecting a failure without the rest of the page in the way:
 *
 *   BASE_URL=http://localhost:3000 npx playwright test \
 *     src/partials/components/Picklist/tests/Picklist.e2e.test.js
 */

import { KitchensinkPage } from "@/components/kitchensink-ui";
import { PicklistKitchensink } from "@/components/Picklist/Picklist.kitchensink";

export const metadata = { title: "Picklist — conformance target" };

export default function Page() {
  return (
    <KitchensinkPage title="Picklist">
      <PicklistKitchensink />
    </KitchensinkPage>
  );
}
