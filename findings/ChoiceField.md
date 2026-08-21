# Phase 1 — ChoiceField

Port status: **8 / 8 conformance tests green**, `npm run build` clean, submodule
untouched (`git -C reference-components status --short` empty).

Files created:

- `web/src/components/ChoiceField/ChoiceField.css` — verbatim copy, byte-identical
  (`shasum` cc5c434b6e96bf77a66433037f078e13217d602c on both sides). No init-gate
  rules exist in this stylesheet, so nothing was dropped.
- `web/src/components/ChoiceField/ChoiceField.tsx` — Server Component, **no `'use client'`**.
- `web/src/components/ChoiceField/ChoiceField.kitchensink.tsx`
- `web/src/app/kitchen-sink/choicefield/page.tsx`
- `web/tasks/probes/choicefield-proxy.mjs`, `cf-axe.mjs`, `cf-controlled.mjs`,
  `cf-colors.mjs` — throwaway measurement harnesses (see F-NEW entries below).

---

### F-NEW · React's controlled-input trap: HTML `checked` is *initial*, React `checked` is *forever*

**Surface:** `ChoiceField.tsx`, and the four behavioural tests in
`ChoiceField.e2e.test.js` (Space toggle, label click, arrow roving, single selection).

The reference contract is authored HTML: `<input type="radio" ... checked>` means
"this is the initial state; native owns it from here". The mechanical translation
into JSX — `checked={props.checked}` — means the exact opposite in React: the value
is *controlled*, React re-asserts it after every DOM event, and without an
`onChange` handler the control is frozen. This is the single largest gap between
"port the logic" and "port the markup" for this component, and it silently destroys
every native behaviour the whole ADR-0013/0015 design exists to preserve.

**Evidence** (`web/tasks/probes/cf-controlled.mjs`, against a throwaway route
rendering both spellings side by side):

```
#p-controlled checked after click = true      # checked={true}, no onChange — cannot be unchecked
#p-default    checked after click = false     # defaultChecked — toggles normally
#p-r2 checked after click = false | #p-r1 = true   # controlled radio group: selection cannot move
[error] You provided a `checked` prop to a form field without an `onChange` handler.
        This will render a read-only field. If the field should be mutable use `defaultChecked`.
```

The radio line is the fatal one: with `checked`, `#p-r2` never becomes selected, so
`selecting one radio deselects the others (shared name)` and
`arrow keys move selection within the radio group` both fail — and they fail as
*apparent native-semantics defects*, which is the most misleading possible failure
mode for a component whose entire thesis is "native carries the behaviour".

**Decision.** The prop is named `defaultChecked`, not `checked`, and there is no
`checked` prop and no `onChange`. Naming it `defaultChecked` in the public API is
deliberate: a `checked` prop would invite exactly the mistake above from the next
person, whereas `defaultChecked` is React's own word for "initial value, DOM owns
it after that". This keeps the component a Server Component with zero client JS,
which is what ADR-0013 asks for ("no JS: the native input is the single source of
truth"). A consumer who genuinely needs a controlled ChoiceField must add
`checked` + `onChange` themselves and accept that they have then re-implemented
selection in JS — the thing the ADR rejects.

**Note for the reference:** `ChoiceField.md`'s HTML Authoring API table says
`checked` = "present / absent — Initial state". That row is correct for HTML and
actively dangerous as a porting instruction for React/Vue/Svelte, all of which
treat a bound `checked` as two-way. A one-line porting note there would prevent a
whole class of broken ports.

---

### F-NEW · Half the e2e suite hard-codes `page.goto('/')` — the documented `TARGET_PATH` seam is inert

**Surface:** `reference-components/src/partials/components/ChoiceField/tests/ChoiceField.e2e.test.js:5`.

CLAUDE.md and `playwright.config.js` present `BASE_URL` + `TARGET_PATH` as the
porting seam. `ChoiceField.e2e.test.js` does not use it:

```js
test.beforeEach(async ({ page }) => { await page.goto('/') })
```

Playwright resolves the absolute path `/` against the **origin** of `baseURL`, so
`BASE_URL=http://localhost:3000 TARGET_PATH=/kitchen-sink/choicefield` lands on
`http://localhost:3000/` — the Next.js starter home page — and every test fails as
a missing element. `TARGET_PATH` is read only by the `targetPath()` helper, which
this spec never imports.

**Measured split** (`grep -n "page.goto" src/partials/components/*/tests/*.e2e.test.js`):

- Uses `targetPath()` (9): AffixField, DateField, DateTimeField, FileUpload,
  MonthField, MotionRegion, ScrollArea, TimeField, WeekField.
- Hard-codes `'/'` (9): **ChoiceField**, ChoiceGroup, Notice, Picklist, RangeField,
  RangeGroup, RangeScale, ThemeSwitch, ToggleTip.

So the seam works for exactly the components that were ported first. Every
remaining port hits this.

**Decision.** Do not edit the submodule, and do not repoint the shared `/` route of
the dev server (parallel ports run against it concurrently). Instead
`web/tasks/probes/choicefield-proxy.mjs` listens on its own port and rewrites one
path — `/` → `/kitchen-sink/choicefield` — passing everything else (including
`/_next/*` and HMR) straight through. The conformance command becomes:

```bash
node web/tasks/probes/choicefield-proxy.mjs 3131 3000
cd reference-components && BASE_URL=http://localhost:3131 \
  npx playwright test src/partials/components/ChoiceField/tests/ChoiceField.e2e.test.js --reporter=line
```

**Open question for the project owner:** this proxy is per-component throwaway. A
single shared `web/tasks/root-proxy.mjs` taking the target path as an argument
would serve all nine `goto('/')` specs and belongs in the playbook's "Running the
suite" section. Upstream, those nine specs should adopt `targetPath()`.

---

### F-NEW · The axe scope is `#ChoiceField` — an id that lives on the reference *demo section*, not on any component

**Surface:** `ChoiceField.e2e.test.js:88` — `await checkA11y(page, '#ChoiceField')`.

This is a second instance of the F-014 shape, and worse. F-014 was about a class
name (`.kitchensink-section`) that `<Section>` happens to provide. Here the suite
scopes its audit to `#ChoiceField`, which in `ChoiceField.html` is the id of the
`<section class="kitchensink-section">` wrapper. Nothing in `ChoiceField.md`
mentions it; it is not a `data-id`; and our shared `<Section>` uses its `id` prop
only to build the heading id (`${id}-heading`), so no element with `id="ChoiceField"`
would ever exist in our tree. Without it, the audit's root selector does not
resolve and the test is meaningless.

**Decision.** The kitchensink renders `<div id="ChoiceField">` inside `<Section>`,
wrapping every Block. Same subtree for axe, no change to the shared chrome. Noted
here because the anchor is undiscoverable from the contract — you only find it by
reading the spec's last three lines.

---

### F-NEW · The unscoped axe run exposed that the shared kitchensink chrome is not AA

**Surface:** `web/src/components/kitchensink-ui.tsx` (`Block`, `Cell`) — reported,
not edited, per the task boundary.

Ported suites so far use per-component `scopedCheckA11y`, so the demo chrome has
never been audited. ChoiceField's spec audits the whole section, and the chrome
fails immediately — **35 nodes, all of them ours, none from ChoiceField**:

```
color-contrast 35
  .mb-xl:nth-child(1) > h3
    contrast 3.84 (fg #807d72, bg #f7f7f4, 11px normal). Expected 4.5:1
  .mb-xl:nth-child(1) > … > .text-caption.text-muted-soft
    contrast 2.73 (fg #a09c92, bg #ffffff, 13px normal). Expected 4.5:1
```

- `Block`'s `<h3 className="text-caption-uppercase uppercase text-muted">` —
  `--color-muted` #807d72 on canvas #f7f7f4 = **3.84:1**, fails 1.4.3.
- `Cell`'s `<span className="text-caption text-muted-soft">` — `--color-muted-soft`
  #a09c92 on card #ffffff = **2.73:1**, fails 1.4.3. `design-tokens.css:25` labels
  this token "disabled text only (2.74:1 — WCAG 1.4.3 inactive exception)", but
  `Cell` uses it for a live state caption, which is not disabled text and gets no
  exception.

**Decision (local, and explicitly a workaround).** `kitchensink-ui.tsx` is off
limits to a component port, so the two roles are re-pointed to `text-body`
(`--color-body` #5a5852, ≈6.3:1 on both grounds) *inside the `#ChoiceField`
subtree only*, via descendant-selector utilities on the wrapper:

```tsx
<div id="ChoiceField" className="[&_h3]:text-body [&_span.text-caption]:text-body">
```

Descendant specificity (0,1,1)/(0,1,2) outranks the single-class utilities on the
targets, so no `!important` is needed. Re-run: `No accessibility violations detected!`

**Open question for the project owner:** the real fix is in the shared chrome —
`Block`'s h3 should use `--color-body` (or `--color-ink`) instead of
`--color-muted`, and `Cell`'s caption must stop using `--color-muted-soft`, which
by its own comment is only legal on disabled text. Until then every component
whose suite runs an unscoped `checkA11y` will need the same wrapper hack, and the
aggregate `/kitchen-sink` page is failing AA today.

---

### F-NEW · `--_cf-selected` defaults to `CanvasText`, bypassing the `--ui-*` bridge for the component's most important colour

**Surface:** `ChoiceField.css` — the token block on `.ChoiceField`.

Two of the component's colour tokens reach for the host bridge, one does not:

```css
--_cf-border-color-invalid: var(--ui-destructive, #c00);
--_cf-bg-hover: var(--ui-hover);
--_cf-selected: CanvasText;      /* no var(), no --ui-* seam */
```

**Measured** (`web/tasks/probes/cf-colors.mjs`, computed styles on the live page):

| anchor | border | box bg | mark | border : white |
|---|---|---|---|---|
| `#cf-cb-def-e` (cb, empty) | `rgb(90,88,82)` | `#ffffff` | — | **7.11:1** |
| `#cf-cb-def-f` (cb, checked) | `rgb(0,0,0)` | `rgb(0,0,0)` | `#ffffff` | 21:1 |
| `#cf-rd-def-f` (radio, selected) | `rgb(0,0,0)` | `#ffffff` | `rgb(0,0,0)` | 21:1 |
| `#cf-inv-cb` (invalid) | `rgb(207,45,86)` | `#ffffff` | — | 5.04:1 |

Every value clears WCAG 1.4.11 (3:1 non-text) comfortably — but the selected state
resolves to **pure `#000000`**, not the design system's warm near-black
`--color-ink` #26251e, because `CanvasText` is a system colour and ignores our
tokens entirely. The unselected border, by contrast, resolves to `rgb(90,88,82)`
(`--color-body`) because it is `currentColor` and therefore *does* inherit our
design. So one control shows two different blacks: an inherited design black on the
rim and a system black in the fill.

There is no `--ui-selected` / `--ui-accent-surface` role in `ui-tokens.css` for the
bridge to map, and because the default is a literal rather than
`var(--ui-…, CanvasText)`, adding one would not help — an `:root` override of
`--_cf-selected` is explicitly shadowed by the component's own default on
`.ChoiceField` (`ChoiceField.md`, CSS Variable API). The host's only route is a
per-instance `style` override, which is what the reference kitchensink's "accent"
variant does and what our `Variants` block reproduces.

**Decision.** Leave it at `CanvasText` for Phase A — it is the verbatim CSS and it
passes every contrast requirement. Flag for Phase B: the honest translation is
`--_cf-selected: var(--ui-selected, CanvasText)` plus a `--ui-selected` role in
`ui-tokens.css`, which would let the bridge paint the selection the way it paints
everything else. That is a change to the reference stylesheet, so it is a Phase B
decision for the project owner, not a Phase A edit.

**Secondary note:** `--_cf-bg-hover: var(--ui-hover)` is the only token in the file
with **no fallback**. In a host that does not define `--ui-hover` the declaration is
invalid at computed-value time and the hover background silently does nothing —
whereas the sibling `--_cf-border-color-invalid` guards itself with `#c00`. Ours
defines `--ui-hover` (`ui-tokens.css:71`) so it works here; the asymmetry is a
reference bug, not a port problem.

---

### F-NEW · Positive: the second component in a row whose contract's ideal implementation is idiomatic React

**Surface:** `ChoiceField.tsx`, `web/src/app/kitchen-sink/choicefield/page.tsx`.

Following F-015, this is a stronger case than AffixField. AffixField was zero-JS
because its script only *computed attributes*; ChoiceField is zero-JS because there
was never any script — ADR-0013 chose native primitives precisely so that roving
tabindex, single selection, Space-to-toggle and form participation would not need
implementing. React's server rendering matches that exactly: `next build` reports
`/kitchen-sink/choicefield` as `○ (Static)` — prerendered, no client component in
the tree, no hydration for the controls — and all six behavioural tests pass on
native alone.

The one place React nearly broke it is F-NEW (`checked` vs `defaultChecked`) — and
notably, the *framework* is what would have broken it, not the contract. Web
Awesome's stateful `<wa-radio-group>` (ADR-0013's rejected alternative) is what you
get if you follow React's controlled-input idiom to its conclusion; the ADR's
reasoning about web components severing native semantics applies almost verbatim to
a controlled React input.

**Also positive:** the `1.5em` box measures **24×24 px** at our 16px base
(`inlineSize`/`blockSize` on `#cf-cb-def-e`), so the box *alone* clears WCAG 2.5.8's
24px minimum — `ChoiceField.md`'s Accessibility section is conservative when it says
"the box is ~20px; the clickable target is the box plus its label". At the design
system's type scale, the label is a bonus rather than a requirement. The `em`-based
sizing survived our typeface and base-size choice unchanged, the same way the
`1.125ch` calibration did in F-013.

---

### F-NEW · The element-selector stylesheet constrains DOM order in a way no contract states

**Surface:** `ChoiceField.css` — `.ChoiceField input`, `.ChoiceField label`,
`.ChoiceField input:disabled ~ label`.

Unlike AffixField (`.prefix`, `.suffix`, `.input` — named parts, per ADR-0019),
ChoiceField's parts are selected by *element name*, and the disabled treatment is a
**general sibling** rule: `.ChoiceField input:disabled ~ label`. Three consequences
for a React port, none of them written down:

1. The input and the label must be siblings under `.ChoiceField` — you cannot wrap
   either in a layout `<div>`, which is the reflex when adding flex/grid utilities.
2. The input must come **before** the label in source order. ADR-0013 explicitly
   allows a skin to reorder them ("skins may want the `<input>` before the
   `<label>`… keep `for`/`id` correct regardless of source order") — but with `~`,
   label-first silently loses the disabled dimming. The reference kitchensink is
   always input-first, so nothing catches it.
3. Adding any second `<label>` or a nested `<input>` for a hint/description would
   pick up the part styling.

**Decision.** `ChoiceField.tsx` renders exactly `<span class="ChoiceField"><input><label></span>`
with a comment recording the ordering constraint. Flag for Phase B: utilities must
go on the existing three elements, never on new wrappers.
