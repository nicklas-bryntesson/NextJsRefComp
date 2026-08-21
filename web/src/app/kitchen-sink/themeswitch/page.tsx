/* Isolated conformance target for ThemeSwitch.
 *
 * NOTE: `ThemeSwitch.e2e.test.js` hard-codes `page.goto('/')` and never imports
 * `targetPath()`, so `TARGET_PATH` is inert for it (F-019) and the conformance run
 * must hit `/`, where the aggregate kitchensink lives:
 *
 *   BASE_URL=http://localhost:3000 npx playwright test \
 *     src/partials/components/ThemeSwitch/tests/ThemeSwitch.e2e.test.js
 *
 * This route exists for isolated probing — and, for this component in
 * particular, for measuring the appearance projection without the rest of the
 * kitchensink in the frame.
 */

import { KitchensinkPage } from "@/components/kitchensink-ui";
import { ThemeSwitchKitchensink } from "@/components/ThemeSwitch/ThemeSwitch.kitchensink";

export const metadata = { title: "ThemeSwitch — conformance target" };

export default function Page() {
  return (
    <KitchensinkPage title="ThemeSwitch">
      <ThemeSwitchKitchensink />
    </KitchensinkPage>
  );
}
