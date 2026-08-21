/* /kitchen-sink — the same aggregate target as `/`, kept as a stable named route
 * for the specs that honour TARGET_PATH. See AggregateKitchensink. */

import { AggregateKitchensink } from "@/components/AggregateKitchensink";

export const metadata = { title: "Kitchen sink — conformance target" };

export default function KitchenSinkPage() {
  return <AggregateKitchensink />;
}
