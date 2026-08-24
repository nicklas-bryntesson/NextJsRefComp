import Link from "next/link";

/* ── Why this file exists ─────────────────────────────────────────────────
 *
 * Every route in this app was built as a conformance target, and Playwright
 * arrives by URL. So for 29 routes nothing ever needed a link, and nothing
 * ever got one: `/` rendered the aggregate kitchensink and pointed at
 * nothing, `/primitives` 404'd because only its children existed, and the
 * whole primitives port was live and unreachable. See Findings.md F-084.
 *
 * The nav renders AFTER `main` in the layout so it cannot disturb the two
 * things the specs assert about the top of the document: the first heading
 * and the first focusable element. Hit areas are 44px (WCAG 2.5.5, above
 * the 24px 2.5.8 minimum) so a page-wide target-size sweep passes on it,
 * and the text is `text-body` rather than `text-muted` for the same reason
 * F-017 exists — muted on this canvas is 3.84:1 and fails AA.
 *
 * The two lists are written out rather than read from the filesystem: an
 * `fs.readdirSync` over `src/app` is drift-proof in dev and a coin toss
 * once Vercel traces the serverless bundle. A stale link here is a 404 a
 * human sees; a stale link there is a build that works locally only.
 */

const COMPONENTS = [
  "affixfield",
  "choicefield",
  "choicegroup",
  "datefield",
  "datetimefield",
  "fileupload",
  "monthfield",
  "motionregion",
  "notice",
  "picklist",
  "rangefield",
  "rangegroup",
  "rangescale",
  "scrollarea",
  "themeswitch",
  "timefield",
  "toggletip",
  "weekfield",
] as const;

const PRIMITIVES = [
  "button",
  "card",
  "circlediagram",
  "covercomposition",
  "heading",
  "picture",
  "prose",
  "table",
  "teaser",
] as const;

/* The route segments are lowercase and unspaced because that is what the
   directories are called; the labels are what a person would search for. */
const LABELS: Record<string, string> = {
  affixfield: "AffixField",
  choicefield: "ChoiceField",
  choicegroup: "ChoiceGroup",
  datefield: "DateField",
  datetimefield: "DateTimeField",
  fileupload: "FileUpload",
  monthfield: "MonthField",
  motionregion: "MotionRegion",
  notice: "Notice",
  picklist: "Picklist",
  rangefield: "RangeField",
  rangegroup: "RangeGroup",
  rangescale: "RangeScale",
  scrollarea: "ScrollArea",
  themeswitch: "ThemeSwitch",
  timefield: "TimeField",
  toggletip: "ToggleTip",
  weekfield: "WeekField",
  button: "Button",
  card: "Card",
  circlediagram: "CircleDiagram",
  covercomposition: "CoverComposition",
  heading: "Heading",
  picture: "Picture",
  prose: "Prose",
  table: "Table",
  teaser: "Teaser",
};

const LINK =
  "inline-flex min-h-11 items-center rounded-md border border-hairline-strong bg-surface-card px-sm text-body-sm text-body no-underline hover:bg-surface-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

function Group({
  label,
  base,
  slugs,
}: {
  label: string;
  base: string;
  slugs: readonly string[];
}) {
  return (
    <nav aria-label={label} className="grid gap-xs">
      <p className="text-caption-uppercase text-body">{label}</p>
      <ul className="flex list-none flex-wrap gap-xxs p-0">
        {slugs.map((slug) => (
          <li key={slug}>
            <Link href={`${base}/${slug}`} className={LINK}>
              {LABELS[slug] ?? slug}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function SiteNav() {
  return (
    <footer className="border-t border-hairline-strong bg-canvas-soft">
      <div className="mx-auto grid max-w-[var(--MAX--WIDTH--SITE)] gap-md px-[var(--SITE--PADDING)] py-lg">
        <nav aria-label="Overview" className="flex flex-wrap gap-xxs">
          <Link href="/" className={LINK}>
            Aggregate kitchen sink
          </Link>
          <Link href="/primitives" className={LINK}>
            Primitives index
          </Link>
        </nav>
        <Group
          label="Reference components"
          base="/kitchen-sink"
          slugs={COMPONENTS}
        />
        <Group label="Razor primitives" base="/primitives" slugs={PRIMITIVES} />
      </div>
    </footer>
  );
}

export { COMPONENTS, PRIMITIVES, LABELS };
