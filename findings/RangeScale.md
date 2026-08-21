# RangeScale — findings

Phase A port. `RangeScale.css` copied **byte-identical** (`diff` clean, no
init-gate rules to drop — this component has none).

Conformance status on the aggregate `/`, canonical command: **the runner reports
31 / 31 passed**, reproducibly. The substantive figure is **30 / 31**: one test
passes *vacuously* because it runs before the lane has hydrated — see
*"The hydration window cuts both ways"* below. The one real failure is the
`1ch`-vs-tabular-digit defect, and it is not caused by React.

---

### F-NEW · The `<output>` **is** a live region in the accessibility tree, and the test that forbids it cannot see that

**Surface:** `RangeScale.md` → *the readout is an `<output>` and never a live
region*; `RangeScale.e2e.test.js` → same title.

This is the contract's single most emphatic accessibility rule, repeated in four
places: *"NEVER `aria-live`: the slider already announces on every change, so a
live region would say the value twice."* The spec guards it with two DOM
assertions:

```js
await expect(out).not.toHaveAttribute('aria-live')
await expect(out).not.toHaveAttribute('role')
```

Both pass. The port emits neither attribute. Measured through CDP's real
accessibility tree (`web/tasks/probes/rangescale-a11ytree.mjs`), the node is:

| node | role | live | atomic | relevant |
|---|---|---|---|---|
| `output.value` | **`status`** | **`polite`** | `true` | `additions text` |
| `input.RangeField` | `slider` | — | — | valuetext `"50 %"` |

`<output>`'s *implicit* ARIA role is `status`, and `status` carries an implicit
`aria-live="polite"` (HTML-AAM / ARIA 1.2). So the element is a polite live
region by virtue of being an `<output>` at all — no author attribute required —
and the component then rewrites its text content on **every** `input` event.
That is precisely the double announcement the rule exists to prevent: the slider
announces "51 %", and the status region announces "51 %" after it.

The two guarding assertions are written against the DOM and the defect lives in
the mapping, so no amount of attribute checking can catch it. Nothing in axe
covers it either (there is no rule for "a live region that duplicates a
control's own announcement").

This is inherited from the reference, not introduced by the port: same markup,
same JS, same mapping. Verified in Chromium 1280×900, `data-appearance` unset.

**Decision:** leave the markup exactly as the contract specifies — `<output
class="value" for="…">` with no `role` and no `aria-live`. Changing it is a
contract change, not a port decision, and the fix is not obvious: `role="none"`
on the `<output>` would silence the live region but also discard the element's
`status` semantics, while wrapping the digits in `aria-hidden` would remove the
readout from the tree entirely (arguably correct — the slider already carries the
value — but it contradicts the value-bubble recipe's explicit *"it is not
`aria-hidden`, and it should not be"*).

**Open question / upstream suggestion:** the rule needs one of two things —
either `role="presentation"` (or `aria-hidden`) on the readout, with the
reasoning written down, or the assertion re-pointed at the accessibility tree
rather than the attributes, e.g.

```js
const ax = await page.accessibility.snapshot({ root: out })
expect(ax.role).not.toBe('status')
```

As written, the suite certifies the opposite of what the contract promises. This
is the most consequential finding of this port, because it fails **silently and
only under a screenreader**, which is the exact class of failure ADR-0024 says a
reference library exists to remove.

---

### F-NEW · Tick marks and labels: what actually reaches the accessibility tree

**Surface:** ADR-0022 → *tick marks are decoration* / *the visible scale is the
source of truth*; `RangeScale.md` → *the stops are `aria-hidden`, and that is not
a compromise*.

Measured, not reasoned (`rangescale-ticks-ax.mjs`, `rangescale-a11ytree.mjs`,
Chromium, both appearances):

**1. The stops are genuinely out of the tree, and only once.**

| node | AX result |
|---|---|
| `.ticks` | ignored — `ariaHiddenElement` |
| `.ticks > i` | ignored — `ariaHiddenSubtree` |
| `.ticks > i > span` (the label word) | ignored — `ariaHiddenSubtree` |

So a screenreader reading the slider hears the label, the role, the value and
`aria-valuetext` — and nothing about the five drawn stops. Both `marks` and
`labels` behave identically here, because the text is in the markup either way.

**2. Both channels agree for free, exactly as claimed.** `data-ticks="labels"`,
`step="25"`:

```
drawn stops : ["0","25","50","75","100"]
keyboard    : ["0","25","50","75","100"]   (Home, then ArrowRight ×4)
agree       : true
```

The claim that `step` alone carries the stops to the keyboard, so marks need no
ARIA, holds under measurement.

**3. The labels have every property CSS `content` would deny them.** The words
are real text nodes, so they are selectable (`Range.toString()` →
`"0255075100"`), readable by JS (`["0","25","50","75","100"]`), and present in
the translatable DOM — and they stay there under `data-ticks="marks"`, where CSS
only sets `display: none` on the child span. The "same markup, one attribute
apart" design is what makes that true, and it is a genuine win: a port has one
place to translate and one place to test.

**4. The author-set `aria-valuetext` on a native range arrives intact.** ADR-0023
flags `aria-valuemin`/`aria-valuemax` as the pair browsers may refuse on a form
control; `aria-valuetext` is the hedge. Verified in the tree for all 34 sliders
on the page — every one reports the author's string, with `valuemin`/`valuemax`
derived from the attributes as expected. Stepping the live lane:

```
ArrowRight  visible="1 %"   attr="1 %"   tree="1 %"    agree
ArrowRight  visible="2 %"   attr="2 %"   tree="2 %"    agree
PageUp      visible="12 %"  attr="12 %"  tree="12 %"   agree
End         visible="100 %" attr="100 %" tree="100 %"  agree
```

**5. And there is one state where the two channels *do* disagree — in the
reference's own kitchensink.** The `no-output` variant authors
`aria-valuetext="50 %"` on a field with no readout, and the contract forbids the
lane from touching it ("an authored `aria-valuetext` on a field with no readout
belongs to the host"). Press ArrowRight once:

```
value      = 51
--_rs-p    = 0.51          ← the fill moved
aria-valuetext = "50 %"    ← frozen
AX tree: {role: slider, valuenow: 51, valuetext: "50 %"}
```

The eye sees the thumb at 51 and the screenreader says "50 %", *forever*. This is
structurally the same channel split ADR-0024 warns about for word scales ("the
eye would read 'Mid' while the screenreader says '2'"), reached by a different
route: a *static* `aria-valuetext` on a control whose value moves. `valuetext`
overrides `valuenow` for announcement, so the correct number is present in the
tree and unreachable.

**Decision:** keep the mirroring rule as specified — the port only writes
`aria-valuetext` when it owns a readout — and keep the variant, because it is the
state that demonstrates the hazard. But render the honest form: the port's
`valueText` prop is documented as *static, host-owned*, and the kitchensink cell
carries the reference's own authored value.

**Upstream suggestion:** the contract should say that a *static* `aria-valuetext`
on a range is only safe when the mapping value→text is constant (a unit suffix
that the host also re-derives, or a read-only control). `_no-output.hbs` as
shipped is a demonstration of the bug, not of the feature, and a porter copying
it ships a permanently wrong announcement. Either drop `aria-valuetext` from that
state (the number is the meaning; `valuenow` alone is correct) or give it a
readout.

---

### F-NEW · `1ch` is not a tabular digit — the readout's width reservation does not survive the typeface substitution

**Surface:** `RangeScale.css` → `.value .digits { min-inline-size: calc(var(--_rs-value-digits, 0) * 1ch) }`;
the spec's last test, *crossing a digit boundary does not resize the lane*. **This
is the one failing assertion.**

The reservation exists to stop a value crossing into another digit from widening
the readout, which widens the lane, which recomputes every position and makes the
thumb jump mid-drag. It assumes `1ch` equals the width of one rendered digit,
which is true only if the font's *default* `0` advance equals its *tabular* `0`
advance. Measured in Inter (`rangescale-debug.mjs`, `max="1000"`, so 4 digits):

| measurement | width |
|---|---|
| `4ch` (what the CSS reserves) | **40.375 px** |
| `"0000"`, `font-variant-numeric: normal` | 40.375 px |
| `"0000"`, `font-variant-numeric: tabular-nums` | **41.5 px** |
| `"1000"`, `tabular-nums` (what is actually painted) | **41.5 px** |

| value | `.digits` width | `output` width |
|---|---|---|
| 0 | 40.375 | 64.72 |
| 400 | 40.375 | 64.72 |
| 990 | 40.375 | 64.72 |
| **1000** | **41.5** | **65.84** |

So the readout is pinned at the reservation for every value except the widest
one, and grows by 1.125 px exactly at `max` — the defect the reservation was
written to remove, reintroduced at the one value it most needed to cover. The
spec rounds and asserts a single unique readout width; it sees `65, 66`.

Root cause: `.value` sets `font-variant-numeric: tabular-nums` and `.digits`
inherits it, but Chromium resolves the `ch` unit from the font's default `0`
glyph and does **not** apply `font-variant-numeric` when doing so. Inter's
default figures are proportional (`"1000"` proportional measures 36.80 px), its
`tnum` figures are 1.125 px/4 wider per digit, and `ch` follows the former.

This is the exact counterpart to **F-013**: `AffixField`'s `1.125ch` calibration
*did* survive the typeface change, and this one does not. The difference is
instructive — F-013's `ch` is a soft reservation for *padding*, where being a
quarter-pixel out is invisible; this one is a hard equality between a unit and a
rendered glyph advance, and a quarter of a pixel per digit is enough to break it.

**Decision:** leave it. Phase A forbids editing the copied CSS, the port cannot
reach the number from the React side (`--_rs-value-digits` is `4`, which is
correct), and lowering the assertion is not available. Recorded as a real gap,
not a non-portable assertion — a real user at `max` sees a real 1 px jump.

**Open question for Phase B.** Three candidate fixes, none free:

1. `min-inline-size: calc(var(--_rs-value-digits) * 1ch + 1px)` — a fudge
   proportional to nothing, and it over-reserves in a font where `ch` is right.
2. Drop `tabular-nums` from `.value` so the painted digits and `ch` agree. Worse:
   proportional `1` is much narrower than `0`, so `1000` and `8888` differ and
   the readout jitters between *every* value rather than only at `max`.
3. Give the design system a typeface whose default figures are tabular, or set
   `font-feature-settings` at the root so `ch` and the text resolve identically.
   This is the only fix that is not a fudge, and it is a design-system change,
   which is not mine.

**Upstream suggestion:** the contract states the reservation as "exactly a digit's
width under `tabular-nums`". That is a claim about the font, not about CSS —
`ch` is specified as the advance of `0` and browsers do not apply numeric
variants to it. Worth either stating the font requirement in the CSS Variable API
table next to `--_rs-value-digits`, or reserving with an explicitly measured
`--_rs-digit-width` token.

---

### F-NEW · The reference layer's neutral ink is appearance-*invariant*, and it does not read against the fill it is drawn on

**Surface:** `RangeScale.css` → `--_rs-ref-ink: color-mix(in oklab, CanvasText 45%, Canvas)`.

The CSS comment states the design intent precisely: *"The neutral ink is a MID
tone, not CanvasText: the fill is currentColor, so a full-strength reference
layer drawn on it is black on black — invisible. Without a variant the layer has
no colour of its own, so it has to read against both the fill and the empty
track."*

Measured in both appearances (`rangescale-colours.mjs`; every colour rasterised
through a 2D canvas because Chromium reports `color-mix()` as `oklab(...)`, which
a naive rgb parser silently mangles into near-black):

| | light | dark |
|---|---|---|
| computed `--_rs-ref-ink` | `oklab(0.549997 …)` → **#717171** | `oklab(0.550209 …)` → **#717171** |
| vs card | 4.88:1 | 3.23:1 |
| **vs the fill it is drawn over** | **1.46:1** | **2.43:1** |

Two separate results:

1. **It does not follow the appearance flip — it cannot.** `Canvas`/`CanvasText`
   *do* flip here (verified: `#fff`/`#000` light, `#121212`/`#fff` dark, driven by
   the `color-scheme` rules in `ui-tokens.css`), but 45 % of black over white and
   45 % of white over near-black both land on lightness 0.55. The mix ratio makes
   the result *invariant* to a factor of 0.0002 in oklab L. That is not a bug on
   its own — an appearance-invariant mid grey is a defensible choice — but it is
   a colour that reaches the page **without passing through the `--ui-*` seam**,
   so replacing the namespace (ADR-0018's whole promise) does not move it. Same
   family as `ChoiceField`'s `--_cf-selected: CanvasText`, `Notice`'s `CanvasText`
   body text and `ScrollArea`'s `oklch()` literals.

2. **Its stated job fails on our palette.** A `region` sits at `z-index: -1`, the
   fill at `-2`, so the region is drawn *over* the fill for its whole overlap —
   which for `_ref-region` (region 0→0.2, value 0.5) is all of it. #717171 on the
   light fill #5a5852 measures **1.46:1**. The "already used: 20 GB" band is
   effectively invisible in the state the demo ships. Dark is better at 2.43:1
   and still under the 3:1 floor WCAG 1.4.11 sets for a graphical object that
   conveys information.

Nothing structural catches this: axe reports **zero** WCAG 2 AA violations over
`#RangeScale` in both appearances, because there is no rule for two adjacent
non-text graphics. The suite's own guard is `expect(region.ink).not.toBe(region.fillInk)`
— inequality, not contrast — so it passes at 1.46:1 as happily as at 10:1.

**Decision:** verbatim in Phase A. The mitigation the contract already requires
is present and correct — the hint text says what the zone *means* and the swatch
matches the ink byte-for-byte in both appearances (verified) — so WCAG 1.4.1 is
satisfied by words even where the layer is hard to see.

**Open question:** `--_rs-ref-ink`'s neutral default should come from the seam,
not from system colours — `var(--ui-muted-foreground)` would be #5a5852 light /
#b9b7af dark here, which is the same colour as the fill and therefore also wrong.
What the role actually needs is a token whose contrast is defined *against
`--ui-foreground`*, which the seam does not have. Propose `--ui-graphic-on-ink`
(or that the neutral region simply require a variant). This is a genuine gap in
the `--ui-*` namespace rather than a mapping mistake, so it wants the project
owner's call.

---

### F-NEW · Tick marks fall below 3:1 in both appearances, and `data-ticks="marks"` is the state where that matters

**Surface:** `RangeScale.css` → `--_rs-tick-color: color-mix(in oklab, currentColor 45%, transparent)`.

| | light (card #ffffff) | dark (card #232320) |
|---|---|---|
| tick mark | #b5b4b1 — **2.07:1** | #666660 — **2.73:1** |
| tick label | #5a5852 — 7.11:1 | #b9b7af — 7.84:1 |
| empty track | #dededc — 1.35:1 | #41413c — 1.54:1 |
| fill vs track (the value cue) | **5.28:1** | **5.11:1** |

The label is fine and the value cue is comfortably above 3:1 in both appearances
— that is the positive half. The mark is not, and unlike the track it is not
merely a surface: with `data-ticks="marks"` the label is `display: none`, so the
1 px mark is the **only** carrier of "there is a stop here". At 2.07:1 in light
it is below the 1.4.11 floor for a graphical object that conveys information.

This one *does* follow the appearance flip (it rides `currentColor`, so the
`--ui-*` seam reaches it) — the mix ratio is simply too weak on our palette,
where the design system's body ink is a warm mid-grey rather than black.

Same structural blind spot as the reference layer: axe cannot see it. The spec
asserts the mark's *geometry* (6 px long, −12 px offset — both exact in the port)
and never its contrast.

**Decision:** verbatim in Phase A. For Phase B, `--_rs-tick-color` at 45 % of a
7:1 ink is the wrong parameterisation — the token wants a contrast target, not a
mix percentage. `color-mix(… currentColor 70%, transparent)` measures **3.46:1** light
/ **4.56:1** dark on this palette (measured); that is a one-token change in the component and it
is the kind of value the `--ui-*` seam should be supplying.

---

### F-NEW · `<input type="range">` is the controlled-input trap **twice**, and the second half is React's event dedup

**Surface:** `RangeScale.tsx`.

The first half is the documented one: `value={n}` without `onChange` freezes a
native range, arrows and Home/End included, while `role="slider"` keeps reporting
perfectly — an apparent native-semantics defect. `defaultValue` avoids it, as
`RangeField` already records.

The second half is specific to this tier and cost the most thought. Seven of the
spec's assertions drive the component with:

```js
f.value = '100'
f.dispatchEvent(new Event('input', { bubbles: true }))
```

React installs its own `value` property descriptor on every input it renders and
suppresses the synthetic change event when its tracked value already equals
`node.value`. A direct `f.value = …` assignment goes *through* that setter, so by
the time the `input` event arrives React considers nothing to have changed and
**`onChange` never fires**. A port built on `onChange` would pass the keyboard
tests (real key events change the value through the UA, not through the setter)
and fail the seven programmatic ones — with the value visibly correct in the DOM
and the fill visibly stale, which reads as "the sync is broken" rather than "the
event was swallowed".

A plain `addEventListener('input', sync)` on the DOM node sits outside React's
event system and receives every one of them, synthesised included. So the port
uses one native listener per field and writes `--_rs-p`, the `.digits` text and
`aria-valuetext` imperatively — the same three writes the reference makes.

Verified after the change (`rangescale-spec-mirror.mjs`): `ArrowRight`,
`ArrowUp`, `Home`, `End`, `PageUp` and `PageDown` all step the value, and
`aria-valuetext` follows each one into the accessibility tree (table in the ticks
finding above). `PageUp` from 2 → 12, i.e. the UA's 10-step page, untouched.

**Decision:** uncontrolled input + native listener + imperative writes. React
still owns the **first paint**, which is strictly better than the reference: the
server HTML already carries the finished end state —

```html
<div class="RangeScale" data-id="rangescale-live" style="--_rs-p:0.5;--_rs-value-digits:3">
  … <input … aria-valuetext="50 %"> <output class="value" for="rs-live"
  data-suffix="%"><span class="digits">50</span> %</output>
```

— so the lane, the readout and the announced value are correct before a byte of
JS runs, where `attach()` has to do a first pass to get there. `sync()` on mount
is then not a gap-fill but only a guard against a browser restoring a different
value on reload.

This extends the ScrollArea finding (*the reference's "one source of truth" model
forces a deliberate split between React state and imperative DOM writes*) with a
sharper reason: here the split is not a preference, it is **forced by the spec's
own API surface**. `lane.__rangeScaleInstance.sync()` is read on the very next
line:

```js
lane.__rangeScaleInstance.sync()
const synced = getComputedStyle(lane).getPropertyValue('--_rs-p').trim()
```

React state cannot satisfy that — a `setState` inside an imperative handle does
not paint before the next statement, and `flushSync` inside a
`getComputedStyle`-adjacent read is exactly the pattern React 19 warns about. A
`useState`-driven `--_rs-p` fails this test *by design*, and no amount of
idiomatic React fixes it. So the reference's imperative shape is not laziness
here; it is the only shape that satisfies the published contract.

---

### F-NEW · Positive: the vertical recipe reaches the accessibility tree as `orientation: vertical` with no ARIA at all

**Surface:** `RangeScale[data-orientation="vertical"]`, `RangeField`'s
`writing-mode: vertical-rl; direction: rtl`.

ADR-0023 rules out rotation because "rotation does not remap the arrow keys".
Measured in the AX tree, `writing-mode` buys more than the keys — all three
vertical lanes report:

```json
{"name":"Volume (vertical)","valuenow":50,"orientation":"vertical", … }
```

No `aria-orientation` is authored anywhere in either component. The UA derives
the orientation from the used writing-mode and publishes it. A `role="slider"`
div implementation would have to author `aria-orientation` and keep it in step
with a CSS property — a second source of truth for exactly the fact ADR-0023
says must have one.

Also measured and correct in the port: the lane owns the length (field height
192 px = lane height 12 em, `.RangeField`'s own `height: 12em` overridden by the
higher-specificity lane rule), and the fill anchors in the same end as the
slider's min for both `data-min` values.

---

### F-NEW · RangeScale cannot be ported without RangeField's stylesheet, and the composition seam has to be made explicit

**Surface:** `RangeScale.tsx` → `import "../RangeField/RangeField.css"`.

ADR-0023 says RangeScale composes a RangeField, and the spec measures the
consequence: three of its assertions read
`getComputedStyle(lane.querySelector('.RangeField')).blockSize` as **the thumb
size**, and compare the fill's shortfall against half of it. That number is
`max(--_rf-thumb, 24px)` = 24 px, and it comes from `RangeField.css`, not from
this component. `expect(m.field.w).toBeCloseTo(m.track.w)` likewise depends on
`RangeField`'s `inline-size: 100%`.

In the reference all stylesheets are concatenated into one site bundle, so the
dependency is invisible. In a component-scoped bundler it is not: the isolated
route `/kitchen-sink/rangescale` renders no RangeField section, so without the
explicit import the input is a bare UA range, the thumb is ~16 px, and every
geometry assertion is off by 4 px — a *plausible* wrong number, which is the
worst kind.

Two smaller consequences worth recording:

- The port renders the `<input class="RangeField">` **inline** rather than
  composing `RangeField.tsx`, for two reasons: that component emits
  `<label>` + `<input>` as one fragment and RangeScale needs the label *outside*
  the lane, and it emits `data-component="RangeField"`, which the reference's own
  RangeScale states deliberately do not carry.
- Specificity works out with no ordering dependency:
  `.RangeScale[data-orientation="vertical"] .RangeField` (0,3,0) beats
  `.RangeField[data-orientation="vertical"]` (0,2,0), so the lane's
  `height: 100%` wins over the field's `height: 12em` regardless of which CSS
  file the bundler emits first. Verified — the field measures the lane's height.

**Decision:** import the sibling stylesheet from the component that composes it,
with a comment naming it as the composition seam. **Open question for the
orchestrator:** the same reasoning will apply to RangeGroup → RangeScale →
RangeField, so it may be cleaner to declare the range family's CSS once at the
route level. Left as-is because the family is being ported in parallel and a
shared file would be a write conflict.

---

### F-NEW · Positive: the four `--ui-*` reference variants and the swatch survive both appearances untouched

**Surface:** `data-reference-variant`, `.hint .swatch`.

The one thing in this component that the seam reaches cleanly, measured on the
card in both appearances:

| variant (the three the demo states use) | light | dark |
|---|---|---|
| `warning` → `--ui-warning` | #9d6d29 · 4.51:1 | #e0a94e · 7.47:1 |
| `success` → `--ui-success` | #1e8662 · 4.52:1 | #5fc79b · 7.60:1 |
| `info` → `--ui-info` | #5b6b7f · 5.45:1 | #9db3cc · 7.32:1 |

All three clear 3:1 against the card in both appearances with no tuning, the
three inks are mutually distinct (the spec asserts exactly that), and every one
resolves to a real `rgb()` rather than falling through to the literal fallback.
The swatch's computed background is **string-identical** to its layer's ink in
both appearances, in all four states the spec checks — which is the mechanism
that stops an author restating the variant and getting the two out of step.

One number qualifies the win: a *variant* band defaults to `z-index: 0`, i.e.
drawn on the fill, and warning-on-fill measures **1.58:1 light / 1.05:1 dark**.
Over the empty track it clears the floor — **3.35:1** light, **4.87:1** dark — so a
band that straddles the thumb is legible on one side of it and not the other. The contract's answer is the hint text, which is
present — but "colour-coded, drawn on the fill" is, on this palette, mostly a
hue difference at equal luminance. Same Phase-B conversation as the neutral ink.

---

### F-NEW · `RangeScale.css` needed zero exceptions — the first component in the set with no init gate to drop

**Surface:** `web/src/components/RangeScale/RangeScale.css`.

`diff` against the submodule is empty and there is nothing in the file to drop:
no `overflow: hidden` gate, no `[data-initialized="true"]` rule, no runtime-only
CSS of any kind. The component is progressive by construction — `--_rs-p` is
authored in the `style` attribute so first paint is correct, and the JS only
keeps it live — so there was never a reason to hide unstyled content.

Consequently the port also does **not** emit `data-initialized`. F-010's rule is
"drop the gated CSS, keep the attribute *because suites wait on it*"; nothing in
this spec or in `e2e-helpers/target.js` waits on it for RangeScale, and the
reference's own `RangeScale.ts` never sets it. Rendering it would be inventing
contract.

Related, and the reason the verbatim copy works at all: the stylesheet's longest
comment explains that `--_rs-pos` must be declared on the elements that *use*
`--p`, never on the root, because a custom property is substituted where it is
declared and the already-substituted result is what inherits. That is pure CSS
mechanics with no framework surface — it ported by copying, which is exactly what
Phase A is for. React contributed nothing to it and broke nothing in it.

---

### F-NEW · 71 px of WCAG 1.4.10 Reflow, and all of it was mine — the verbatim CSS reflows to 30 px

**Surface:** `RangeScale.kitchensink.tsx`; WCAG 1.4.10 Reflow (Level AA).

Handed back by the orchestrator after FileUpload bisected the shared page:
RangeScale owned **71 px of the 73 px** document overflow at 320 px on `/`.

**The bisection.** `reflow-locate.cjs` walks the sections and hides each in turn:

```
before:  RangeScale   without: 2px   contributes 71px      <- all but 2px of the page
         every other section          contributes 0px
         innermost offenders in #RangeScale:
           span.text-caption.text-body  w=288 right=329
           label                        w=288 right=329
           span.track                   w=288 right=329
           input.RangeField             w=288 right=329
```

Every offender measured exactly **288 px = 18 rem** — my `Slot` helper's
`style={{ inlineSize: "18rem" }}`. So the cause was a fixed demo width in *my*
kitchensink markup, not anything in the component.

**Proving the verbatim CSS is innocent** (`/tmp` probe, intrinsic sizing measured
by cloning each lane into a zero-width container):

| lane | `min-content` | `max-content` |
|---|---|---|
| `rangescale-live` | **30.28 px** | 129 px |
| `rangescale-ticks-labels` | **30.28 px** | 129 px |
| `rangescale-ref-with-ticks` | 80.59 px | 228.5 px |
| `rangescale-ref-band` (with hint) | 117.14 px | 243.38 px |
| `output.value` alone | 30.53 px | 55.08 px |

`RangeScale.css` reflows to 30 px. **None of the 71 px was inherited**, so there
is no Phase B fix to record for the copied stylesheet — a rare clean result for
this component.

Two sub-results worth keeping:

- **The tick row costs nothing**, because `.ticks > i` is `position: absolute`
  and contributes no intrinsic width. `rangescale-ticks-labels` has the same
  30.28 px min-content as a bare lane despite carrying five labels.
- **The JSX-whitespace trap did not bite, and the contract is why.** The readout
  min-content (30.53 px) is well under its max-content (55.08 px), i.e. it soft-
  wraps between the number and the unit. That break opportunity exists because
  the suite asserts `output.textContent === '50 %'` *with the space*, which
  forced me to write the suffix as an explicit `{" %"}` string rather than as an
  adjacent JSX child. The assertion that looks like a formatting nitpick is what
  kept the readout wrappable — the same DOM the Handlebars partial gets for free
  from its source line break.

**The fix.** `w-[18rem]` → `w-full max-w-[18rem]` (and `min-w-0`), because
`Cell`'s documented `w-[Nrem] max-w-full` pattern **does not work here**: `Cell`
renders *two* nested divs and only the outer one carries `min-w-0`. Measured
chain at 320 px before the fix:

```
div.grid.min-w-0.gap-xxs                 w=238   min-width: 0px     <- shrank
  div.grid.gap-xxs [&>label]…            w=288   min-width: auto    <- did not
    div.grid.min-w-0.max-w-full …        w=288   max-width: 100%    <- 100% of 288
      div.RangeScale                     w=288
```

`max-w-full` resolves against the inner Cell div, which is itself 288 px because
my fixed-width Slot sized its auto grid track. `w-full` removes the demand
entirely, the track collapses to the available width, and everything follows.

**Verified after the fix** (`tasks/probes/rangescale-reflow-check.mjs`):

| viewport | `/` document | RangeScale contributes | overflowing nodes in `#RangeScale` | isolated route |
|---|---|---|---|---|
| 320 px | 2 px | **0 px** | **0** | **0 px** |
| 360 px | 0 px | 0 px | 0 | 0 px |
| 480 px | 0 px | 0 px | 0 | 0 px |
| 768 px | 0 px | 0 px | 0 | 0 px |

The residual 2 px on `/` at 320 px is FileUpload's (`li.item`, `span.label`),
confirmed by `reflow-locate.cjs`.

**No test in the reference suite could have caught this, and that is the point.**
Three independent reasons, all structural:

1. **The suite never resizes.** `playwright.config.ts` uses
   `devices['Desktop Chrome']` — 1280×720 — and not one of RangeScale's 31 tests
   calls `setViewportSize`. Reflow is a *narrow-viewport* criterion, so a suite
   pinned to one wide viewport cannot express it.
2. **axe has no reflow rule at all.** Both of my axe runs — light and dark, over
   `#RangeScale` — reported **zero** WCAG 2 AA violations while the page was
   overflowing by 71 px. This is the third time in this port that a clean axe
   result coexisted with a real Level AA failure (the others being the reference
   layer at 1.46:1 and the tick marks at 2.07:1), and the second time the
   mechanism was "axe has no rule for this criterion" rather than "axe measured
   it wrong".
3. **It lives in the demo page, which no contract covers.** The offending width
   was in `RangeScale.kitchensink.tsx`, the file the reference expresses as
   Handlebars partials inside `<td>` cells. A component contract cannot assert
   anything about it — the same blind spot F-014 found for
   `.kitchensink-section`, now with a Level AA consequence instead of a null
   selector.

**Decision:** fixed in my own markup; nothing owed by the copied CSS.

**Upstream suggestion:** the conformance suite would gain a great deal from one
project-level reflow test — `for (const w of [320, 480]) { setViewportSize; expect(scrollWidth).toBe(clientWidth) }`
— because it is three lines, it is Level AA, and neither the component specs nor
axe can see it. The demo-page markup being outside the contract is exactly why it
has to be a page-level test rather than a per-component one.

---

### F-NEW · The hydration window cuts both ways: it failed one assertion and silently *passed* another

**Surface:** `RangeScale.e2e.test.js` → *sync() is public* and *crossing a digit
boundary does not resize the lane*; `RangeScale.tsx` → `attach()`.

The reference mounts from `RangeScale.attach(parent?)`, called by a parse-time
`<script type="module">`. Module scripts are deferred but run **before**
`DOMContentLoaded`, so the public API exists before the `load` event — which is
what `page.goto()` resolves on. React does not have that guarantee. Measured
(`tasks/probes/rangescale-hydration-race.mjs`, 5 runs each):

| page | lane in DOM | instance attached | gap |
|---|---|---|---|
| dev, aggregate `/` | 144–171 ms | 338–364 ms | **185–200 ms** |
| dev, isolated route | 32–51 ms | 142–158 ms | 105–113 ms |
| **production build**, aggregate `/` | 26–50 ms | 93–109 ms | **46–67 ms** |

And the `load` event lands *inside* that gap in both dev and prod
(prod: load 75–93 ms, attached 97–109 ms), so `attachedByLoadEvent` is `false`
everywhere. A production build narrows the window but **does not close it** —
unlike the ScrollArea precedent, where prod closed it to a frame.

**Direction 1 — it failed `sync() is public`.** That test reads
`lane.__rangeScaleInstance.sync()` in the first `page.evaluate` after `goto`, and
got `TypeError: Cannot read properties of undefined (reading 'sync')` — 30/31,
three runs in a row.

**The fix, and it is a port of the contract rather than a workaround.** The
`## JavaScript API` table documents `RangeScale.attach(parent?)` as the mount
entry point, so I ported it as a module-level function with the reference's own
idempotence guard (`if (root.__rangeScaleInstance) return`) and call it once at
client-module evaluation, keeping `useEffect` only as the mount hook for lanes
React creates later plus teardown. Both paths run the same `mount()`; the guard
makes the second a no-op.

Clean counterfactual, same command, three runs each:

| attach strategy | result |
|---|---|
| `useEffect` only | **30 passed / 1 failed** ×3 |
| module-level `attach()` + idempotent effect | **31 passed** ×3 |

Worth being precise about *why* it now passes, because it is not because the API
arrives before `load` (`tasks/probes/rangescale-attach-timing.mjs`, 12 runs):

```
aggregate /   API present when the spec evaluates: 12/12   [-S ×12]   (absent at load, present after)
isolated      API present when the spec evaluates: 12/12   [LS ×12]   (present at load)
```

On `/` the API is still absent at `load` and arrives during the single
`scrollIntoViewIfNeeded()` round trip the spec happens to perform first — which
waits for two stable animation frames. So the assertion is satisfied by an
actionability wait that the test did not write for that purpose. Honest reading:
the module-level attach removed a ~100 ms deficit and made the margin
comfortable, but the test remains structurally racy against any SSR framework
whose hydration lands after `load`.

**Direction 2 — and this is the alarming half — the same window makes a *failing*
assertion pass.** *Crossing a digit boundary does not resize the lane* runs
straight after `goto` with **no** actionability round trip, so on the aggregate
page it executes before the lane has attached. It sets `field.value` and
dispatches `input`; with no listener attached, nothing rewrites the readout, so
the width it measures cannot change, and the test passes.
`tasks/probes/rangescale-digit-honesty.mjs` replicates it exactly and adds the
one thing the spec does not check — whether the readout text actually changed:

| page | gated on attach | hydrated | readout text across values 0 / 400 / 990 / 1000 | widths | spec verdict |
|---|---|---|---|---|---|
| aggregate `/` | no | **false** | `"400 tkr"` ×4 — never rewritten | 65 | **PASS** (vacuous) |
| aggregate `/` | yes | true | `"0 tkr"`, `"400 tkr"`, `"990 tkr"`, `"1000 tkr"` | 65, 66 | **FAIL** |
| isolated route | no | true | rewritten correctly | 65, 66 | FAIL |
| isolated route | yes | true | rewritten correctly | 65, 66 | FAIL |

So the reported **31/31 is 30 real passes plus one vacuous one**, and the
vacuous one is hiding the `1ch` defect below. The two directions share one root
cause and point opposite ways, which is the finding: on an SSR port, a green
result is not evidence unless the suite has a readiness gate. The reference
suite has none — `PORTING.md`'s *What the tests expect* names
`data-initialized="true"` as that gate, and RangeScale neither sets it nor waits
on it.

**Decision:** keep the module-level `attach()`. It is the contract's own
documented entry point, it is idempotent, it is measurably load-bearing, and it
does not change what the component renders.

**Upstream suggestion, and it is cheap:** every test in this spec that drives the
component through `f.dispatchEvent(new Event('input'))` should first wait for
mount — one line in `beforeEach`:

```js
await page.waitForFunction(() =>
  !!document.querySelector('[data-component="RangeScale"]').__rangeScaleInstance)
```

or, better, have the component emit `data-initialized="true"` on mount and wait
on that, which is what `PORTING.md` already tells porters the suite does. Without
it the suite cannot distinguish "the sync works" from "the sync never ran", and
it currently reports the second as the first.

---

### F-NEW · The `1ch` measurement re-verified after the px → rem/em token change: byte-for-byte identical

**Surface:** the `1ch` finding above; the design-token move from px to rem/em.

Re-measured on both `/` and the isolated route after the token scale changed
(`/tmp/digits2.mjs`). Every number is unchanged:

| | before | after |
|---|---|---|
| root font-size | 16 px | 16 px |
| `.digits` font-size | 16 px | 16 px |
| `min-inline-size` (`4ch`) | 40.375 px | **40.375 px** |
| `"0000"` proportional | 40.375 px | **40.375 px** |
| `"0000"` tabular | 41.5 px | **41.5 px** |
| `"1000"` tabular (painted) | 41.5 px | **41.5 px** |
| readout width, values 0/400/990 | 64.719 px | **64.719 px** |
| readout width, value 1000 | 65.844 px | **65.844 px** |

Identical on both pages. The finding holds exactly as written: `4ch` under-reserves
by 1.125 px because Chromium resolves `ch` from Inter's *proportional* `0` and
ignores `font-variant-numeric`, and the shortfall appears at `max` — the one value
the reservation most needed to cover.

The token change could not have moved it, and that is itself informative: `ch`
depends only on the font and the used `font-size`, and the rem/em move was
value-preserving at a 16 px root. The defect is a **typeface** property, not a
scale property — so it will not be fixed by any amount of token work, only by a
face whose default figures are tabular (or by not reserving in `ch`).
