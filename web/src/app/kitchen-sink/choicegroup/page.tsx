/* Isolated conformance target for ChoiceGroup.
 *
 * ChoiceGroup.e2e.test.js hard-codes `page.goto('/')` and never calls
 * targetPath(), so TARGET_PATH is inert for it (Findings.md F-019) and the
 * official run must happen against `/` once AggregateKitchensink mounts this
 * section. This route is the isolated target for probes and for the proxy
 * harness at web/tasks/probes/choicegroup-proxy.mjs.
 */

import { KitchensinkPage } from "@/components/kitchensink-ui";
import { ChoiceGroupKitchensink } from "@/components/ChoiceGroup/ChoiceGroup.kitchensink";

export const metadata = { title: "ChoiceGroup — conformance target" };

export default function Page() {
  return (
    <KitchensinkPage title="ChoiceGroup">
      <ChoiceGroupKitchensink />
    </KitchensinkPage>
  );
}
