# RangeField

**Phase A result: 21 / 21 green on the aggregate `/`.** The one failure recorded
below (F-NEW, the px type scale) was a design-system defect, not a component
defect; the orchestrator converted the scale to `rem` and the assertion went
green, so the finding is kept for the record with its measurement and its
resolution noted.

Both axe runs (`#RangeField`, light **and** dark) are clean.

---

### F-NEW · The design system pins `body { font-size: 16px }`, so nothing in the library follows the reader's text size

**Surface:** `web/src/styles/design-tokens.css` → `--text-body-md`, via
`web/src/app/globals.css`. Found by *"the whole control scales with the root font
size"* in `RangeField.e2e.test.js` — the only assertion in the port that fails.

`RangeField.css` is built entirely on `em`, and `font: inherit` on the input is
documented as **load-bearing** rather than tidiness: a form control does not
inherit the document font, so without that line `em` resolves against the UA's
~13px. The reference verified the fix by raising the root font size and watching
the control grow.

The port's `font: inherit` works perfectly. The chain breaks one level up.
Measured (`web/tasks/probes/rf-textscale.cjs`, Chromium):

| `html` font-size | computed `body` | computed input | `#rf-live` height |
|---|---|---|---|
| 16px | 16px | 16px | **24px** |
| 32px | 16px | 16px | **24px** |
| 32px + `body { font-size: 1rem }` | 32px | 32px | **48px** |

The cause is one absolute length: `--text-body-md: 16px`, applied as
`body { font-size: var(--text-body-md) }`. `html { font-size: 32px }` therefore
changes nothing downstream, so every `em` in the library resolves against a
constant, and the whole relative-unit model of the range family — thumb, track,
ring width, the 12em vertical lane — is inert. The third row proves the component
is correct and the token is not: with `1rem` the height doubles *exactly*
(24 → 48), which is what the spec asserts.

This is not RangeField-specific. **All 36 length tokens in `design-tokens.css`
are px**, so the whole type scale ignores a reader's browser default font size.
Page *zoom* still scales px (so WCAG 1.4.4 is not violated outright), but the
"minimum font size" / default-size preference — the setting a low-vision user
actually changes — is silently discarded. RangeField is simply the first ported
component whose contract tests for it.

**Decision (scope):** not patched here. `web/src/styles/**` was out of my scope,
and patching `RangeField.css` would have broken Phase A's byte-identity — the
component was already correct.

**RESOLVED by the owner:** the whole token scale was converted from px to `rem`
(and `letter-spacing` to `em`), which renders identically at the default 16px root
and only diverges when the reader has asked it to. Verified afterwards: doubling
the root doubles the control, `RangeField` is 21/21, and AffixField's box height
now tracks the root too. Recorded as the clearest instance so far of a component
contract catching a defect that spanned the entire port — a single px token had
made the library's whole relative-unit model inert, and nothing else had noticed.

---

### F-NEW · The contract's "no JavaScript — not 'none yet'" is enforceable in React, and the enforcement mechanism is `undefined`

**Surface:** `RangeField.tsx`, and two assertions in the spec.

RangeField is the second component in this port to ship as a **Server Component
with zero client JS** (after AffixField, F-015), but for a stronger reason.
AffixField's JS only computed attributes; here the contract argues *nothing could
ever need any*, and ADR-0023 records the relapse it is guarding against — an
earlier draft authored `--_rf-p` in the `style` attribute, which "renders
correctly on first paint and goes stale the instant anyone drags, so eighteen of
nineteen kitchensink examples read as broken".

The spec pins that down in a way that maps unusually well onto React:

```js
expect(await input.getAttribute('style')).toBeNull()   // before AND after End
```

Not "no `--_rf-p`" — **no `style` attribute at all**. React omits the attribute
entirely when `style` is `undefined`, so a single optional `styleOverrides` prop
satisfies both halves: absent on the live instance (no attribute), present on the
`resized` and `text-scaled` variants (which the reference also authors inline).
The same `undefined`-is-absence alignment noted in F-015 does the work again.

**Positive finding.** Zero bytes of JavaScript ship for RangeField, the
statelessness assertion passes for the right reason rather than by accident, and
the "authored position goes stale" trap is structurally unreachable — there is no
render-time value to author, because the browser owns the value.

---

### F-NEW · `value` without `onChange` is the worst possible failure mode here, and `defaultValue` is not a workaround but the contract

**Surface:** `RangeField.tsx`, the `input` element.

Recorded because the CLAUDE.md warning understates how misleading this is *for
this specific component*. A controlled `<input type="range" value={n}>` with no
`onChange`:

- still reports `role="slider"` — the spec's ARIA test passes;
- still receives ArrowLeft/Right/Up/Down, Home/End, PageUp/Down — the events fire;
- still has correct `aria-valuemin`/`max`/`now` in the accessibility tree;
- simply never changes value.

So the failure surfaces as *"arrow keys change the value by exactly one step"* and
*"Home and End reach min and max"* — i.e. as **native keyboard semantics being
broken**, on the one component whose entire thesis is that native carries the
behaviour. A porter's first instinct is to look at `appearance: none` (which the
contract itself warns "removes more than the look") and conclude the styling
destroyed the control. It did not; React froze it.

`defaultValue` is not a lesser choice here — RangeField has **no visible readout
to mirror into**, so there is nothing a controlled pair would buy. Mirroring a
word into `aria-valuetext` is RangeScale's job (ADR-0023: "RangeScale … mirrors
the visible words into the field's `aria-valuetext`"), which is why this tier's
`aria-valuetext` is a static authored string and passes as one.

Keyboard stepping verified in Chromium on the uncontrolled port: Arrow ×4, Home,
End, and PageUp/PageDown all move the value (PageUp/Down are not in the spec but
are in the porting brief's list; they work).

**Decision:** uncontrolled, permanently. Any future need for a visible readout
belongs to RangeScale, not to a controlled RangeField.

---

### F-NEW · Measured: the thumb and the focus ring clear 1.4.11 in both appearances; the **track** does not, and it is far worse in dark

**Surface:** `RangeField.css` → `--_rf-track-color`, `--_rf-thumb-color`,
`--_rf-thumb-ring`, `--_rf-thumb-outline`. Measured with
`web/tasks/probes/rf-colors.cjs`, Chromium, `#rf-live` on the kitchensink card
(`--color-surface-card`), both `data-appearance` halves.

| | light (card `#ffffff`) | dark (card `rgb(35,35,32)`) | 1.4.11 floor |
|---|---|---|---|
| thumb (`currentColor`) vs card | **7.11:1** | **7.84:1** | 3:1 ✓ |
| focus ring (`currentColor`) vs card | **7.11:1** | **7.84:1** | 3:1 ✓ |
| thumb ring (`Canvas`) vs thumb | 7.11:1 | 9.33:1 | ✓ |
| thumb vs track | 4.43:1 | 8.50:1 | ✓ |
| **track vs card** | **1.61:1** | **1.08:1** | 3:1 ✗ |
| invalid thumb (`--ui-destructive`) vs card | 5.04:1 | 6.58:1 | ✓ |
| invalid track vs card | 2.11:1 | 1.12:1 | ✗ |

Two things worth separating.

**Positive, and contrary to the ScrollArea precedent.** The CLAUDE.md warning
told me to expect hardcoded literals in a range track that "cannot follow the
appearance flip". RangeField has none. Its two non-`--ui-*` values are the
*system* keywords `Canvas` (thumb border) and `CanvasText`-free
`currentColor` — and because `ui-tokens.css` sets `color-scheme` and
`data-appearance` only switches that, both flip correctly:
`Canvas` resolves to `#ffffff` in light and `rgb(18,18,18)` in dark. This is the
ADR-0021 mechanism working exactly as advertised, and it is a *better* outcome
than a token would have given, because the ring's job ("so the handle reads
against the track") is defined relative to the *appearance*, not to our palette.
`--_rf-invalid-color` goes through `var(--ui-destructive)` and picks up our
`light-dark()` pair for free.

**The defect.** `--_rf-track-color: color-mix(in oklab, currentColor 20%,
transparent)` is a *relative* expression, which is why nothing flagged it — but
relative in oklab is not relative in luminance contrast. 20% of a dark ink over
white gives 1.61:1; 20% of a light ink over a near-black card gives **1.08:1**,
i.e. the unfilled track is essentially invisible in dark mode. The same
compression hits the invalid track (2.11 → 1.12), which means the invalid *skin*
is carried almost entirely by the thumb colour in dark.

Axe reports zero violations for `#RangeField` in both appearances, so this is
invisible to the exit criterion: 1.4.11 asks for 3:1 on "visual information
required to identify user interface components and states", and a strict reading
is satisfiable by the thumb alone (7.8:1) — the track is arguably the *extent*, not
the identification. That reading is defensible and also not much comfort to
someone who cannot see the lane.

**Decision (Phase A):** left verbatim. It is the reference's value, it is
expressed correctly as a relative mix, and changing it is a Phase B design move.

**Open question / Phase B proposal:** the fix is not a literal and not a `dark:`
variant — it is to stop mixing toward `transparent` and mix toward the *surface*,
e.g. `color-mix(in oklab, currentColor 35%, Canvas)`, or to route the track
through a `--ui-*` role with a `light-dark()` pair so the light and dark halves
can be sized independently. Worth raising upstream too: `currentColor N%` over an
unknown backdrop cannot hold a contrast floor in both appearances, and the
library uses that idiom in RangeField, RangeScale (`--_rs-track-color`,
`--_rs-tick-color`) and elsewhere.

---

### F-NEW · The reference's own `data-test-state` hook made the no-reflow assertion portable for free

**Surface:** *"grabbing the thumb grows it without reflowing the page"*.

Small positive. That test needs `:active` without a pointer, and it gets it
because the reference ships `data-test-state="active"` as a documented
kitchensink-only attribute that CSS projects onto the same custom property as the
real pseudo-class (`--_rf-thumb-scale: 1.1`). In React this is one optional prop,
and the assertion — thumb grows, `--_rf-thumb` unchanged, element height, top and
`document.scrollHeight` all unchanged — passes untouched.

Worth naming because the *pattern* is the transferable bit: every state in this
component is a custom property **on the element** rather than a declaration on a
vendor pseudo-element, which is what makes both the focus ring and the active
scale assertable at all (Chrome exposes no computed style for
`::-webkit-slider-thumb`). Four state rules instead of eight, and a test suite
that does not need screenshots. Of the components ported so far this is the
cleanest example of a styling decision that paid for itself in testability.
