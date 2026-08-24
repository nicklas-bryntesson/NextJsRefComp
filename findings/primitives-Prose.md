# findings/primitives-Prose.md

`TagHelpers/ProseTagHelper.cs` (`app-prose`) ported to `web/src/primitives/Prose/`
in two of the three ordered steps: `fbb1026` (step 1, verbatim), `9ab41e0`
(step 2, restyle). **Step 3 was NOT performed, deliberately — see the verdict
below, which is the headline finding of this port.**

Route: `/primitives/prose`. Probes: `web/tasks/probes/typo-computed.cjs`,
`typo-axe.cjs`, `typo-reflow.cjs`, `typo-text-spacing.cjs`,
`typo-teaser-markup.cjs`. Snapshots: `web/tasks/snapshots/prose-step1.json`,
`prose-step2-before-tailwind.json`.

The family-collapse, nine-steps and `--baseline-offset-*` entries are shared with
the sibling port and live in `findings/primitives-Heading.md`.

---

### F-NEW · Prose cannot be converted to Tailwind, and the reason is measurable rather than aesthetic — the utility form raises specificity from 0,0,1 to 0,1,1 and destroys the override surface the component exists to provide

**Surface:** `Prose.css` in full, vs a Tailwind arbitrary-descendant-variant
conversion. Measured with a controlled specificity contest, and confirmed against
the source's own consumer.

**This is the direct answer to F-062 from the other direction, and it is a
negative result.**

`Prose.css` styles ~20 element types — `p`, `h1`–`h6`, `ul`, `ol`, `li`, `em`,
`strong`, `a`, `code`, `blockquote`, `pre`, `table`, `th`, `td`, `caption`,
`figure`, `figcaption`, `hr` — **none of which Prose renders.** Its whole purpose
is to style markup it does not own: rich-text output, markdown, CMS fields. A
utility attaches to an element. So the naive conversion is impossible by
definition, and the question is only whether an escape hatch is acceptable.

**There is exactly one escape hatch, and it works.** Tailwind v4's arbitrary
descendant variant puts the utility on the Prose root and the selector on the
descendant. Verified generating correctly:

```
[&_p]:text-body-md [&_h2]:text-display-md [&_h2]:text-ink …
```

Measured on a probe route: `[&_p]:text-display-md` on the container gave the
child `<p>` a 26px font-size. It compiles, it applies, it is real.

**And it is disqualified by one measurement.** Every selector in `Prose.css` is
wrapped in `:where()`, so the entire stylesheet has **zero specificity** — the
file says so in its own header comment, and it is the component's thesis: "Block
components inside Prose override naturally via their own class-based selectors
without needing any resets here."

Tailwind's arbitrary variant generates `.\[\&_p\]\:text-body-md p` —
specificity **(0,1,1)**. So I ran the contest, with the consumer's rule placed
**FIRST** in source order so that only specificity could decide it:

```css
.OverridingBlock { font-size: 11px; }                      /* the consumer, 0,1,0 */
:where(.formWhere[data-variant="rich"]) p { font-size: 101px; }  /* today,      0,0,1 */
.formArb p                                { font-size: 102px; }  /* [&_p]:,     0,1,1 */
.formArb2[data-variant="rich"] p          { font-size: 103px; }  /* + the gate, 0,2,1 */
```

| form | rendered font-size | who won |
|---|---|---|
| `:where(.Prose[data-variant="rich"]) p` — **as shipped** | **11 px** | **the consumer** ✓ |
| `.class p` — what `[&_p]:` generates | 102 px | Prose ✕ |
| `.class[data-variant] p` — keeping the gate | 103 px | Prose ✕ |

**The conversion inverts the cascade.** A consumer's block component, styled with
one class and no `!important`, wins today and loses after conversion. That is
precisely the override surface ADR-0017 and ADR-0018 exist to provide, and F-062
identified its loss as the cost of a utility conversion for Button. Here it is
not a cost to weigh — it is the destruction of the component's only feature.

**A second, independent disqualification: the variant tiers.** Prose's three
variants are nested element sets — `basic` styles `p`; `default` adds nine more
element groups; `rich` adds seven more. In CSS that is three selector lists over
one declaration body each. As utilities it is either three separate class strings
with the shared declarations duplicated, or a runtime concatenation — and Tailwind
cannot see a concatenated class name, so the enumeration must be literal.
Counted: **~90 declarations across ~25 rules become roughly 150 literal utility
strings across three variants**, every one of them an arbitrary variant with
escaped brackets, and the `:where()` guarantee gone.

**Third, and smallest but decisive for correctness:** three of Prose's rules
cannot be expressed as descendant variants at all —
`:is(strong, b) :is(em, i)` (a two-level descendant relationship inside the
content tree), `p:last-child`, and `:is(h1…h6):first-child`. Arbitrary variants
can technically nest (`[&_strong_em]:italic`), but each nesting level adds
specificity, compounding the first problem.

**Decision: Prose stays CSS. Step 3 is not performed for this component.**

`Prose.css` after step 2 is 300 lines of zero-specificity descendant selectors
reading design tokens, and that is the correct artifact. The stylesheet is not an
implementation detail that Tailwind would tidy — it *is* the component. There is
nothing here for utilities to hold.

**The confirming measurement, from the consumer.** `TeaserTagHelper.cs` does not
compose either component; it builds their markup as strings (lines 86–107):

```csharp
sb.Append($"<h2 class=\"Heading\" data-variant=\"heading\" data-size=\"4\" …>{headingContent}</h2>");
sb.Append($"<div class=\"Prose\" data-variant=\"basic\" data-size=\"sm\"><p>{encodedExcerpt}</p></div>");
```

Pure class + `data-*` markup — exactly what these stylesheets were designed for,
and exactly what a utility cannot reach. `tasks/probes/typo-teaser-markup.cjs`
injects Teaser's own strings into both live routes and measures them against what
each component renders for the same axes:

| | Teaser's markup | via the component | same? |
|---|---|---|---|
| **Heading, CONVERTED** | | | |
| `font-size` | 16 px | **18 px** | **NO** |
| `line-height` | 24 px | **22.5 px** | **NO** |
| `font-weight` | 400 | **600** | **NO** |
| `color` | ink | ink | yes¹ |
| `.heading-text` `display` | **inline** | block | **NO** |
| **Prose, NOT CONVERTED** | | | |
| `p` font-size | 14 px | 14 px | yes |
| `p` line-height | 21 px | 21 px | yes |
| `p` font-weight | 400 | 400 | yes |
| `p` color | body | body | yes |
| `p` display | block | block | yes |

¹ right only by accident — `globals.css`'s base layer colours `h1`–`h4`. A
Teaser heading at `h5` or `h6` would be wrong here too.

**Four of five properties wrong for the converted component; five of five correct
for the one left as CSS.** The port's own downstream consumer is the evidence.

**Open question for the project.** Heading's conversion is committed and its
computed-style diff is clean, so nothing in this repo detects that it broke
Teaser — the breakage lives in markup no test on either side renders. Before
Teaser is ported, either (a) Teaser must compose `<Heading>` rather than emit its
markup, or (b) Heading's step 3 must be reverted. Option (a) is clearly right for
a React port and is what I would do; it is worth recording that **a utility
conversion silently converts a public class-and-attribute API into a
private one**, and that the only reason it is survivable here is that we also
control the one consumer.

---

### F-NEW · Two `opacity: 0.7` declarations were real WCAG 1.4.3 failures, and `opacity` on live text cannot be sized once

**Surface:** `Prose.css`'s `blockquote` and `figcaption`, verbatim from the
source. Measured on the step-1 build with `typo-axe.cjs`.

Both carried `opacity: 0.7` as a "quieter voice" device. Measured:

| element | text colour | ground | composited | ratio | AA |
|---|---|---|---|---|---|
| `blockquote` | `--color-body` #5a5852 | card #ffffff | rgb(140,138,134) | **3.45:1** | **✕** |
| `figcaption` | same | same | same | **3.45:1** | **✕** |

Axe reports both. The WCAG 1.4.3 inactive-component exception does **not** apply —
a blockquote is live prose, not a disabled control — so this is the same defect
shape as the reference library's FileUpload `.drop-label` (F-027) and the same
shape as the Button port's `[data-test-state="disabled"]` cell.

**The structural point is the one worth keeping: `opacity` on a text container is
not a colour, it is a multiplier against an unknown ground.** Prose is explicitly
"a container for uncontrolled markup" and can land on `canvas`, `canvas-soft`,
`surface-card`, `surface-strong` or a consumer's own band. There is no single
opacity value that clears 4.5:1 on all of them, because the composite depends on
the ground. And the failure mode inverts between appearances: in dark, 0.7
against a dark ground makes text *dimmer*, not lighter, so the same declaration
fails from the opposite direction.

**Decision:** `opacity` removed from both and replaced with
`color: var(--color-body)`, which is already the quieter of our two text stops
(5.64:1 on the card), is a `light-dark()` pair so it stays quiet rather than
dissolving in dark, and is a colour rather than a multiplier. The `hr`'s
`opacity: 0.2` on `currentColor` was replaced by `--color-hairline` for the same
reason — measured, it composited to a near-invisible line on cream and a
near-white one in dark, because `currentColor` inverts and 0.2 does not
compensate. Verified 0 axe violations on the route in both appearances after the
change.

**Open question for upstream:** the same reasoning applies to
`blockquote`'s `border-inline-start: 3px solid currentColor`, which we tokenised
to `--color-hairline-strong`. A full-strength ink rule beside quiet text is the
opposite of the intended emphasis, and the source has it in both places.

---

### F-NEW · Three survivability declarations were locked inside the `rich` tier, so `basic` and `default` could not reflow at all

**Surface:** `Prose.css`'s variant tiers. Found by `typo-reflow.cjs` and
`typo-text-spacing.cjs`; the first found half of it and the second found the rest.

Prose's three variants are nested element sets, and the tiering is a contract:
`basic` gets `p`, `default` adds headings/lists/inline/links/code/blockquote,
`rich` adds `pre`/tables/figures/`hr`. Two of `rich`'s declarations are not
appearance at all — they are the only thing keeping the content on the page.

**`pre`.** `overflow-x: auto` lives in the rich block only. A `<pre>` is
UA-styled `white-space: pre`, so in `basic` and `default` a long code line
neither wraps nor scrolls. Measured at a 320 px viewport on this route:

| variant | `pre` behaviour | innermost `<code>` right edge |
|---|---|---|
| `rich` | scroll container | 397 px (clipped, harmless) |
| `default` | **overflows** | **376 px** |
| `basic` | **overflows** | **454 px** |

**134 px of document horizontal scroll** against a 320 px viewport — a WCAG
1.4.10 failure that depends on which variant a CMS editor happened to be given.

**`table`.** Every table declaration is rich-only, so a `<table>` in `basic` or
`default` keeps `table-layout: auto` and `overflow-wrap: normal`. Measured under
the four forced WCAG 1.4.12 text-spacing properties at 320 px:

| variant | `table-layout` | `overflow-wrap` | table box |
|---|---|---|---|
| `rich` | fixed | anywhere | 238 px ✓ |
| `default` | **auto** | **normal** | **337 px** ✕ |
| `basic` | **auto** | **normal** | **337 px** ✕ |

17 px more of document scroll. **And the plain reflow sweep was green for this
one** — without the overrides the tables fit. Only the 1.4.12 probe finds it,
which is the criterion's whole point: it is about surviving the *reader's*
typography, and an auto-layout table does not.

Even in `rich`, the source's own table needed work: `width: 100%` +
`table-layout: auto` put **59 px** of document scroll on the route at 320 px
entirely on its own, with the `pre` defect already fixed.

**Decision:** the survivability declarations are hoisted out of the rich tier and
made variant-agnostic — `pre { overflow-x: auto }`, `table { table-layout: fixed }`,
`:is(th, td, caption) { overflow-wrap: anywhere }` — while every appearance
declaration (ground, border, padding, font, radius) stays rich-only. The tier
design is a contract about *appearance*; survivability is not appearance, and
CLAUDE.md makes accessibility the tiebreaker.

`table-layout: fixed` + `overflow-wrap: anywhere` is recorded as a **mitigation,
not a fix.** It makes columns share the available width and break inside words,
which costs typographic quality. The real fix is a scroll container around the
table, and **Prose cannot add one — it does not own the element.** That is the
same structural limit as the step-3 verdict, showing up as an accessibility
constraint rather than a styling one.

**A `<caption>` sub-finding worth its own line, because it is non-obvious:** a
caption's min-content contributes to the **table's** minimum width, so
`table-layout: fixed` + `width: 100%` does *not* stop a long caption from
widening the table past its container. With the cells already at `anywhere`, the
caption alone still pushed the table to 337 px and put 17 px of scroll on the
document. It was also the one element in the sample that `Prose.css`'s own
element list forgot to style at all — upstream a captioned table renders its
caption at the inherited size, UA-centred, with no space.

---

### F-NEW · The stylesheet's element list has gaps, and only a realistic long-form sample finds them

**Surface:** `Prose.css`'s element coverage vs the kitchensink's article sample.

Prose styles what it styles by enumeration, so anything absent from the list
falls back to the UA stylesheet — invisibly, because UA defaults look
*plausible*. Building the demo sample to cover every element the stylesheet
mentions turned up three it does not:

| element | upstream | what it rendered as | step 2 |
|---|---|---|---|
| `caption` | **absent** | inherited size, UA-centred, no spacing | `--text-caption`, `start`, 0.5em |
| `h5`, `h6` colour | absent | **`--color-body`**, while `h2`–`h4` were `--color-ink` | all six → `--color-ink` |
| `pre` ground | absent | no background at all | the design's `code-block` |

The `h5`/`h6` one is the instructive one, and it is a *host* interaction rather
than a Prose bug. `Prose.css` sets no heading colour and relies on the host;
`globals.css`'s base layer sets `color: var(--color-ink)` on `h1, h2, h3, h4` and
stops. Measured inside one article on the step-1 build: `h2`/`h3`/`h4` at
`rgb(38,37,30)` and `h5`/`h6` at `rgb(90,88,82)`. **A long-form container whose
sixth heading level is a different colour from its second is broken**, and no
component-scoped test could see it because neither file is wrong on its own.

`pre` having no ground matters more than it sounds: on a cream canvas an unstyled
`<pre>` is a paragraph in a different font, and `cursor-DESIGN.md` says code
surfaces are "roughly half the page" and gives `code-block` an explicit
recipe (surface-card, ink, 1px hairline, `{rounded.lg}`, 20px padding).

**Decision:** all three filled in inside `Prose.css`. The heading colour is
deliberately fixed *here* rather than by extending the host base layer: this
component's job **is** to style descendant headings, and doing it here makes
Prose independent of whether a host happens to cover `h5`/`h6`.

**Open question for the host:** `globals.css`'s `h1, h2, h3, h4` base rule should
probably be `h1, h2, h3, h4, h5, h6`. Not changed — reported, per instruction.

---

### F-NEW · The `em`-relative code size is a relationship, and step 2 changed the ratio without breaking the mechanism

**Surface:** `Prose.css`'s `code` and `pre`, `font-size: 0.875em` → `0.8125em`.

Small, but it is the one place in this pair where ADR-0025's "express
relationships, never a scale" had a clean answer, and the Button port's
equivalent finding was a loss.

The source writes `font-size: 0.875em` on `code`, i.e. "7/8 of whatever the
surrounding text is". Against the source's 20px desktop body that is 17.5px.
Against our 16px body it measured **14px** on the step-1 build, where
`cursor-DESIGN.md`'s `{typography.code}` is **13px** and "JetBrains Mono on every
code surface" is one of its three typographic principles.

**Decision:** `0.8125em` — because 13/16 = 0.8125. The value changed; the
mechanism did not. Code stays proportional to its context, so a consumer that
sets Prose to `data-size="sm"` gets 11.4px code rather than a pinned 13px, and a
consumer that installs a larger body scale keeps the ratio. Compare the Button
port, where `calc((var(--_iconSize) / 2) * -1)` had to become three hardcoded
constants: there, the relationship was between two *properties* and no utility
can hold that; here it is between a property and its own inherited value, which
`em` holds natively. **`em` survives a design swap; a utility does not.**
Measured after: `code` 13px, `pre` 13px, `pre code` 13px (the `1em` reset holds).

---

### F-NEW · `element="aside"` is a legal prop that produces a WCAG violation almost everywhere Prose is used

**Surface:** `ProseTagHelper.ValidElements`, measured by `typo-axe.cjs`.

`app-prose` accepts five wrapper elements: `div`, `section`, `article`, `aside`,
`footer`. Demonstrating all five put a real violation on the route, in both
appearances:

```
[moderate] landmark-complementary-is-top-level: Aside should not be
           contained in another landmark  (1 node)
  aside
```

`<aside>` carries the `complementary` landmark role, and the rule fails any
complementary landmark nested inside another landmark. Every page of this
kitchensink is inside `<main>`, and so is essentially every real placement of a
prose container — an excerpt inside an article, a CMS body field inside a page
region. Wrapping it in `<article>` does not help: `article` is not a landmark, so
the `aside` is still inside `main`.

**Decision:** the prop is kept (the source has it) and the live demo is
**dropped**, replaced by a cell that explains the absence — the same call the
Button port made for its disabled-CTA cell, for the same reason: a kitchensink
must not manufacture a violation the component would not produce in correct use.
Route is 0 violations in both appearances with the cell removed.

**Open question for upstream:** `aside` is the one element in the list that
carries a landmark role, and `app-prose` is a component whose entire purpose is
to be nested inside other content. Either drop `aside` from `ValidElements`, or
document that it is only valid when Prose is a top-level sibling of `main` — which
is a placement the component cannot check.

---

### F-NEW · `IHtmlContent` becomes `dangerouslySetInnerHTML`, and React makes the mutual exclusion stricter than the source's

**Surface:** `ProseTagHelper`'s `Content` property vs `Prose.tsx`'s `rawHtml`.

The source has two content paths: an `IHtmlContent Content` property and child
content, with `hasContent` winning. `IHtmlContent` is *unescaped by contract* —
it is the CMS-string case Prose exists for.

In React both are `children`, so the two branches would collapse. They should
not: a pre-rendered CMS string genuinely needs `dangerouslySetInnerHTML`, and
conflating it with `children` would either escape markup that must not be escaped
or invite an injection. So `rawHtml?: string` is a separate prop, documented as
trusted input only, exactly as unescaped as `IHtmlContent`.

**One place React is stricter, for free.** The source's precedence is a silent
drop: given both `Content` and child content, it renders `Content` and discards
the children. React makes `dangerouslySetInnerHTML` and `children` **mutually
exclusive by construction** — you cannot pass both to one element — so the
component has to branch, and the impossible combination is a type-level error
rather than silent data loss.

**Decision:** two props, `rawHtml` winning, matching the source's precedence.
Recorded because it is the second place in this pair where "port the logic, not
the class" produced a safer component rather than an equivalent one (the first is
Heading's highlighter): the Razor idiom is a string API because Razor has no other
option, and JSX's tree API makes the dangerous path explicit and narrow.

---

### F-NEW · The reference library's own text-spacing suite has two defects, and both produced a false green here before they were found

**Surface:** `reference-components/tests/text-spacing.e2e.test.js`, ported to
`web/tasks/probes/typo-text-spacing.cjs`. **A finding about the instrument, which
is worth as much as a finding about the component.**

The reference suite is the right shape and its self-awareness is exemplary — it
plants a violation and fails if its own detector misses it, "because a green
survivability suite is exactly the kind that rots into theatre". Ported to this
project, it reported green while asserting nothing, twice, for two different
reasons.

**1. The planted canary cannot fire here, and the documented reason is not the
whole reason.** F-023 already records that this project's `globals.css` renders
`body` at `line-height: 1.5`, so forcing 1.5 changes nothing. Giving the plant
`line-height: 1` fixes that — and it still did not fire. Measured:

| stage | box (`clientHeight`) | content (`scrollHeight`) | over |
|---|---|---|---|
| before overrides, box pinned from `getBoundingClientRect().height` | 16 px | **18 px** | **2 px** |
| after overrides | 16 px | 24 px | 8 px |

The plant was **already clipped by 2 px before the overrides**, because at
`line-height: 1` the descenders exceed the line box — so the baseline filter
discarded it as a pre-existing defect and the self-test passed with the detector
blind. This is exactly the mistake the reference's own comment warns about
("It has to be intact BEFORE the overrides"), arrived at from a direction the
comment does not cover: the pin is taken from the *border box*, and the thing
that must not overflow is the *scroll* box. Fixed by pinning `blockSize` from
`scrollHeight`.

**2. The target-size assertion has no inline exception, and prose is made of
inline links.** The suite fails any interactive target whose smaller dimension
drops below 23 px. WCAG 2.5.8 explicitly exempts targets "in a sentence or whose
size is otherwise constrained by the line-height of non-target text". Measured on
this route at 320 px: **three false positives**, all inline `<a>` in the sample
article at 78 × 20 px. The exception is normative, and without it the check cannot
be run against a prose component at all. Added as
`display: inline*` **and** inside a text element.

**Decision:** both fixed in our probe, which now reports
`self-test: planted violation DETECTED` before every run. Final result, on the
current tree:

| route | 320 px | 768 px | 1280 px |
|---|---|---|---|
| `/primitives/prose` | ok (12169→15888 px tall, 0 h-scroll, 0 clipped) | ok | ok |
| `/primitives/heading` | ok (7308→9175 px, 0 h-scroll, 0 clipped) | ok | ok |

**Open question for upstream:** both defects are in the reference suite as
shipped. The `scrollHeight` pin is a two-word change; the inline exception is
three lines and makes the suite correct against any long-form content. Worth
proposing, because the suite is otherwise the best instrument either repo has and
it is currently able to pass while measuring nothing.

---

### F-NEW · Prose's `:where()` discipline is the one thing in this pair that a design swap did not touch, and that is a positive result

**Surface:** `Prose.css` step 1 → step 2, all 25 rules.

Step 2 changed ~15 declarations across the file — colours, sizes, grounds,
borders. It changed **zero selectors**. Every rule is still
`:where(.Prose[data-variant="…"]) <element>`, still zero specificity, still
overridable by one consumer class.

That is worth recording as a positive, because it is the concrete demonstration
of what the two-phase method is *for*. A stylesheet whose selectors encode
*meaning* (which variant, which element) and whose declarations encode *values*
(which colour, which size) can have its entire design replaced without touching
its structure — and the diff proves the separation held: `git show` on the step-2
commit for this file is a diff of values, plus three accessibility declarations
and one forgotten element.

Compare `Button.css`, whose central idiom (thirty blank custom properties filled
by gates) was a *structural* encoding of the same information, and which step 3
deleted entirely. `Prose.css` reaches the same goal — conditional styling behind
a gate — with a selector instead of a property, and the selector version is the
one that survived both a design swap and the question of a utility conversion.

**Observation, not a decision.** `philosophy.md`'s "conditional properties live
behind a gate" and Prose's ":where() plus a descendant selector" are two
implementations of one idea. Measured across this port: the property version is
convertible to utilities and loses its override seam doing it; the selector
version is not convertible and keeps its seam. Neither is free. But only one of
them makes the seam *the point*, and that is the one that a component styling
markup it does not own actually needs.
