/* Isolated conformance target for ToggleTip.
 *
 *   BASE_URL=http://localhost:3000 TARGET_PATH=/kitchen-sink/toggletip \
 *     npx playwright test --grep ToggleTip
 *
 * CAVEAT — TARGET_PATH does not reach this suite. ToggleTip.e2e.test.js calls
 * `page.goto('/')` directly instead of importing `targetPath()` from
 * src/e2e-helpers/target.js, so the env var is ignored and the run lands on the
 * site root. `web/src/app/page.tsx` therefore redirects to this route. See
 * findings/ToggleTip.md.
 */

import { KitchensinkPage } from "@/components/kitchensink-ui";
import { ToggleTipKitchensink } from "@/components/ToggleTip/ToggleTip.kitchensink";

export const metadata = { title: "ToggleTip — conformance target" };

export default function Page() {
  return (
    <KitchensinkPage title="ToggleTip">
      <ToggleTipKitchensink />
    </KitchensinkPage>
  );
}
