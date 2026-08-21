# RangeGroup

**Phase A result: 19 / 19 green on the aggregate `/`**, twice consecutively,
including the axe run over `#RangeGroup`. The isolated probe
(`web/tasks/probes/rangegroup-contract.cjs`) is 57 / 57 in both appearances.

It did **not** start there: the first run on `/` was 11 / 19 while the isolated
route was already 19 / 19. The cause was neither a regression nor a
cross-component collision — it was an init-timing assumption the spec inherits
from the reference's deferred module script, which Next.js's `async` chunks
cannot satisfy. Diagnosis, measurements and fix are the last-but-one finding
below; it is the most portable lesson in this pair.

---

### F-NEW · A React component owns its children, so "the lane knows nothing about whether it holds one field or two" does not survive the port

**Surface:** `RangeGroup.tsx`, `web/src/components/RangeScale/RangeScale.tsx`.
**This is the most interesting structural finding of the pair.**

ADR-0023 splits the family three ways and gives the middle tier this property:

> **RangeScale** owns the lane … *knows nothing about* whether it holds one field
> or two.

In the reference that is true and free, because **the lane is authored markup**.
`RangeScale.ts` does not render anything — it scans for
`[data-component="RangeScale"]` and attaches behaviour, and its `sync()` already
branches on `positions.length > 1` to publish `--_rs-a` / `--_rs-b`. RangeGroup's
own `.hbs` partials hand-write the `.RangeScale` div, the `.track` and the
`.fill`. One lane implementation, two arities, zero coupling.

The React port cannot have that. The sibling `RangeScale.tsx` (correctly, and
idiomatically) *renders* its subtree, and its signature is singular by
construction — `{ id, label, name, defaultValue, suffix, valueText }`, one
`<input>`, one `<output>`, one `<label>`. There is no `children`, and there could
not easily be one: the lane is a CSS grid of stacked layers in a fixed order, and
a `children` slot would hand that ordering to the caller. So a pair cannot be
composed through it, even though the *stylesheet* it ships supports pairs fully
(`.RangeScale[data-fields="2"] .fill`, `… .RangeField { pointer-events: none }`).

**Decision:** RangeGroup writes the lane markup itself — the same markup the
reference's own partials write, verbatim in structure — and imports
`../RangeScale/RangeScale.css` and `../RangeField/RangeField.css` as the
composition seam. The CSS is where the lane's knowledge actually lives, and it is
read, never edited. The DOM the suite measures (`.track`, `.fill`, `--_rs-a`,
`--_rs-b`, the fill geometry) is byte-for-byte the reference's.

The residue is one duplicated function: publishing the two sorted positions onto
the lane, plus installing `lane.__rangeScaleInstance = { sync }`, which the suite
calls directly. About 10 lines. In the reference those 10 lines are RangeScale's;
here they are RangeGroup's, because a DOM-scanning `attach()` has no React
equivalent that reaches into a subtree it does not own.

**Open question:** should `RangeScale.tsx` grow a `children` (or `fields`) prop so
the lane is composable at *both* arities, matching the ADR? It would restore the
architecture at the cost of letting a caller mis-order the grid layers. My
inclination is no — the duplication is small, honest and local, and see the next
finding — but the ADR's claim should then be qualified for framework ports:
*"knows nothing about arity"* is a property of authored markup, not of the
component.

---

### F-NEW · ADR-0004's anti-DRY stance was the reason porting two siblings back to back was cheap

**Surface:** porting RangeField and RangeGroup in sequence. Requested explicitly
by the brief, and the answer came out the opposite way round from what I expected.

I expected the library's "clarity over DRY" position to cost me duplicated work
across three closely-related components. It did the reverse, in three concrete
ways:

1. **The three tiers do not share code, so they do not share failure.** RangeField
   ported to a Server Component with *zero* client JS and went green before I had
   read a line of RangeGroup. Nothing about the pair, the clamping, the pointer
   arbitration or the readout could regress it, because there is no shared module
   to regress. A single array-valued `<Slider values={[a,b]}>` — which is what MUI,
   Radix, Base UI, shadcn, React Aria, Ark and Chakra v3 all ship — would have made
   the trivial case depend on the two-thumb case's state machine, and would have
   made "no JavaScript" impossible for the trivial case.
2. **The overlap that *did* exist was in CSS, and CSS composes without a build
   step.** RangeGroup needed the lane's geometry and the two-field pointer rule;
   three `@import`-equivalent lines got them. No prop threading, no context, no
   generic.
3. **Each `.md` is self-contained and repeats itself deliberately.** The
   `--_rf-thumb` geometry argument (`thumb/2 + p × (100% − thumb)`, "off by up to
   half a thumb, and the error changes sign") appears in ADR-0023, in
   `RangeField.md` and in `RangeField.css`'s header. Reading three overlapping
   explanations of the same constant is exactly what made it safe to render the
   lane markup by hand: I already knew which numbers were load-bearing.

Where it hurt: the duplication in finding #1 above is a *direct* consequence —
because there is no shared value↔position primitive, the conversion exists twice
in `web/src/components/` (once in `RangeScale.tsx`, once in `RangeGroup.tsx`). The
ADR anticipates this and names the trigger: *"promote a `range-scale` primitive
only if a third component needs the same value↔position conversion"*. That
threshold is now **met** — RangeScale and RangeGroup both need it, and a fourth
consumer would be the third instance.

**Decision:** leave it duplicated for Phase A; the two copies are 4 lines each and
disagreeing about them would be immediately visible in the fill geometry. Flag the
kernel-promotion threshold as reached so the owner can decide.

---

### F-NEW · React's synthetic `onChange` is deduplicated, and seven of this spec's assertions drive the component through exactly the sequence it swallows

**Surface:** `RangeGroup.tsx` → the `useEffect` listeners.

Independently rediscovered here after the RangeScale port hit it (its header
records the same thing), which makes it a family-wide trap rather than a
one-component quirk — worth stating with this spec's evidence because the failure
is *silent*.

React installs its own `value` property descriptor on every `<input>` it renders
and suppresses `onChange` when its tracked value already equals `node.value`. The
spec drives the component like this, in two separate tests:

```js
upper.value = String(v)
upper.dispatchEvent(new Event('input', { bubbles: true }))
```

That is precisely the sequence the descriptor eats. With `onInput`/`onChange`
props the *clamping never runs*, the readouts never update, and the
digit-boundary test then reports **width instability** — a layout bug — when the
actual cause is an event React decided was redundant. Two indirections between
symptom and cause.

A plain `addEventListener('input', …)` on the DOM node sits outside React's
synthetic event system and sees every one of them, synthesised included. That is
what the port uses, and it is also what makes the reference's imperative
`setAttribute` calls the *right* translation rather than a shortcut: `sync()` has
to be synchronous because the suite reads `getComputedStyle` on the next line, so
React state is ruled out anyway.

**Decision:** native listeners, imperative writes, uncontrolled inputs — for all
three of the reference's own reasons plus this one. React still owns first paint:
`--_rs-a`, `--_rs-b`, `--_rs-p`, `--_rg-readout-digits` and both readouts are
server-rendered from props, so the lane is correct before hydration. The
reference has to do that pass inside `attach()`; here it is free.

---

### F-NEW · `aria-valuemin`/`max` are server-rendered here, and the contract's reason for forbidding that does not apply to React

**Surface:** `RangeGroup.md` → *Contract rules*, vs `RangeGroup.tsx`.

The contract is explicit:

> **`aria-valuemin`, `aria-valuemax` and `aria-valuetext` are NOT authored.** They
> are statements about the pair at a moment in time; the class writes them on
> mount. Authoring them would be a second source of truth that goes stale on the
> first drag.

The stated hazard is *a human hand-writing a value into HTML that JS will later
disagree with*. In React there is no second source: `aria-valuemax` and the
`defaultValue` it is derived from come from the same props in the same render, and
the effect recomputes from the DOM afterwards. Server-rendering them makes the
announcement correct **before hydration** — which matters more here than
elsewhere, because a slider announces on focus and focus can precede hydration.

I chose to server-render them. The suite is indifferent (its `sync()` test only
needs the pre-sync value to differ from the one it writes programmatically, which
it does), and both readings pass.

**Decision:** author them, from the same props. Recorded because it is a case
where a contract rule is a *framework-specific* rule wearing general clothing:
"do not author" means "do not hand-author" and is correct for the reference's
authoring model. In a render-time model the rule inverts — authoring is the way
you avoid a stale first paint.

**Upstream suggestion:** phrase these rules as "must equal what the owner would
compute" rather than "must not be present". The end-state contract
(ADR-0009 — the contract specifies DOM, not computation site) already says this
is the right framing; three of RangeGroup's contract rules are written as
prohibitions on *when* rather than assertions about *what*.

---

### F-NEW · Measured: the fill carries the span at 4.4:1 / 8.5:1, but the unfilled track is invisible in dark (1.08:1)

**Surface:** the lane inside `#RangeGroup`, measured with
`web/tasks/probes/rg-colors.cjs`, Chromium, both `data-appearance` halves,
against the kitchensink card.

| | light (card `#ffffff`) | dark (card `rgb(35,35,32)`) |
|---|---|---|
| fill vs card | **7.11:1** | **7.84:1** |
| **fill vs track** | **4.43:1** | **8.50:1** |
| track vs card | 1.61:1 | **1.08:1** |
| legend / role labels / readouts vs card | 7.11:1 | 7.84:1 |
| thumb vs fill | **1.00:1** | **1.00:1** |

Three readings.

**Positive:** the span *itself* — the thing this component exists to draw — is
unambiguous in both appearances (4.43:1 and 8.50:1 between filled and unfilled),
and the legend, both role labels and both numeric readouts clear AA text contrast
comfortably in both. No hardcoded colour literal appears in either
`RangeGroup.css` or the reference lane markup; everything resolves through
`currentColor`, `Canvas`/`CanvasText` or `--ui-*`, all of which follow
`color-scheme` and therefore `data-appearance`. Colour never enters this
component, exactly as ADR-0023 claims.

**The same track defect as RangeField** (see `findings/RangeField.md`): the
unfilled portion is `color-mix(in oklab, currentColor 20%, transparent)`, which
compresses to 1.08:1 over a dark card. On a *span* this costs more than on a
single field, because the reader has to see where the lane ends to judge where
the span sits within it. Axe is silent in both appearances.

**Worth knowing:** thumb and fill are the same colour (`currentColor`) —
**1.00:1** — so the handle is distinguished from the filled span only by
`--_rf-thumb-ring`, which is `Canvas`. That measures 7.11:1 (light) and 9.33:1
(dark) against the thumb, so it holds; but it means a Phase B translation that
"tidies away" the thumb border would make both thumbs disappear into the fill
while every test stayed green. Flagging it as a Phase B tripwire.

**Decision:** all verbatim in Phase A. Track fix proposed in
`findings/RangeField.md`; it belongs in one place because both components
inherit the same idiom.

---

### F-NEW · The reference's own `with-ticks` demo renders no ticks — and it cannot

**Surface:** `reference-components/src/partials/components/RangeGroup/states/_with-ticks.hbs`.

Small upstream bug, found while reproducing the variant table. That state authors
`data-ticks="labels"` on the lane but contains **no `.ticks` markup**, and
`RangeScale.ts` never generates any (grepping it for `ticks` or `stops` returns
nothing — the marks are authored, per ADR-0022's "tick marks are decoration …
the visible scale is the source of truth"). So the row labelled *"with tick
labels — stops and both ends share one expression"* draws nothing in the reference
kitchensink. No test covers it, which is why it survived.

**Decision:** the port renders real stops (`0 / 250 / 500 / 750 / 1000`) as
`.ticks > i > span` with `aria-hidden="true"`, matching what
`RangeScale.css` styles and what the row claims to demonstrate. This is the one
place the port deliberately differs from the reference's markup, and it differs
by *adding* what the reference's own CSS and prose require.

Consistent with ADR-0022: nothing in ARIA models tick marks, `step="10"` already
makes the keyboard land on every stop, so both channels agree with no ARIA at all.

---

### F-NEW · The digit reservation is the strongest argument in the library for "take it from the contract, never from the DOM"

**Surface:** `--_rg-readout-digits`, and *"crossing a digit boundary does not
resize the group or the lane"*.

Positive finding, and the one I would show someone who asked why this library is
worth studying. The bug it prevents is a genuinely nasty one and the contract
documents it as *reported from a test environment, not caught by any test*:
`"700"` is a character narrower than `"1000"`, so crossing into four digits
widened the readout → the label → the fieldset → the lane inside it, at which
point **every position recomputed and the thumb jumped under the finger
mid-drag**.

The fix reserves `calc(var(--_rg-readout-digits) * 1ch)` on a `.digits` span,
under `tabular-nums`, sized from `max` — and only the digits, because reserving
the whole string over-reserved by about a quarter (a space and three lowercase
letters are far narrower than a zero): *~51px of permanent width to remove a 12px
jump, which is a worse defect than the one it fixed*.

In React the reservation is a render-time expression rather than a mount-time
`style.setProperty`, so it is correct on first paint and the whole
`#reserveReadoutWidth()` method disappears into one line — the same collapse
AffixField's `--_af-input-chars` showed (F-015), now with a much sharper motive.
Measured green: group, lane, track and readout widths are all constant across
values 200 → 700 → 990 → 1000, and the readout is wider than its digits (the unit
costs its natural width and no more).

---

### F-NEW · The pointer-arbitration tie-break is the only part of this component with no native fallback, and it ports exactly

**Surface:** the `pointermove` / `pointerdown` handler.

Positive. Two details the contract calls out as easy to get wrong, both verified
in the port:

- **`pointermove` as well as `pointerdown`.** A `pointerdown` listener runs
  *after* the browser has hit-tested and chosen a target, so raising a thumb there
  only ever fixes the *following* press. Pre-raising on hover means the right
  thumb is already on top when the press arrives.
- **On equal values, side breaks the tie, not distance.** With both ends on 500
  the two distances are identical; without a side rule one end is permanently
  unreachable by pointer the moment they meet — the pair becomes a dead control.
  Verified against the `rangegroup-collided` fixture: 0.2 along the lane raises
  `lower`, 0.8 raises `upper`.

And it holds in RTL, because the fraction is read along the lane's **inline** axis
(`box.right - clientX` when `direction: rtl`). Verified on the `rangegroup-rtl`
fixture: 0.95 raises `lower`, because in RTL the lower end is on the right.

Nothing about this needed rethinking for React — it is DOM geometry plus two
`setAttribute` calls, and `data-on-top` is the documented exception to the
library's "`true` or absent" boolean rule (both states are selectable, since
exactly one thumb is on top at any moment). Recorded as evidence for the brief's
question: the parts of this library that are *about the platform* port with zero
friction. The friction is entirely at the seams where a framework wants to own
markup that the library assumed was authored.

---

### F-NEW · Green in isolation, red on `/`: the spec assumes init completes before the `load` event, and every Next.js chunk is `async`

**Surface:** `RangeGroup.e2e.test.js` on the aggregate `/`. **11 / 19 on `/`
against a verified 19 / 19 in isolation.** This is the finding the orchestrator
asked for, and the answer is *not* a cross-component collision.

**It is not a collision.** Every candidate was checked on the live aggregate page
and ruled out by measurement:

| Hypothesis | Measured on `/` |
|---|---|
| `[data-id="rangegroup-live"]` resolves to something else | **1** match, `FIELDSET.RangeGroup`, in `#RangeGroup` |
| `#rg-live-lower` / `-upper` ambiguous | **1** match each |
| Duplicate ids anywhere on the page | **0** |
| Strict-mode / bare-class / accessible-name selection | the spec uses no `.first()`, no `getByRole`, no name-based locator |
| Stray `.RangeField` inputs from RangeScale's lanes | irrelevant — the spec never selects `.RangeField` outside a group it already scoped |
| Console / hydration errors | **0** |

After a 1.5 s settle, *every* assertion's precondition was satisfied on `/`:
`__rangeGroupInstance` present on all 13 groups, `__rangeScaleInstance` present,
`aria-valuemax="700"` correct. The page is not wrong — the tests are early.

**The mechanism.** Upstream, `src/js/script.js` calls `RangeGroup.attach()` at
module evaluation of `<script type="module" src="/main.js">`. A non-async module
script is **deferred**, and a deferred script **delays the `load` event**. So
upstream, every group is wired before `load` — which is exactly when Playwright's
`page.goto()` resolves. That is why nine of these assertions can call
`page.evaluate` immediately with no gate at all: upstream there is nothing to
wait for, and the spec is correct as written.

Next.js injects **every** client chunk as `<script src=… async>` (verified against
the served HTML of `/`: 10+ chunks, all `async`), and an `async` script does *not*
delay `load`. Measured on `/`, dev server, Chromium, four runs each:

| Init strategy | `__rangeGroupInstance` present |
|---|---|
| React `useEffect` (hydration) | **86–141 ms after** `goto` resolved |
| module-scope `attach()` in the client module | **54–91 ms after** `goto` resolved |
| inline parser-blocking bootstrap (the fix) | **before** `goto` resolved, 4/4 |

The isolated route showed the same gap at ~54 ms; my own probe's 200 ms settle hid
it. That is why the port read 19/19 in isolation and 11/19 on `/` — **the
aggregate page did not cause the bug, it made a pre-existing race lose reliably.**
The eight failures are exactly the eight assertions that call `page.evaluate`
without a preceding auto-retrying `expect()` or `scrollIntoViewIfNeeded()`; the
eleven that passed all interact first and so retry into the window.

**It is not a test-only problem, which is why it was not fixed in the test.** For
~100 ms *after the page has finished loading*, a hydration-only RangeGroup does
not clamp, does not announce its span, and cannot arbitrate an overlapping pair.
A user who starts dragging in that window gets raw unclamped native behaviour on
both handles, and the collided case is a dead control. Making the suite wait would
have hidden a real defect.

**Does it exist upstream?** Not for the reference itself — its deferred module
script closes the window by construction. But the *contract* the spec encodes
("state attributes are readable as soon as the document has loaded") is a
**framework-timing assumption that nothing documents**, and it is unsatisfiable by
any framework that boots from async chunks — which is Next.js, Remix, SvelteKit,
Nuxt and Astro's island hydration. So the latent hazard is upstream: it has simply
never been triggered, because the reference is the only implementation that has
run the suite.

**Decision.** The behaviour is emitted once per page as an inline,
parser-blocking `<script>` (`RangeGroup.bootstrap.ts` + `<RangeGroupBootstrap />`),
gated on `document.readyState` so it runs at `DOMContentLoaded` — after the markup
below it has been parsed, still before `load`, and independent of where in the
document it sits. The implementation exists **once**: the same exported function
is serialised with `String(fn)` for the inline script *and* imported by the React
effect, which is now only a safety net for client navigation and Strict-Mode
remounts (it is idempotent, guarding on `__rangeGroupInstance` exactly as the
reference's `attach()` does). Nothing in the DOM changes at hydration, because the
ARIA span, the positions, the readouts and the digit reservation are all
server-rendered from the same props — so there is no mismatch to patch and no
flash.

This is the same technique the reference uses in its own `index.html` for the
appearance script, and the one PORTING.md's *Preventing FOUC* section prescribes —
applied to behaviour rather than to paint. F-002 concluded that section was
inapplicable to us because we had no colour to resolve before first paint; this
finding **supersedes that reasoning for interactive components**: what has to
happen before `load` is not always a colour.

**Result:** 19 / 19 on `/`, twice consecutively. RangeField remains 21 / 21 on `/`
(its one former failure was the px-token defect the orchestrator has now fixed —
converting the scale to `rem` made the `em` model live again, exactly as measured).

**Upstream suggestion — cheap and worth doing.** Either (a) gate these nine
assertions on the `data-initialized="true"` attribute the library already defines
and `e2e-helpers/target.js` already waits on for FileUpload — RangeGroup does not
currently emit it, and F-010 established the attribute survives the port even when
its CSS does not; or (b) state in PORTING.md that the suite assumes component
init has completed by the `load` event, and that a framework booting from `async`
chunks must supply an inline bootstrap. Right now a porter discovers this as
**eight semantically unrelated failures** — clamping, ARIA, pointer arbitration and
a `TypeError` — with no hint that they share one cause, and the natural diagnosis
(a selector collision on the shared page) is wrong.

---

### F-NEW · The seam RangeScale's porter raised: ADR-0023's kernel-promotion threshold IS met, and what should be promoted is not the maths

**Surface:** answering the question the orchestrator relayed. Both porters now
have evidence from opposite sides of the same seam.

The two symptoms:

- **RangeScale's porter**, downward: it imports `RangeField.css` read-only and
  renders `<input class="RangeField">` inline rather than composing
  `RangeField.tsx`, because that component emits `<label>` + `<input>` as one
  fragment and stamps `data-component="RangeField"`, which the reference's
  RangeScale states deliberately omit.
- **This port**, upward: it renders the whole `.RangeScale` lane inline rather
  than composing `RangeScale.tsx`, because that component owns a singular subtree
  and cannot be handed a pair — and it therefore re-implements the position
  publication and installs `__rangeScaleInstance` itself.

Both are the *same* failure, and it is worth naming precisely: **in the reference,
every tier's DOM is authored by the consumer and the component only attaches
behaviour to it; in React, every tier's DOM is authored by the component.** So the
reference's tiers compose by *nesting markup*, which is free at any arity and with
any attribute set, while React's tiers can only compose by *nesting components*,
which forces each tier to fix its children's markup, its arity and its attributes.
ADR-0023's seam ("the seams run one way, downward") survives; the *composition
mechanism* does not.

**So: is the threshold met?** ADR-0023 says *"promote a `range-scale` primitive
only if a third component needs the same value↔position conversion"*. Counting
consumers of the conversion in `web/src/components/`: `RangeScale.tsx` and
`RangeGroup.tsx` — two. On a literal reading, not yet.

**We think the literal reading measures the wrong thing, and the answer is still
yes.** The conversion itself is four lines and completely uninteresting:

```ts
const span = max - min; return span === 0 ? 0 : (value - min) / span;
```

Duplicating *that* is harmless — two copies cannot plausibly disagree, and if they
did the fill geometry would be visibly wrong immediately. Promoting a kernel
module to share four lines of arithmetic would be pure ceremony, and ADR-0004
(clarity over DRY) is right to resist it.

What is actually duplicated, and what actually *can* drift, is the **publication
protocol** — the contract between whoever owns a lane's DOM and whoever reads it:

1. the property names `--_rs-a`, `--_rs-b`, `--_rs-p`;
2. the rule that a two-field lane publishes **sorted by value, not by document
   order**, because a clamping owner may have just corrected one of them;
3. the rule that `--_rs-p` is the *last* field's position;
4. the `__rangeScaleInstance = { sync }` handle, and that `sync()` must be
   **synchronous** (the suite reads `getComputedStyle` on the next line);
5. the thumb-centre correction `thumb/2 + p × (100% − thumb)` that every layer
   drawn in the lane must use — the one ADR-0023 says is "written **once**, in
   RangeScale", and which is now written in two stylesheets' worth of consumers.

Items 2–4 are behavioural invariants with no compiler and no test holding them
together across the two files, and item 2 is exactly the kind of subtlety a second
implementer gets wrong (the spec has a dedicated test for it *because* it is easy
to get wrong).

**Joint recommendation.** Promote a `range-lane` primitive to `src/kernel/`, and
have it own the *protocol*, not the arithmetic:

```ts
// src/kernel/range-lane.ts
export function publish(lane: HTMLElement, fields: HTMLInputElement[]): void
export function attachLane(lane: HTMLElement, fields: HTMLInputElement[]): LaneInstance
export const LANE_VARS = { a: "--_rs-a", b: "--_rs-b", p: "--_rs-p" } as const
```

`attachLane` installs `__rangeScaleInstance`, wires the `input` listeners and
publishes sorted positions; RangeScale calls it with one field, RangeGroup with
two. That is a ~25-line module with a conformance test, and it removes every one
of items 1–4 from both consumers. It is also exactly the shape ADR-0023
anticipated — it just has to be triggered by *the protocol having two
implementers*, not by *the arithmetic having three*.

**Upstream suggestion, and the more valuable half:** rewrite the promotion trigger
in ADR-0023 from *"a third component needs the same value↔position conversion"* to
something like *"a second component writes the lane's published properties or
installs its lane handle"*. The current trigger counts the cheapest thing to
duplicate and ignores the expensive one. And ADR-0023's *Consequences* claim that
the thumb-centre correction "is written **once**, in RangeScale" should be
qualified: it is written once *in the reference's stylesheet layout*, where the
lane's DOM is authored by consumers. In a component framework it is written once
per tier that renders a lane.

**Also worth stating plainly for PORTING.md:** RangeField and RangeScale are
usable as React components; **RangeScale is not usable as a React component by
RangeGroup**, and RangeField is not usable by RangeScale. A porter will discover
this only after writing both. One sentence in `RangeScale.md` — "in a framework
where components own their markup, the lane must accept its fields as children" —
would save the discovery, and a `children`/`fields` prop on `RangeScale.tsx` would
close it properly.

---

### F-NEW · One mechanism, four failure modes: `page.goto` resolves on `load`, and Next.js hydrates after it

**Surface:** the whole e2e suite, on the aggregate `/`. This generalises the
RangeGroup timing finding above; it was written after the same mechanism produced
three further, entirely different-looking symptoms across four ports, and after a
reported RangeField "regression" that turned out to be a fourth. It is the most
portable thing in this document, so it is stated once, in full.

**The mechanism, in three facts.**

1. `page.goto()` resolves on the **`load`** event (Playwright's default
   `waitUntil`).
2. The reference boots from `<script type="module" src="/main.js">`. A non-async
   module script is **deferred**, and a deferred script **delays `load`**. So
   upstream, every `attach()` has run before `goto` returns. The suite is written
   against that guarantee, and against that guarantee it is correct.
3. Next.js injects **every** client chunk as `<script src=… async>` (verified in
   the served HTML of `/`: 10+ chunks, all `async`). An `async` script does **not**
   delay `load`. So in a Next.js port, `goto` returns *before any component
   JavaScript has run at all* — not merely before hydration finishes.

Nothing in PORTING.md, AGENTS.md or any component `.md` states fact 2. It is an
invisible premise of the suite, and every port inherits its violation.

**The four symptoms, all measured, none of which name the cause.**

| Symptom | Where | What the error said | Actual cause |
|---|---|---|---|
| 8 unrelated assertions fail together — clamping, ARIA, pointer arbitration, a `TypeError` | RangeGroup, this port | `Cannot read properties of undefined (reading 'sync')`, `Received null`, lower/upper swapped | ungated `page.evaluate` reads landing 86–141 ms before init |
| a coordinate-based click misses its target | ToggleTip, Picklist | button never receives `click`; `mousedown` reports the button, `mouseup` a heading | Playwright computes a click point, *then* moves the mouse; a +224 px document growth at t ≈ 330–410 ms lands mid-gesture and pushes the trigger 212 px below the aim. Chrome hit-tests before the frame commits, so the two halves of the gesture disagree |
| a "no reflow" assertion fails | **RangeField** | `expect(active.top).toBe(idle.top)` — `347.55` vs `459.55` | 17 MonthField roots above it reveal on hydration (`.overlay` 0→40 px, `.native` 24→1 px); `#rf-live` moves 112 px between two measurements taken 3 ms apart |
| a test **passes** that should have failed | RangeScale | (nothing) | the assertion ran before the code under test existed |

The fourth row is the dangerous one, and it is why "make the tests wait" is the
wrong fix: a settle delay turns three loud failures into silence and leaves the
false pass exactly where it was.

**Proof of causality for the RangeField case** (`tasks/probes/rf-reflow-diag*.cjs`,
dev server, Chromium). The failing assertion's own logic, run verbatim with only a
settle inserted:

```
settle    0ms -> FAIL  top 347.546875 -> 459.546875   doc 30180 -> 30404
settle    0ms -> FAIL  top 347.546875 -> 459.546875   doc 30180 -> 30404
settle  500ms -> PASS  top 459.546875 -> 459.546875   doc 30404 -> 30404
settle  500ms -> PASS  top 459.546875 -> 459.546875   doc 30404 -> 30404
```

And with **no attribute set at all**, three consecutive measurements: `347.55`,
`347.55`, `459.55` — the component under test is not involved. The grower was
identified by diffing every element's height across the flip: `DIV.MonthField`
24 → 40, `INPUT.native` 24 → 1, `DIV.overlay` 0 → 40, ×17 instances, all above
`#rf-live` in document order (`MonthField` is section 5 of 16, `RangeField` is 9).
Timeline: unchanged at t = 76 ms after `goto` returned, shifted by t = 189 ms.

**Dev vs production is the multiplier, not the cause.** The same reveal completes
at t = 66 ms in a production build — before Playwright's first action — so
everything passes there. Measured, both suites, `next build && next start`:

```
RangeField  21 passed / 0 failed        RangeGroup  19 passed / 0 failed
```

Against `next dev` on the same commit: RangeField 20 / 1, RangeGroup 19 / 19.
**RangeGroup is 19/19 in both**, because the inline bootstrap removed its
dependence on the window entirely. RangeField's remaining dev-only failure is
MonthField's layout shift and needs no change here.

**Decisions and non-decisions.**

- *For RangeGroup:* fixed at the source — the behaviour ships as an inline,
  parser-blocking bootstrap gated on `DOMContentLoaded`, so init completes before
  `load` exactly as upstream. See the previous finding.
- *For RangeField:* **no change.** Its port is correct in dev and in production;
  the shift is above it and belongs to another component. `RangeField.css` remains
  byte-identical.
- *Two leads investigated and cleared, recorded so nobody re-runs them:* the
  px→rem token conversion is **not** implicated (the delta is a structural mode
  swap of 16 px per instance, not a rounding difference, and the scale is
  numerically identical at a 16 px root), and `min-w-0` on `Cell` is **not**
  implicated (the bisection that suggested it was reading a flaky gesture).
- *A trap in the diagnosis itself:* `RangeField.e2e.test.js` is one of the nine
  specs that hard-code `page.goto('/')`, so passing `TARGET_PATH=/kitchen-sink/rangefield`
  is inert and the run silently hits the aggregate page. Two separate observers
  concluded "it reproduces in isolation" from exactly that. It does not: on the
  real isolated route `#rf-live`'s `top` is stable across the flip (348.344 both
  times). **Never trust an "isolated route" result for those nine specs without
  checking which URL the browser actually opened.**
- *A second measurement hazard:* several agents share one Playwright install, and a
  concurrent run produces a bogus `Playwright Test did not expect test.beforeEach()
  to be called here / No tests found` runner error. Check `ps aux | grep "[p]laywright test"`
  is empty before trusting any number.

**Upstream suggestion — one paragraph in PORTING.md would prevent all four.**
State the premise the suite depends on: *component initialisation is complete by
the `load` event, because the reference boots from a deferred module script. A
framework that boots from `async` chunks — Next.js, Remix, Nuxt, SvelteKit, Astro
islands — must supply an inline bootstrap, or the suite will fail in ways that name
neither the timing nor the component.* Then either gate the ungated
`page.evaluate` reads on the `data-initialized="true"` attribute the library
already defines and `e2e-helpers/target.js` already waits on for FileUpload
(RangeGroup and RangeField emit no such attribute today), or have the suite await
it once in `beforeEach`.

**And the deeper one, which is a contract point rather than a test point:** three
components in the popup family render server HTML that is *not their end state* —
MonthField and TimeField reveal `.overlay`, `.segments` and `.trigger` on
hydration, growing the document 224 px. ADR-0009 says the end-state contract
specifies DOM, not computation site; a first paint that is 16 px short per instance
is a real Cumulative Layout Shift for every user, not only for Playwright.
MonthField's swap turns on `(pointer: coarse)`, which is a **CSS media query** —
decidable at first paint with no JavaScript at all, which is also ADR-0005's own
position that feature detection is progressive enhancement only. Resolving the mode
in CSS, or reserving the taller box in both modes, would remove the shift for
users and make three suites deterministic in dev as a side effect.
