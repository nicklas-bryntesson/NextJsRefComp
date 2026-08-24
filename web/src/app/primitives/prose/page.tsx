/* /primitives/prose — the inspection surface for the `app-prose` port.
 *
 * Prose is a long-form content style: it styles descendant elements it does not
 * own. So this route carries a realistic article — headings, lists, blockquote,
 * inline and block code, a table, a figure and a rule — because an element the
 * sample omits is an element nothing on this project checks.
 *
 * Verify with (production server on :3200):
 *   node tasks/probes/prose-computed.cjs diff tasks/snapshots/prose-step2-before-tailwind.json
 *   node tasks/probes/typo-axe.cjs           both appearances, WCAG 2 AA
 *   node tasks/probes/typo-reflow.cjs        320–1280 px, WCAG 1.4.10
 *   node tasks/probes/prose-text-spacing.cjs WCAG 1.4.12
 */

import { KitchensinkPage } from "@/components/kitchensink-ui";
import { ProseKitchensink } from "@/primitives/Prose/Prose.kitchensink";

export const metadata = { title: "Prose — Razor primitive port" };

export default function Page() {
  return (
    <KitchensinkPage
      title="Prose"
      intro="Ported from ProseTagHelper.cs (app-prose) — the container for markup the component does not own: rich-text output, markdown, CMS fields. Three variants widen the element set (basic → p only; default → headings, lists, inline, links, code, blockquote; rich → + pre, tables, figures, rules). Every selector is wrapped in :where(), so the whole stylesheet has zero specificity."
    >
      <ProseKitchensink />
    </KitchensinkPage>
  );
}
