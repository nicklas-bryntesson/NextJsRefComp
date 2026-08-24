# findings/primitives-Card.md

The Razor `app-card` TagHelper ported to `web/src/primitives/Card/` in three
ordered commits: `0c2020d` (step 1, verbatim), `9487482` (step 2, restyle),
`f1eaa73` (step 3, Tailwind).

Route: `/primitives/card`. Probes: `web/tasks/probes/card-computed.cjs`,
`card-axe.cjs`, `card-reflow.cjs`. Snapshots: `web/tasks/snapshots/card-step1.json`,
`card-step2-before-tailwind.json`.

`ClientApp/css/04_ui/CTABlock.css` was in scope as an orphan. Its verdict is the
third entry below; no code was written for it.

---

### F-NEW · The one axis that carries design was the one axis that did not render — and Tailwind's preflight INVERTED the failure

**Surface:** `Card.css` line 4, step 1. Measured on the step-1 production build
(`tasks/snapshots/card-step1.json`, 25 instances × 2 appearances).

F-061 says to grep for `--COLOR-` before assuming the bridge covers a stylesheet.
Done, and the result is one hit in 45 lines:

```
$ grep -o '\-\-COLOR-[A-Z0-9]*' Card.css | sort -u
--COLOR-N30
```

One constant-tier read — and it is `--_borderColor`, i.e. the only colour in the
file and the only axis with a visual rule of its own. Everything else
(`--size-sm|md|lg`) is semantic and came through correctly: padding 8/12/20px,
gap 12px, radius 8px, `overflow: hidden`, the flex column. **Typography and
spacing arrived; the entire visible design did not.**

That much is F-061 repeating. What is new is *how* it failed:

| | `border-top-width` | `border-top-style` |
|---|---|---|
| `data-border="false"` | 0px | **solid** |
| `data-border="true"` | 0px | **none** |

**Inverted.** Tailwind's preflight sets `border-style: solid; border-width: 0` on
every element, so the *unbordered* card kept a usable `solid` default. The
*bordered* card's own gate — `border: 1px solid var(--COLOR-N30)` — is invalid at
computed-value time, and an invalid `var()` in a **shorthand** makes the whole
declaration guaranteed-invalid, which resets `border-style` to its initial value
`none`. So the gate that exists to add a border actively removed one, and the
element asking for a border ended up further from having one than the element
that was not.

**Decision:** retinted in step 2 to `var(--color-hairline)` — the design's own
name for exactly this line. Nothing added to the bridge.

**The generalisable point, and it sharpens F-061 rather than repeating it.** An
unbridged token does not degrade to "no colour"; it degrades to *whatever the
host framework's reset left behind*, and that can be the opposite of the intent.
Grepping for `--COLOR-` tells you a value is missing. It does not tell you which
direction the miss will move the pixel, and on a shorthand the answer is "further
than you think". Measure the property, not the token.

---

### F-NEW · Card's variant mechanism survives step 3 intact — and the reason is structural, so it predicts which components will and will not

**Surface:** `Card.css` → `cardUtilities.ts`, step 3. **This is the second data
point on F-062 that was asked for, and it lands the opposite way.**

`card-computed.cjs diff` against the step-2 baseline: **0 property diffs, 0 gone,
0 new**, over 26 instances × 2 appearances × 2 elements (42 properties on the
root, 8 inherited ones on the first child). `Card.css` went from 45 lines to **zero rules** — a
header comment and nothing else. `Button.css` at least kept its debug
pseudo-elements; Card had nothing a utility could not reach.

None of the Button port's three conversion costs applied, and none of that is
luck:

| Button's cost | Why Card does not pay it |
|---|---|
| The cascade becomes a 9-row lookup table | **Card's axes are orthogonal.** `padding` owns `padding`, `border` owns `border`, `elevation` owns `box-shadow`. No gate ever overrode another gate, so there is nothing for a table to disambiguate. The three tables in `cardUtilities.ts` are lookups only because a class name must be a static literal. |
| Every state written twice (`hover:` **and** `data-[test-state=hover]:`) | **Card has no states.** No `:hover`, no `:focus-visible`, no `[data-test-state]`. A card has no interactive appearance in the source at all. |
| Relationships become constants (`calc(var(--_iconSize) / 2 * -1)`) | **Card has no relationships.** Not one `calc()` in the file. Every value is a token reference or a literal. |

**Decision / positive finding:** the answer to "does the variant mechanism
survive the Tailwind conversion" is not a property of Tailwind and not a property
of the `data-*`-gate idiom. It is a property of the *stylesheet's shape*:

> A **stateless** component whose axes are **orthogonal** converts one-for-one and
> loses nothing. A component whose axes **compose through specificity**, or which
> styles **states**, or which expresses **relationships**, pays in exactly those
> three places and nowhere else.

Button was three-for-three; Card is zero-for-three. That is a usable predictor
for the rest of the set: grep a candidate stylesheet for `calc(`, for `:hover`,
and for any selector carrying two attribute conditions. If all three are absent,
step 3 is mechanical.

Note what this does **not** rescue. F-062's real complaint was the override seam,
not the code volume — and the seam was already gone. See the next entry.

---

### F-NEW · `CTABlock.css` is a live component that duplicates Card's frame — and the element it duplicates it with is a measured accessibility defect

**Surface:** `ClientApp/css/04_ui/CTABlock.css` (25 lines),
`Views/Partials/richtext/Components/rteCTABlock.cshtml`, `seed.sql:191`,
`ClientApp/css/style.css:14`. **The requested verdict.**

**It is not dead.** It has no TagHelper because it is not a TagHelper component:
it is an Umbraco **rich-text block partial**. `seed.sql` creates the document type
(`rteCTABlock`, "A CTA reference block for use inside the Rich Text Editor"),
`rteCTABlock.cshtml` renders it from `cta` / `title` / `summary` / `links`
properties, and `style.css` imports the stylesheet. Its "props" are content-model
fields, not attributes, which is why there is nothing in `TagHelpers/` to port.

**It is not a Card variant either, because Card has no variant axis.** What it
actually is: a **composition of Card plus one part it owns**. Compare the two
stylesheets declaration by declaration —

| | `Card.css` | `CTABlock.css` |
|---|---|---|
| radius | `0.5rem` `/* TODO: radius token */` | `0.5rem` `/* TODO: radius token */` |
| border colour | `var(--COLOR-N30)` `/* TODO: tone-border-primary */` | `var(--COLOR-N30)` `/* TODO: tone-border-primary */` |
| layout | `flex` / `column` | `flex` / `column` |
| border | `1px solid` (behind a gate) | `1px solid` (unconditional) |
| gap | `var(--size-md)` | `var(--size-sm)` |
| padding | `var(--size-md)` (behind a gate) | `var(--size-md)` |
| block margin | — | `var(--size-md)` |
| root element | `article` \| `section` \| `li` \| `div` | `aside` |
| parts | **none** | `.CTABlock-actions` |

Twelve of its twenty declarations are Card's, including both `TODO` comments
copied verbatim — which is the strongest possible evidence of provenance. Three
declarations genuinely differ (gap, block margin, element) and one part is new.

**Decision:** it is a **Card composition, not a component in its own right and
not dead.** The port shape is `<Card element="div" padding="md" border>` plus a
small `CTABlock-actions` row, and the block margin does not belong to it at all —
`margin-block` is the RTE flow's concern, not the card's, and it is the one
declaration in the file that a card should never own.

**And measurement settled the one axis that looked like a blocker.** `element`'s
allow-list excludes `aside`, so `<app-card element="aside">` silently renders an
`<article>` — which reads at first like Card being too narrow. It is not. A
faithful `<aside class="CTABlock">` on the kitchensink route produced a **real
axe violation in both appearances**:

```
[moderate] landmark-complementary-is-top-level: Aside should not be contained
           in another landmark   (1 node)
```

A CTABlock is rendered *inline within rich-text content*, which is inside
`<main>` — so the source app produces this violation on every page that uses the
block. **Card's allow-list is right and CTABlock's root element is wrong.** The
demo cell renders a `<div>` with the deviation documented in place, so the route
stays green.

**Open question for upstream:** change `rteCTABlock.cshtml`'s root from `<aside>`
to `<div>` (or `<section>` with an accessible name, if the complementary
semantics are actually wanted at top level), then collapse `CTABlock.css` to
`.CTABlock-actions` plus a `margin-block` and let `app-card` supply the frame.
Twelve duplicated declarations and two duplicated `TODO`s go away, and the
landmark violation goes with them.

---

### F-NEW · The consumer override seam was already closed by cascade layers before step 3 touched it — and `:where()` is why nobody would notice

**Surface:** step 2 → step 3, measured on the emitted CSS.
**This is F-062 arriving one step early, by a different mechanism.**

`Card.css` wraps every rule in `:where(.Card)`. Specificity **zero**. The whole
point of that idiom is that one class from a consumer wins without an
`!important` — it is the same generosity `:where()` buys throughout the source
set, and it is the seam an inverted `pricing-tier-featured` has to arrive through
because Card has no variant axis for it.

**It does not work, and specificity has nothing to do with it.**

```
.bg-ink              → @layer utilities     (measured via CSSOM)
:where(.Card)        → (no layer)
```

Tailwind v4 emits utilities inside `@layer utilities`; a component stylesheet
imported from a module (`import "./Card.css"`) is **unlayered**; and an unlayered
normal declaration beats every layered one regardless of specificity. Measured on
`<Card className="bg-ink">` after step 2: `background-color: rgb(255, 255, 255)`.

So in step 1 the override worked (there was nothing to override — the source Card
has no `background-color` at all), in step 2 it silently stopped working the
moment the port *added the design value cursor-DESIGN.md requires*, and the only
form that works is `bg-ink!` — an important declaration inverts layer order.

**Step 3 does not give it back.** Both sides now sit in `@layer utilities`, so the
contest becomes an ordering one — and the order is alphabetical by utility name.
From the emitted chunk:

```
.bg-canvas{…}  .bg-ink{…}  .bg-primary{…}  .bg-semantic-error{…}
.bg-semantic-success{…}  .bg-surface-card{…}  .bg-surface-strong{…}  .bg-transparent{…}
```

`.bg-surface-card` is late in that list, so it beats `bg-ink`, `bg-canvas` and
`bg-primary` — and would **lose** to `bg-surface-strong` and `bg-transparent`.
The `card-computed.cjs` diff confirms it: the override cell shows **0 diffs**
between step 2 and step 3, i.e. the plain override failed identically before and
after.

**Decision:** recorded, not worked around. `bg-ink!` is used in the kitchensink to
demonstrate the working form.

**The finding, stated precisely, because it is worse than F-062's version.**
F-062 says a Tailwind port keeps the design tokens and discards the per-component
override seam. Card shows two things F-062 could not see from one component:

1. **The seam is discarded at step 2, not step 3.** Any component CSS that is
   imported from a module and declares a property a utility also declares has
   already won the argument, permanently, whatever its specificity. `:where()`
   makes this *invisible* — the author reads specificity zero and concludes the
   consumer can win.
2. **After step 3 the outcome is decided by alphabetical order.** Whether a
   consumer's `className` override lands depends on how their chosen token's name
   sorts against the component's. That is not a property the consumer can reason
   about, cannot be discovered from the component's source, and changes if a token
   is renamed.

**Open question for the project owner:** if consumer overrides are meant to work,
component stylesheets need to be in a layer — `@layer components { … }` inside
each component's CSS would put them *below* utilities and make `:where()` mean
what it says. One line per file, and it would restore the seam F-062 mourns for
the whole set rather than for Card. Not done here: `@layer` placement is a
repo-wide cascade decision and `web/src/styles/**` is off-limits.

---

### F-NEW · A half-applied override is a real AA failure, and this is the shape it takes

**Surface:** the `pricing-tier-featured` demonstration, step 2. Measured by
`card-axe.cjs`.

Inverting a card to ink needs two things: `bg-ink` on the root and a light text
colour on the descendants. The natural attempt is
`className="bg-ink [&_*]:text-canvas"` — and the two halves resolve by **different
rules**:

- `[&_*]:text-canvas` generates `.…\:text-canvas *`, specificity (0,1,0) plus a
  descendant, and beats the `text-ink` / `text-body` utilities on the children.
  **It lands.**
- `bg-ink` loses on layer to the unlayered `Card.css`. **It does not.**

Result: canvas-coloured text on a white card.

```
[serious] color-contrast (4 nodes, 2 per appearance)
  light: #f7f7f4 on #ffffff → 1.07:1   (expected 4.5:1)
  dark:  #1a1a17 on #232320 → 1.10:1
```

**Decision:** the demonstration now applies `bg-ink! border-ink!` together with
the text flip, in one cell, so the two halves cannot disagree; a separate cell
shows the plain `bg-ink` attempt with the text left alone, which is the
measurement and is contrast-safe. Route is green in both appearances.

**Why it earns an entry:** an override that fails *completely* is a cosmetic
non-event — the component just looks like itself. An override that fails
*partially* produces 1.07:1, in both appearances, on text a user is meant to
read. The layer/specificity asymmetry above guarantees that partial failure is
the **default** outcome for anyone who tries to retint a card, because background
and text are governed by different mechanisms. This is the most dangerous thing
found in the port.

---

### F-NEW · The elevation axis dies twice, and the second death leaves no trace in a diff

**Surface:** `Card.css` elevation gates, step 2 and step 3.

`cursor-DESIGN.md` does not merely avoid shadows, it rules the axis out by name:

> "The system uses **hairline-only depth**. No drop shadows, **no elevation
> tiers**. Cards float above the canvas via 1px hairlines and the slight
> white-on-cream contrast."

The source has four elevation values with three real shadow stacks. There is
nowhere for them to go.

**Step 2 — the first death.** All four gates resolve to `box-shadow: none`. The
selectors were kept rather than deleted, so the axis is still *legible* in the
stylesheet and a consumer can still hang a rule off `[data-elevation="lg"]`.
Measured: `box-shadow: none` on all 26 instances, both appearances.

An alternative was costed and rejected: re-express the three tiers as hairline
weights (`--color-hairline` → `--color-hairline-strong`), which would have kept
the axis alive using only existing tokens. **A hairline weight is an elevation
tier**, and the doc rejects elevation tiers — so this is the same class of move as
inventing five surface hues, and it was declined for the same reason.

**Step 3 — the second death.** `CARD_ELEVATION` is a table of five empty strings.
`box-shadow: none` is already the computed default, so there is not even a
`shadow-none` to emit. Nothing in the component reads `data-elevation` any more.
The attribute is still written, still documented, still selectable — and entirely
decorative.

The two deaths are not equivalent. After step 2 the axis was four visible
selectors in a file anyone could open. After step 3 it is absent from the code
entirely, and **the computed-style diff reports 0** — because nothing about the
rendering changed. An axis losing its last implementation is invisible to the only
instrument guarding the conversion. That is the same blind spot F-026 and the
Button port's `calc()` finding describe, from a third direction.

**What survives, and it is worth saying:** Teaser's three frames are still
distinguishable without a single shadow, because what Card contributes is the
**surface**, not the shadow — `bare` has no Card at all, `elevated` is a card with
no hairline, `bordered` is a card with one. The design's depth model turns out to
be sufficient for the component that actually consumes the axis.

---

### F-NEW · A TagHelper whose job includes choosing its own tag name has no JSX form in React 19

**Surface:** `Card.tsx`, step 1. Cost one lint cycle.

`CardHelper` sets `output.TagName` from an allow-list, so the obvious port is the
standard React idiom for a polymorphic element:

```tsx
const Element = resolveCardElement(element);
return <Element className={…} {…attrs}>{children}</Element>;
```

That is a **lint error**, not a style note:

```
error  Cannot create components during render   react-hooks/static-components
> const Element = resolveCardElement(element);
                  ^ The component is created during render here
```

The rule keys on the *pattern* — a capitalised local used as a JSX tag — not on
the semantics, and JSX compiles to exactly the call that is accepted:

```tsx
return createElement(resolveCardElement(element), { className, ...attrs }, children);
```

**Decision:** `createElement`, with the reasoning in the file. The cost is that
the component's return statement no longer reads as markup, which for a
nine-line component whose whole job is "wrap children in a configurable tag" is
most of its readability.

This belongs on CLAUDE.md's list of "traps found by the ports themselves"
alongside `useEffect(() => setState(true), [])`: it is a second case where the
React-19 compiler lint rejects the idiom a porter is pointed straight at by the
source's own design. Three of the Razor set's TagHelpers expose an `element`
property (`app-card`, `app-teaser`, `app-heading`), so every one of them meets
this.

---

### F-NEW · The dev-only error box is unreachable in every build this project measures

**Surface:** `CardHelper.RenderError` → `Card.tsx`, all three steps.

`CardTagHelper` renders a red-outlined diagnostic for an invalid `padding` or
`elevation` in Development, and calls `SuppressOutput()` in Production. Ported
faithfully with `process.env.NODE_ENV`, which Next inlines at build time.

**The consequence is that no gate in this repo can see it.** `card-axe.cjs`,
`card-reflow.cjs` and `card-computed.cjs` all run against `next start` on a
production build — for the good reason F-049 established (`next dev` is not a
valid substrate) — so the error path is dead code in every build that is ever
measured. The kitchensink has a cell for it; on `:3200` the cell is empty.

Two things follow, and only the second is a problem.

1. **The invalid-value path cannot regress a gate,** which is fine.
2. **The box has never been checked for contrast, by us or by upstream.** Its
   inline styles are `color: red; border: 2px solid red` with no background, so
   it inherits whatever ground it lands on. Pure red `#ff0000` computes
   **4.00:1** on white, **3.73:1** on our `--color-canvas` `#f7f7f4` and
   **4.36:1** on our dark canvas `#1a1a17` — below AA on all three grounds for
   the text it renders, and closest to passing on the ground it is least likely
   to land on. A developer diagnostic is exempt from nothing at all; it is real
   text in a real page.

**Decision:** ported verbatim, including the hardcoded `red`, and deliberately
**not** restyled in step 2. It must be impossible to miss and must not depend on
the design system having loaded — which is why the source hardcodes it, and that
reasoning is sound. Recorded rather than repaired.

**Open question for upstream:** giving the box an opaque background of its own
would fix it and make it *more* unmissable, not less — `#b00020` text on `#fff`
is 6.6:1, and an explicit background is what stops the diagnostic inheriting the
page it is diagnosing.

Also worth noting the port loses one byte of the source's output for free:
`RenderError` emits an HTML comment alongside the visible span so the message
survives a `display: none`, and JSX cannot emit a comment node.

---

### F-NEW · Card has no parts, and that is the whole reason it is composable

**Surface:** `Card.css` vs `Teaser.css` / `Button.css`.

`Card.css` styles the root and **nothing else**. There is no `.Card-header`,
`.Card-body`, `.Card-media`, no `grid-template-areas`, no slot. The component is
a flex column with a gap and an optional frame, and the children are whatever the
caller passes.

Three consequences, all positive, and they are worth stating because a porter's
instinct is to add parts:

- **Step 3 had exactly one structural class name to preserve.** `Card`. The
  Button port had eight. Nothing to collide, nothing to enumerate.
- **F-057 immunity holds trivially.** `Card` is capitalised and is not a bare
  generic word, so no Tailwind utility can share the name.
  `tailwind-collisions.css` needed zero entries, as it did for Button — but here
  it is a one-name claim rather than an eight-name one.
- **Teaser can put a container query on its own root inside the frame** without
  Card having an opinion. `Teaser.css` declares `container-type: inline-size` on
  `.Teaser`, which is Card's only child; if Card owned a body part the query
  container would be in the wrong place.

**Decision:** do not add parts to Card, in this port or in the Teaser port. If
Teaser needs a media or body region, those are Teaser's parts
(`.MediaContainer`, `.ContentContainer` — which is exactly what the source does).

---

### F-NEW · Card exposes no theme axis at all, so the bridge's five-hue collapse is latent here rather than live

**Surface:** `primitive-tokens.css`'s ✕ comment vs `Card.css`, step 1 and step 2.

The brief flagged this as the risk: `--bg-{blue,red,green,sand,purple}-*` are
collapsed onto one surface pair, so any component with a theme axis renders all
five values identically.

Measured: **`Card.css` reads none of them.** The only colour it reads is
`--COLOR-N30`, and the only tokens at all are `--size-{sm,md,lg}` and that one
constant. `app-card` has four axes and none of them is a theme.

So Card is *not* affected — and it is worth recording as a **positive** finding
rather than saying nothing, because the negative result narrows where the problem
actually lives. Grepping the source's stylesheet set:

```
$ grep -rl '\-\-bg-\(blue\|red\|green\|sand\|purple\)' ClientApp/css/
(no matches in 04_ui/)
```

Nothing in the ported UI layer reads the tinted-surface semantics either. If the
collapse bites, it will be in a *composition* stylesheet that selects a theme for
a section, not in a primitive. Nothing invented, nothing added to the bridge.

---

### F-NEW · What `cursor-DESIGN.md` could not express, and what it contradicted itself about

**Surface:** step 2 mapping.

The doc names five card components. Mapping them onto `app-card`'s four axes:

| doc | port |
|---|---|
| `feature-card` (24px) | `padding="md"` + `border` |
| `comparison-card` (24px, internally 2 columns) | `padding="md"` + `border`; the split is the caller's |
| `testimonial-card` (24px) | `padding="md"`; text colour is the caller's |
| `pricing-tier-card` (32px) | `padding="lg"` + `border` |
| `pricing-tier-featured` (inverts to ink) | **no home** — see below |

**Five things could not be expressed, or were internally inconsistent:**

1. **`pricing-tier-featured` has no axis.** It is the same geometry with
   `background: {colors.ink}` and `text: {colors.canvas}`, and `app-card` has no
   variant, tone or theme axis to carry it. Adding one would mean adding a prop
   the source does not have, which step 1 forbids. So it can only arrive through
   `className` — which is the seam two entries above measures as broken. **The one
   card in the doc that needs the override seam is the one the port cannot deliver
   without an `!important`.**
2. **The doc supplies two card paddings for a four-value axis.** 24px and 32px
   became `md` and `lg`; `sm` (16px, `--spacing-base`) is derived work and marked
   as such in the stylesheet; `none` is 0 in both systems. Same shape as the
   Button port's missing `sm` size.
3. **No internal card gap is specified anywhere.** "Cards within bands sit close
   (16–24px gap)" is the gap *between* cards. The source's `--_gap: var(--size-md)`
   role was kept at its own value (12px) for want of a doc value.
4. **The doc disagrees with itself about card text colour.** `feature-card` and
   `pricing-tier-card` say `{colors.ink}`; `testimonial-card` says
   `{colors.body}`. `app-card` cannot tell them apart, so **`color` is not set at
   all** — inherited, as in the source, and the caller's own typography decides.
   That is the only reading that satisfies both entries, and it happens to match
   what the source did.
5. **`comparison-card` is "internally split into 2 columns"**, which is a content
   layout and not a card property. Left to the caller, correctly — but it means
   one of the doc's five "cards" is not describable as a card at all.

**One thing the port had to add.** `background-color` is the single declaration in
step 2 that has no source counterpart. The source Card has **no surface** —
measured `rgba(0, 0, 0, 0)` on all 25 step-1 instances — while all five of the
doc's cards specify `{colors.surface-card}` without exception. So the port gives
Card a surface it did not have, and that is the change with the widest blast
radius: it is what closed the override seam (F-062 entry above), and it is what
made the kitchensink chrome a problem (next entry).

---

### F-NEW · The shared kitchensink chrome is card-coloured, so a Card demo has to bring its own ground

**Surface:** `Block` in `web/src/components/kitchensink-ui.tsx`, step 2.

`Block` renders its contents on `bg-surface-card`. Once step 2 gave Card the
surface the design requires, every card was **white on white** — and the entire
`border={false}` half of the page — 7 of 26 instances, including both
unbordered Teaser-frame demos — was invisible. Not a contrast failure (the text is unaffected), but the
demo stopped demonstrating anything.

`cursor-DESIGN.md` is explicit that a card is "White card on cream canvas", so the
fix is one wrapper on our side: each demo sits on `bg-canvas`.

**Decision:** `kitchensink-ui.tsx` is off-limits and correctly so. Recorded
because this is the *second* mismatch between the shared chrome and this primitive
set — the Button port found the chrome is **field-shaped** (`Cell` is a
one-column grid, so intrinsically-sized components stretch); Card finds it is also
**card-coloured**. Both are right for the reference-components ports, which are
form fields on a card. Any primitive that is itself a surface has to opt out.

---

### F-NEW · Two small contract details that will bite the next porter

**Surface:** `cardAttributes.ts`, `Card.kitchensink.tsx`.

**`data-border="false"` has a weaker claim on the CLAUDE.md exception than
`data-pill` did.** The rule is `="true"` or absent, with one documented exception:
when both states must be styled. `Button.css` styles both pill states, so the
exception clearly applied. `Card.css` styles **only** `[data-border="true"]` — so
`data-border="false"` is written to the DOM and selects nothing in the component's
own stylesheet. Reproduced anyway, because it is the documented public API and a
consumer's stylesheet can select on it; pinned in
`tests/cardAttributes.test.ts`. **Open question:** the exception as written in
CLAUDE.md does not actually cover this case, and the honest options are to narrow
the port or to widen the rule to "the source writes it, so it is API".

**An omitted `elevation` and `elevation="none"` are different, and the difference
is only in the DOM.** `Elevation?.ToLowerInvariant() ?? "none"` for the
combination check, but the attribute is written only when the prop was supplied.
Identical rendering, different DOM — and the DOM is the API, so both are
reproduced and both are tested. It also means `CARD_ELEVATION` is keyed on
`"absent" | "none" | "sm" | "md" | "lg"`, five rows for four values.

**`element="li"` requires the caller to own the `<ul>`.** That is deliberate in
the source (Teaser's contract has the same `element="li"` option for list
contexts), but an `<li>` with no list owner is an ARIA structure violation that
axe reports, so the kitchensink cell supplies the `<ul>`. Worth knowing before
demonstrating the axis.

---

### F-NEW · The probe has to key on the tag name, because one of Card's four axes has no `data-*` reflection

**Surface:** `tasks/probes/card-computed.cjs`.

`element` is a first-class axis and its only trace in the DOM is the tag name —
there is no `data-element`. A snapshot key built from `data-*` attributes alone
(which is what `button-computed.cjs` does, correctly, because every Button axis is
an attribute) collapses `article` / `section` / `li` / `div` onto one entry and
silently stops measuring three of them.

Two other deliberate differences from the Button probe, both because Card is a
different shape:

- **It measures the first element child**, which is not a Card part — Card has no
  parts. It is the only way to see whether an inherited value changed, and
  inheritance is exactly what a utility on the root can silently alter.
- **It measures `overflow-x` / `overflow-y` explicitly.** `overflow: hidden` is
  what clips a Teaser's full-bleed media to the frame's radius, and **Teaser is
  not on this route**. A component's most important consumer being absent from
  its own inspection surface is the normal case for a primitive, and the probe is
  the only place that gap can be covered.

**Also parameterised `BASE_URL`,** which `button-axe.cjs` and `button-reflow.cjs`
hardcode at `:3200`. Several primitive ports were running concurrently against one
`.next` directory during this one, and killing the shared port pulls the ground
out from under another agent's measurement. Card's probes default to `:3200` and
were run on `:3210`.

---

## What Teaser will need from Card

`TeaserTagHelper` **does not use `<app-card>`**. It writes the frame by hand into
`PreElement`:

```csharp
var cardExtra = frame == "elevated" ? " data-elevation=\"sm\"" : " data-border=\"true\"";
output.PreElement.SetHtmlContent($"<div class=\"Card\" data-padding=\"none\"{cardExtra}>");
```

That is a string, not a component call, and it is the single most useful thing to
know before starting Teaser. Concretely:

| Teaser `frame` | React |
|---|---|
| `bordered` (default) | `<Card element="div" padding="none" border>` |
| `elevated` | `<Card element="div" padding="none" elevation="sm">` |
| `bare` | no `Card` at all — Teaser renders its own root directly |

Pinned in `tests/cardAttributes.test.ts` ("emits the Teaser frames exactly"), so
if the Teaser port's frame drifts from the source's, a unit test says so.

**The exact surface, so nothing has to be inferred from my source.**

```tsx
import { Card } from "@/primitives/Card/Card";

<Card
  element="article" | "section" | "li" | "div"   // default "article"
  padding="none" | "sm" | "md" | "lg"            // default "md"
  border={boolean}                               // default false
  elevation="none" | "sm" | "md" | "lg"          // default OMITTED (not "none")
  className={string}                             // merged AFTER "Card"
>{children}</Card>
```

**Part names: there are none.** The only class name Card puts on the DOM is
`Card`, on the root, and the only attributes are `data-border`, `data-padding`
and (when supplied) `data-elevation`. There is no `Card-header`, `Card-body` or
`Card-media` to target or to avoid colliding with — so every part name in the
Teaser port (`Teaser`, `Teaser-body`, `Teaser-link`, and the source's
`LayoutContainer` / `MediaContainer` / `ContentContainer` / `Heading`) is
Teaser's own, with no negotiation needed. Card also renders **no wrapper of its
own** around `children`: the child you pass is a direct child of the `Card`
element.

Also inherited, and worth knowing before you duplicate it: `hasContent()` lives
at `@/primitives/Button/hasContent` and is the shared translation of
`TagHelperContent.IsEmptyOrWhiteSpace`. `Card.tsx` imports it rather than copying
it, because a second copy would be a second definition of the suppression rule.
Teaser needs the same predicate (`childContent.IsEmptyOrWhiteSpace`,
`string.IsNullOrWhiteSpace(Excerpt)`), so import it too. The cost is that these
primitives are no longer independently deletable, which is recorded here rather
than solved.

Seven things Teaser depends on, in rough order of how easy they are to break:

1. **`element="div"`, not `article`.** The frame is a `<div>` wrapping
   `<article class="Teaser">`. Teaser's own `element` prop names the *inner*
   element; Card's is always `div`. Two `element` axes, one nested inside the
   other, and only one of them is the caller's.
2. **`padding="none"` always.** The frame contributes no padding —
   `.Teaser { padding: var(--size-md) }` owns it. So Card's padding axis, which is
   the axis the design doc has the most to say about, is **unused by Teaser**.
3. **`overflow: hidden` and the radius, both on the frame.** This is the load-
   bearing pair: the media is full-bleed and is clipped to the frame's corners by
   Card. Guarded explicitly by `card-computed.cjs`.
4. **Card must not set `color`.** Teaser's heading link inherits (`.Teaser-link {
   color: inherit }`), and its `Prose` body sets its own. Step 2's decision not to
   set `color` — taken because the doc contradicts itself — is what keeps this
   working.
5. **Card must stay a single-child flex column with no parts.** `.Teaser` is
   `flex: 1` inside it, and `.Teaser` is the container-query container. See the
   "no parts" entry.
6. **`data-border` and `data-elevation` must keep being written.** Nothing in
   Card reads them after step 3, but they are how a Teaser-level or site-level
   stylesheet distinguishes the frames. This is the one place the F-062 seam
   matters concretely inside this repo.
7. **`frame="elevated"` and `frame="bordered"` no longer differ by a shadow.**
   After step 2 they differ by the *hairline*: elevated is a bare surface,
   bordered is a surface with a 1px line. Distinguishable, but not what the source
   looked like, and the Teaser port should not try to restore the difference with
   a shadow.

---

## Results

| Gate | Result |
|---|---|
| `card-computed.cjs diff` (step 2 → step 3) | **0** property diffs, 0 gone, 0 new — 26 instances × 2 appearances × 2 elements |
| `card-axe.cjs` — light | **0** WCAG 2 AA violations |
| `card-axe.cjs` — dark | **0** WCAG 2 AA violations |
| `card-reflow.cjs` 320–1280 px | 0 px horizontal overflow at every width |
| `npm run build` | clean |
| `npx eslint src/primitives/Card src/app/primitives/card` | clean |
| `npm run lint` (whole repo) | **2 errors, neither in Card** — `CircleDiagram.tsx:59` (`Cannot reassign variable after render completes`) and `CoverCompositionVideo.tsx:145` (`This value cannot be modified`), both other primitive ports in flight on `main`. `npx eslint src/primitives/Card src/app/primitives/card` is clean. |
| `npm run test:unit` | 262 passed / 11 files (16 new, `primitives/Card/tests/`) |
| `npx tsc --noEmit` | clean |
| `Card.css` byte-identical to source at step 1 | md5 `7acc86b46b492d3601398ee8fdd697ff`, `diff` empty |

All four browser gates were re-run on the current tree after two changes landed
from other ports — `Heading`/`Prose`/`orphans` step 1, and the `Cell` fix in
`kitchensink-ui.tsx` that binds its inner grid track to `minmax(0, 1fr)` because
`min-w-0` alone was not enough. **Both reflow and the computed diff are unchanged
by that fix on this route**, and the diff covering `width` is the evidence: the
Card demos sit in a `w-[17rem] max-w-full` wrapper, so they were never sized by
the track. Measured on a private port (`:3211`), `Ready in 54ms` read from the
server log rather than inferred from a `curl` 200.

## Props settled on

Source names throughout; no React-casing changes were needed, because all four of
`app-card`'s properties are single words.

| Prop | Type | Default | Notes |
|---|---|---|---|
| `element` | `"article" \| "section" \| "li" \| "div"` | `"article"` | Allow-list; anything else silently becomes `article`. No `data-*` reflection — the tag name is the only trace. |
| `padding` | `"none" \| "sm" \| "md" \| "lg"` | `"md"` | `md` = 24px and `lg` = 32px are the doc's two card paddings; `sm` = 16px is derived. |
| `border` | `boolean` | `false` | Written as `data-border="false"`, not omitted. |
| `elevation` | `"none" \| "sm" \| "md" \| "lg"` | *omitted* | Omitting it and passing `"none"` differ in the DOM, not in rendering. Visually inert since step 2. |
| `className` | `string` | — | Merged **after** `Card`, matching the source. Not an override seam — see the layer entry. |
| `children` | `ReactNode` | — | Absent or whitespace-only renders `null` (`SuppressOutput`). |

Additions: `className` (the source's own class-merge behaviour). **No `testState`**
— `Card.css` has no state rules at all, so there is no hook to expose and no
state to pin. **No parts, no theme axis, no variant axis.** Server Component,
zero client JS.
