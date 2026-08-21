# Picklist — findings

**Result: 27 / 27 conformance tests green on the first run**, including the
unscoped `checkA11y(page, '#Picklist')` (zero WCAG 2 AA violations), all four
focus-ring contrast measurements, the segmented seam/radius geometry and the
40px height contract in both gapped and segmented mode.

**And the prize: `reference-components/tests/appearance.e2e.test.js` — 8 / 8
green**, the first run of the site-level appearance suite in this project. It
was blocked on Picklist landing (`.Picklist[data-id="single"]` and `#Picklist`).

Phase A only. `Picklist.css` is byte-identical to the submodule's copy
(`diff` clean) — see F-NEW *Picklist.css needed no edits at all* below.

---

### F-NEW · The chip mechanism, written down — ThemeSwitch reuses it as a recipe

**Surface:** `Picklist.css`, `web/src/components/Picklist/Picklist.tsx`,
`reference-components/src/partials/components/ThemeSwitch/ThemeSwitch.css`.

Recorded because ThemeSwitch consumes this as a *recipe*, not as a shared
stylesheet, so the next porter has to re-implement it from a description.

Five parts, all load-bearing:

1. **Wrapper.** `.option { position: relative; display: inline-flex }` — the
   containing block for the absolutely-positioned input.
2. **The input is sr-clipped but still focusable.** `position: absolute;
   inline-size/block-size: 1px; clip-path: inset(50%); overflow: hidden;
   white-space: nowrap; border: 0; padding/margin: 0`. Never `display: none` or
   `visibility: hidden` — either one takes the keyboard and the semantics with it.
3. **The label immediately follows the input and is the visible surface.**
   `input + label` is a *literal adjacent-sibling* requirement: any element
   between them silently kills selection and focus styling. In JSX that means
   `<input …/><label …>` as consecutive siblings with no wrapper and no `{' '}`.
4. **Every state is a plain adjacent-sibling selector** — `input:checked +
   label`, `input:focus-visible + label`, `input:disabled + label`,
   `input:not(:checked) + label .deselect`. **No `:has()` anywhere**, because a
   focus ring is load-bearing and `:has()` is progressive enhancement only
   (ADR-0005).
5. **The focus ring is drawn on the label and is INSET** — `outline: 2px solid;
   outline-offset: -3px`. Not cosmetic: a selected chip is `color: Canvas` on
   `background: CanvasText`, and `outline` with no colour is `currentColor`, so
   an outward ring on a selected chip is drawn *on the page behind the chip* in
   the chip's own inverted foreground. Measured (probe below): drawn inside, the
   ring is **7.11:1 unselected / 21.00:1 selected in light** and **9.33:1 /
   18.73:1 in dark**. `|offset| ≥ width` keeps it fully inside the border box,
   which is why touching segments need no `z-index` raise — and the spec ties
   those two decisions together in one test.

**ThemeSwitch's one deviation, per its own stylesheet comment:** the inputs and
labels are **direct children of `.options`** with no per-item wrapper, because
the sliding indicator is reached with `input:nth-of-type(N):checked ~
.indicator` and a general sibling combinator cannot escape a `.option` wrapper.
`.options` becomes the containing block instead. Nothing is lost — the input is
1px and clipped, so where it sits does not matter. Everything else (clip recipe,
`input + label`, inset ring, forced-colors block) is identical.

**Decision:** treat parts 2–5 as the portable unit. A React port expresses it
with `defaultChecked` on the input and nothing else — no state, no handler, no
`'use client'`.

---

### F-NEW · Picklist is the cleanest zero-client-JS port in the set so far

**Surface:** `web/src/components/Picklist/Picklist.tsx`.

`Picklist.md`: "No JavaScript. Picklist is markup + CSS." There is no reference
`Picklist.ts` at all — the directory holds `.css`, `.html`, `.md`, `tests/`. So
the port is a Server Component with **no `'use client'` and zero client bytes**,
and it passes 27/27 including three tests that look like they need JS (label
click toggles, Space toggles, arrow keys rove *and* select). Native carries all
three; the port's only job is not to get in the way.

It gets in the way in exactly one place, which is the trap CLAUDE.md warns
about: **`defaultChecked`, never `checked`.** A `checked` prop with no
`onChange` freezes a radio group, and *"radio chips rove with arrow keys and
hold single-selection"* then fails with `expect(italian).toBeChecked()` — i.e.
it reads as **native arrow-roving being broken by the chip skin**, which is the
exact defect the test was written to catch. `Picklist.md`'s Contract section
writes `checked` in the HTML (correct HTML, dangerous porting instruction).

**Decision:** `PicklistOption.defaultChecked`. Selection is uncontrolled by
design; the component never learns what is selected, and does not need to,
because the value goes to the form.

Positive finding: AffixField's story (F-015) repeats. `undefined` = "absent"
lines up with the library's `="true"`-or-absent boolean rule, and the whole
`data-*` authoring API becomes five conditional attributes.

---

### F-NEW · `Picklist.css` needed no edits at all — the first component with nothing to drop

**Surface:** `web/src/components/Picklist/Picklist.css`.

`diff` against the submodule is clean. There is no `data-initialized`, no
`overflow: hidden` init gate (F-010) — the two `overflow: hidden` declarations
in the file are the sr-clip recipe for the input and for the hidden legend, and
both are functional. The `@media (forced-colors: active)` block, which
`Picklist.md` says in bold not to delete, is intact.

This is the direct consequence of the previous finding: **the init gate exists
only because the reference has client JS to wait for.** A component with none
has nothing to gate, so the one sanctioned edit to a Phase-A stylesheet does not
apply. Recorded as the cheapest possible port: `cp`, one `.tsx`, done.

---

### F-NEW · The chip's border is `currentColor`, which sidesteps F-003 entirely

**Surface:** `--_pl-chip-border-color`, WCAG 1.4.11.

F-003 is the project's running problem: one `--ui-border` token serves both
decorative dividers and control boundaries, and the design system's hairlines
(1.18–1.59:1) fail 1.4.11 as a control boundary. Picklist never touches
`--ui-border`. Its unselected chip border is `currentColor`, so it inherits the
chip's *text* colour, which already has a 4.5:1 obligation.

Measured on `/` (`web/tasks/probes/picklist-colours.cjs`), unselected chip
border vs the page ground:

| Appearance | Border | Page | Ratio | 1.4.11 (3:1) |
|---|---|---|---|---|
| **light** | `rgb(90,88,82)` | `rgb(247,247,244)` | **6.63** | ✓ |
| **dark** | `rgb(185,183,175)` | `rgb(26,26,23)` | **8.68** | ✓ |

**Decision:** leave it. `currentColor` for a control boundary is a technique
worth stealing: it makes the boundary *structurally* unable to be fainter than
the label it surrounds, in any appearance, with no token and no floor to
maintain. The border cannot silently drift under 3:1 the way a named hairline
token can.

---

### F-NEW · The most prominent Picklist state is off-palette by design — `CanvasText`, not our ink

**Surface:** `--_pl-chip-selected-bg: CanvasText`, `--_pl-chip-selected-fg: Canvas`.

Measured in both appearances:

| Appearance | Selected chip fill | Selected chip text | Text ratio | Fill vs page |
|---|---|---|---|---|
| **light** | `rgb(0,0,0)` (pure black) | `rgb(255,255,255)` | 21.00:1 | 19.57:1 |
| **dark** | `rgb(255,255,255)` (pure white) | `rgb(18,18,18)` | 18.73:1 | 17.44:1 |

Accessibility-wise this is unimprovable. Design-wise it is the one place in the
port where a component paints a *large* surface in a colour the design system
does not own: `cursor-DESIGN.md`'s ink is `#26251e` (warm near-black), and a
selected chip is `#000000`. On a warm-cream page a pure-black pill reads cold.

This is deliberate on the library's side — `Picklist.md`: "Neutral, monochrome
defaults on system colours — the component **takes** design; override
`--_pl-chip-selected-bg` to push an accent." It is also *why* the appearance
suite picks this chip as its probe: it only reads system colours, so it proves
the seam reaches component internals with no per-component change.

**Decision (Phase B), pre-verified against the appearance suite:** override on
the `.Picklist` element (an ancestor or `:root` override is shadowed by the
component's own defaults, per `Picklist.md`)

```css
--_pl-chip-selected-bg: var(--color-ink);   /* light-dark(#26251e, #f2f1ec) */
--_pl-chip-selected-fg: var(--color-canvas);
```

The appearance suite asserts the selected chip's luminance is `< 0.1` in light
and `> 0.8` in dark. Computed for `--color-ink`: **0.0183** (light half
`#26251e`) and **0.879** (dark half `#f2f1ec`) — both inside the thresholds, so
the override keeps 8/8 green. Do not reach for `--ui-primary` here: F-001's
`#d04200` has luminance ≈ 0.19 and would fail the light half of that assertion,
which is a nice accidental proof that the suite is guarding *the inversion*, not
just "some dark colour".

---

### F-NEW · `--ui-hover` as a 4% alpha wash follows the appearance for free

**Surface:** `--_pl-chip-bg-hover: var(--ui-hover)`, both appearances. Positive.

`ui-tokens.css` defines `--ui-hover: color-mix(in srgb, var(--color-ink) 4%,
transparent)`. Because the mix partner is itself a `light-dark()` pair, the
resolved computed values are:

| Appearance | Computed `background-color` on a hovered unselected chip |
|---|---|
| **light** | `color(srgb 0.14902 0.145098 0.117647 / 0.04)` — a 4% *darkening* wash over white `Canvas` |
| **dark** | `oklab(0.263084 -0.00230259 0.0124794 / 0.04)` — a 4% *lightening* wash over `#121212` |

So "hover lifts the chip" holds in both appearances with **no dark rule, no
`dark:` variant and no second token**: the wash inverts with the ink, and it
composites over whatever `Canvas` currently is. This is the strongest example so
far of why the library's system-colour + alpha-wash model beats a pair of
hard-coded hover fills.

One porting note: measuring an alpha colour with the appearance suite's
canvas-pixel technique gives a **wrong** answer — the canvas defaults to
transparent-black, so a 4% ink wash reads as `rgb(26,26,26)` in light. Composite
it over the element's own resolved background before drawing any conclusion. My
first probe run reported exactly this bogus value.

---

### F-NEW · `.content` is page-global, and Picklist's unqualified descendant rule reaches into a nested Notice

**Surface:** `.Picklist .content { display: flow-root }` vs
`.Notice .content { display: flex; flex-direction: column; gap: … }`.

The `data-id="invalid"` variant composes a Notice *inside* `.Picklist .content`,
and the Notice's own body column is also called `.content`. Both selectors are
specificity `(0,2,0)`, so **source order decides**. Measured on `/`:

| Element | Computed `display` |
|---|---|
| `.Picklist[data-id="invalid"] .Notice > .content` | `flow-root` |
| a standalone `.Notice > .content` | `flex` |

The nested Notice loses `flex-direction: column`, `gap: var(--_nt-content-gap)`
and `min-inline-size: 0`. Invisible today (our error Notice has one paragraph
and no `.title`), but it *is* Notice's documented long-word-wrap guard being
switched off by a sibling component.

The reference has the identical outcome — `src/css/site/style.css` imports
`Notice.css` before `Picklist.css`, so Picklist wins there too. The difference
is that the reference's order is **one hand-maintained import list**, while ours
is emergent: each component `.tsx` imports its own stylesheet (deliberately, so
it stays deletable in one move), and the resulting CSS order is decided by
Next's module graph and chunking, not by us. A change in import order elsewhere
could flip this rule either way, in either direction, with no test noticing.

**Open question / upstream suggestion:** `.content`, `.options` and `.option`
are acknowledged as "page-global words shared across components" — the Picklist
spec says so in its own header comment and scopes every locator for it. The
stylesheets do not take the same care: `.Picklist .content` should be
`.Picklist > .content` (which is what the contract actually describes — "the
`.content` wrapper holds hint + options + error", a direct child). One
`>` removes the whole class of collision. Should we make that the one Phase-A
deviation from verbatim, or hold it for Phase B and note the risk? Held for now,
because Phase A's value is being byte-identical.

---

### F-NEW · The appearance suite's ring-contrast fallback would misread a transparent root

**Surface:** `tests/appearance.e2e.test.js` and `Picklist.e2e.test.js` →
`RING_CONTRAST`. Latent, not currently failing.

When `outline-offset` is negative the helper compares the ring against the
element's own `backgroundColor` (correct). When it is positive it falls back to
`getComputedStyle(el.closest('.Picklist')).backgroundColor`. Measured: that is
`rgba(0, 0, 0, 0)` — the `.Picklist` fieldset has no background of its own, and
`Picklist.css` gives it none.

So if a port ever moved the ring outward, the "surface behind the chip" would be
read as **transparent**, which the helper's canvas-pixel parse turns into pure
black — and a white ring would score 21:1 against a page it is actually
invisible on. That is precisely the bug the test exists to prevent, and the
positive-offset branch would hide it.

Not our problem today: our offset is `-3px`, the assertion `offset < 0` runs
first, and all four measurements pass on the correct branch. Recorded because
the guard is weaker than it reads.

**Upstream suggestion:** walk up for the nearest non-transparent background, or
sample the rendered pixel next to the chip, rather than trusting the component
root.

---

### F-NEW · Appearance suite: 8 / 8, and the whole seam worked with no component changes

**Surface:** `reference-components/tests/appearance.e2e.test.js`, first run in
this project.

| Test | Result |
|---|---|
| `:root` declares `color-scheme: light dark`; absent attribute = follow the OS | ✓ |
| `data-appearance` pins the scheme in both directions | ✓ |
| system colours reach component internals and invert where the component inverts | ✓ |
| the page scaffolding flips with the components, not after them | ✓ |
| every accent token resolves differently in dark than in light | ✓ |
| the shadow ink differs between appearances | ✓ |
| axe is clean in dark (`#Picklist`) | ✓ zero violations |
| body text keeps ≥ 4.5:1 in both appearances | ✓ light 6.63:1 · dark 8.68:1 |

The measured chip pair the suite hangs its central claim on:

| | light | dark |
|---|---|---|
| unselected chip (`Canvas`) | `rgb(255,255,255)`, lum 1.000 | `rgb(18,18,18)`, lum 0.0061 |
| selected chip (`CanvasText`) | `rgb(0,0,0)`, lum 0.000 | `rgb(255,255,255)`, lum 1.000 |
| `body` ground | `rgb(247,247,244)`, lum 0.929 | `rgb(26,26,23)`, lum 0.0115 |

Worth stating plainly as a positive finding: **`Picklist.tsx` contains not one
line of appearance code.** No `dark:` utility, no media query, no duplicated
block, no token read. The component follows the flip because it paints in
`Canvas` / `CanvasText` and because `ui-tokens.css` pins `color-scheme` off
`data-appearance`. F-002's "open question" — is the appearance machinery worth
press-testing? — now has a measured answer: it is the part of the library that
ports at zero cost, and it is the part a Tailwind-native port would have thrown
away first.

The invalid-state border is the one accent that reaches this component, and it
has a proper dark half:

| Appearance | `--_pl-chip-border-color-invalid` | vs unselected chip fill |
|---|---|---|
| **light** | `rgb(207,45,86)` | 5.04:1 |
| **dark** | `rgb(255,128,149)` | 7.83:1 |

---

### F-NEW · The reference kitchensink's trailing `.ChoiceGroup` block was omitted

**Surface:** `web/src/components/Picklist/Picklist.kitchensink.tsx`.

`Picklist.html` ends with a `data-id="reference"` block rendering the same
options as a plain `.ChoiceGroup`, purely as an editorial side-by-side. Nothing
in `Picklist.e2e.test.js` touches it. It was omitted rather than shipped as
markup with a class name that belongs to a component another agent is porting —
`/` renders every component at once, and a stray `.ChoiceGroup` element on that
page is a live hazard for `ChoiceGroup.e2e.test.js`'s own locators.

**Decision:** omit. The comparison it makes is documented in `Picklist.md` and
costs nothing to lose; a duplicate class on a shared conformance page is not
free. Worth generalising: **a cross-component "reference" block in one
component's kitchensink is not portable to an aggregate page** — the reference
gets away with it because it serves one section per page.

---

### F-NEW · The same suite scores 27/27 in production and 23/27 against `next dev` — with no code difference

**Surface:** `Picklist.e2e.test.js` run against `npm run dev` vs
`next build && next start`. Not a defect in the port; a portability hazard in how
the suite is run.

Measured. Against the dev server, `/` (the aggregate page, 229 component roots)
reports:

| Sample | `document.scrollHeight` | `.Picklist[data-id="single"]` top |
|---|---|---|
| immediately after `goto` resolves | 30180 | 13817.5 |
| +250 ms | **30404** | **13929.5** |

`+224 px` of document growth, `+112 px` of downward shift for everything below
the culprit — and per-section diffing names it: `MonthField` and `TimeField`
each grow **exactly 112.0 px** on hydration, because their server HTML is not
their end state and each instance *reveals* sub-parts after mount. Section order
on `/` is alphabetical, so MonthField sits above Picklist and TimeField below.
In a production build the same `+224 px` lands at t ≈ 66 ms, before Playwright's
first action, and everything passes.

Three of the four dev-only failures are the *same* event seen three ways, and
none of them says so:

- **`chips flow in a row` → `Expected: < 4  Received: 112`.** Two consecutive
  `boundingBox()` calls straddled the reflow. The `112` is not a wrapped row; it
  is literally the shift.
- **`segmented does not wrap, even when narrow` → `Expected: 1  Received: 2`.**
  This one is *provably* not a wrap: `.options` computes `flex-wrap: nowrap`, and
  a nowrap flex row cannot produce two rows. The loop collecting four `y` values
  straddled the shift.
- **`clicking the chip label toggles the checkbox` / `activating the × glyph
  deselects the chip`.** Playwright computes a click point, then moves the mouse;
  the shift lands inside that gesture, `mousedown` and `mouseup` resolve to
  different elements, and the `click` event dispatches on their common ancestor —
  so the label never receives it, and the input never toggles.

**Decision:** run the conformance suite against a production build. Recorded
because the failure *messages* point at the wrong component every time: they read
as "Picklist's chips wrap when they must not" and "Picklist's label does not
toggle its input" — i.e. as defects in the chip mechanism, the component's whole
thesis — when the cause is another component's hydration reveal 13 000 px up the
page. Two of us spent real time on it. A consumer who runs the suite against
their dev server, as PORTING.md's own instructions imply, will see this.

**Upstream suggestion:** two cheap guards. (1) The geometry assertions read
`boundingBox()` twice and compare; taking both measurements inside a single
`page.evaluate()` makes them atomic and immune to any shift between them —
worth doing regardless of environment, since it is a real race in the assertion
rather than in the page. (2) The suite's own `AXE_SETTLE=1` convention could be
generalised to a settle gate for the geometry and click tests, or PORTING.md
could simply say "run against a production build".

A related note the same investigation turned up, kept separate because there is
**no evidence it currently costs a test**: `Cell`'s `min-w-0` (added for WCAG
1.4.10 Reflow, so an auto track can shrink) and a segmented Picklist's
`flex-wrap: nowrap` (a joined bar must never break mid-row) pull in opposite
directions in principle — reflow wants tracks that shrink, a joined bar wants a
floor it can refuse to go below. The earlier bisection that appeared to show
`min-w-0` costing one failure was the flaky gesture above, so this stays an
observation, not a defect. If it ever does bite, the resolution is for the
component to state its own minimum (`min-inline-size` on `.options` in
segmented mode) rather than to rely on an ancestor track refusing to shrink —
which is also the honest reading of `Picklist.md`: "a joined row that wrapped
would break mid-row with stray radii, so segmented never wraps."
