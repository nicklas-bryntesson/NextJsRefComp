/* Isolated conformance target for MotionRegion.
 *
 *   BASE_URL=http://localhost:3000 TARGET_PATH=/kitchen-sink/motionregion \
 *     npx playwright test --grep MotionRegion
 */

import { KitchensinkPage } from "@/components/kitchensink-ui";
import { MotionRegionKitchensink } from "@/components/MotionRegion/MotionRegion.kitchensink";

export const metadata = { title: "MotionRegion — conformance target" };

export default function Page() {
  return (
    <KitchensinkPage title="MotionRegion">
      <MotionRegionKitchensink />
    </KitchensinkPage>
  );
}
