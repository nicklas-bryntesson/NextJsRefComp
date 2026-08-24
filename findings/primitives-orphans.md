# findings/primitives-orphans.md

Three Razor stylesheets with **no TagHelper** — `Tables.css` (224 lines),
`CoverComposition.css` (249), `CircleDiagram.css` (87) — ported to
`web/src/primitives/{Table,CoverComposition,CircleDiagram}/` in three ordered
commits: `4b67f78` (step 1, verbatim), `75eeddf` (step 2, restyle), `a9f7608`
(step 3, Tailwind).

Routes: `/primitives/table`, `/primitives/covercomposition`,
`/primitives/circlediagram`.
Probes: `web/tasks/probes/orphans-{guard,step1-tokens,step2-verify,computed,axe,reflow,reflow-who}.cjs`.
Baseline snapshot: `web/tasks/snapshots/orphans-step2-before-tailwind.json`.

`F-061` (the bridge answers the semantic tier, colour reads the constant tier) and
`F-062` (the blank-property gate does not survive a Tailwind conversion, and the
cost lands on the consumer) are referenced throughout and live in the root
`Findings.md`, not here.

**This port's defining difference from every other one in this project.** For the
reference components the contract *was* the deliverable — a `.md` with
`## Contract` / `## Behaviour` / `## Accessibility`, plus an e2e suite that is
stricter than the prose. For the Button family the contract was executable C#.
Here there is neither. The markup contract had to be **derived from the CSS
selectors plus whatever Razor happens to use them**, and the confidence in that
derivation varies enormously between the three. Two of the highest-value entries
below (F-066, F-094) are defects that exist *only* because nobody ever had to
write the contract down.

---

## Reconnaissance — the verdict for each, before any code

Grepped the whole source repo (`--include=*.cshtml,*.cs,*.js,*.ts,*.css,*.html`,
excluding `bin/`, `obj/`, `wwwroot/`, `node_modules`) for every class name and
custom property each stylesheet defines or reads.

| Stylesheet | Referenced from | Verdict | Contract confidence |
|---|---|---|---|
| `Tables.css` | `style.css` import; `_Tables.cshtml` (14 demo tables); **overridden by** `DateField.css:248` and `DateTimeField.css:247` | **Element-level styling, not a component** | n/a — the contract is "any HTML table" |
| `CoverComposition.css` | `style.css`; `_CoverComposition.cshtml`; `Site.cshtml`, `Home.cshtml`; `ClientApp/js/utils/CoverCompositionVideo.ts` | **A real component**, two variants | **MEDIUM** — three disagreeing sources |
| `CircleDiagram.css` | `style.css`; `Views/Partials/richtext/Components/rteCircleDiagramBlock.cshtml` | **A real component** | **HIGH** — the Razor is a complete literal template |

**None of the three is dead code**, which was the outcome I was most prepared for
and the grep ruled out immediately. What I recommend discarding is narrower and
is set out at the end.

---

### F-064 · A `.cshtml` can be as good a contract as a `.cs` — and one of these three is

**Surface:** `Views/Partials/richtext/Components/rteCircleDiagramBlock.cshtml`.

The brief framed "no TagHelper" as the source of uncertainty. For CircleDiagram
that turned out to be false. The Razor partial is a complete, literal template:
every element, every class name, every attribute, and the one piece of logic
(cumulative conic-gradient stops indexed `1..n`) written out in C# I could port
line for line. Nothing was inferred. The `.tsx` is a transliteration.

What made it a good contract is not the language, it is that the markup is
**enumerated rather than composed**. `ProseTagHelper` or `HeadingTagHelper`
compute a class list; this partial spells out a fixed tree.

The two things it does *not* pin, and neither is markup:
- `<app-heading element="h4" size="4">` — the heading primitive is a separate
  port, so the element and its type role were reproduced directly. A hard-coded
  `h4` is a heading-order hazard the source already had, and fixing it means
  adding an attribute the contract does not have. Left as found, recorded.
- `--CircleDiagram-color-7` and beyond. See F-074.

**Decision:** treat "has a TagHelper" as a poor proxy for "has a contract". The
useful question is whether the markup is enumerated or computed. Enumerated Razor
is a contract; a TagHelper that builds a class list is a contract; a stylesheet
with no markup anywhere is not.

---

### F-068 · A hard-coded `h4` in a rich-text block is a heading-order hazard the contract cannot fix

**Surface:** `rteCircleDiagramBlock.cshtml` line 44 → `CircleDiagram.tsx`.

The Razor renders `<app-heading text="@title" element="h4" size="4" />` — the
element is a **literal**, not a parameter. A rich-text block can be dropped
anywhere in a document, so a chart placed directly under an `<h2>` skips a level,
and two charts in a row under different parents produce an incoherent outline.
WCAG 1.3.1 does not require sequential heading levels, but axe's
`heading-order` rule flags a skip and the atomica11y table criteria ask for "a
caption **or a heading** to describe its purpose" — so the heading is doing real
work and its level matters.

Reproduced as found. Fixing it means adding a `headingLevel` prop, which is an
**attribute the contract does not have** — and inventing API on a derived contract
is exactly the failure mode this port is trying to avoid (F-065). The kitchensink
sidesteps it: `Section` renders the `<h2>`, so the demo's own outline is valid.

**Open question for the project owner:** add `headingLevel` (as
`_CoverComposition.cshtml` already does via `ViewData["headingLevel"]`, so there is
precedent *in the same codebase*), or leave the level fixed and document that a
CircleDiagram must be placed under an `<h3>`. The first is a contract change; the
second is a constraint no editor will read.

---

### F-065 · Where there was no TagHelper, the contract had THREE sources and they disagreed

**Surface:** CoverComposition. **The measured cost of a derived contract.**

Assembled from:

1. `_CoverComposition.cshtml` — two variants, image and video, with **different
   inner structure**.
2. `CoverComposition.css` — selectors for parts the Razor never emits.
3. `CoverCompositionVideo.ts` — a 7-state machine that **injects** two of the
   parts the CSS styles.

And the stylesheet's own header comment names a third set of class names —
`.CoverComposition-videoControls`, `.CoverComposition-videoToggle`,
`.CoverComposition-media` — that **none of the three uses**. The CSS and the JS
both say `.video-controls` / `.video-toggle` / `.media-container`. So the one
piece of prose documentation in the entire scope is wrong about the markup it
documents.

The class names are also generically dangerous: `.media-container`,
`.content-container`, `.content`, `.overlay`. And in the container-query branch
they are **not scoped to `.CoverComposition` at all** — the source writes bare
`.media-container { … }` at top level inside `@container`, so those rules apply to
any element with that class anywhere in the document.

**What the derivation cost, concretely.** Four real defects in the layout, none
of which the source app could have noticed, all found by measuring rather than by
reading: F-066 (dead CTAs), F-081 (a grid with no columns), F-094 (an overlay
that does not overlay), F-095 (no scrim). Every one is a consequence of the
contract living in three places with nobody responsible for their agreement.

**Decision:** every derived decision is marked `DERIVED:` in the source files, and
confidence is stated in each file's header. Confidence MEDIUM is not a hedge here
— it is the honest reading of a contract whose three witnesses contradict each
other.

---

### F-066 · The two variants have different markup, and one of them shipped non-clickable CTAs

**Surface:** `_CoverComposition.cshtml` lines 52 and 89. **The single best
argument in this port for writing contracts down.**

The video variant's inner wrapper is `<div class="content">`. The image variant's
is a bare `<div>` with no class. And the stylesheet says:

```css
& .content-container {
  pointer-events: none;      /* the whole overlay column */

  & .content {
    pointer-events: auto;    /* the ONLY rule that restores it */
  }
}
```

So in the source, **the image variant's CTA buttons are not clickable**. Measured
on the step-1 verbatim baseline: `pointer-events: none` computed on
`.content-container > div` and inherited by every descendant, including the
`<a>` elements inside `.link-group`.

This is invisible from either end alone. Reading the Razor, the two branches look
like a stylistic inconsistency. Reading the CSS, `.content` looks like it is
always there. It takes both files at once, plus a `getComputedStyle` on the right
element, and the source app's own hero is the *video* variant on both pages that
use it — so the broken branch is the one nobody looks at.

**Decision:** reproduced verbatim in step 1 and measured; fixed in step 2 two
ways, deliberately. The `content` class is added to the image variant *and*
`.content-container > *` restores pointer events in the stylesheet, so a host that
copies the source's own markup is also covered.

---

### F-067 · The chart is a `<div>` with a background, and the legend is the only accessible representation

**Surface:** `CircleDiagram.tsx`, `CircleDiagram.css`.

The donut is `<div class="CircleDiagram-chart" style="background: conic-gradient(…)">`
containing one empty `<div>`. It carries the entire dataset visually and exposes
**nothing** to assistive technology — the source leaves two empty generic
containers in the accessibility tree.

Three options: build a data table the source never had; add
`role="img"` with a generated `aria-label` enumerating every segment; or hide the
chart and let the legend be the accessible representation. The legend already
renders **both** the label and the percentage as text, per segment, so the third
option costs nothing and invents nothing.

```tsx
<div className="CircleDiagram-chart" aria-hidden="true" style={{ background: gradient }}>
```

plus `role="group"` and `aria-label` on the `<figure>` so the figure announces
what it is.

**This decision is load-bearing for F-082** — it is what makes a monochromatic
palette honest. Nothing depends on telling adjacent fills apart, so WCAG 1.4.1
"Use of Color" is satisfied by the text and not by the hues.

**Open question:** if a future variant drops the legend, the chart needs a real
accessible representation and the palette decision has to be revisited. Both are
recorded in the stylesheet header at the point of use.

---

## Tables.css — the "is it even a component" question

### F-070 · 224 lines, zero class names: this is a stylesheet, not a component, and the honest port says so

**Surface:** `ClientApp/css/04_ui/Tables.css`.

Every selector is rooted at the bare element `table`. There is no class name
anywhere in the file — the whole thing is `& td`, `& th`,
`& tbody th[scope="col"]`, `:has(thead)`, `:has(tfoot)`,
`tr:first-child th:last-child`. Its contract is *any HTML table*, exactly like
`Prose.css`.

Two pieces of evidence that this is the source author's intent and not an
oversight:

- `_Tables.cshtml` is 533 lines of **arbitrary** table markup — 14 tables with no
  shared class, including two lifted verbatim from MDN.
- `DateField.css:248` and `DateTimeField.css:247` both contain
  `background: none; /* override global Tables.css thead th band */`. The author's
  own components fight it, which only happens to a *global element* stylesheet.

So there is no `<Table>` component, and building one would have been the wrong
answer twice over: it would invent a contract the source does not have, and the
wrapper would be unreachable by the selectors that do all the work.

**What shipped instead:** `Tables.css` (restyled), a kitchensink that imports it
and supplies arbitrary table markup, a documented markup contract, and exactly
one React file — `TableScroll.tsx`, which exists for the reason in F-088 and for
no other.

**Decision:** ported as a stylesheet. `Table` is singular in the directory name
because the directory holds a stylesheet about tables, not a Table component.

---

### F-071 · The source's own table demos fail the accessibility criteria the library documents

**Surface:** `Views/Shared/Partials/KitchenSink/_Tables.cshtml` vs
`reference-components/docs/atomica11y/main/table.md`.

`table.md` requires that a screen-reader user "HEAR the table has a caption or a
heading to describe its purpose" and that "column headers and row headers are
identified". Of the 14 demo tables in the source partial, **most have no
`<caption>`**, and three use bare `<th>` with no `scope` at all — including the
two MDN examples, which MDN ships specifically to contrast scoped and unscoped
markup.

The first demo in the file is titled `<h1>Bug to fix:</h1>` with the note *"What
is happening with the double border here?"*, and the following one says *"I mean,
you could just remove it with a simple class, but that does not scream
Designsystem"*. This is a working scratchpad that shipped, not a conformance
surface.

**Decision:** every table on `/primitives/table` has a `<caption>` and `scope` on
every header cell, and the multi-row header uses `scope="colgroup"` for the cell
that spans two columns. That is a correction, not a port, and it is called out in
the kitchensink header so nobody mistakes it for a faithful reproduction. The
structural axes the *stylesheet* branches on are reproduced exactly — tbody only,
+thead, +tfoot, multi-row thead, colspan, rowspan, row headers, empty table.

---

### F-072 · `overflow-x: auto` on a `table` is silently forced to `visible`, so the source's whole reflow strategy is a no-op

**Surface:** `Tables.css` line 5, verbatim.

```css
table {
  overflow-x: auto;   /* the source's entire answer to a wide table */
}
```

Measured on the verbatim step-1 build, both appearances:

```
table: {"overflow-x":"visible", …}
```

The declaration is authored, parsed, and then **discarded by the engine**: a table
box is not a scroll container, and Blink's style adjuster resets `overflow` to
`visible` for `display: table`. So the one property in the file whose job is
reflow does nothing, in every browser, and always has.

It is a perfect trap: it reads as a solved problem in code review, it produces no
warning, no console message and no axe violation, and it is only detectable by
reading the *computed* value rather than the declared one.

**Decision:** moved to `.table-scroll`, which is what `TableScroll.tsx` puts on
the wrapper. The declaration is not merely relocated — the comment in
`Tables.css` explains why it could never have worked where it was, because the
next person to see a bare `table { overflow-x: auto }` will assume it works too.

---

### F-088 · An element-level table stylesheet CANNOT satisfy WCAG 1.4.10 on its own — reflow puts exactly one element into the contract

**Surface:** `/primitives/table`, 320–1280 px sweep.
**This is the answer to "how does a wide table survive 320 px".**

Measured document horizontal overflow on the step-1 verbatim build:

| Viewport | Overflow | Culprits |
|---|---|---|
| 320 px | **578 px** | `caption`, `th`, `td` of the 12-column table |
| 360 px | 538 px | same |
| 480 px | 418 px | same |
| 768 px | 130 px | same |
| 1024 px | 0 px | — |

And a *five*-column table of real names — the source's own "club members" demo —
overflowed by 219 px at 320 px. This is not an exotic case; it is a normal data
table.

Nothing a `table { }` rule can say fixes it. The two mechanisms that would are
both unavailable: `overflow` is forced to `visible` on a table box (F-072), and
changing `display` destroys the table semantics that both this stylesheet and
`atomica11y/main/table.md` depend on. So the "no component" verdict of F-070 has
**exactly one limit**: reflow forces a single wrapper element into the contract.
That is the entire markup requirement this stylesheet turns out to have, and the
source app never found it because every one of its own demos is narrow.

For context, `Findings.md` F-037 records the reference library's own kitchensink
overflowing by 737 px at 320 px "largely because of its state tables". Same
mechanism, same blind spot, different repo.

After wrapping every data table: **0 px overflow at 320, 360, 480, 768, 1024 and
1280.** One demo is left deliberately unwrapped — a genuinely narrow 3-column
table — to show the wrapper is a response to width and not a ritual.

**Decision:** `TableScroll` is part of the port and is documented as mandatory for
any table whose min-content width can exceed the viewport. It is *not* a
`<Table>` component: it takes arbitrary children and knows nothing about tables
except that they overflow.

---

### F-073 · The scroll container's two accessibility requirements pull in opposite directions, and only the wrapper satisfies both

**Surface:** `TableScroll.tsx`, `Tables.css`.

- WCAG 2.1.1 / axe's `scrollable-region-focusable`: a scrollable region must be
  reachable and operable by keyboard, which in practice means a tab stop.
- `atomica11y/main/table.md`, criterion 1: *"WHEN I use the arrow keys I SEE the
  table scrolls into view **(but is not focusable)**"*.

Put `tabindex="0"` on the `<table>` and you satisfy axe and violate the
atomica11y criterion in the same stroke. Both hold only if the **wrapper** is the
focus target and the table is left alone:

```tsx
<div className="table-scroll" role="region" aria-label={label} tabIndex={0}>
```

Measured: `.table-scroll` `overflow-x: auto` / `tabindex="0"`, `table`
`overflow-x: visible` / `tabindex` absent, in both appearances. axe clean.

`role="region"` needs an accessible name or it is a worse violation than no
landmark, so `label` is a **required** prop rather than an optional one — the type
system enforces the a11y requirement.

One detail that only shows up in a scroll container: `Tables.css` sets
`caption-side: bottom`, so the caption scrolls sideways out of view with the
table, taking the region's only description with it. `position: sticky;
inset-inline-start: 0` pins it. That is the caption a screen-reader user relies
on to know what the region contains, and it was one horizontal swipe from being
gone.

**Open question for the project owner:** the reference library's own `ScrollArea`
solves this problem for its own subtree and has a conformance suite for it.
`TableScroll` duplicates a small part of that behaviour. Whether the two should
converge is a design decision, not a porting one — but note `ScrollArea` brings
`--_sb-track` / `--_sb-thumb` oklch literals and a 2.22:1 thumb that is also its
focus ring (`Findings.md`, CLAUDE.md), so composing it here would import a known
1.4.11 defect into a data table.

---

### F-077 · One undefined token took out 190 of 224 lines, and the port could not see it because nothing errored

**Surface:** `Tables.css`, step 1 verbatim. **F-061, a second time, worse.**

`Findings.md` F-061 records that the bridge answers the *semantic* tier while
`Button.css` reads the *constant* tier, and closes with the right instruction:
"grep the components for constant-tier reads before trusting a semantic bridge".
All three stylesheets in this scope read constants. Measured with
`orphans-step1-tokens.cjs` on the verbatim build:

| Token read | Resolved to |
|---|---|
| `--COLOR-N10`, `--COLOR-N20`, `--COLOR-N30`, `--COLOR-N80`, `--COLOR-B90` | **UNDEFINED** |
| `--grid-layout-gap`, `--grid-layout-columns`, `--grid-container-columns` | **UNDEFINED** |
| `--borderWidth` | **UNDEFINED** |
| `--fontSize-label-sm` | **UNDEFINED** (a typo — see F-084) |
| `--color-text-muted` | **UNDEFINED** (but written with a fallback — see below) |
| `--fontFamily-body`, `--size-md`, `--fontSize-body-small`, `--fontSize-label-small` | resolved correctly |

The amplification is what is new. `Tables.css` funnels its entire visual system
through one line:

```css
--_border: 1px solid var(--COLOR-N30);
```

An invalid `var()` inside a **shorthand** is invalid-at-computed-value-time, so
the whole `border` shorthand falls to its initial value. Measured on the verbatim
build, both appearances:

```
table:    border-top-width: 0px
tbody td: border-left-width: 0px   border-bottom-width: 0px
thead th: background-color: rgba(0, 0, 0, 0)
tbody th[scope=row]: background-image: none
```

Gone: every border, the entire `:has()`-gated corner-radius system, the header
band, the footer band, the row-header diagonal hatch. That is 190 of 224 lines
producing nothing, from one missing token, with **no build error, no console
warning and no visual clue that anything was ever meant to be there.** A porter
who had not read the source would conclude the stylesheet was about padding.

The one place a constant-tier read survived is instructive: the source wrote
`var(--color-text-muted, currentColor)`, and the inline fallback carried it. F-061
noticed the same thing about `var(--COLOR-R60, #d63031)`. **An inline fallback is
the only thing that makes a constant-tier read portable**, and it is present by
accident rather than by policy.

**Decision:** closed in step 2 by retinting to our tokens, matching F-061's
decision not to extend the bridge downward into a palette we are replacing.
Post-restyle, both appearances:

| | light | dark |
|---|---|---|
| cell border | `1px rgb(230,229,224)` | `1px rgb(51,50,46)` |
| header band | `rgb(247,247,244)` | `rgb(26,26,23)` |
| cell text on band | **14.33:1** | **15.42:1** |
| caption | **6.63:1** | **8.68:1** |
| corner radius | 12 px | 12 px |

The band-to-card delta is 1.07:1 in light and 1.11:1 in dark. That is deliberate:
`<th scope>` carries the meaning, the band is decorative, and 1.4.11 does not
apply to it. Worth stating explicitly so a future reader does not "fix" it.

---

### F-078 · `text-align: middle` — a source defect the browser silently drops

**Surface:** `Tables.css`, the caption rule.

```css
& caption {
  caption-side: bottom;
  text-align: middle;   /* not a valid text-align value */
}
```

`middle` belongs to `vertical-align`. The browser drops the declaration and the
caption inherits `start`. Repaired to `center` in step 2 — unambiguously the
intent for a caption, and a one-word change that had been inert since it was
written.

Small on its own; it belongs in the same family as F-072 and as the Button port's
`color: var()`. **Three of the four stylesheets ported from this source app
contain at least one declaration that has never had any effect.** A stylesheet
with no tests and no conformance suite accumulates dead declarations, and a
browser's error recovery is what hides them.

---

### F-079 · "Component CSS" in Next.js means ROUTE-scoped, which is the wrong granularity for an element-level stylesheet

**Surface:** `/kitchen-sink` with `Tables.css` injected.

An element-level stylesheet has no scope of its own. In Next.js, importing it
from a component makes it load on every route that renders that component — never
element-scoped, always route-scoped. So the question is what it would do to a
route it shares with other components.

Measured by injecting the restyled `Tables.css` into a live `/kitchen-sink`:

| Route | `<table>` elements | Elements inside them | Restyled by the injection |
|---|---|---|---|
| `/kitchen-sink` | 3 | 77 | **59 (77 %)** |
| `/kitchen-sink/datefield` | 0 | 0 | 0 |

77 % of every element inside a table changes appearance. And the second row is a
**false reassurance that matters**: `DateField`, `DateTimeField`, `WeekField`,
`ThemeSwitch` and `ScrollArea` all render `<table>`, but the field components
render theirs inside a **closed popup**, so a measurement taken with the popups
shut sees nothing. The real blast radius is larger than any static measurement of
the default state.

The source app already knew: `DateField.css:248` and `DateTimeField.css:247` both
carry `background: none; /* override global Tables.css thead th band */`. Two
components paying a tax to a global element stylesheet, in the source's own repo.

**Decision:** the selectors stay bare, because that *is* the contract (F-070), and
the port keeps `Tables.css` on its own route where nothing else renders a table.
**Open question for the project owner:** if this stylesheet is ever to be used
alongside the reference components, it needs a scope — a `.Tables` wrapper or a
`@scope` block — and adding one changes the contract from "any table" to "any
table inside a marked region". That is a design decision. Recorded rather than
taken, because taking it silently is how a design system ends up with two
incompatible table contracts.

---

## CoverComposition — four defects from a contract nobody wrote down

### F-080 · `color-scheme: dark` cannot pin a `light-dark()` token, because `light-dark()` resolves where it is DECLARED

**Surface:** `CoverComposition.css`. **A mechanism I designed, shipped, measured,
and had to withdraw.**

A hero's content sits on **media**, and media does not flip with the appearance.
The source hard-codes the consequence — `color: white`, `outline: 2px solid white`
— which is right in light, right in dark, and unreachable by any token in the
bridge. CLAUDE.md's three tiers (plain literal / system colour / token) have no
fourth entry for "correct in both appearances but not a token", and this is it.

**The attempt.** Put `color-scheme: dark` on `.media-container` so that every
`light-dark()` token used inside resolves to its dark half regardless of the page.
Elegant, no literals, and it looked like exactly what the brief asked for — "use
our tokens so `light-dark()` keeps working".

**It does not work.** `light-dark()` is resolved at the computed-value time of the
declaration it appears in, and every one of these tokens is declared on `:root` in
`design-tokens.css`. The pair resolves against the **root's** `color-scheme`, and
what gets substituted downstream is an already-resolved colour. Measured with
`color-scheme: dark` confirmed live on `.media-container`, page appearance
**light**:

```
.media-container  color-scheme: dark          <- applied
.overlay          oklch(0.9753 …)             <- a NEARLY WHITE scrim
.video-toggle     color: rgb(38, 37, 30)      <- near-black text on it
heading over the scrim                 1.36:1
```

`color-scheme` governs UA-rendered surfaces inside the subtree — scrollbars, form
controls, and the native `controls` the SSR pass ships — and **nothing at all**
about a `light-dark()` token declared elsewhere.

**What ships instead.** Two component-local custom properties holding an
appearance-independent pair, in the design's own warm hue, equal to the dark
halves of `--color-canvas` and `--color-ink`:

```css
.CoverComposition {
  --_on-media-ground: oklch(0.2 0.006 85);    /* == #1a1a17 */
  --_on-media-ink:    oklch(0.955 0.004 85);  /* == #f2f1ec */
}
```

Custom properties rather than inline values, so a host can still re-tint the hero
in one rule — the seam F-062 found a utility conversion destroys. Verified
identical in both appearances after the change: the scrim reads
`oklch(0.2 0.00600414 none / 0.66)` in light **and** dark, and so does the ink.

Scoped to the **layout state**, not the component: the STACKED branch (< 21.25 rem)
puts the content on the page ground, so every `--_on-media-*` use is reverted
there, container-query first with an `@supports not` viewport fallback. An
appearance-independent surface is a property of the layout, not of the component —
which is why a single `color-scheme` on the root would have been wrong even if the
mechanism had worked.

**Open question for the project owner.** This is a **missing bridge role**, not a
component decision. `design-tokens.css` and `primitive-tokens.css` have no
`on-media` / scrim family, and `web/src/styles/**` is off-limits to this port, so
the values live in the component with a pointer here. Two `oklch()` literals in a
component are a smell; the fix is `--color-on-media-ground` /
`--color-on-media-ink` in `design-tokens.css`, defined *without* `light-dark()`
precisely because they must not flip. Following the precedent F-063 praises: work
around it in my own file, report the token as the real defect.

---

### F-081 · The grid tokens are undefined in the SOURCE app too, so this hero has never had columns

**Surface:** `CoverComposition.css`; `ClientApp/css/03_utils/grids/`.

`.content-container` is `display: grid` with
`grid-template-columns: var(--grid-layout-columns)` and
`column-gap: var(--grid-layout-gap)`. Neither token is assigned anywhere in
`ClientApp/css` — grepped the whole source repo. The only definitions of that
name family live in the **reference-components submodule**, under a completely
different constant set (`--GRID--COLUMNS--BASE` and friends), which the Umbraco
app does not import.

`.grid-container` has the same problem one level up:
`grid-template-columns: var(--grid-container-columns)` — also never assigned — and
its children are placed with `grid-column: main`, a **named line** that therefore
never exists.

So `.content-container` has been a single implicit column with
`column-gap: normal` since it was written, and every `grid-column: 1/8`,
`1/9`, `2/9` in the four responsive breakpoints has been inert. Measured on the
verbatim build: `grid-template-columns: 1166px` — one column, not twelve.

**Decision:** given **fallbacks**, not replacements —
`var(--grid-layout-gap, var(--size-lg))`,
`var(--grid-layout-columns, repeat(12, minmax(0, 1fr)))`. A host that defines the
tokens still wins, which keeps precisely the override seam F-062 says a utility
conversion destroys. Measured after: 12 tracks of 78.83 px, 20 px gap.

The generalisable point: **an undefined custom property is the quietest possible
failure in CSS.** Four responsive breakpoints of column arithmetic, dead from the
day they were written, in a shipped hero on two live page templates.

---

### F-094 · `grid-column: 1 / -1` degenerates on an implicit grid, so the overlay never overlaid

**Surface:** `CoverComposition.css`, the overlay branch. **Three stacked
mistakes, each hiding the next.**

The step-2 restyle retinted the hero's content for media (F-080) and axe
immediately reported **11 contrast failures at 1.06:1** — `#f1f0ed` on `#f7f7f4`.
The retint was not the bug; it *exposed* one. Chasing it took three rounds, and
each round's fix revealed the next problem:

1. **No grid at all.** `.CoverComposition`'s base rule is `position: relative`
   and nothing else. The grid comes from a separate utility class,
   `grid-container`, which the Razor puts on the **video** variant and omits from
   the **image** variant. With no grid, the overlay branch's `grid-row: 1` on both
   children is inert and the content lays out *after* the media. Measured: media
   `1166×0`, content below it on the page ground. → added `display: grid`
   unconditionally (a grid with implicit rows and no placement stacks vertically,
   which is exactly the STACKED layout the source describes).

2. **`1 / -1` on an implicit grid.** With the grid in place, still no overlay.
   `.media-container` is placed `grid-column: 1 / -1`, and on an implicit grid
   `-1` resolves to the end of the **explicit** grid — which, with no
   `grid-template-columns`, is line 1. So `1 / -1` collapses to a single span in
   column 1, the content-container auto-placed into a *new* implicit column 2, and
   the hero rendered as two side-by-side columns. Measured:
   `grid-template-columns: 332px 932px`, media `332×118` in column 1, content
   `932×118` in column 2. → declared one explicit column,
   `grid-template-columns: minmax(0, 1fr)`.

3. **Auto-placement will not stack on an occupied cell.** Still two columns:
   `0px 1166px`. The content-container has no `grid-column` in the overlay branch
   at all — upstream it reads `grid-column: main`, the named line from the
   undefined `--grid-container-columns` (F-081). With no such line it auto-places,
   and auto-placement opens a new column rather than sharing an occupied one. →
   placed it explicitly on the same span as the media.

After all three: `grid-template-columns: 1166px`, media `1166×634`, image
`1166×634`, content on top. axe clean in both appearances.

**Decision:** all three fixed in step 2 with the reasoning at the point of change.

**The finding is the shape of it.** Every one of the three is a *silent* failure:
no error, no warning, no axe violation, and each one individually produces a page
that looks plausible. What surfaced them was a colour change that made the
geometry's consequences visible — the retint was an *instrument*, not a
regression. A layout defect can hide indefinitely behind a colour scheme that
happens to be forgiving, and axe reporting zero violations on the verbatim build
was not evidence the hero worked. It was evidence the hero was invisible.

---

### F-095 · The image variant has no scrim, so display text sat on arbitrary CMS media with no knowable contrast

**Surface:** `_CoverComposition.cshtml`. Found while fixing F-094.

The Razor emits `<span class="overlay">` in the **video** variant only. The image
variant overlays display-size content (72 px) on an editor-uploaded image with
**no scrim at all**. Nothing about the resulting contrast is knowable, let alone
AA: an editor uploading a light photo produces near-white text on near-white
ground, and neither the stylesheet nor axe can catch it — axe reads the CSS
background, not the image pixels.

Added to the image variant in step 2. Measured with the scrim compositing properly
(see F-092 for why the first measurement of this was garbage), against the two
extremes any photo can present:

| | over pure-WHITE media | over pure-BLACK media |
|---|---|---|
| heading / prose (`--_on-media-ink` on the 66 % scrim) | **5.09:1** ✓ | **16.91:1** ✓ |
| toggle icon (on its own 55 % fill) | **3.50:1** ✓ (non-text, needs 3:1) | 17.13:1 ✓ |

Both text figures clear 4.5:1, so the content clears AA **over any image**, which
is the only claim worth making about media a component does not control. The
toggle icon clears the 3:1 non-text threshold at its worst case with 0.5 to spare.

**Decision:** the scrim is part of the port, and the contrast claim is stated as a
range over the two extremes rather than as a single number. A single ratio against
one poster would be meaningless — the component does not choose the poster.

---

### F-069 · Server-rendering the video controls removes a dead-control window the source has by construction

**Surface:** `CoverCompositionVideo.tsx` vs `ClientApp/js/utils/CoverCompositionVideo.ts`.

The source **injects** `.video-controls` / `.video-toggle` from JS in
`setupControls()`, and ships a `<noscript>` block containing a **second**
`<video>` with native `controls`. Two divergences, both deliberate:

- The controls are server-rendered, and native `controls` goes on the one video
  until enhancement takes over (`video.controls = false`, exactly what the
  source's `setupVideoElement()` does). One video element, no duplicate download,
  and the control is live before hydration instead of ~100 ms after. That window
  is what `Findings.md` F-035 measured for hydration-only components: 86–141 ms in
  which the component "does not clamp, does not announce, and cannot arbitrate".
  For a video toggle it is a visible dead button, which is worse than the
  measurement suggests.
- Enhancement state comes from `useSyncExternalStore` with asymmetric snapshots,
  not `useEffect(() => setState(true), [])` — a lint error in this repo and one
  commit slower. Precedent: `ScrollArea.tsx`.

**Scope, stated plainly:** the source class is a 7-state machine
(`idle`/`ready`/`playing`/`pausedByUser`/`pausedByPolicy`/`blocked`/`error`) driven
by five policy blockers. The port carries the state names, the `data-video-state`
reflection any host script would read, and all five blockers — the two that read
the non-standard `navigator.connection` are behind a feature test rather than
dropped, which the source does not do.

---

### F-075 · A full-bleed component cannot use the shared `Block`, for the same reason an intrinsically-sized one cannot use `Cell`

**Surface:** `CoverComposition.kitchensink.tsx`.

`Block` is a padded card — `flex flex-wrap items-end gap-lg rounded-lg border
bg-surface-card p-lg`. `CoverComposition`'s entire contract is "fill the inline
axis and put content on top of media". Nesting it in a padded, wrapping flex card
measures the card: the media never reaches an edge, the `21.25rem` container query
fires against the card's content box rather than the hero's, and `items-end`
bottom-aligns a component whose height is its own padding.

So the cover demos use `Section` (which carries `.kitchensink-section` and the
heading — both contractual, F-014) and a local `Frame` instead of `Block`/`Cell`.
`Frame` supplies only what a hero needs to be inspectable: `min-w-0`,
`overflow-hidden`, and a `rounded-lg` hairline so the full-bleed edge is visible
on the page.

**Decision:** recorded rather than fixed, because `web/src/components/**` is
off-limits and correctly so. But the pattern is now three-for-three — Button
needed `Row` because it is intrinsically sized, CircleDiagram needed `Sized`
because it is fluid (F-091), CoverComposition needs `Frame` because it is
full-bleed. **The shared chrome is field-shaped**: it assumes a component is a
form control that wants to be exactly as wide as its cell. Every primitive that is
not a form control has had to opt out. That is worth a design decision at the
chrome level rather than a fourth local wrapper.

---

## CircleDiagram — and the timeline-pastel question

### F-082 · CircleDiagram does NOT have a claim on the timeline pastels, and the reason it looks like it does is the interesting part

**Surface:** `CircleDiagram.css`, whose own step-1 comment read
`/* Hardcoded palette — swap for tokens later */`.

**The case FOR is real, and it is not aesthetic.** The five pastels are the *only
multi-hue set in cursor-DESIGN.md*. Everything else is one warm neutral ramp, a
single orange voltage, and four semantic states. A donut chart needs N mutually
distinguishable fills; the design system contains exactly one such set; and this
component is the only thing in this port that is arguably a "visualisation". A
porter reaching for them is not being lazy — they are reaching for the only tool
in the box. That is a finding about the **design system**, not about the porter:
**cursor-DESIGN.md has no categorical data-visualisation palette at all**, and the
first component that needs one will always be pointed at the pastels.

**Three reasons it still loses.**

1. **Arity.** The source declares **six** colours and indexes them by segment
   ordinal. There are **five** pastels. Any mapping either drops a segment colour
   or invents a sixth pastel — and inventing one is inventing a brand hue, the
   exact thing F-061's Decision refused to do when it declined to map forty
   constants.

2. **They are not a palette, they are five names.** `timeline-thinking`, `-grep`,
   `-read`, `-edit`, `-done` are *stage identities*. cursor-DESIGN.md says so four
   separate times: "only inside in-product timeline visualizations", "never as
   system action colors", "Don't use timeline pastels on non-timeline UI", and
   exit criterion 8. A reader who has learned that mint means *Grepping* and then
   reads mint here as *C#* has been **actively misinformed**. This is a stronger
   objection than the stylistic one, and it is the one that decides it: the pastels
   carry semantics, and a CMS pie chart has different semantics per instance.

3. **They are light-only by design.** `design-tokens.css` gives the five no dark
   half, on the stated grounds that they are "illustration inside a product
   mockup, not UI that has to survive an appearance flip". A rich-text chart
   authored by an editor in Umbraco **is** UI that has to survive the flip. Using
   them would import a known light-only surface into a component whose gate is
   "axe clean in both appearances".

**Decision — what replaced them:** a six-step **monochromatic ramp** in the brand
hue, `color-mix(in oklch, var(--color-primary) N%, var(--color-surface-strong))`
at N = 100/78/60/44/29/15. Zero new hues; both operands are `light-dark()` pairs
so the ramp follows the appearance (measured: step 1 is `rgb(200,64,0)` in light
and `rgb(255,122,64)` in dark).

**A monochromatic ramp is only defensible because of F-067.** The chart is
`aria-hidden` and the legend renders every label *and* every percentage as text,
so nothing depends on distinguishing adjacent fills — WCAG 1.4.1 is satisfied by
the text, not by the hues. Recorded at the point of use: if a future variant drops
the legend, the ramp is no longer sufficient and this decision must be reopened.

**Open question for the project owner:** if in-product charts become a real
surface, the design system needs a categorical palette of its own — derived from
the warm neutral ramp plus the single voltage, sized against both card grounds,
and explicitly *not* the timeline pastels. Until then every chart author will
reach for the pastels, and the only thing stopping them is a comment in one
component.

---

### F-074 · A seventh segment blanked the entire chart, because one invalid stop invalidates the whole gradient

**Surface:** `rteCircleDiagramBlock.cshtml` line 29.

The Razor builds conic-gradient stops as
`var(--CircleDiagram-color-{seg.Index})` with `Index = i + 1`, and the stylesheet
defines six colours. A seventh segment therefore emits
`var(--CircleDiagram-color-7)`, which resolves to nothing, which makes that colour
stop invalid — and **an invalid stop invalidates the entire `conic-gradient()`**,
so the chart renders blank. Not a wrong colour: no chart.

The trigger is an editor adding one more row in the Umbraco backoffice. There is
no validation, no maximum on the segments block list, and no visual warning — the
graphic simply disappears, and the legend below it still lists all seven segments,
which makes the failure look like a rendering bug rather than a data limit.

**Decision:** the palette index wraps (`(i % 6) + 1`), so a seventh segment
degrades to a repeated colour instead of destroying the chart. Demonstrated
explicitly on the kitchensink with a 7-segment instance. Wrapping is only
survivable because the legend carries the data as text (F-067) — with a
colour-only legend, two identical fills would be as broken as none.

---

### F-083 · The donut hole was a plain white literal — CLAUDE.md's first tier, in the one place it is most visible

**Surface:** `CircleDiagram.css`, `.CircleDiagram-center { background: #fff }`.

Measured on the verbatim build: `rgb(255, 255, 255)` in **both** appearances — so
in dark, a white disc in the middle of the donut on a `#232320` card. This is
exactly CLAUDE.md's first tier ("a plain literal — `white` — wrong in both
appearances"), and the donut hole is the single largest flat area in the
component.

Repaired to `var(--color-surface-card)`. Measured after: `rgb(255,255,255)` light,
`rgb(35,35,32)` dark.

Two neighbouring reads in the same file complete the three-tier picture and are
worth keeping together, because they show the whole spectrum in 87 lines:

- `var(--color-text-muted, currentColor)` — token undefined, **inline fallback
  saved it**. The subtitle rendered correctly on the verbatim build purely by
  accident of how the declaration was written (see F-077).
- `var(--fontSize-label-sm)` — a **typo** for `--fontSize-label-small`; the
  source's own token set has no `-sm`. No fallback, so it resolved to nothing and
  the legend silently fell back to the inherited 16 px instead of 13 px. F-084.

---

### F-084 · `--fontSize-label-sm` is a typo in the source, and with no fallback it failed silently

**Surface:** `CircleDiagram.css`, `.CircleDiagram-legend-item`.

```css
font-size: var(--fontSize-label-sm);
```

The source's own token set defines `--fontSize-label-small`. There is no `-sm`
variant anywhere in `ClientApp/scss/tokens`. Measured on the verbatim build:
`--fontSize-label-sm` → **UNDEFINED**, `--fontSize-label-small` → `.8125rem`. The
legend fell back to the inherited 16 px instead of the intended 13 px.

Worth its own entry rather than a footnote to F-083 because of the contrast with
its neighbour two rules below: `var(--color-text-muted, currentColor)`, whose token
is *also* undefined, rendered correctly — the inline fallback carried it. **Same
file, same class of mistake, opposite outcome, decided entirely by whether the
author happened to write a fallback.**

`--fontSize-label-sm` is also 4 characters from a token that exists, which is why
nobody caught it: it reads as correct. A design system with ~30 semantic type
tokens and no build-time check that every `var()` resolves will accumulate these
indefinitely.

**Decision:** repaired to `--fontSize-label-small`, verified at 13 px in both
appearances. **Open question:** a build-time or CI check that every custom property
read by the ported CSS resolves would have caught this, F-077's eleven undefined
tokens, and F-081's grid tokens — three separate findings, one instrument. That is
a bigger return than any of the individual fixes.

---

### F-085 · `opacity: 0.7` on text is a multiplier on a ratio nobody measured

**Surface:** `CircleDiagram.css`, `.CircleDiagram-legend-value`.

The source dims the percentage with `opacity: 0.7`. Opacity on text scales
whatever contrast the inherited colour happened to have, so the resulting ratio is
a property of the *page*, not of the component — and it is invisible to a design
token audit, because no token is involved.

Replaced with `color: var(--text-secondary)`, which is a ratio rather than a
multiplier on one. Measured after, on the card:

| | light | dark |
|---|---|---|
| legend value | **7.11:1** | **7.84:1** |
| legend label | 15.38:1 | 13.93:1 |
| subtitle | 7.11:1 | 7.84:1 |

**Decision:** a design system should treat `opacity` on text as a code smell. It is
the mechanism by which a contrast failure enters a codebase without any colour
being chosen — the same shape as FileUpload's `.drop-label { opacity: 0.7 }`
(`Findings.md` F-027, 3.44:1) and AffixField's `opacity: 0.5`. Third instance in
this project, same source app.

---

### F-087 · The source gated a layout on the viewport when the thing that varies is the container

**Surface:** `CircleDiagram.css`, `@media (min-width: 30rem)`.

The source switches the chart and legend from stacked to side-by-side at a
**viewport** breakpoint. But this is a rich-text block: an editor drops it into
whatever column the template gives them, and the viewport says nothing about how
wide that column is.

Measured on the kitchensink before the change — the media query fired, the 200 px
chart (which the source pins with `flex-shrink: 0`) plus the legend no longer fit
the card, and the figure pushed horizontal scroll onto the **document**:

| Viewport | Document overflow | Culprit |
|---|---|---|
| 480 px | 12 px | `.CircleDiagram-legend-value` |
| 768 px | 36 px | same |
| 1024 px | 67 px | `.CircleDiagram-legend-label`, `-value` |

A WCAG 1.4.10 failure introduced by a breakpoint that was measuring the wrong box,
and it got *worse* as the viewport got wider — the opposite of the direction
anyone looks.

**Decision:** converted to a container query on the component itself, with the
viewport MQ kept as an `@supports not (container-type: inline-size)` fallback.
This is the same preferred-plus-fallback pattern `CoverComposition.css` already
uses **in the source**, so it is the source repo's own newer idiom rather than an
invention. Plus `flex-wrap` and `min-inline-size: 0` on the legend row, because a
flex item defaults to `min-width: auto` — its longest word, not zero. After:
0 px overflow at every width, and the figure correctly stays stacked at 352 px
wide on a 1280 px viewport, which the viewport query got wrong.

---

## What the three steps taught about the method

### F-086 · The kitchensink's own prose failed 1.4.10 while the component under test passed

**Surface:** `CoverComposition.kitchensink.tsx`, step 2.

`/primitives/covercomposition` overflowed by 163 px at 320 px. The generic culprit
finder in `orphans-reflow.cjs` reported **nothing** — it lists boxes whose *right
edge* is past the viewport, and this one was inside an `overflow: hidden` frame.
A second probe (`orphans-reflow-who.cjs`, then a `scrollWidth` walk) named it:

```
main    scrollWidth 483  clientWidth 320
section scrollWidth 467  clientWidth 288
h2      scrollWidth 467  clientWidth 288
```

The `<h2>`. My own section title, `Video variant — data-component="CoverCompositionVideo"`,
in which `data-component="CoverCompositionVideo"` is one unbreakable 37-character
token rendered at `text-display-md`. min-content 467 px. The component reflowed
perfectly; the page describing it did not, and axe reported zero violations
throughout.

**Decision:** section titles are short, with the reason in the file so nobody
"improves" them back. And a second lesson about instruments: a culprit finder
that only reports right-edge overflow misses anything clipped by an ancestor. Both
probes are committed, because the second one is the only reason this was found in
minutes rather than by bisection.

---

### F-090 · A percentage width on a flex item sized from its content is a circular dependency that resolves to nothing

**Surface:** `CircleDiagram.css`, `.CircleDiagram-chart`, step 2.

Capping the 200 px donut so it could not set the document width at 320 px looked
like a one-liner:

```css
width: min(var(--CircleDiagram-size), 100%);
```

It is a circular dependency. The chart is a flex item whose container
(`.CircleDiagram`) is sized from its content, so the `100%` resolves against an
**indefinite** size; the browser falls back to the item's content size; and the
content is an empty `<div>` whose only geometry is `aspect-ratio: 1`. Measured:
the 200 px chart rendered at **62.27 px** on a 1280 px viewport.

`width: var(--CircleDiagram-size)` plus `max-inline-size: 100%` expresses the same
intent without the circularity — a `max-*` percentage against an indefinite
containing block simply does not apply, rather than poisoning the used value. Also
restored `flex-shrink: 1` (the source pins it to `0`), which is what actually lets
the circle shrink below 200 px instead of overflowing.

The same trap then reappeared one level up, in the fix for F-091:
`min-inline-size: min(100%, 18rem)` on the figure is not a floor either, for
exactly this reason. **Twice in one component, in two different properties, both
looking like the obvious answer.** The rule worth carrying: a percentage length on
a flex or grid item whose container is content-sized is not a constraint, it is a
guess — and `min()` / `max()` around it does not make it one.

---

### F-091 · The shared chrome is field-shaped, and it silently sized a 200 px chart to 62 px

**Surface:** `CircleDiagram.kitchensink.tsx`; `kitchensink-ui.tsx` `Cell`.

`Cell` now sizes its inner grid track `minmax(0, 1fr)` — a correct fix for another
port's 2 px overflow. The consequence for an intrinsically-sized component: a
Cell's min-content contribution becomes **zero**, and `Block` is `flex-wrap`, so
six zero-min cells all fit on one flex line and each took 1/6 of the row.

Measured ancestor chain at a 1280 px viewport, innermost first:

```
.CircleDiagram-chart            w=62
figure.CircleDiagram            w=62   max-width: 100%
div.w-full.max-w-[22rem]        w=62   max-width: 352px   <- INERT
div.grid-cols-[minmax(0,1fr)]   w=62   grid-template-columns: 62.2656px
div.grid.min-w-0                w=62
div.flex.flex-wrap              w=1168
```

A 200 px donut rendered at **62.27 px**, in a card with 1168 px of room, and it
looked like a plausible small chart rather than a bug.

Two wrong fixes before the right one, both worth recording because both look
correct:

- `min-inline-size: min(100%, 18rem)` on the figure. Not a floor at all: the
  `100%` resolves against the containing block, so in a 62 px container the floor
  evaluates to 62 px and defends nothing.
- `w-full max-w-[22rem]` on a wrapper. `width: 100%` of a box that is already
  62 px. Inert, as the chain above shows.

What works is an **explicit** width plus `max-w-full` — `w-[22rem] max-w-full` —
which is the exact pattern `Cell`'s own comment prescribes: *"so a component can
use a plain `w-[28rem] max-w-full` and get reflow for free"*. After: chart 200 px
at 1280 px and at 480 px, 200 px inside a 238 px figure at 320 px, zero overflow
at every width.

**Decision:** the floor belongs to the **demo**, not the component. The component
is fluid and a 62 px donut in a 62 px box is *correct*; the defect was that the
kitchensink handed it a 62 px box. Same conclusion the Button port reached with
its `Row` wrapper, from the opposite direction — Button was too wide, this was too
narrow, and both are the shared chrome being field-shaped.

---

### F-089 · The React compiler rejects a third idiom that a straight port produces — and this time only half the fix is an improvement

**Surface:** `CircleDiagram.tsx:59`, `CoverCompositionVideo.tsx:145`. Two
`react-hooks/immutability` errors, a rule not previously hit in this project.

This completes a set of three. Every one rejects a pattern that porting imperative
markup-plus-JS to React arrives at **naturally**, not by carelessness:

| Rule | Pattern rejected | Where |
|---|---|---|
| `react-hooks/set-state-in-effect` | `useEffect(() => setState(true), [])` — the "am I hydrated yet" gate | reference-components ports |
| `react-hooks/refs` | a props factory or validator dereferencing a ref during render | FileUpload, MonthField, WeekField |
| `react-hooks/immutability` | a render-loop accumulator; mirroring state into a ref an effect reads | **here** |

**1. The render-loop accumulator.** Laying out a conic gradient wants
`let cumulative = 0` and `cumulative += percentage` inside a `map`. It is the
idiomatic charting loop and it is exactly what the Razor does. The rule rejects
it: *"Cannot reassign variable after render completes"*. Fixed by deriving the
running total from the array instead of carrying it in a closure variable.

**Is the fix better? Marginally, and honestly: no.** It is `O(n²)` instead of
`O(n)` on a list that is at most a handful of segments, so the cost is nil, and it
removes a mutable binding from a render path — which is the point of the rule. But
the accumulator was not a latent bug, and the derived version is *less* readable
than the two lines it replaced. **This one is compliance cost.** I do not think the
rule is wrong — a render function that reassigns across iterations is exactly what
breaks under a compiler that may re-enter it — but the flattering story ("the fix
was better anyway") does not hold here, and the prior two entries in the table
should not be read as a pattern that always repeats.

**2. Mirroring state into a ref.** The first version was:

```tsx
const [userPaused, setUserPaused] = useState(false);
const userPausedRef = useRef(false);
useEffect(() => { userPausedRef.current = userPaused; }, [userPaused]);
```

the standard "give my event listeners a fresh value" idiom. The rule rejects the
assignment: *"Modifying a value used previously in an effect function or as an
effect dependency is not allowed."*

**Here the rule was right and the fix is strictly better.** Nothing in the render
tree reads `userPaused` — only the pause handler and the policy arbiter do — so it
was never state, and mirroring it into a ref was a workaround for having declared
it as state in the first place. One ref written only from event handlers; the
mirroring effect disappears, and so does a render on every user pause.

**Decision:** both fixed, neither silenced. The generalisable claim holds in
**three of four** cases: the compiler rejects idioms a port naturally produces, and
the fix is usually a genuine improvement — measurably faster for
`set-state-in-effect`, a removed silent fallback for `refs`, a removed render here.
The accumulator is the counter-example, and it is worth keeping visible so the
claim stays a measurement rather than a slogan.

---

### F-092 · A contrast probe that parses digits out of a computed colour string produces plausible, wrong numbers

**Surface:** `orphans-step2-verify.cjs`, first version.

The probe computed WCAG luminance by regexing `[\d.]+` out of the computed colour
and treating the first three as RGB. That is correct for `rgb(38, 37, 30)` and
**garbage** the moment Chromium returns the authored colour space — which it does
for `color-mix()` and `oklch()` results. `lab(94.7964 0.107527 1.52066)` parsed as
`rgb(94, 0, 1)`.

It reported a near-white heading on a near-black scrim as **1.36:1**, then
**1.48:1** after the scrim was fixed. Both looked like exactly the failure I was
hunting, and I nearly "fixed" a working scrim because of it. The real figures are
5.09:1 and 16.91:1 (F-095).

Two errors, and the second is the subtler:

1. **Colour space.** Fixed by resolving every colour through the browser — assign
   it to `ctx.fillStyle`, fill one pixel, read it back. Chromium does the
   conversion.
2. **Alpha.** A translucent scrim is not a background; the effective background is
   the scrim *composited over what is behind it*. The probe now takes an explicit
   third "ground" colour and composites, which is what makes "5.09:1 over white
   media, 16.91:1 over black" expressible at all.

**Decision:** a wrong instrument that produces a plausible number is worse than no
instrument, because it redirects the work. Recorded next to F-093 — both are
failures of *measurement* rather than of the port, and between them they cost more
time than any defect in the three stylesheets.

---

### F-093 · A shared `web/` directory reproduces the stale-server failure from a new cause, and the probes now refuse to run

**Surface:** `/primitives/table` on a server I had started from a good build.

CLAUDE.md documents the stale-server trap — a `pkill` that does not match, an old
server answering 200 from a `.next` that later builds overwrote, "three wrong
reports in this project". Several agents are now building in the same `web/`
directory, which produces the same end state from a different cause: my server was
started from a good build, a **concurrent** `npm run build` rewrote `.next`, and
the HTML my server had already committed to referenced a CSS chunk that no longer
existed.

```
<link rel="stylesheet" href="/_next/static/chunks/0vp50q60ektp1.css">  -> 404
<link rel="stylesheet" href="/_next/static/chunks/0z3cb8tq7silg.css">  -> 200
```

One of two stylesheets missing. The page returned 200. Every computed colour came
back `rgb(0, 0, 0)`, every font-size `16px`, and the probe cheerfully reported
**"21:1"** contrast ratios and a perfectly-sized 200 px chart. A green-looking run
against a page with no design on it at all.

**Decision:** `orphans-guard.cjs`, called by every measuring probe before it reads
anything. It `fetch`es every `<link rel="stylesheet">` from inside the page and
**throws** if any is not `ok`, plus a sentinel check that `body`'s
`background-color` is not transparent. It throws rather than warns, because a
warning in a long log is how this gets missed.

The generalisable point, and it sharpens CLAUDE.md's existing warning: **a `curl`
200 on the page proves only that the server is answering.** It says nothing about
whether the assets that page references still exist. Check the assets, and prefer
a sentinel computed value over any status code.

---

### F-096 · A utility can express a VALUE; it cannot express a CONDITION whose halves must stay linked

**Surface:** step 3, all three stylesheets. **The direct answer to F-062's
question, with counts.**

| Stylesheet | Declarations | Positional selectors | `:has()` | `@supports` | `@container` | `@media` | Converted |
|---|---|---|---|---|---|---|---|
| `Tables.css` | 62 | **60** | 7 | 3 | 0 | 0 | **none** |
| `CoverComposition.css` | 137 | 0 | 0 | 5 | 2 | 11 | 2 rule sets |
| `CircleDiagram.css` | ~40 → **10** | 0 | 0 | 5 | 2 | 1 | leaf styling |

**`Tables.css` cannot be converted at all**, and this is a stronger claim than
"unattractive". 60 of its 62 declarations sit behind positional selectors
(`tr:first-child th:last-child`) or `:has(thead)` / `:has(tfoot)` gates. A utility
would have to be placed on each cell by the author, who would have to know whether
that cell is last in its row **and** whether the table has a `tfoot`. The contract
is "any HTML table" (F-070), so there is no call site to place anything on. This is
not a Tailwind limitation to work around; it is the boundary of what a class-per-
element model can express.

**`CoverComposition.css`: 59 of 137 declarations (43 %) are inside a conditional
at-rule**, including two preferred-plus-fallback pairs
(`@supports (container-type)` + `@container`, and `@supports not` + `@media`) whose
two halves are the *same decision made twice for different engines*. Tailwind v4
has container variants; it has no way to say that. Exactly two rule sets converted
— `.link-group` and the demo CTA — and they are the two with no condition and no
seam. That ratio is the finding.

**`CircleDiagram.css`: 40 declarations down to 10**, all eleven class names kept.
What stayed:
1. the **override seam** — `--CircleDiagram-size`, `-hole`, and the six palette
   steps. A host re-tints in one scoped rule; a utility cannot be reassigned. F-062
   measured on a second component.
2. a **condition with two linked halves** — the container query and its fallback.
3. an **element-selector reset** — `figure { margin-inline: 0 }`, cancelling a UA
   default on an element the component does not always own.

One mechanism worth flagging: `flex-direction: row` in the container query beats
the `flex-col` utility because the component CSS is **unlayered** while Tailwind's
utilities live in `@layer utilities`, and unlayered declarations win over layered
ones regardless of source order. That is load-bearing and **invisible at the call
site** — a reader of the JSX sees `flex-col` and cannot tell that a media query
overrides it. The `@layer` interaction is a new hazard the class-name-plus-utility
model introduces that neither model has alone.

---

### F-076 · A class-less stylesheet cannot be keyed by its contract, so the safety net had to key on the DOM

**Surface:** `orphans-computed.cjs`.

`button-computed.cjs` keys each measured instance by **its own contract surface** —
the element's `data-*` axes, its `aria-label`, its tag, its label text. That works
because a Button *has* a contract surface: `data-emphasis`, `data-intent`,
`data-size`, `data-pill`. The key survives a DOM change that does not change the
contract, and breaks loudly on one that does. That is exactly the property you want
from a snapshot key.

`Tables.css` has no class names and no `data-*` API (F-070). A `<td>` has nothing
to be keyed by except *where it is*. So instances are keyed by a **DOM path** —
`section[2]>div>div[1]>table>tbody>tr[3]>td[2]` — built from tag plus
`nth-of-type` up to `<main>`.

The consequence is precisely inverted, and it is worth naming because it is the
snapshot-testing equivalent of F-062's trade:

| | keyed by contract | keyed by DOM path |
|---|---|---|
| survives a DOM refactor that preserves behaviour | **yes** | **no** — every key moves |
| catches a structural change | yes, as a missing key | yes, as a missing key |
| tells you *what* changed | the axis that moved | only where it was |
| requires the component to have an API | **yes** | no |

So the net that guards an element-level stylesheet is strictly more brittle than
the one guarding a component, and it is brittle in the least useful direction: it
will cry wolf on a harmless reorder of the kitchensink and say nothing informative
about why. There is no better option — that is the whole point. **A stylesheet with
no contract surface cannot have a contract-shaped test.**

Measured cost in practice: adding two selectors to the probe *after* the baseline
was taken produced 18 "new" keys, which is the same signal a genuine structural
regression would produce. The only reason it is not a false alarm is that a human
wrote down why. That is not a test, it is a note.

**Decision:** keyed by DOM path, with the trade documented in the probe's header,
and the "18 new" explained in the gate table rather than suppressed. For the two
real components (which do have class names) the same probe keys by selector plus
path, so they degrade gracefully.

---

### F-097 · Four utilities were not equivalent to the declaration they replaced, and only the computed-style diff knew

**Surface:** step 3, `orphans-computed.cjs diff`. **The safety net earning its
keep.**

Guard: 584 elements × 2 appearances × up to 55 properties, keyed by a DOM path
(the only identity a class-less stylesheet offers). First run after the
conversion: **1760 property diffs.** Four causes, none visible by eye:

| Diff | Nodes | Cause |
|---|---|---|
| `line-height: 19.5px -> 18.2px` | 440 | `text-caption` is a **pair** — `--text-caption` *and* `--text-caption--line-height: 1.4`. Step 2 set `font-size` alone and inherited 1.5. Fixed with `leading-normal`. |
| `border-radius: 50% -> 3.35544e+07px` | 52 | `rounded-full` is 9999px, not `50%`. Same circle on a square box; different the moment it stops being square. Fixed with `rounded-[50%]`. |
| `line-height: 22.5 -> 25.2`, `letter-spacing: -0.225px -> normal` | 22 | `text-title-md` carries `line-height: 1.4` and no tracking; step 2 used the bridge's heading metrics (1.25 / −0.0125em). Restated explicitly. |
| `gap: 4px -> 8px` | 52 | **`gap-xs` is 8px; the bridge maps `--size-xs` to `--spacing-xxs` = 4px.** Two scales, same suffix. Fixed with `gap-xxs`. |

Plus one caught by hand because it post-dated the snapshot: `px-xl` is 32 px while
the bridge's `--size-xl` is `--spacing-lg` = 24 px. Same collision as the last row.

**Final: 0 property diffs, 0 gone.**

Two lessons. First, **a `text-*` utility is not a `font-size` declaration** — in
Tailwind v4 it is a bundle of size, line-height and sometimes weight and tracking,
so replacing `font-size: X` with `text-y` changes the line box unless you restate
the rest. 440 nodes, invisible in a screenshot, and it is the single most likely
way a "pure" utility conversion silently changes a layout.

Second, and specific to this port: **the bridge and Tailwind share a `xs/sm/md/lg/xl`
vocabulary with different values.** `primitive-tokens.css` maps `--size-xs` →
`--spacing-xxs`, `--size-md` → `--spacing-sm`, `--size-xl` → `--spacing-lg` —
every step shifted by one. So a conversion that reads `var(--size-xs)` in the CSS
and writes `gap-xs` in the JSX is wrong *every single time*, and it looks right.
Two of the five errors above are this. **Any future step-3 conversion of a
primitive must translate through the bridge table, never by matching suffixes.**

---

## Gate results

Measured on a clean production build on port 3210, after verifying every
stylesheet chunk resolves (F-093), with the routes warmed and Playwright idle.

| Gate | Result |
|---|---|
| `npm run build` | **pass** |
| `npm run lint` | **pass** — 0 errors (both `react-hooks/immutability` errors fixed, not silenced) |
| `npm run test:unit` | **pass** — 303 tests, 13 files |
| axe WCAG 2 A + AA, `/primitives/table` | **0 violations** light, **0** dark |
| axe WCAG 2 A + AA, `/primitives/covercomposition` | **0 violations** light, **0** dark |
| axe WCAG 2 A + AA, `/primitives/circlediagram` | **0 violations** light, **0** dark |
| Reflow 320 / 360 / 480 / 768 / 1024 / 1280 px, all three routes | **0 px overflow at every width** |
| Computed-style diff vs step-2 baseline | **0 property diffs, 0 gone** (584 elements × 2 appearances) |
| `git -C reference-components status` | **empty** |

The 18 "new" entries in the diff are two CTA selectors added to the probe *after*
the baseline was taken; they carry no before/after coverage for this commit and
were verified by hand against the step-2 CSS (F-097). Stated rather than hidden.

---

## What I recommend discarding

The owner said "take them along and we discard if we need to". Nothing here is
dead code, so nothing gets discarded wholesale. Three narrower recommendations:

1. **Discard the idea of a `<Table>` component, permanently.** F-070. `Tables.css`
   is element-level styling and the honest port is a stylesheet plus a documented
   contract plus one scroll wrapper. If a `<Table>` appears later it will be
   because someone wanted a place to hang props, and it will not be reachable by
   the selectors that do the work.

2. **Discard `Tables.css` from any route that renders reference components**, until
   the scoping question in F-079 is answered. It restyles 77 % of the elements
   inside every table it can reach, the source app already pays that tax in two
   components, and five ported components render `<table>`.

3. **Discard the video variant's `<noscript>` duplicate video** — already done, per
   F-069 — and consider discarding the source's *injected* controls pattern
   wherever else it appears. Server-rendering a control and enhancing it is
   strictly better than injecting it, and the source's own state machine already
   contains the handover step.

One thing I recommend **keeping** that a leaner port would drop: the six
`--CircleDiagram-color-N` custom properties, and `--_on-media-ground` /
`--_on-media-ink`. They are the only override seam these components have left after
step 3, and F-062 is the argument.

## Open questions for the project owner

1. **An `on-media` token family.** F-080. `design-tokens.css` needs
   `--color-on-media-ground` / `--color-on-media-ink`, defined *without*
   `light-dark()` because they must not flip. They currently live as two `oklch()`
   literals in `CoverComposition.css` because `web/src/styles/**` is off-limits to
   this port.
2. **A categorical data-visualisation palette.** F-082. Until one exists, every
   chart author will reach for the timeline pastels, and the only thing stopping
   them is a comment in one component.
3. **Scoping `Tables.css`.** F-079. A `.Tables` wrapper or a `@scope` block changes
   the contract from "any table" to "any table inside a marked region". A design
   decision, not a porting one.
4. **`TableScroll` versus `ScrollArea`.** F-073. Whether they converge — noting
   that `ScrollArea` would import a 2.22:1 focus ring into a data table.
5. **The fixed `h4` in CircleDiagram.** F-064. A heading-order hazard inherited
   from the source; fixing it means adding an attribute the contract does not have.
