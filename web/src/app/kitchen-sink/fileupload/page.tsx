/* Isolated conformance target for FileUpload.
 *
 *   BASE_URL=http://localhost:3000 TARGET_PATH=/kitchen-sink/fileupload \
 *     npx playwright test src/partials/components/FileUpload/tests/FileUpload.e2e.test.js
 *
 * FileUpload's spec honours `targetPath()`, and it scopes its full-section axe
 * run to a bare `.kitchensink-section` — with exactly one section on this route
 * that scope is unambiguous, which the aggregate page cannot promise.
 */

import { KitchensinkPage } from "@/components/kitchensink-ui";
import { FileUploadKitchensink } from "@/components/FileUpload/FileUpload.kitchensink";

export const metadata = { title: "FileUpload — conformance target" };

export default function Page() {
  return (
    <KitchensinkPage title="FileUpload">
      <FileUploadKitchensink />
    </KitchensinkPage>
  );
}
