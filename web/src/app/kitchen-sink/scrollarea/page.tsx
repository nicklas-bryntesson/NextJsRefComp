/* Isolated conformance target for ScrollArea.
 *
 *   BASE_URL=http://localhost:3000 TARGET_PATH=/kitchen-sink/scrollarea \
 *     npx playwright test --grep ScrollArea
 */

import { KitchensinkPage } from "@/components/kitchensink-ui";
import { ScrollAreaKitchensink } from "@/components/ScrollArea/ScrollArea.kitchensink";

export const metadata = { title: "ScrollArea — conformance target" };

export default function Page() {
  return (
    <KitchensinkPage title="ScrollArea">
      <ScrollAreaKitchensink />
    </KitchensinkPage>
  );
}
