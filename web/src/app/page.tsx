/* `/` is the kitchensink.
 *
 * Not a landing page: nine of the component specs hard-code `page.goto('/')`,
 * so the site root has to carry the components or those suites fail on missing
 * elements. The reference repo's own `/` is its kitchensink for the same reason.
 * See AggregateKitchensink for the full explanation and Findings.md F-019.
 */

import { AggregateKitchensink } from "@/components/AggregateKitchensink";

export const metadata = { title: "Kitchen sink — conformance target" };

export default function Home() {
  return <AggregateKitchensink />;
}
