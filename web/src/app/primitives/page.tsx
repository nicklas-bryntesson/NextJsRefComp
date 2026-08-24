/* /primitives — the index that was missing.
 *
 * Nine primitive routes shipped and every one of them was live; `/primitives`
 * itself 404'd because App Router only creates a route where a `page` file
 * exists, and the port never needed one. Findings.md F-084.
 */

import Link from "next/link";
import { KitchensinkPage } from "@/components/kitchensink-ui";
import { LABELS, PRIMITIVES } from "@/components/site-nav";

export const metadata = { title: "Razor primitives — index" };

export default function Page() {
  return (
    <KitchensinkPage
      title="Razor primitives"
      intro="The nine TagHelpers from the Umbraco app, ported prop-for-prop and restyled onto cursor-DESIGN.md. Structure first, then the design system, then a Tailwind conversion — the three steps are recorded per component in findings/."
    >
      <ul className="grid list-none grid-cols-[repeat(auto-fill,minmax(min(14rem,100%),1fr))] gap-xs p-0">
        {PRIMITIVES.map((slug) => (
          <li key={slug}>
            <Link
              href={`/primitives/${slug}`}
              className="flex min-h-11 items-center rounded-md border border-hairline-strong bg-surface-card px-sm text-body-md text-body no-underline hover:bg-surface-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {LABELS[slug] ?? slug}
            </Link>
          </li>
        ))}
      </ul>
    </KitchensinkPage>
  );
}
