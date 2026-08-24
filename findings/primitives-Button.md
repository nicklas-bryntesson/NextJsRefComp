# findings/primitives-Button.md

The Razor Button family — `app-action-button`, `app-link-button`,
`app-cta-link-button` — ported to `web/src/primitives/Button/` in three ordered
commits: `82a5e64` (step 1, verbatim), `a99829c` (step 2, restyle), `b80c8f0`
(step 3, Tailwind).

Route: `/primitives/button`. Probes: `web/tasks/probes/button-computed.cjs`,
`button-axe.cjs`, `button-reflow.cjs`. Baseline snapshot:
`web/tasks/snapshots/button-step2-before-tailwind.json`.

---

### F-NEW · The verbatim stylesheet does not compile — `color: var()` is a build error, not a dropped declaration

**Surface:** `Button.css` line 64, step 1.

`Button.css` as shipped contains, inside `.Button:hover`:

```css
color:                var();
```

An empty `var()` with no custom-property name. Browsers treat it as a syntax
error and drop the declaration, so upstream it is dead code that nobody would
ever notice. Turbopack's Lightning CSS parser refuses the file outright:

```
./src/primitives/Button/Button.css:64:31
Error: Parsing CSS source code failed
> 64 |     color:                var();
     |                               ^
Unexpected end of input
```

`npm run build` fails, and step 1 could not proceed until the line was commented
out. **This is a class of finding the two-phase method is supposed to surface and
did:** "copy the CSS verbatim" is not always possible, because a browser's
error-recovery tolerance and a build-time CSS parser's are different contracts.
Anything the source relies on the browser silently discarding becomes a hard
failure the moment the CSS goes through a bundler.

**Decision:** commented out, not repaired, in step 1 — that preserves the
rendered behaviour exactly (the browser dropped it too). Repaired in step 2 to
`var(--_color-hover)`, which is unambiguously the intent given every sibling
declaration in the block. Note the repair is *inert* in the source's own design,
because each emphasis gate sets `--_color` rather than `--_color-hover` inside
its `:hover`, so hover colour already resolved through the base property.

**Open question for upstream:** worth a lint rule. `var()` with no argument is
never intentional, and it survived in a 384-line file that is in production.

---

### F-NEW · The token bridge answers the semantic tier; `Button.css` reads the constant tier, so step 1 rendered no colour at all

**Surface:** `primitive-tokens.css` vs `Button.css`, step 1. Measured on the
step-1 build.

`primitive-tokens.css` states its strategy explicitly and correctly — bridge the
~30 lowercase **semantic** tokens, not the ~40 SCREAMING **constants**, because
the semantics are "the layer that carries MEANING". The expectation set for step
1 was that the components "will already look roughly like our design".

**Half of that came true, and the half that did not is the interesting half.**

| What `Button.css` reads | Tier | Bridged? | Step-1 result |
|---|---|---|---|
| `--fontFamily-label`, `--fontWeight-label`, `--lineHeight-label` | semantic | yes | Inter / 500 / 1.4 ✓ |
| `--fontSize-label`, `--fontSize-label-small`, `--fontSize-label-large` | semantic | yes | 14px label ✓ |
| `--size-sm` (padding-block) | semantic | yes | 8px ✓ |
| `--COLOR-N00`, `--COLOR-B20`, `--COLOR-B30`, `--COLOR-B50`, `--COLOR-B80`, `--COLOR-B90`, `--COLOR-N05`, `--COLOR-N10`, `--COLOR-N20`, `--COLOR-N70` | **constant** | **no** | nothing |

Every colour in the file bypasses the semantic tier and goes straight to the
palette. With the constants unanswered, `--_backgroundColor: var(--COLOR-B80)` is
invalid at computed-value time, so `background-color: var(--_backgroundColor)`
falls back to the initial value and `color` falls back to inherited. Measured on
`/primitives/button`, light:

| | primary | secondary |
|---|---|---|
| `background-color` | `rgba(0, 0, 0, 0)` | `rgba(0, 0, 0, 0)` |
| `color` | `rgb(90, 88, 82)` (inherited `--color-body`) | same |
| `border-top-color` | `rgb(90, 88, 82)` | same |

**Primary and secondary were pixel-identical.** The whole emphasis axis was
invisible. Typography and spacing were already ours; colour was absent.

**The only colours that rendered came from the source's own emergency fallbacks.**
The intent rules are written `var(--COLOR-R60, #d63031)` and
`var(--COLOR-G60, #00b894)` — and `R60`/`G60` are *not defined in the source
palette either* (`ClientApp/scss/tokens/color/color.constant.scss` has no such
constants). So destructive and success were the only visible colours on the page,
in both the source app and ours, and both came from hardcoded hex fallbacks
rather than from any token.

**Decision:** the bridge is not wrong and should not be extended. Mapping 40
cool-blue palette constants onto a warm-orange system is exactly the work
`primitive-tokens.css` declines to do, and the right place for the decision is
step 2, where the emphasis axis was mapped onto `cursor-DESIGN.md`'s named button
components. But the sequencing claim needs qualifying:

**Open question / correction to the method.** "Step 1 will already look roughly
like our design" holds only for component CSS that reads the semantic tier. For a
file that reads the palette directly it produces a *silently colourless*
component — which is worse than an obviously broken one, because a
transparent-on-cream button with inherited text looks like a deliberate tertiary
style. Any future primitive should be grepped for `--COLOR-` before step 1
so the porter knows in advance whether the bridge covers it. Suggested one-liner:
`grep -o '\-\-COLOR-[A-Z0-9]*' <file> | sort -u`.

---

### F-NEW · The icon `<svg>` has no `viewBox`, so every icon rendered at 300px — and the guard written to prevent it does not

**Surface:** `ButtonHelper.RenderIcon` + `Button.css .Button-icon`. Measured on
the step-1 and early step-2 builds.

`RenderIcon` emits:

```html
<svg class="Button-icon" aria-hidden="true" focusable="false"><use href="#id"/></svg>
```

No `viewBox`, no `width`, no `height`. A `<symbol>`'s `viewBox` does **not** give
the referencing `<svg>` an intrinsic size. `Button.css` declares only
`block-size: var(--_iconSize)` and leaves `inline-size: auto`, so the width falls
back to the CSS default for a replaced element with no intrinsic dimensions:
**300px**.

Measured (probe `tasks/probes/iconprobe.cjs`):

| | before | after |
|---|---|---|
| icon rect | **300 × 16 px** | 16 × 16 px |
| `sm` button, label "right" | **362.7 px** wide | 78.7 px |
| `lg` icon-only button | full-width bar | 58 × 44 px square |

`.Button-icon` carries `max-width: fit-content`, which was plainly written to
guard exactly this — and does not, because `fit-content` on such a replaced
element resolves to the same 300px. Measured `max-width: fit-content` alongside
`width: 300px` on the same element.

**Decision:** repaired in step 2 with one declaration on each icon part:

```css
aspect-ratio: auto 1 / 1;
```

"Use the intrinsic ratio if there is one, otherwise 1:1." Fixed in the CSS rather
than the markup deliberately: the helper only ever receives a sprite id and has
no viewBox to emit, so a markup fix would mean changing the public API of all
three components.

**Open question:** whether the source app is actually affected. It would be,
given the same markup and CSS — unless its Razor sprite partial injects a
`viewBox` onto the referencing element by some other route. Worth checking
upstream, because it is a total layout failure, not a cosmetic one.

---

### F-NEW · `.CtaButton`'s icon had no grid area, so it auto-placed into a second row

**Surface:** `CtaButton.css`, step 1.

`CtaButtonHelper.RenderInnerContent` renders `.CtaButton-icon` as a direct child,
and `CtaButton.css` declares `grid-template-areas: "text"` with `grid-area: text`
on the label only. The icon is an unplaced grid item, so it auto-placed into an
implicit second row **below** the label rather than beside it. Visible on the
step-1 build; the step-1 snapshot records `grid-template-areas: "text"` on a
CtaButton that contains an icon.

**Decision:** repaired in step 2 with `&:has(> .CtaButton-icon)` declaring a
two-column `"text icon"` layout, so the component's props do not change. Note
this repair was then **undone in kind** by step 3 — `:has()` has no utility form,
so the decision moved into `CtaLinkButton.tsx`, which is strictly less capable:
the CSS version worked for any icon a consumer put in the slot, the component
version only for icons this component renders.

---

### F-NEW · `data-pill="false"` is the right call, and the `data-*` API is what made steps 1 and 2 cheap

**Surface:** `ButtonHelper.SetSharedAttributes`, all three steps.

The source writes every axis as an attribute — `data-emphasis`, `data-intent`,
`data-size`, `data-icon-position`, `data-icon-only` — and notably writes
`data-pill` as `"true"` **or** `"false"`, never omitted. CLAUDE.md's rule is
"`="true"` or absent, never `="false"`", with one documented exception: when both
states must be styled. `Button.css` styles both:

```css
&[data-pill="false"] { --_borderRadius: 0.375em; }
&[data-pill="true"]  { --_borderRadius: 3em; }
```

So the exception applies and the port reproduces `"false"` verbatim. Pinned in
`tests/buttonAttributes.test.ts`.

**What the `data-*` API cost versus React props: almost nothing, and it saved the
first two steps outright.**

*Saved.* Because every visual axis is an attribute gate filling a custom
property, steps 1 and 2 required **no component changes at all**. Step 1 was
"emit the same attributes"; step 2 was "change values in a stylesheet". The React
port could not have been simpler: `sharedButtonAttributes` is 40 lines of pure
data, tested without a DOM, and all three components stayed Server Components
with zero client JS — the ideal CLAUDE.md asks for. Contrast the
reference-components ports, where `useSyncExternalStore` and hydration-race
bootstraps were needed for components that only *compute attributes*; nothing
here needed any of it, because the Razor helper computes attributes and so does
a React Server Component. The two models are the same model.

*Cost.* Three things, all small:

1. **Runtime validation is redundant but has to stay.** TypeScript unions make
   the source's `HashSet` guards unreachable at compile time, but these values
   arrive from a CMS in the real app, so the guards were kept. The source's
   silent-drop behaviour is preserved: an unknown emphasis renders a `.Button`
   with no emphasis attribute and therefore no colour. That is a dangerous
   default — it fails invisibly — but changing it would change the API.
2. **`data-intent="neutral"` matches no rule.** `ActionButton` defaults to it and
   `Button.css` has no `[data-intent="neutral"]` selector. That is correct
   (neutral *is* the base appearance) and it means one of the two most common
   attribute values on the page is inert. Reproduced.
3. **`data-test-state` had to become a prop.** The stylesheet defines
   `hover`/`active`/`focus`/`disabled`/`debug` state pins as a first-class hook,
   and upstream the demo page writes the attribute onto the rendered element
   directly. A React component owns its whole element, so the hook had to be
   surfaced as `testState`. Documented as demo-only. It turned out to be the
   single most useful thing in the port: it is what makes hover and focus both
   screenshot-visible and machine-measurable, and the entire step-3 safety net
   depends on it.

---

### F-NEW · The empty-value gate idiom does not survive the Tailwind conversion — it becomes dead code and is deleted

**Surface:** `Button.css`, step 2 → step 3. **This is the headline finding.**

`Button.css`'s central idiom is a two-tier indirection: `.Button` declares ~30
custom properties **blank** and reads them in one generic block, and a variant
gate later fills them.

```css
.Button {
  --_backgroundColor: ;                 /* declared empty */
  background-color: var(--_backgroundColor);
}
.Button[data-emphasis="primary"] {
  --_backgroundColor: var(--COLOR-B80); /* filled by the gate */
}
```

This is the same gate-selector philosophy the reference library is built on, and
step 3 collides with it head-on. **The answer is unambiguous: it does not
survive.** Once the emphasis row applies `bg-primary` directly, nothing declares
`--_backgroundColor` and nothing reads it. The entire block — 30 blank
properties, ~40 lines — is dead and was deleted.

Deleting 30 blank custom properties is a genuine simplification of the
stylesheet. It is also **the removal of the exact seam a consumer overrides**,
and the source proves the seam is used. `ClientApp/css/style.css` re-tints
primary and secondary buttons for a photographic hero background like this:

```css
.Hero .content :where(.Button)[data-emphasis="primary"] {
  --_color:           var(--COLOR-N80);
  --_backgroundColor: var(--COLOR-N00);
  --_borderColor:     var(--COLOR-N00);
  /* + hover / active / focus-visible */
}
```

Nine lines, no component change, no build step, correct cascade. After step 3
that override has nowhere to attach: `bg-primary` is on the element, so a
descendant-scoped rule loses on specificity unless it is `!important`, and the
utility-based alternative is to thread different utilities in through
`className` and hope Tailwind's generated order favours them. **The cost of the
conversion falls on the consumer, not on this repo** — which is the worst place
for it, because the consumer is the party with the least context.

**Decision:** step 3 is committed as specified and measured clean, but it is
recorded as a **regression in extensibility**, not a neutral translation. The
custom-property seam and the utility layer are alternatives, not layers: you can
have one or the other.

**Open question:** a middle path exists and is worth costing — keep the blank
custom properties and the generic `background-color: var(--_backgroundColor)`
block, and use utilities only to *fill* them (`[--_backgroundColor:var(--color-primary)]`).
That keeps the seam and moves the values, which is arguably what "move design
values to utilities" should mean for a gate-based stylesheet. Not attempted here
because it produces bracket syntax for every declaration and no readable
utilities at all.

---

### F-NEW · A utility cannot override a utility, so two composing CSS axes become nine enumerated rows

**Surface:** `buttonUtilities.ts`, step 3.

Step 2's `.Button` had two independent axes that composed through specificity:

```css
&[data-emphasis="primary"]                          { /* fill */ }
&[data-emphasis="primary"][data-intent="destructive"] { /* overrides the fill */ }
```

Three emphases + two intents + the base = **6 short selectors**, and the cascade
did the composing.

Utilities have no such relationship. `bg-primary` and `bg-semantic-error` are the
same specificity, one class each, and the winner is decided by their order in
Tailwind's generated stylesheet — a property of Tailwind, not of the component.
The override cannot be expressed; the conflicting utility must **never be
emitted**. So emphasis × intent had to be enumerated as **nine explicit rows**
in a lookup table, resolved in JS.

**And the same lesson landed twice more, in places nobody would predict:**

**Inline padding.** Step 2 made icon-only buttons square with
`&[data-icon-only="true"] { padding-inline: var(--_paddingBlock) }`, beating the
size rule on specificity. Emitting `px-[1.125rem]` (size md) and `px-[0.625rem]`
(icon-only md) together is not an override. Measured by the snapshot diff:

| size | authored intent | actual |
|---|---|---|
| sm | 6px inline | 6px ✓ |
| md | 10px inline, 48px wide | **18px inline, 64px wide** ✗ |
| lg | 12px inline, 58px wide | **20px inline, 74px wide** ✗ |

The same authored intent produced different outcomes at different sizes, because
Tailwind's sort key is the *value*. **A bug that varies by size is exactly the
kind that ships.** Fixed by making the two mutually exclusive in the component.

**The focus ring.** `outline-2 outline-offset-[3px]` as unconditional utilities
changed the *resting* computed `outline-width` from the UA's `medium` (3px) to
2px and `outline-offset` from 0 to 3px, because a utility is always on where a
nested CSS rule is scoped by construction. Both had to move under
`focus-visible:` and `data-[test-state=focus]:`.

**Decision:** three separate instances of "resolve it in JS, never emit both".
That is now the rule for this component, and it is worth stating generally: **any
CSS that relies on specificity to override becomes a decision the component must
make before rendering.** Every such move is a transfer of styling logic from CSS
into JavaScript, and it is invisible in the diff of any single utility.

---

### F-NEW · Every state is written twice, because a variant prefix cannot be a selector list

**Surface:** `buttonUtilities.ts`, step 3.

`Button.css` styles each state with a two-selector list so one declaration block
serves the real pseudo-class and the demo pin:

```css
&:hover,
&[data-test-state="hover"] { /* three declarations */ }
```

A Tailwind variant prefix cannot be a list, so each declaration needs `hover:`
**and** `data-[test-state=hover]:`. Counted for one tone (primary/neutral): the
stylesheet had 12 declarations across four states; the utility string has **26
utilities**. `TONE` is 9 rows × ~15 lines = the largest file in the port at 326
lines, replacing ~180 lines of stylesheet.

This is a pure multiplication with no upside. It is also the mechanism by which
`data-*`-as-public-API and utility-first styling are in direct tension: the
attribute is still on the element, still the documented API, and now every rule
that reads it must be written out a second time alongside its pseudo-class twin.

---

### F-NEW · Tailwind's static extraction forbids computed class names — the failure is silent

**Surface:** `buttonUtilities.ts`, step 3. Cost one build cycle.

The natural expression of "nine rows, three shapes" is a helper:

```ts
const primaryIntent = (fill: string, press: string) =>
  `border-${fill} bg-${fill} hover:bg-[${press}] …`;
TONE.primary.destructive = primaryIntent("semantic-error", ERROR_PRESS);
```

This generates **nothing**. Tailwind v4 finds candidates by scanning the raw
*text* of source files, so a class name that only exists after a template literal
is evaluated is invisible to it. The utility is never emitted, and **nothing
errors** — not the build, not the type checker, not the linter. The component
renders unstyled.

That constraint bites this component harder than most, because a `data-*`-driven
component is by definition one whose styling is chosen at runtime. The stylesheet
enumerated the matrix in nine short selectors; the utility layer must enumerate
it in nine long literals, and the deduplication a helper would give is
unavailable.

Two smaller consequences worth recording:

- Line breaks in the concatenated literals must fall on space boundaries only. A
  break inside a class name silently drops it — the same silent failure, from a
  formatting change.
- `--_iconSize` was read off the ancestor by inheritance in step 2. In step 3 the
  icon's height and its compensating negative margin must be *passed down as
  props* from the button to `ButtonIcon`, because a utility has no access to the
  cascade. Small, exact, and irreversible.

---

### F-NEW · The utility layer cannot hold a relationship — `calc(--_iconSize / 2 * -1)` becomes three constants

**Surface:** `Button.css` → `buttonUtilities.ts`, step 3. Relates to F-026 and
ADR-0025.

Two mechanisms in `Button.css` are *rules* rather than values:

```css
/* icon contributes no height, whatever height it is */
margin-block: calc((var(--_iconSize) / 2) * -1);

/* keep line-height inside the button box */
--_marginBlock: calc((var(--_fontSize) - var(--_fontSize) * var(--_lineHeight)) / 2);
```

There is no utility for "half of another utility", so the first became three
hardcoded values (`-my-[0.5rem]`, `-my-[0.5625rem]`, `-my-[0.625rem]`) and the
second became `my-0`. Both are correct today and silently wrong for any icon size
or line-height a consumer installs.

This is exactly ADR-0025's "express relationships, never a scale", and F-026
recorded the same loss from the other direction — a px type scale disabling the
library's `em` model. **The utility layer cannot hold a relationship at all**, so
converting a relationship-based stylesheet to utilities *always* costs the
relationship, whether or not the current numbers stay identical. A computed-style
diff cannot detect this: 0 diffs is exactly what you get.

Worth naming the second-order effect: `{typography.button}`'s line-height of
**1.0** already made the whole `--_marginBlock` compensation evaluate to 0 in
step 2. The apparatus was a no-op before step 3 touched it, which is why its
conversion to `my-0` was free — and why nobody would have noticed the loss.

---

### F-NEW · `Component-part` naming is immune to F-057, and that is a real advantage of the rejected convention

**Surface:** `Button-text`, `Button-icon`, `CtaButton-glow` vs F-057.

F-057 measured the reference library's element lexicon colliding with Tailwind's
utility names: `.grid` computed `display: grid` on a `<table>` (a one-column
calendar with 38px of dead space) and `.ring` picked up Tailwind's
`--tw-ring-shadow` (a grey rectangle around every wheel column). Both needed
repairs in `tailwind-collisions.css`.

**No name in this family can collide, by construction.** `Button`,
`Button-text`, `Button-icon`, `CtaButton`, `CtaButton-text`, `CtaButton-icon`,
`CtaButton-border`, `CtaButton-glow` — every one contains a capitalised component
name and none is a bare generic word, so no utility a framework generates can
share one. `tailwind-collisions.css` needed **zero** entries for this port, and
that holds even though `.Button`'s root now literally carries Tailwind's `grid`
utility alongside its own class.

**Decision / observation.** The reference library's ADR-0019 chose generic
single-word part names *deliberately*, "precisely so a consuming project can swap
them for its own utilities", and F-057 is the bill for that choice. The Razor set
made the opposite choice and pays nothing. When the target is a utility
framework, `Component-part` is strictly safer than `.Component .part` — which is
an argument for ADR-0026 (`data-part`) from a direction the reference's own
reasoning had not considered, and an argument that the rejected convention was
right about something.

Do not "fix" the naming to match the reference library. It is better here.

---

### F-NEW · The one thing no utility could reach: a pseudo-element

**Surface:** `Button.css` after step 3.

`CtaButton.css` is now **empty**. `Button.css` retains exactly one rule: the
`[data-test-state="debug"]` block, which paints the padding band with `::before`
and `::after` sized to `var(--_paddingBlock)`.

A pseudo-element cannot carry a class, so a utility cannot reach it. This is the
only thing in 477 lines of source CSS that is *structurally* impossible to
convert rather than merely awkward — and it survives only by re-declaring the one
custom property it reads, per size:

```css
&[data-size="md"] { --_paddingBlock: 0.625rem; }
```

Which is to say: the residue of the conversion is a fragment of the very
custom-property system the conversion deleted, kept alive for one debug feature.

---

### F-NEW · `.CtaButton`'s disabled rule is unreachable, and demonstrating it created a real AA failure

**Surface:** `CtaButton.css` + the kitchensink. Measured by `button-axe.cjs`.

`CtaButton.css` styles `&:disabled { opacity: 0.5 }`. But
`CtaLinkButtonTagHelper` always renders an `<a>`, and `:disabled` never matches
an anchor — so for this component the rule is unreachable dead code. There is no
`disabled` prop and no way to reach it.

Demonstrating it via the `[data-test-state="disabled"]` pin put a **real WCAG
1.4.3 failure** on the route:

```
[serious] color-contrast (1 node)
  .CtaButton[data-test-state="disabled"] > .CtaButton-text
  contrast 2.89:1 (foreground #f7f7f4, background #93928f, 14px, weight 400)
  Expected 4.5:1
```

The inactive-component exception does **not** apply, because the element is not
actually disabled — axe reads it as live text and is right to. This is a precise
instance of the trap CLAUDE.md warns about for `[data-test-state]` pins
generally: a pin renders a *style* without the *semantics* that would exempt it.

**Decision:** the cell was removed from the kitchensink, with a comment
explaining why the absence is deliberate. The same reasoning drove a step-2
choice that paid off: `.Button`'s disabled text uses `--color-body` (5.64:1 on
`surface-strong`) rather than the literal analogue `--color-muted-soft` (2.17:1,
valid only under the inactive exception), so `.Button`'s disabled pins pass axe
outright and need no exemption.

**Open question for upstream:** either drop `&:disabled` from `CtaButton.css`, or
give `app-cta-link-button` a `disabled` prop that renders
`aria-disabled="true"` + `role="link"` semantics — currently it advertises a
state it cannot produce.

---

### F-NEW · `--color-semantic-success` is a fill colour, not a text colour, on the cream canvas

**Surface:** step 2, `[data-emphasis="secondary"][data-intent="success"]`.
Computed contrast ratios, sRGB.

The source's intent axis puts the semantic hue on the **label** for secondary and
tertiary emphasis, where it owes 4.5:1 (14px/500 is not WCAG large text).
Measured against the two grounds a button can land on:

| Pair | Ratio | AA |
|---|---|---|
| `--color-semantic-error` #cf2d56 on card #ffffff | 5.04 | ✓ |
| `--color-semantic-error` on canvas #f7f7f4 | 4.70 | ✓ |
| `--color-semantic-success` #1e8662 on card #ffffff | 4.52 | ✓ (barely) |
| **`--color-semantic-success` on canvas #f7f7f4** | **4.22** | **✗** |

The kitchensink's `Block` chrome uses `bg-surface-card`, so a component-scoped
axe run on this page passes at 4.52 and says nothing about the 4.22 case. **That
is the F-017 pattern again** — a ratio measured on one ground is half a finding —
and it is why this is recorded from a calculation rather than from a green audit.

**Decision:** the intent hue is split into two roles inside the component, using
only existing tokens:

```css
--_intentColor:     var(--color-semantic-success);   /* fill and border */
--_intentTextColor: color-mix(in oklab, var(--_intentColor) 72%, var(--color-ink));
```

Mixing toward `--color-ink` raises contrast against the canvas in **both**
appearances, because ink and canvas invert together: in light the hue darkens on
cream, in dark it lightens on near-black. One expression covers both halves and
invents no token. Borders keep the full-strength hue, which only owes 3:1.

**Open question for the token layer:** the honest fix is a `*-text` stop for each
semantic colour in `design-tokens.css`, the way `--color-primary` already has one
(`--color-primary` is the AA-safe stop and `--color-primary-brand` the true hue,
per F-001). `--color-semantic-success` currently has to serve as both a fill and
a body-text colour and cannot do both. **Not added — reported, per instruction.**

---

### F-NEW · What `cursor-DESIGN.md` could not express, and where `button-download` went

**Surface:** step 2 mapping.

The doc names five button components. Four map cleanly onto the source's
emphasis axis:

| doc | port |
|---|---|
| `button-primary` | `emphasis="primary"` |
| `button-primary-active` | its `:active` / `:hover` state |
| `button-secondary` | `emphasis="secondary"` |
| `button-tertiary-text` | `emphasis="tertiary"` |
| `button-download` | **`.CtaButton`** — see below |

**`button-download` has no home in `.Button`.** It is an ink-filled,
canvas-texted, 44px CTA, and the source's emphasis axis has no ink variant while
its intent axis is for semantic state, not for a second brand fill. Mapping it
onto `.CtaButton` — the standalone larger CTA, a separate lexicon and stylesheet
— is what let step 2 finish without inventing a token. It also justified two
moves against the source: the radius drops from `3em` (pill) to
`{rounded.md}` 8px, and the type drops from 1.25rem/600 to
`{typography.button}` 14px/500, because "larger" in `button-download` is the box,
not the label.

**Four things in the doc could not be expressed, or were internally
inconsistent:**

1. **`button-primary` gives both `padding: 10px 18px` and `height: 40px`, and the
   two disagree.** 14px of type at line-height 1, inside 20px of padding and 2px
   of border, is a **36px** box. Resolved by honouring the padding literally and
   guaranteeing the height with `min-block-size` — the only reading that
   satisfies both numbers, and also what makes the three emphases the same height
   despite tertiary having no border. `button-secondary`'s `9px 17px` is the
   doc compensating for a border that `.Button` always has anyway, so it was not
   used; border-box absorbs it.
2. **The doc has no `sm` size.** It supplies exactly two geometries (40px/10×18
   and 44px/12×20), which became `md` and `lg`. `sm` (32px, 6×12,
   `--fontSize-label-small`) is derived work, marked as such in the stylesheet.
3. **Only two primary fills exist**, `primary` and `primary-active`, so hover and
   press are necessarily the same colour. Recorded rather than papered over with
   an invented third stop.
4. **The source's `0 0 0 4px` hover ring has no home.** The doc is explicit —
   "Hairline-only depth; no drop shadows" — so hover became a fill change
   (primary) or a border-colour change (secondary), which is the hairline
   system's own vocabulary. The **focus** ring stays; that is WCAG 2.4.7, not
   decoration, and it uses `--color-primary` so the two ported sets cannot
   disagree about what focus looks like (4.67:1 on canvas light, 6.74:1 dark).

**One positive.** The doc's brand hue got exactly one legitimate use in the whole
port: `--color-primary-brand` (#f54e00) tints `.CtaButton-glow`'s radial
gradient. F-001 confines the true hue to decorative use where the floor is 3:1,
and a gradient behind an opaque button carries no text and conveys no
information. Everything else uses the AA-safe `--color-primary` (#c84000). The
glow's opacity was toned from the source's 0.6/0.9 to 0.35/0.5, because a heavy
halo reads as the glow-heavy IDE voice the doc explicitly rejects ("editorial
calm over IDE-darkness").

---

### F-NEW · The shared kitchensink chrome is field-shaped; an intrinsically-sized component has to opt out

**Surface:** `Cell` in `web/src/components/kitchensink-ui.tsx`, step 2.

`Cell` is `display: grid` with one column, which is right for the
reference-components ports — a form field *is* full-width. A `.Button` is
`display: inline-grid`, so as a grid child it takes `justify-self: stretch` and
every button in a cell widens to the widest label in that cell.

Measured before the fix: a 137px `pill false` and a 404px `pill false`, same
component, same size, different cells — and every icon-only button rendered as a
full-width bar rather than a square.

**Decision:** `Cell` is off-limits to this port and correctly so — changing it
would move every reference-components demo. Fixed with one local wrapper in the
kitchensink (`<div className="grid justify-items-start gap-xxs">`). Recorded
because the next porter of an intrinsically-sized primitive will hit it, and
because it reads as a component defect rather than a chrome mismatch.

---

### F-NEW · Two probe defects, recorded because each was one step from a wrong report

**Surface:** `tasks/probes/button-computed.cjs`.

The computed-style snapshot is the only safety net this primitive set has, and it
was wrong twice before it was right. Both failures were in the *instrument*, and
both would have produced a confident false conclusion.

**1. `transition: none` hid the property it was meant to guard.** The first
version killed transitions with `transition: none !important`, which also resets
`transition-property` — so `transition` computed to `none` on all 99 instances
and the snapshot **could not see a transition being dropped**, which is the
single property a utility conversion is most likely to lose. Changed to
`transition-duration: 0s !important`, which freezes the animation while keeping
the property list observable.

**2. An in-flight colour transition produced 518 phantom diffs.** The probe sets
`data-appearance` and then measures. `Button.css` transitions colour over 250ms,
so flipping the appearance *starts a transition on every button*. Once the values
came from Tailwind (`transition-[…]` routes the duration through `--tw-duration`)
the duration override no longer landed before the measurement, and the dark pass
read oklab waypoints: a dark primary measured `rgb(203, 67, 3)` instead of
`rgb(255, 122, 64)`.

**518 diffs, every one in the dark appearance, all colour properties. It looked
exactly like a broken dark palette** — and the wrong report was one sentence
away: "the Tailwind conversion breaks `light-dark()` tokens". Diagnosed by
measuring the token at `:root` (correctly `#ff7a40`) against the element
(`rgb(200, 64, 0)`), and confirming via CDP `CSS.getMatchedStylesForNode` that
`.bg-primary` resolves a plain `var(--color-primary)` with no `color-mix`
wrapping. Fixed by waiting 400ms — longer than the longest declared transition —
so the probe is correct whether or not the override takes.

**The general lesson, and it is F-056's theme again:** a measurement apparatus
that is wrong in the *conservative* direction produces false greens (case 1); one
that is wrong in the *noisy* direction produces false alarms that are
indistinguishable from real regressions (case 2). Case 2 is more dangerous here,
because the phantom had a plausible mechanism attached to it.

---

## Results

| Gate | Result |
|---|---|
| `npm run build` | clean |
| `npm run lint` | clean |
| `npm run test:unit` | 229 passed / 9 files (17 new, `primitives/Button/tests/`) |
| `button-axe.cjs` — light | **0** WCAG 2 AA violations |
| `button-axe.cjs` — dark | **0** WCAG 2 AA violations |
| `button-reflow.cjs` 320–1280px | 0px horizontal overflow at every width |
| `button-computed.cjs diff` (step 2 → step 3) | **0** property diffs, 0 gone, 0 new — 99 instances × 2 appearances × 3 elements |

## Props settled on

Source names throughout, React casing only where JSX requires it.

| Component | Props |
|---|---|
| `LinkButton` | `href`, `target`, `emphasis="primary"`, `pill=false`, `size="md"`, `icon`, `iconPosition="right"`, `ariaLabel`, `className`, `testState`, `children` |
| `ActionButton` | `buttonType="button"`, `disabled=false`, `emphasis="primary"`, `intent="neutral"`, `pill=false`, `size="md"`, `icon`, `iconPosition="right"`, `ariaLabel`, `className`, `testState`, `children` |
| `CtaLinkButton` | `variant="glow"`, `icon`, `href`, `target`, `ariaLabel`, `testState`, `children` — **no `className`**, because the source's `SetAttribute("class", "CtaButton")` overwrites rather than merges and silently discards an author class |

Renames: `icon-position` → `iconPosition`, `aria-label` → `ariaLabel`,
`button-type` → `buttonType`. Additions: `className` (the source's own
class-merge behaviour, which two of the three helpers implement), and `testState`
(the stylesheet's `data-test-state` hook, which upstream the demo page writes
directly onto the element). No `onClick` — the source has no handler to port, and
adding one would force `'use client'` on a primitive whose entire job is to
compute attributes. All three are Server Components with zero client JS.
