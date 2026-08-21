/* Isolated conformance target for Notice.
 *
 * NOTE: Notice's e2e suite does `page.goto('/')` and scopes to `#Notice`; it
 * does NOT read TARGET_PATH, so this route is NOT what the suite exercises.
 * Run the suite against `/`, which serves the aggregate kitchensink:
 *
 *   BASE_URL=http://localhost:3000 npx playwright test \
 *     src/partials/components/Notice/tests/Notice.e2e.test.js
 *
 * This route is kept for isolated visual work, and becomes the real target the
 * day the spec adopts `targetPath()`. See findings/Notice.md.
 */

import { KitchensinkPage } from "@/components/kitchensink-ui";
import { NoticeKitchensink } from "@/components/Notice/Notice.kitchensink";

export const metadata = { title: "Notice — conformance target" };

export default function Page() {
  return (
    <KitchensinkPage title="Notice">
      <NoticeKitchensink />
    </KitchensinkPage>
  );
}
