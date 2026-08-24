# findings/primitives-Teaser.md

The Razor `app-teaser` TagHelper ported to `web/src/primitives/Teaser/` in three
ordered steps: step 1 verbatim, step 2 restyled to `cursor-DESIGN.md`, step 3
Tailwind. Teaser is the first component in the set that **composes** others —
`Card`, `MediaFigure`, `Heading`, `Prose`, `LinkButton` — so it is the test of
**F-039**.

Route: `/primitives/teaser`. Probes: `web/tasks/probes/teaser-computed.cjs`,
`teaser-axe.cjs`, `teaser-reflow.cjs`, `teaser-override.cjs`, `teaser-guard.cjs`.
Snapshots: `web/tasks/snapshots/teaser-step1.json`,
`teaser-step2-before-tailwind.json`.

Source: `TagHelpers/TeaserTagHelper.cs` (6.6 KB) and
`ClientApp/css/04_ui/Teaser.css` (212 lines, md5
`53c66f31d4f51e223f7d85c457b5dd2a`, verified byte-identical at step 1).

---

### F-NEW · THE F-039 VERDICT — composition succeeded for four children out of five, and the discriminator is whether the child exposes a `children` slot

**Surface:** `Teaser.tsx`, all three steps. **This is the headline finding, and
it confirms F-039's recommendation from the other direction.**

F-039 predicted: *"React tiers can only compose by nesting components, which
forces each tier to fix its children's markup, arity and attributes."* Teaser
composes five children. Measured outcome:

| Child | Composed as | Cost |
|---|---|---|
| `Card` | `<Card element="div" padding="none" border>` | **none — React is BETTER here.** See below. |
| `MediaFigure` | `<MediaFigure figureClass=… pictureClass=…>` | none at step 1/2; **fatal at step 3** for one rule (next finding) |
| `Prose` | `<Prose variant="basic" size="sm"><p>…</p></Prose>` | none |
| `LinkButton` | `<LinkButton …>{label}<span class="ScreenReaderText">…</span></LinkButton>` | none |
| `Heading` | `<Heading>` **with a hand-authored inner anchor** | one part class duplicated; measured breakage |

**Four of the five composed at zero cost, and every one of those four exposes a
`children` slot** (`MediaFigure` is the exception that proves the rule — it has
no slot, but the source had already parameterised the two class names Teaser
needs, so the seam existed by accident of API design). **The one that cost
something is the one whose relevant markup is fixed inside it with no slot.**

So F-039's recommendation — *"a contract in a component-owned-markup framework
must specify slots, not markup"* — is confirmed, and can be stated more precisely:

> A component contract needs a slot at **every point where a consumer may need to
> contribute a class or an attribute to an element the component renders.** A
> `children` slot at the leaf is sufficient; a `className` on the root is not.

`Heading` has both a root `className` and a `children` slot, and neither was
enough for the one thing Teaser needed: a **second class on the anchor inside
it**. `HeadingProps` has `href`, which renders `<a class="heading-link">`, and no
`linkClassName`. So `Teaser.css`'s stretched-link selector (`.Teaser-link`) had
nowhere to land. The escape was Heading's `children` slot with the anchor
hand-authored by Teaser — byte-identical DOM, at the price described in the next
finding.

**The positive half, and it is genuinely surprising: the Card frame is EASIER in
React.** Upstream, `TeaserTagHelper` writes the frame as two raw strings into
`output.PreElement` / `output.PostElement`:

```csharp
output.PreElement.SetHtmlContent($"<div class=\"Card\" data-padding=\"none\"{cardExtra}>");
output.PostElement.SetHtmlContent("</div>");
```

It does that because **a TagHelper cannot wrap its own output in another
TagHelper's output** — Razor's composition model is nesting in the *template*,
and a helper has no template. The consequence upstream is that Card's entire
contract is bypassed: no allow-list, no `ForbiddenCombinations` check, no
suppression rule, no dev error box. In React it is an ordinary conditional
wrapper and all of that comes back for free.

So F-039's framing is right about the direction of the cost but incomplete about
its distribution: **markup-nesting composes freely at the leaves and not at all at
the root; component-nesting composes freely at the root and only through declared
slots at the leaves.** A Razor helper wrapping another helper is exactly as
impossible as a React component adding a class to another component's inner
anchor.

**Decision:** composed as components, with the one hand-authored anchor and an
explicit import (below) rather than a silent copy. Not repaired in `Heading` —
that is another component's surface.

**Upstream recommendation for `Heading`:** one prop, `linkClassName?: string`,
merged onto the anchor. It is a one-line change and it removes the only
composition failure in this port. The alternative — the slot-shaped contract
F-039 asks for — would be:

```tsx
<Heading element="h2" variant="heading" size="4">
  {(inner) => <a className="heading-link Teaser-link" href={href}>{inner}</a>}
</Heading>
```

i.e. Heading passes its *inner class* to a render prop instead of the consumer
guessing it. That is the shape that would survive Heading's own step 3, because
the class name would arrive from Heading rather than being re-typed.

---

### F-NEW · A sibling component's Tailwind conversion silently broke a class name this component hand-authors — measured, within one working session

**Surface:** `Heading`'s step 3 vs `Teaser.tsx`'s hand-authored anchor. **F-039
happening in the repository rather than in theory.**

`Heading.css` (step 2) declared:

```css
.heading-link, .heading-text { display: block; font-size: …; line-height: …; }
```

`Heading`'s step 3 moved `display: block` into `HEADING_INNER = "block"` — a
utility `Heading.tsx` emits on the element **it** renders. Teaser hand-authors
that element, so it stopped receiving the declaration. Measured on the step-1
build, identical 18px/22.5px type, comparing Teaser's linked heading against its
own unlinked one:

| | element | `display` | measured height |
|---|---|---|---|
| `heading-text` (rendered by Heading) | `<span>` | `block` | **13.09 px** |
| `heading-link` (hand-authored by Teaser) | `<a>` | **`inline`** | **21.00 px** |

The 13.09 px is `text-box-trim: trim-both` + `text-box-edge: cap alphabetic`
(18 px × Inter's 0.727 cap ratio), which `Heading.css` still applies via
`> .heading-link, > .heading-text` — **and which is a no-op on an inline box.** So
a linked teaser heading was 8 px taller than an identical unlinked one *and* the
design system's cap-height trim silently did not apply to it.

Diffed across the full 49-property snapshot for that element:

```
display   "inline"  -> "block"
height    "auto"    -> "13.0938px"
width     "auto"    -> "254px"
__rect    "185x21"  -> "254x13"
4 of 49 properties
```

**Nothing caught it.** No type error, no lint error, no failing test, and the
step-3 computed diff was clean — because the diff compares this component against
*itself* before and after, and the breakage arrived from a different component's
commit. The orchestrator reports the Heading porter measured the same class of
failure independently (4 of 6 properties wrong when Heading's markup is
hand-written against the converted component), which makes this two independent
measurements of one mechanism.

**Decision:** repaired two ways, deliberately belt-and-braces.

1. `Teaser.tsx` **imports** `HEADING_INNER` from `headingUtilities.ts` rather than
   re-typing `"block"`. That converts an invisible markup duplication into a
   compile-time dependency: if Heading deletes the export, Teaser stops building.
2. `Teaser.css` step 2 also declared `display: block` on `.Teaser-link` — Teaser's
   **own** class, not Heading's — so the two cannot fight.

Verified after the repair, 17 typographic and box properties compared between the
two heading modes on the step-3 build:

```
ROOT  <h2 class="Heading">      -> 0 of 17 differ
INNER heading-text vs heading-link -> 0 of 17 differ
```

**Open question for the project owner.** The import is a workaround for a missing
slot, and it only works because `HEADING_INNER` happens to be exported. The
general problem is unsolved: **in a repo where components own their markup, a
component that hand-authors another component's part has a dependency that no tool
can see.** Three candidate mitigations, in increasing cost: export every part's
utility string (what happened here, by luck); give every part a `*ClassName` prop;
or adopt `data-part` (upstream ADR-0026) so the *selector* stops depending on the
class at all — which would have made this breakage impossible, since `Teaser.css`
would have selected `[data-part="link"]` and Heading's utilities would have been
free to change.

---

### F-NEW · The Tailwind conversion is PARTIAL, and the boundary is exactly component ownership

**Surface:** `Teaser.css` step 2 (148 lines with the repair) → step 3 (148 lines,
22 declarations). **The clearest structural result in the port.**

`Card.css` converted to **zero** declarations. `Button.css` kept one debug block.
`Teaser.css` keeps three groups, and the reason is not that anything is hard to
express — it is that **a utility must be written on an element, and a composition
component does not own every element its stylesheet styles.**

| Group | Rules | Why it cannot be a utility |
|---|---|---|
| 1 | `.Media.StackedSources` / `.Media.HorizontalSources` — `display`, `position`, `aspect-ratio`, the absolutely-positioned `img` | `MediaFigure` takes ONE `pictureClass` and applies it to BOTH groups, then appends each group's own `cssClass`. **There is no seam through which Teaser can give one group `block` and the other `hidden`.** |
| 2 | `.ContentContainer > time` | The source's documented **body slot**. The caller's markup; Teaser never sees the element. |
| 3 | the whole `@supports not (container-type: inline-size)` fallback | Half of it is group 1, and a progressive-enhancement layer that is half utilities and half CSS is correct only in combination — a worse artefact than either half. |

Group 1 is the important one: **it is the single most important rule in the
component** — it is what makes the teaser art-directed, a 4:3 stacked crop
becoming a 1:1 square crop when the card goes horizontal — and it is the one rule
that is *structurally* unconvertible.

**The generalisable rule, sharper than "some CSS resists utilities":**

> A utility conversion is possible exactly as far as component ownership extends.
> Button and Card own every element they style, so they converted completely.
> Teaser is a composition, so the boundary of its markup falls *inside* the
> boundary of its stylesheet, and every rule that crosses that boundary stays CSS.

**That boundary does not exist in the reference/Razor model at all**, because
there the consumer authors the DOM and a descendant selector reaches anything.
This is the same mechanism F-039 identified, arriving at the *stylesheet* rather
than at the component tree — and it means the two-phase method's Phase B has a
hard ceiling for any composition component, not a matter of taste.

**Upstream recommendation for `MediaFigure`:** the preset table already names each
group (`StackedSources`, `HorizontalSources`), so the missing seam is a
`groupClass?: Record<string, string>` or a `pictureClass` that accepts a function
of the group. Reported, not added — another component's surface.

---

### F-NEW · Two things the Button port ruled out that actually convert cleanly — a pseudo-element, and container queries

**Surface:** `teaserUtilities.ts`, step 3. **Positive findings, and one is a
correction.**

**1. THE PSEUDO-ELEMENT CONVERTED.** The Button port's conclusion was: *"A
pseudo-element cannot carry a class, so a utility cannot reach it. This is the
only thing in 477 lines of source CSS that is structurally impossible to
convert."* Teaser's stretched link is a pseudo-element and it converted exactly:

```css
.Teaser[data-button="false"] .Teaser-link::after {
  content: ""; position: absolute; inset: 0; cursor: pointer;
}
```
→ `after:content-[''] after:absolute after:inset-0 after:cursor-pointer`

Verified by the computed-style diff (`::after` is measured explicitly by
`teaser-computed.cjs`, via `getComputedStyle(el, '::after')`) — 0 diffs.

**The correct rule is narrower than the one recorded.** A utility *can* reach a
pseudo-element; Tailwind's `after:` variant generates the pseudo-selector. What
Button could not convert was a pseudo-element **whose value came from the
cascade** — `var(--_paddingBlock)`, inherited per size. The obstacle was the
inherited value, not the pseudo-element. Worth correcting because "no pseudo-
elements" would wrongly rule out a large, cheap category.

**2. CONTAINER QUERIES CONVERTED, EXACTLY, INCLUDING `grid-template-areas`.**
Teaser's entire layout is one container query at 25 rem, and all of it moved:

```
@container                                                    → container-type: inline-size
@max-[24.999rem]:[grid-template-areas:'media'_'heading'_'body']
@min-[25rem]:[grid-template-columns:minmax(12rem,1fr)_2fr]
@min-[25rem]:grid-rows-[auto_auto_1fr]
@min-[25rem]:[grid-template-areas:'media_heading'_'media_body'_'media_body']
@min-[25rem]:h-full  @min-[25rem]:items-stretch
```

Tailwind rewrites `_` to a space **inside the quoted strings as well**, so
`'media_heading'` is exactly `"media heading"`. Nothing about a container query
resisted, and the three-row named-area template — the least utility-shaped CSS in
the whole primitive set — survived verbatim.

**3. AND THE `@supports` PAIR IS ASYMMETRIC UNDER CONVERSION**, which is a useful
small result. The **positive** gate becomes redundant: `container-type` is an
unknown declaration in an engine without container queries (dropped), and an
`@container` at-rule cannot match there either, so the utilities are
**self-gating**. Exactly one declaration inside it is not self-gating —
`display: grid` — which is why `LAYOUT` carries
`supports-[container-type:inline-size]:grid` rather than a bare `grid`. Emitting a
bare `grid` would silently change the ~3%-of-browsers branch from block flow to a
single-column grid, with no test able to see it. The **negative** gate has no
escape: it is a condition rather than an element, so it stays CSS.

---

### F-NEW · F-062's override seam: the token seam dies, the mechanical seam survives — measured both ways

**Surface:** `teaser-override.cjs` against the step-3 build. **Refines F-062 and
F-064.**

F-062 recorded that the blank-property gate does not survive a Tailwind
conversion and that the cost lands on the consumer. Teaser is the second data
point and structurally the harsher one, for a reason F-062 did not have:

> **Teaser has no `className` prop at all** — faithfully, because
> `TeaserTagHelper` calls `output.Attributes.SetAttribute("class", "Teaser")`,
> which **replaces** an author's class rather than appending it. `CardTagHelper`
> appends. Two conventions in one component set, and Teaser's closes the seam
> *before Tailwind is anywhere near it*.

So step 2's five `--_*` properties (`--_padding`, `--_flow`, `--_columnGap`,
`--_mediaRadius`, `--_minMediaSize`) were not one seam among several — they were
the only one. Three consumer overrides injected into the live step-3 page:

| Consumer rule | Result |
|---|---|
| `.Card > .Teaser { --_padding: 2rem }` | 24px → 24px · **NO EFFECT — the seam is gone** |
| `.Card > .Teaser { padding: 2rem }` | 24px → **32px** · **OVERRIDE WORKS** |
| `.Card > .Teaser[data-button="false"] .Teaser-link::after { content: none }` | `""` → **`none`** · **OVERRIDE WORKS** |

**The conclusion is more nuanced than F-062's, and it is F-064's mechanism doing
the work.** Tailwind v4 emits utilities in `@layer utilities`; an injected or
imported consumer stylesheet is **unlayered**, and unlayered normal declarations
beat every layer regardless of specificity. So:

- What the conversion destroys is the **semantic / ergonomic** seam: the named
  design intent (`--_padding`), self-documenting, discoverable, and the idiom the
  source's own `style.css` uses.
- What survives is the **mechanical** seam, on one condition: **the consumer must
  write CSS, not utilities.** A consumer who writes `padding: 2rem` in a
  stylesheet wins. A consumer who tries to pass `p-xl` cannot even deliver it,
  because Teaser has no `className`.

That is a real change in who can override and how. The pre-conversion seam was
usable by a designer editing tokens; the post-conversion seam is usable only by
someone writing raw CSS declarations against class names the component treats as
internal. **F-062's verdict stands in substance — it is a regression in
extensibility — but "the override has nowhere to attach" is too strong.** It has
somewhere to attach and it is a worse place.

**And F-064's alphabetical-ordering hazard did NOT bite here, for a structural
reason worth recording:** Teaser's conversion emits **no colour utility at all**.
Teaser has no colour of its own — every surface, border and text colour on a
teaser belongs to a component it composes. So there is no `bg-*` pair whose
resolution depends on token names sorting alphabetically. A composition component
turns out to be *less* exposed to F-064 than a leaf component, not more, because
composition is precisely what stops it declaring colour.

Related, and load-bearing for the partial conversion: **`Teaser.css`'s residue is
unlayered, so it always beats the utilities.** That is what makes a half-converted
stylesheet stable rather than order-dependent — the three surviving groups cannot
lose to a utility, whatever Tailwind's sort order does. Verified: no declaration
in the residue is also emitted as a utility, so there is no live contest at all.

---

### F-NEW · `--COLOR-` grep before step 1: zero reads, and the reason is structural

**Surface:** `Teaser.css`, step 1. **Positive finding, and it closes the loop on
F-061.**

The Button port's recommendation was to grep for `--COLOR-` before step 1, because
the semantic bridge covers only component CSS that reads the semantic tier. Run
on this file:

```
grep -c -- '--COLOR-' Teaser.css                        → 0
grep -o -- '--[a-zA-Z][a-zA-Z0-9-]*' Teaser.css | sort -u → --size-md, --size-sm
```

Two tokens, both semantic, both bridged. **Step 1 rendered correctly on the first
build**, which is the outcome `primitive-tokens.css` predicted and which Button
did not get.

**The reason is not luck, and it generalises: a composition component has no
colour to get wrong.** Every surface, border, radius and text colour on a Teaser
belongs to `Card`, `Heading`, `Prose` or `Button`. Teaser owns position, display,
grid, gap, padding and one border-radius — all of which the spacing bridge
answers. So:

> **A composition component is the cheapest possible step 1, and the most
> expensive possible step 3** — for the same reason. It delegates everything that
> a token bridge handles well (colour) and owns everything that a utility layer
> handles badly (rules about elements it does not render).

---

### F-NEW · `ContentContainer` and `LayoutContainer` are not utilities, not components, and not global — they are Teaser-private parts with generic names

**Surface:** the source's `03_utils/` directory vs `Teaser.css`. Answers a
question the brief raised.

The source's class list (`Button`, `Card`, `ContentContainer`, `Heading`,
`LayoutContainer`, `Prose`, `ScreenReaderText`) reads like a mixture of components
and grid utilities. Measured:

```
grep -rn "ContentContainer\|LayoutContainer\|ScreenReaderText" ClientApp/css/03_utils/  → nothing
grep -rn ... ClientApp/                                                                 → only Teaser.css and style.css
```

- `ContentContainer` and `LayoutContainer` are defined **nowhere except
  `Teaser.css`**. They are Teaser's own parts. `03_utils/grids/` contains
  `grid-container`, `grid-layout`, `grid-stack` and `grid-breakout` — four real
  utilities, 55 lines total, and **none of them is used by Teaser**. Nothing
  needed porting.
- `ScreenReaderText` is a nine-declaration rule sitting in the global
  `style.css`, between a `@keyframes` block and a commented-out debug block. It is
  not a component and has no file of its own. Ported to
  `Teaser/ScreenReaderText.css` verbatim, because `web/src/styles/**` is off
  limits to a port and Teaser is currently its only consumer.

**So the answer to "components, utilities or Tailwind's job now" is: parts, and
they stay parts.** But they are the **only two part names in the entire Razor
primitive set that break the `Component-part` convention** the Button port found
immune to F-057 (`.grid` on a `<table>`, `.ring` picking up Tailwind's ring
shadow). `.ContentContainer { display: flex }` unscoped in a shared stylesheet is
exactly that shape.

**Decision:** the retargeted body rule is written `.Teaser .ContentContainer`,
scoped, where the source's `.Teaser-body` was unscoped and safe by naming.
Recorded rather than renamed — the class name is contractual.

**And `ScreenReaderText` was deliberately NOT converted to Tailwind's `sr-only`
in step 3.** They are not equivalent: the source uses `clip-path: inset(100%)`
with no `white-space` declaration, Tailwind's `sr-only` uses `clip: rect(0,0,0,0)`
plus `white-space: nowrap`. Converting would have produced a clean-looking diff on
a different mechanism. Kept as CSS; the class name is also the name the source's
markup uses.

---

### F-NEW · The stylesheet had a dead rule because the TagHelper renamed a class — and the source's own commented-out debug block proves it

**Surface:** `Teaser.css` `.Teaser-body`, step 1 → step 2. Repair.

`Teaser.css` ships a `.Teaser-body` block:

```css
.Teaser-body { display: flex; flex-direction: column; align-items: flex-start; flex: 1;
  & time { padding-block-start: var(--size-sm); margin-block-start: auto; } }
```

`TeaserTagHelper` emits `<div class="ContentContainer">` for the body — and
appends `sb.Append("</div>"); // Teaser-body`, a comment naming the class that is
no longer written. The source's `style.css` still carries a commented-out debug
block styling `.Teaser .LayoutContainer .Teaser-body`. So the class was renamed
and the rule was left behind.

Three of the four declarations are duplicated onto `.ContentContainer` by both
`@supports` branches, so the only live loss is the `time` rule — the mechanism
that pins a date to the bottom of a card. Measured on a slotted `<time>`:

| | `padding-block-start` |
|---|---|
| step 1 (verbatim) | **0 px** — rule dead |
| step 2 (retargeted) | **12 px** |

**Decision:** retargeted to `.Teaser .ContentContainer` in step 2. This is the
third instance in this port set of the same class of finding — `Button.css`'s
`color: var()`, `CtaButton.css`'s unplaced icon grid area, and now a renamed part
— all of them dead code that a browser tolerates silently and that only a port
surfaces.

**Upstream recommendation:** rename the selector, or rename the emitted class
back. Also worth a note: the debug block in `style.css` is the audit trail, and it
is the only evidence of which name came first.

---

### F-NEW · `.Teaser` only works inside a container that gives it a definite inline size, and the failure looks like a component bug

**Surface:** the kitchensink's `Boxed` wrapper. Cost one build cycle.

`.Teaser` declares `align-items: flex-start` and `flex: 1`, and the first version
of the demo box was `display: flex`. Result: every demo measured **26 px wide**,
with `.LayoutContainer` at 73 px overflowing its own parent — because as a flex
*item* the Card's width comes from `flex-basis: content`, and `align-items:
flex-start` stops the LayoutContainer stretching.

As a plain **block** child the Card fills its box and the Teaser stretches
correctly. One-word fix, and the failure presented as a total layout collapse
inside the component.

Worth recording because the source cannot hit it: upstream a Teaser is always
placed by a parent composition (the comment says *"locked layouts belong to a
parent composition, not Teaser"*), and every such parent gives it a definite
inline size. `flex: 1` on a component that is *always* a flex item in the real app
is fine; in a demo harness it is a trap. **A component whose contract assumes a
particular parent is a component whose kitchensink has to supply that parent.**

---

### F-NEW · A stale shared `.next` presents as a layout bug, not as a broken server — and it cost the first two measurements

**Surface:** `web/tasks/probes/teaser-guard.cjs`. **Sharpens CLAUDE.md's existing
warning; hit twice in one session.**

CLAUDE.md warns that a stale server answers `200` from an overwritten `.next` and
that `curl` proving something is listening is not enough. The version this port
hit is more specific and more misleading. Several primitive ports run in parallel
against **one shared `.next`**. When another agent runs `npm run build`, every
chunk hash changes; a server already running keeps serving HTML that references
the old hashes. The result:

- the document is **200**
- the JS chunks are **200**
- **one or two CSS chunks are 500**
- the component's own module CSS still applies, and **Tailwind's entire utility
  layer is missing**

So the page renders, styled, half-correct. Measured on the first step-1 snapshot:
every boxed demo came back 1264 px instead of 320/544 px, `display` computed
`block` on elements carrying `flex`, and the container query never crossed its
threshold. **That is indistinguishable from a component layout bug.** It happened
again later, between a clean guard run and the next probe — the second time it
produced `42 gone, 42 new` on a computed diff, which reads as a structural change
to the component.

**Decision:** `teaser-guard.cjs` — two checks, ~2 seconds: every CSS response is
200, and a known utility (`.bg-canvas`) computes to a real colour. Run before
every measurement in this port; it caught the second incident immediately. Both
final numbers below are bracketed by a passing guard before *and* after.

Recommended as a standing pre-flight for any probe in this repo while ports run
concurrently. `npm run verify` cannot see this, because it builds and starts its
own server in the same invocation.

---

### F-NEW · What `cursor-DESIGN.md` could not express for a teaser

**Surface:** step 2 mapping.

The doc names five surfaces that could plausibly be a teaser — `feature-card`,
`comparison-card`, `testimonial-card`, `cta-band`, `hero-band` — and **none of
them is a teaser.** Mapped what mapped:

| Teaser value | Source | Step 2 | From |
|---|---|---|---|
| root padding | `--size-md` 12px | `--spacing-lg` **24px** | `feature-card` / `comparison-card` / `testimonial-card` all specify 24px |
| card radius | (Card) | `--radius-lg` 12px | "Cards use `{rounded.lg}`" |
| media radius | `0.3em` → 4.8px | `--radius-md` **8px** | `ide-pane` — an inner pane inside a 12px card |
| card border | (Card) | 1px `hairline` | "hairline-only depth" |
| elevation | `data-elevation="sm"` | **nothing** | "No drop shadows, no elevation tiers" |
| CTA | `emphasis="primary" size="sm"` | unchanged | `button-primary` at `sm`; `--color-primary` #c84000, never #f54e00 (F-001) |

**Three things the doc has no answer for.**

1. **The internal rhythm.** The doc specifies card *padding* and section *rhythm*
   (80 px) and nothing in between. A teaser needs a heading↔body gap and a
   media↔text column gap, and neither is a padding or a section. Chosen as
   `--spacing-sm` (12px, the source's value, which the bridge already maps to our
   scale) for vertical flow and `--spacing-lg` (24px) for the column gap, on the
   reasoning that "generous / minimal hairlines" wants more air beside a 192 px
   crop than between two lines of text. **That is a judgement, not a mapping.**
2. **`frame="elevated"` has become a distinction without a difference.** The Card
   port resolved all four `[data-elevation]` gates to nothing, correctly, because
   the doc rules out elevation tiers by name. So `elevated` and `bare` now paint
   **identically** inside a bordered parent and differ only in the DOM. The axis is
   live in the API, documented, and visually dead. Demonstrated side by side on the
   route so the emptiness is visible rather than inferred.
3. **A horizontal teaser is not in the doc at all.** State B — a square crop in a
   left column with the CTA pinned bottom-right — has no named surface, no
   specified column ratio and no specified crop aspect. The `2fr` text column and
   the `1/1` crop are the source's, kept because inventing a ratio would be new
   design.

**Open question:** the doc's card family is all *padding + radius + hairline* and
says nothing about internal composition. A `teaser-card` entry specifying the two
internal gaps and the horizontal split would remove the only judgement calls in
this step 2.

---

### F-NEW · Two axes written as `"false"`, and only half of the CLAUDE.md exception applies

**Surface:** `teaserAttributes.ts`. Pinned in `tests/teaserAttributes.test.ts`.

The source writes both `data-button` and `data-media` as `"true"` **or**
`"false"`, never omitted. CLAUDE.md's rule is `="true"` or absent, with an
exception when both states are styled. Measured against the source stylesheet:

- `data-button` — `[data-button="false"]` is styled (the stretched-link block);
  `[data-button="true"]` is not. **The exception holds in one direction only.**
- `data-media` — **neither** value is styled anywhere. The axis is entirely inert
  in the source's own CSS.

Both reproduced verbatim. `data-media` is the only DOM trace of the `image` prop
and it is what a consumer's stylesheet would select on, which is the same
reasoning `cardAttributes.ts` recorded for `data-border="false"` — and the third
time in this component set that an attribute is emitted as public API while
matching no rule in its own stylesheet.

After step 3 the count rises: `data-button` no longer styles anything either,
because the stretched-link gate became a decision the component makes before
rendering. **Three of this component's three `data-*` values are now decorative.**
That is `Card.css`'s "an axis can die twice" outcome again — once when the design
removes its meaning, once when the conversion removes its last reader — and this
time all three axes died at the second step.

---

### F-NEW · The accessible name of the CTA needs a slot, not an `aria-label`, and that is why `LinkButton` composed for free

**Surface:** `Teaser.tsx`, the CTA branch. Positive finding.

The source appends the heading to the CTA's visible label as visually-hidden
text, **inside** `.Button-text`:

```html
<span class="Button-text">Read more<span class="ScreenReaderText"> about Predict your next edit</span></span>
```

Not an `aria-label`. That is the correct choice and worth stating because the
tempting React port is `ariaLabel={`Read more about ${heading}`}`, which
`LinkButton` offers as a prop:

- `aria-label` **replaces** the accessible name, so the visible "Read more" would
  no longer be part of it — a WCAG **2.5.3 Label in Name** failure for anyone
  using voice control.
- The hidden span **extends** it, satisfying **2.4.4 Link Purpose in Context**
  (a list of "Read more" links is otherwise indistinguishable) while keeping the
  visible text inside the name.

This is exactly why `LinkButton`'s `children` slot mattered: the extension has to
land *inside* a part the button renders. A `LinkButton` that exposed only
`ariaLabel` and no children would have forced Teaser to hand-author
`.Button-text` — the Heading failure, a second time. **The slot is what made the
correct accessibility choice expressible.**

axe over the whole route in both appearances: **0 violations**, including
`link-name` and `nested-interactive`, which is the pair a stretched-link overlay
covering an entire card tends to trip.

---

### F-NEW · Where the stretched link is still a hazard, and it is not one axe can see

**Surface:** `Teaser.css` `.Teaser[data-button="false"]`. Open question.

The `::after` overlay covers the whole card. Two consequences the source is
silent about and no gate detects:

1. **Text inside the card cannot be selected**, because the overlay sits above it.
   Live for every `data-button="false"` teaser, which is the default.
2. **Any other interactive content in the child slot is unclickable.** The source
   handles the CTA case by construction — `data-button="true"` removes the overlay
   entirely, which is what the `hasLink = href && !Button` condition encodes — but
   the child slot accepts arbitrary markup, and a tag link or a share button
   dropped into a `data-button="false"` teaser is dead. Nothing warns.

3. Related, and visible on the route: the focus indicator for a whole-card link is
   the UA outline around the **inline heading text only**, not around the card.
   That satisfies 2.4.7 and it under-communicates the hit area.

**Open question:** a `z-index` on interactive slot content, or a documented "no
interactive content in the slot when `button` is false", or a `:focus-within`
ring on the card. All three are new design, so none was invented. Reported.

---

## Result

Three ordered steps, each measured on a clean production build on a private port
(`:3260`), each bracketed by a passing `teaser-guard.cjs`.

| Gate | Result |
|---|---|
| `Teaser.css` byte-identical at step 1 | ✓ md5 `53c66f31d4f51e223f7d85c457b5dd2a` |
| step-3 computed-style diff vs step 2 | **0 property diffs, 0 gone, 0 new** — 21 instances × 2 appearances × up to 16 parts, incl. `::after` |
| axe WCAG 2 AA, light **and** dark | **0 violations** |
| reflow sweep 320–1280 px | **0 px horizontal overflow at every width** |
| `npm run build` | clean |
| `npm run lint` | clean, 0 errors |
| `npm run test:unit` | **303 passing** (17 new: `teaserAttributes.test.ts`) |

Heading parity after the repair, step-3 build, 17 properties compared:
`<h2 class="Heading">` text vs link mode → **0 of 17 differ**;
`heading-text` (Heading's) vs `heading-link` (Teaser's) → **0 of 17 differ**.
Counterfactual, before the repair: **4 of 49** properties wrong, everything green.

Source CSS 212 lines → step-3 residue 148 lines / **22 declarations**, all three
surviving groups being rules about elements Teaser does not own.
