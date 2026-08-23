# DateTimeField

Phase A port. The last of the eighteen, and the only component in the set that
composes **two field families** — DateField's calendar + month/year wheel picker
and TimeField's hour/minute/second wheels + AM/PM toggle — behind one popup and
one value.

Results are recorded in the "Result" section at the foot of this file; the
findings come first because several of them are about things the suite cannot
see.

Two verbatim-CSS edits, both PORTING.md-sanctioned and nothing else:
`.DateTimeField { overflow: hidden }` and
`.DateTimeField[data-initialized="true"] { overflow: visible }` removed (F-010).
`diff` against the submodule shows exactly those two hunks; the file was copied
byte-identical first (`md5 3c54201b104481f44aaa2fa84467047b` both sides) and the
edits applied on top.

---

### F-NEW · Composing two families cost almost nothing in the kernel and everything in one ordered list

**Surface:** `DateTimeField.tsx` vs `DateField.tsx` + `TimeField.tsx`. **The
architectural question this port existed to answer.**

Measured, so the answer is not an impression:

| | reference `.ts` | React port | `.css` |
|---|---|---|---|
| DateField | 1179 | 1381 | 360 |
| TimeField | 1013 | 1135 | 266 |
| **DateTimeField** | **1397** | **1661** | **417** |
| DateField + TimeField | 2192 | 2516 | 626 |

DateTimeField is **64 % of its two parents' combined size**, and it does strictly
more than either (five wheels, two panels, a three-button footer, a value that
spans both halves). So composition is cheap in the aggregate. The interesting
part is *where* the 36 % saving came from and where it did not.

**The kernel absorbed both families without being asked twice.** This is the
strongest evidence in the port for the kernel's design, because DateTimeField
uses `WheelColumn` under **two different contracts in one popup**:

| Contract | Instances | The entire delta |
|---|---|---|
| time wheel | 3 (`hour`/`minute`/`second`) | `{ min, max, value, onChange }` |
| month picker | 1 | `+ loop: true, format: getMonthName` |
| year picker | 1 | `+ loop: false, format: String` |

Two options — `loop` and `format` — carried the whole difference between a
looping localised month name wheel and a clamped four-digit year wheel and a
zero-padded 24-hour wheel. Nothing about the physics, the 3D geometry, the
`aria-activedescendant` wiring or the cross-column trackpad arbitration was
touched, parameterised or forked. Same for `popup-interaction`: one
`trapPopupInteraction` call serves a popup whose tab-stop *set changes shape*
when a panel swaps, because the primitive takes `tabStops` as a **callback**
rather than an array. That single API decision is what makes a
modal-within-a-modal expressible without a second primitive.

**The seam composition does expose — and it is not a size problem.** Three
places where two contracts meeting in one component produce something neither
parent has:

1. **The tab order interleaves, so it cannot be composed.** The stop list is
   `prev → month/year → next → grid(one composite stop) → hour → minute →
   [second] → [AM/PM] → clear → today → now`. DateField's list and TimeField's
   list are both *contiguous subsequences of nothing* — the grid sits in the
   middle of the nav buttons and the wheels sit between the grid and the footer.
   `popupTabStops()` is 40 lines that must know the whole interleaving, and it
   also has to switch to a completely different two-element list when the picker
   panel is active. There is no version of this function that calls a DateField
   half and a TimeField half.
2. **The completeness gate spans both halves, which creates a state neither
   parent can reach.** `datetimeFromVals` writes nothing to the native input
   until day, month, year, hour AND minute are all filled (plus second when
   `step < 60`). So a user who fills the whole date and stops has a field that
   *looks* three-quarters filled and submits **empty** — and no `change` event
   has fired, so a host form has no signal that anything happened. DateField and
   TimeField each gate on three segments; here it is five or six, and the
   probability of sitting in the incomplete state is correspondingly higher.
   This is faithful to the reference (`_trySyncToNative` returns early) and it
   is the one place where composing two values behind one native input is
   genuinely worse than two fields would be.
3. **The time wheels are not time controls.** `_onWheelChange` reads the
   committed *datetime*, mutates hours, and writes the datetime back — so the
   hour wheel cannot be reused from TimeField even in principle, because its
   `onChange` has to know about a date. Same for the AM/PM toggle. This is
   F-039's finding arriving from a different direction: in the reference every
   tier's DOM is authored by the consumer, so a "time wheel" is just markup that
   a component attaches to; in React the callback signature *is* the coupling.

**Decision:** the kernel's split is correct and the seam is in the right place.
The evidence for that is the 64 % figure combined with the fact that the three
seam items above are all *behaviour that genuinely differs*, not plumbing. The
one thing worth taking upstream is item 2.

**Upstream suggestion:** `DateTimeField.md`'s Behaviour section says "All
segments must be filled before native input is written" in one line, as if it
were a detail. For a six-segment field it is the dominant interaction state, and
it is invisible: there is no attribute, no event and no announcement
distinguishing "partially filled" from "empty". A `data-incomplete="true"` on the
root (paint attribute, server-renderable) would let a consumer style it and let
a form warn about it, and it costs one line in `_trySyncToNative`.

---

### F-NEW · `DateTimeField` is the one component that destroys a wheel while sibling wheels are alive — which is what makes F-030 load-bearing

**Surface:** `_closePicker()` vs `_closeCalendar()`. A structural corroboration
of F-030 rather than a new defect.

F-030 fixed `WheelColumn.destroy()` stranding the module-level `_activeWheelCol`
trackpad lock, and argued the reference never found it because "the reference's
kitchensink mounts its wheels once and never tears them down". DateTimeField
sharpens that: it is the **only** component in the set where `destroy()` runs
while *other live wheel columns remain in the same popup*.

Measured wheel-column census on the live instance:

```
popup open, calendar panel : 2 spinbutton wheels (hour, minute)
popup open, picker panel   : 4 spinbutton wheels (hour, minute, month, year)
closing the picker         : destroys 2, leaves 2 alive
```

In the other four fields `destroy()` only ever runs as part of tearing the whole
popup down, so a stranded lock is invisible until the *next* popup opens. Here
the victims are three feet away and still on screen: spin the month wheel, tap
the month/year trigger inside the 100 ms snap window, and without the `[PORT FIX]`
the hour and minute wheels beside it stop responding to the trackpad while
keyboard and drag keep working. That is the "the wheel feels broken sometimes"
symptom F-030 predicted, in its most reproducible form.

**Honest limitation:** I could not turn this into a runtime measurement.
Synthetic `mouse.wheel` and a dispatched `WheelEvent` both reach
`WheelColumn._onWheel` (`defaultPrevented` is `true`) but do not move the ring
within 400 ms in a headless harness, so control and test both read "no
movement" and the comparison is uninformative. The counterfactual would also
require reverting a kernel line, which Phase A forbids. So this is an argument
from structure plus the census above, not a measured before/after — stated that
way deliberately.

**Decision:** nothing to change. Recorded because it is the strongest available
answer to "was F-030 worth a `[PORT FIX]`": the component that would have
suffered most from it is the last one ported, i.e. the defect would have shipped.

---

### F-NEW · `data-initialized` and `data-input-mode` split cleanly, and the height contract can be honoured without giving up the no-JS control

**Surface:** `DateTimeField.tsx`, the `.native` `style` prop. Measured; resolves
F-046 vs F-049 for this component.

F-047 established the rule (paint attributes in SSR, behaviour gates after
hydration) and F-049 established the bill: MonthField and TimeField reveal on
hydration, +112 px each, which is real CLS *and* broke four unrelated
components' suites by moving click targets mid-gesture. Both facts are true at
once and they pull in opposite directions: keeping the native input as the
pre-hydration face is the *good* progressive-enhancement story (F-046 singles it
out as "the strongest argument in the library for keeping a native fallback in
the markup"), and it is also the thing that shifts.

They are only in tension if you accept the native input's intrinsic height.
ADR-0008 says every field's bordered box is at least `2.5rem`; before hydration
the native input **is** the field's bordered box, so it owes the same contract.
Reserving it from the stylesheet's own token —
`style={{ minBlockSize: "var(--_dtf-field-min-block-size)" }}`, dropped the
moment the mode resolves — keeps both halves.

Measured on the isolated route, production build, 18 instances, real
`layout-shift` PerformanceObserver entries:

```
goto resolved at 59 ms, data-initialized at 83 ms
  mode      null      → custom      initialized null → true
  root      40h ×207w → 40h ×212.4w   Δh   0
  native    40h ×207w →  1h ×  1w     Δh -39
  overlay    0h ×  0w → 40h ×212.4w   Δh +40
  document  2084px    → 2084px        Δ    0px
  CLS 0.0064   one shift, t = 76 ms
```

**Δdocument 0 px** across eighteen instances, against MonthField's and
TimeField's +112 px each. CLS **0.0064**, an order of magnitude inside the 0.1
"good" threshold, and the whole of it is one shift at t = 76 ms.

The residual 0.0064 is horizontal, not vertical: the native
`<input type="datetime-local">` measures 207 px where the overlay that replaces
it measures 212.4 px, so the inline row shifts 5.4 px sideways once. There is no
token for the field's inline size the way there is for its block size, so
reserving it would mean inventing a width — which is design work, not a port.
Left, measured, and named.

**Decision:** reserve the block size from `--_dtf-field-min-block-size`, keep the
server snapshot `null` so the native control stays live and usable before
hydration, and gate `data-initialized` on hydration so the suite's
`beforeEach` barrier gates something.

**Upstream suggestion:** ADR-0008's height contract is written as a statement
about the *component's* box. It should say the pre-initialisation face owes it
too — one sentence, and it is the difference between +112 px of CLS and zero.
The 83 ms dead-control window itself is unavoidable under `<script async>`
(F-035) and is *not* dead here, because the native input works.

---

### F-NEW · The stylesheet styles two `td` attributes this component's JS never sets, while its sibling's does

**Surface:** `DateTimeField.css` lines 238–248 vs `DateTimeField.ts`
`_renderMonth()`. **Dead CSS, and the divergence is between two siblings.**

`DateTimeField.css` ships:

```css
.DateTimeField .popup .calendar-grid td[data-today="true"] button { font-weight: bold }
.DateTimeField .popup .calendar-grid td[data-disabled="true"] button {
  color: var(--_dtf-calendar-color-muted); cursor: not-allowed;
}
```

`_renderMonth()` sets `data-outside-month` on the `td`, `aria-disabled` on the
`td`, and `aria-pressed` on the button. It never sets `data-today` or
`data-disabled`. Both rules are unreachable.

`DateField.ts` — the same family, the same two rules in its own stylesheet —
**does** set them (`td.dataset.selected`, `td.dataset.disabled`, and a
`data-today`). So the two calendars diverge on which channel carries the state,
and only one of them agrees with its own CSS.

Consequences, both visual rather than accessibility failures:

- **Today is not bold.** A user cannot see today in the grid at all.
- **An out-of-range day renders in normal body colour** with a normal pointer.
  Its `aria-disabled="true"` on the `td` is correct, so a screen reader is
  informed and axe is satisfied — the affordance is missing only for sighted
  users. It is still selectable by click, because the reference's `_selectDate`
  has no disabled guard either. (Our port added one: a disabled cell's click is
  ignored. That is a one-line divergence from the reference and it is recorded
  here rather than buried — it prevents writing a value outside `data-min`/
  `data-max` through the calendar, which the `.md` says the range constrains.)

**Decision:** ported faithfully — `aria-disabled` on the `td`,
`data-outside-month` on the `td`, `aria-pressed` on the button, no `data-today`,
no `data-disabled`. Phase A's fidelity rule applies to the DOM as much as to the
CSS, and F-042 already settled that silently repairing the reference destroys the
evidence this project exists to produce. Phase B fix is two attributes on the
`td` and no CSS change at all.

**Upstream suggestion:** this is the cheapest possible test to add and nobody
has it: assert that every attribute selector in a component's stylesheet is
reachable from the DOM the component renders. It is a static cross-check between
two files the repo already has, and it would have caught this, plus whatever
else in the set has the same shape.

---

### F-NEW · Placeholder and filled segments render at exactly the same colour — our AA fix collapsed a distinction the component relies on

**Surface:** `.segment[data-placeholder="true"]`, `--ui-muted-foreground`.
**Ours, not the library's — and it is family-wide.**

The component's only visual cue for "this segment is empty" is
`color: var(--_dtf-segments-color-muted)`, which resolves through
`--ui-muted-foreground`. F-004 mapped that token to `--color-body` (`#5a5852`)
because the design system's `muted` (`#807d72`) measures 4.12:1 on white and
fails AA as placeholder text.

The field has no colour of its own; a filled segment simply inherits. And the
host's inherited body text colour is *also* `--color-body`. Measured on the live
route:

| | light | dark |
|---|---|---|
| inherited (filled segment) | `rgb(90, 88, 82)` | `rgb(185, 183, 175)` |
| `data-placeholder="true"` | `rgb(90, 88, 82)` | `rgb(185, 183, 175)` |
| `.separator` | `rgb(90, 88, 82)` | `rgb(185, 183, 175)` |
| contrast between them | **1.00 : 1** | **1.00 : 1** |

So `dd/mm/yyyy, --:--` and `27/05/2026, 14:35` are rendered in one flat colour,
and the placeholder rule is a no-op. The same holds for the separator, which the
reference deliberately mutes so the digits read as the content.

**This is not a WCAG failure**, and it matters that it is not: the distinction is
carried by the *text itself* (`dd` versus `27`) and by `aria-valuetext`, so 1.4.1
Use of Colour is satisfied and axe has nothing to flag. It is a fidelity loss —
and it is exactly the shape CLAUDE.md warns about, an accessibility fix
propagating into a place nobody was looking.

It applies to **all five popup fields**, because they all reach for
`--ui-muted-foreground` for the same job, so it belongs in the project-level log
rather than here.

**Open question for the project owner:** the honest fix is a *third* role in
`ui-tokens.css`, between body text and the disabled tier — a placeholder colour
that is lighter than body and still clears 4.5:1 on both the card and the popup
surface. `muted` at 4.12:1 is 0.38 short; a value a few steps darker than
`muted` and lighter than `body` exists and would restore the cue in both
appearances. That is a token decision, so it is yours: one colour, or accept a
flat field.

---

### F-NEW · Zero axe violations with `color-contrast` ON, popup open, in both appearances — the four runs the spec cannot do

**Surface:** `DateTimeField.e2e.test.js`'s axe test vs
`web/tasks/probes/dtf-axe.cjs`. A positive finding, deliberately over-measured.

The spec's single axe test is scoped to the component root, runs with the popup
**closed**, and disables both `duplicate-id` and `color-contrast`. So it cannot
see the calendar, the five wheels, the AM/PM toggle, the footer, the arrow, or
any colour at all — and per F-040 the honest reading of a pass from it is "a
lower bound on failures".

Ran the widest version instead: four scopes × two appearances, `color-contrast`
enabled throughout.

| Scope | light | dark |
|---|---|---|
| closed, spec's rule set | 0 | 0 |
| closed, `color-contrast` ON | 0 | 0 |
| **popup open**, `color-contrast` ON | **0** | **0** |
| **picker panel open**, `color-contrast` ON | **0** | **0** |

Eight runs, zero violations. Measured colours behind that:

| Element | light | dark | note |
|---|---|---|---|
| `.overlay` border (`currentColor`) | `#5a5852` on card, 7.11:1 | `#b9b7af` on card, **7.84:1** | F-044's fourth tier, 1.4.11 floor 3:1 |
| `.popup` | `#262520` on `#ffffff` | `#f2f1ec` on `#232320` | `--ui-surface` pair |
| `.calendar-footer-now` | `#c84000` | `#ff7a40` | F-001's promoted primary |
| `.Wheel .option` | `#262520` | `#f2f1ec` | inherits the popup |

Two things are worth saying about *why* this was clean on the first run, because
neither is luck:

- `--_dtf-segments-border-color: currentColor` — F-044's finding, and this
  component uses it for the control edge that WCAG 1.4.11 actually cares about.
  It tracks the appearance **and** the design system with no token at the seam,
  and it measures 7.11:1 / 7.84:1 against a 3:1 floor. No `CanvasText` literal
  could do that in dark.
- The verbatim stylesheet has **no `transition`, no `animation`, no
  `@keyframes` and no `@starting-style`** — grepped, zero hits — so no entrance
  animation was inherited and none was added. This is the point the brief asked
  to be checked explicitly: `DateTimeField.css` and `DateField.css` ship none;
  `ToggleTip.css` line 153 ships `transition: opacity 0.15s`, which contradicts
  ToggleTip's own documentation and is the origin of the ~150–180 ms sub-AA
  window in F-006/F-043. DateTimeField is on the clean side of that split, so
  `AXE_SETTLE` is not needed and the popup-open audits above sample a settled
  frame by construction.

---

### F-NEW · F-045's dark wheel-fade band is confirmed a fifth time, and this component shows twice as much of it

**Surface:** `Wheel.css` `.WheelColumns::after`, measured through
`DateTimeField`'s popup.

Measured `background-image` on `.WheelColumns::after`, live, both appearances:

```
light: linear-gradient(rgb(255,255,255), transparent 38px, transparent calc(100% - 38px), rgb(255,255,255))
dark:  linear-gradient(rgb(18,18,18),   transparent 38px, transparent calc(100% - 38px), rgb(18,18,18))
```

`Canvas` resolves to `#ffffff` in light — coincidentally *exactly* our card
colour, so the fade is pixel-perfect for free — and to the UA's `#121212` in
dark against the popup's `#232320`, a ratio of **1.19**. Identical to the
MonthField and TimeField measurements, so five wheel fields now agree on the
number.

What DateTimeField adds: it is the only component with **two `.WheelColumns`
hosts in one popup** (`.time-columns` and `.year-month-picker`), so a user
switching to the month/year panel sees the band on a second surface in the same
dialog, and with three time wheels visible the band spans a wider area than in
any other field. The defect is unchanged; its exposure is roughly doubled.

Left verbatim — the kernel CSS is a copied deliverable under the same Phase A
rule as component CSS. F-045's proposed one-token fix
(`var(--ui-surface, Canvas)`) is still the right one and would fix all five
fields at once.

---

### F-NEW · This spec is the fixed version of F-050's unscoped selector — the only one of the five

**Surface:** `DateTimeField.e2e.test.js`, the three `popup-interaction` tests.
**A positive finding, and it changes what F-050 says about the family.**

F-050 found that WeekField, TimeField, MonthField and DateField all write

```js
const inside = await page.evaluate(() =>
  document.querySelector('.popup')?.contains(document.activeElement) ?? false)
```

— document-wide, load-bearing on the `<template>`-clone mechanism, and therefore
broken for any framework that cannot populate a `<template>`. Twelve
occurrences, three per spec, and the predicted symptom is exactly three failures
on any page that also renders a ToggleTip.

`DateTimeField.e2e.test.js` does not have the defect. All three of its
equivalents pass the root selector across the `evaluate` boundary:

```js
const inside = await page.evaluate((rootSel) => {
  const popup = document.querySelector(`${rootSel} .popup`)
  return popup?.contains(document.activeElement) ?? false
}, ROOT)
```

…and the fourth, the `wheel` containment test, dispatches its event on
`` `${rootSel} .popup` `` rather than on the first `.popup` in the document.

So the shape F-050 recommends upstream — "passing the selector into the
`evaluate` is a one-line change per occurrence" — **already exists in the repo**,
in the fifth member of the same family, written the correct way. That makes the
upstream suggestion much easier to act on than F-050 could know: it is not a
proposal, it is a diff towards a file that is already there.

The practical consequence for this port is that DateTimeField is the one popup
field predicted to score the same on the aggregate page as on its isolated
route. That prediction is verifiable once the section is mounted on `/`.

**Upstream suggestion, sharpened:** copy the three assertions from
`DateTimeField.e2e.test.js` into the other four specs verbatim. Twelve lines,
and it removes a whole class of false negatives for every non-`<template>`
framework.

---

### F-NEW · The leap-day desync is present here too, on the year axis only

**Surface:** `_setSegmentValue()`, the `type === 'year'` branch. Same defect as
DateField, same `[PORT FIX]`.

`_setSegmentValue` clamps the day when the **month** changes:

```ts
if (type === 'month') { … if (currentDay > daysInMonth) this._setSegmentValue(daySeg, daysInMonth) }
else if (type === 'day') { … }
else if (type === 'year') { seg.setAttribute('aria-valuetext', String(numericValue)); … }
```

The year branch writes and returns. With 29 Feb 2024 selected, one ArrowUp on
the year leaves the segments reading `29/02/2025` while `_trySyncToNative` builds
`new Date(2025, 1, 29)`, which rolls over, and writes `2025-03-01` to the native
input. The visible face and the submitted value disagree, with no event, no
announcement and no attribute marking it.

Fixed in the port, marked `[PORT FIX]`, in `withSegment()`: the clamp runs on
`month` **or** `year`. It is the same rule the reference already wrote, applied
to both axes.

Worth noting it is *worse* here than in DateField, for a reason specific to this
component: DateTimeField's `_trySyncToNative` also carries the hour, so the
rolled-over value is `2025-03-01T14:35` — a date **and** a time that were never
chosen together. And the announcement, which is the one channel that would tell
a screen-reader user, is gated on the equality check and so announces the
rolled-over value as if it were the selection.

---

### F-NEW · Three footer buttons, three different close policies — and only one of them is documented

**Surface:** `.calendar-footer-clear` / `-today` / `-now`,
`DateTimeField.md` § Behaviour.

DateField's footer has two buttons and both close the popup. DateTimeField's has
three and they behave differently:

| Button | writes | closes the popup? | documented? |
|---|---|---|---|
| Clear | value `""` + a `change` event | **yes** | the Events section mentions the `change`, not the close |
| Today | today's date, **existing time preserved** | **no** | not mentioned at all |
| Now | current date **and** time | **yes** | "'Nu' footer button sets current datetime" |

The asymmetry is correct and deliberate — Today has only set half the value, so
closing would strand the user — but it is undocumented, and it is the kind of
thing a porter guesses wrong. The reference's own `_selectDate` (which Today
routes through) does not close either, for the same reason: picking a *day* in
the calendar leaves the time still to set. That is the single biggest behavioural
difference between this component and DateField, where clicking a day closes the
popup, and it follows directly from composing two values.

Also undocumented: Clear is **never disabled** here, whereas DateField disables
its Clear when the field is empty. The suite depends on it — *"clear button
empties all segments"* clicks it directly — so this is contract, not styling.
Ported faithfully.

**Upstream suggestion:** the Behaviour section should carry the table above. Four
lines, and it is the part of the contract most likely to be reimplemented wrong.

---

### F-NEW · `_focusTrigger` is absent, so DateTimeField lands on the safe side of F-042

**Surface:** `DateTimeField.ts`. A negative result, reported because the brief
asked which side it falls on.

F-042 is the roving-tabindex one-way defect: `_focusTrigger()` sets every segment
to `tabindex="-1"` and nothing restores a `0`, so after tabbing out the segments
are keyboard-unreachable for the rest of the page's life — a WCAG 2.1.1 failure
that neither axe nor the suite can see.

Grepped: `DateTimeField.ts` contains **no `_focusTrigger`, no `case 'Tab'` and no
`Tab` handling of any kind** in its segment key handler. Its only roving writer is
`_setSegmentFocused()`, which sets `-1` on all segments **and then `0` on the one
receiving focus** — symmetric, and always leaving exactly one tab stop in the
group. It is immune for the same structural reason DateField is: the browser's
native Tab is left alone.

So the family splits 2–2 rather than 3–1: DateField and DateTimeField are safe,
TimeField is measured broken, and MonthField/WeekField still need the two
measurements F-042 recorded as outstanding. Since the two components *without* a
`Tab` case are the two that are safe, "does it handle Tab itself?" is a reliable
one-line screen for the remaining two.

Ported faithfully in either case — the port's `tabIndex={activeSeg === type ? 0 : -1}`
is `_setSegmentFocused`'s rule expressed declaratively, which cannot go one-way
by construction because it is derived from state on every render rather than
written imperatively on an event. Worth noting as a small, real advantage of the
declarative form for this specific class of bug.

---

### F-NEW · Removing the reference's equality gate was required by the lint rule, and React supplies both halves anyway

**Surface:** `commit()`, `react-hooks/refs`.

The reference's `_trySyncToNative` guards everything behind
`if (this.native.value !== next)`, which collapses a cascade — a calendar pick
touches up to seven segments, each calling `_setSegmentValue` → `_trySyncToNative`
— into one `change` event and one announcement. It is load-bearing there and the
`.md` documents it.

Reproducing it as `if (iso === nativeValueRef.current) return` inside `commit()`
is a **build-blocking lint error**, and not on the line you would expect:

```
error  Cannot access refs during render
  onClick={() => selectAmpm(v)}
           ^^^^^^^^^^ Passing a ref to a function may read its value during render
  react-hooks/refs
```

`selectAmpm` does not touch a ref. It calls `applyDatetime`, which calls
`commit`, which read `nativeValueRef.current` — and the analyser follows the
chain. Two details make this worth recording: the error names an
`onClick` three calls away from the actual read, and it fired for `selectAmpm`
(depth 3) while **not** firing for `selectDate` → `selectDay` → `applyDatetime` →
`commit` (depth 4) doing the identical thing, which looks like an analyser depth
limit. So the rule's coverage here is real but not uniform, and a port that
satisfies it by moving the ref read one call deeper has not fixed anything.

The fix was to delete the gate rather than relocate it, because React already
provides both of its jobs:

- the cascade is a single `setVals` + `setNativeValue`, so there is nothing to
  collapse;
- `setState` with an identical value bails out, so a re-commit of an unchanged
  datetime re-announces nothing;
- the one job still needed — not dispatching a spurious native `change` — lives
  in the write effect, which compares against the input's **actual DOM value**.
  That is a strictly stronger check than the reference's, because it also catches
  a value the host wrote directly.

**Decision:** gate deleted, with the reasoning in the code. This is the third
time in this project that a piece of the reference's imperative bookkeeping
turned out to be React's default (cf. F-015's `attach()` steps becoming
render-time expressions), and the pattern is worth naming: **guards that exist to
make an imperative write idempotent have no counterpart in a framework where the
write is derived.** The ones that do survive are the guards about *the outside
world* — the native `change` dispatch here, `input.form`'s reset, the document
click listener.

---

## Result

**30 / 30 conformance tests green, three consecutive runs**, against a
**production build** (F-049 — `next dev` is not a valid substrate). No failures,
no skips, nothing left failing as a known non-portable assertion.

```
BASE_URL=http://localhost:3201 TARGET_PATH=/kitchen-sink/datetimefield \
  npx playwright test src/partials/components/DateTimeField/tests/DateTimeField.e2e.test.js
→ 30 passed (9.6s)
→ 30 passed (9.7s)
→ 30 passed (9.5s)
```

The port ran on **3201** rather than 3200 because another agent's `conformance`
run held 3200 for the whole session; two of its Playwright runners were active
throughout, so the "check `pgrep -f 'playwright test'` is empty first" guard
could never be satisfied. Three things make the number trustworthy anyway: the
run is reproducible three times over, it is against a production build, and the
26-assertion library-level probe (below) was written first and agreed with it
before the runner was ever used. One caveat worth flagging to the owner: my
`npm run build` overwrote `.next` underneath that agent's already-running
`next start`, so **its** conformance figures for this session may be
contaminated — mine are not, since my server booted after the build.

Every gate:

| Gate | Result |
|---|---|
| `DateTimeField.e2e.test.js` | **30 / 30**, ×3 |
| `npx tsc --noEmit` | clean |
| `npm run lint` | clean |
| `npm run build` | clean |
| `npm run test:unit` | 206 / 206 |
| axe, 8 runs (4 scopes × 2 appearances, `color-contrast` ON) | **0 violations** |
| behaviour probe (library-level positive control) | **26 / 26** |
| reflow sweep 320 / 375 / 768 / 1280 px | 0 px document overflow at every width |
| hydration console errors / warnings | none |
| CLS (18 instances, production) | **0.0064**, Δdocument **0 px** |
| `git -C reference-components status --short` | empty |
| verbatim CSS `diff` | exactly the two sanctioned init-gate hunks |

A behaviour probe mirroring the spec's 26 riskiest assertions through the
Playwright *library* (`web/tasks/probes/dtf-behaviour.cjs`) passed **26 / 26** on
the first run — written because a concurrent `playwright test` from the shared
submodule install was occupying the runner and F-049 records that concurrent runs
produce a bogus `No tests found` error rather than a clean failure. It turned out
to be worth more than a workaround: it is a **positive control for the whole
suite**. Every one of its 26 checks is a direct assertion (`.popup` count is 0
while closed, `document.activeElement` is the hour wheel, the native input reads
`2026-05-27T02:35`), none of them can pass vacuously against a missing element,
and it exercised the popup, the picker, the wheels and the AM/PM toggle before
the runner was available. Given F-040's finding that a green count from this
suite is a lower bound on failures, having a second independent instrument agree
is the only reason I would call this port green rather than "the runner was
green".

**Two gates I could NOT run, and why.** `npm run verify:axe`,
`verify:reflow` and `verify:appearance` all hard-code `http://localhost:3000/`
and audit the aggregate page. DateTimeField is not mounted on `/` yet, so they
cannot cover it — and port 3000 was held by another agent's server of unknown
type for the session, which F-049 makes explicitly unsafe to measure against.
The equivalents were run instead against the isolated route on my own production
server: axe over the component in both appearances across four scopes with
`color-contrast` **enabled** (8 runs, 0 violations), and a 320 / 375 / 768 /
1280 px reflow sweep of the whole route (0 px document overflow at every width).
The three aggregate-page gates need re-running by the owner after mounting; they
are the checks that see the shared chrome, which no component-scoped run can
(F-017).

**Not mounted on the aggregate `/` yet** — that is the project owner's call.
Prediction from the F-050 finding above: because this spec scopes its
`page.evaluate` selectors correctly, DateTimeField should score the **same** on
`/` as on its isolated route, unlike its four siblings.

---

### F-NEW · Both upstream fixes land, and the check this port proposed found less than the port did — but it is general

**Surface:** submodule `99ff470` → `c2d12c2`; `DateTimeField.tsx`,
`DateTimeField.kitchensink.tsx`. Supersedes nothing; it **closes** the dead-CSS
finding above ("The stylesheet styles two `td` attributes this component's JS
never sets") and the `.calendar-footer-clear` note in the three-footer-buttons
finding, both of which were recorded as faithful reproductions of upstream
defects. Upstream fixed both, so the faithful port is now the fixed one.

**What changed here.** Two edits, no CSS change at all — exactly the Phase B fix
the earlier finding predicted ("two attributes on the `td` and no CSS change").
`DateTimeField.css` was re-checked against the submodule after both commits:
neither touched it, and `diff` still shows only the two sanctioned init-gate
hunks (F-010).

| Upstream | Our equivalent |
|---|---|
| `f7ab857` (#56) — `_renderMonth()` sets `td.dataset.today` and `td.dataset.disabled` | `data-today={cell.isToday ? "true" : undefined}` and `data-disabled={cell.isDisabled ? "true" : undefined}` on the `<td>` |
| `c2d12c2` (#57) — new `_updateClearButton()`, called from `_openCalendar` and the select tail, sets `clearBtn.disabled = this.native.value === ''` | `disabled={nativeValue === ""}` on `.calendar-footer-clear` |

The second row is the more interesting port. Upstream needed a new private
method and two call sites because the button's `disabled` is imperative state
that has to be re-pushed whenever the value changes; in React the same
requirement is a single derived expression on the element and there is no method,
no call site and nothing to forget to call. It is also **character-for-character
what our DateField port already had** (`disabled={nativeValue === ""}`,
`DateField.tsx:1306`), which is the point: the sibling divergence the earlier
finding described existed in the reference and the port inherited it, and closing
it required copying our own sibling rather than translating anything new.

The port already computed both bits of state (`cell.isToday`, `cell.isDisabled`
in `buildMonth`) — they were feeding the roving rule and the click guard. So the
whole of #56, in this port, was **reflecting two booleans that were already in
hand onto the element that the stylesheet reads.** That is worth saying plainly:
the defect was never a missing computation, in either codebase.

#### The dead-CSS check the port proposed is now upstream. It is general, and it found less than reading did.

`tests/dead-attribute-selectors.unit.test.ts` is the port's suggestion
implemented, and it is a **general check, not a one-off**: it enumerates every
directory under `src/partials/components`, skips the two parked ones, and emits
one `it()` per component that has a `.css`. So all eighteen are covered, and
`.claude/philosophy.md` gained a rule section ("If CSS selects on it, something
has to write it"). That answers the question the earlier finding left open —
the other seventeen are in scope, not just this one.

But the honest accounting of what it *caught* is smaller than the idea suggests,
and upstream states this in the file rather than letting a green run imply more:

- **It found exactly what this port had already found by reading, minus half.**
  Of the two dead rules, the static check catches `data-today` and **would not
  have caught `td[data-disabled="true"]`**, because DateTimeField writes
  `data-disabled` on its own root — the *name* was present while the `<td>` rule
  was dead. It reads attribute names, not the elements they sit on; separating
  those needs dataflow. So the whole library passing says "no component styles a
  name nobody writes", which is strictly weaker than "no rule is dead".
- **The form the port proposed was tried and rejected.** The port's wording was
  "reachable from the DOM the component renders" — i.e. runtime. Upstream built
  that first: it flagged **81 of 193 selectors**, almost all mutually exclusive
  states that cannot coexist on one instance (`data-direction="top"` and
  `="bottom"`) or platform-absent modes (`data-input-mode="display"` is
  touch-only). Inverting the question from *is it on the page* to *who writes it*
  removes the blind spot entirely. **The idea was right and the implementation the
  port suggested was wrong**, which is the more useful half of the lesson: a
  reachability check over mutually exclusive enum states is unfixable without an
  allowlist, and a provenance check needs none.
- **Scope had to be "component plus its composers".** Per-component flagged
  RangeGroup's `data-fields`/`data-on-top` on the RangeScale it composes;
  repo-wide would have *excused this very bug*, because DateField writes
  `data-today` somewhere in the tree. Both failure modes are real and the correct
  scope is neither.

**Open question for the project owner.** This check runs over the *submodule's*
sources and therefore says nothing about our ports — our `.tsx` and our copied
`.css` are not in its input. Its regexes would port almost unchanged: the
`(data-[a-z0-9-]+)\s*=` branch already matches JSX (`data-today={…}`), and the
`dataset.x` branch is simply unused in a declarative port. Run against
`web/src/components/`, it would have flagged this component's dead `data-today`
read too. It is a repo-level static file check rather than a white-box unit test
of a reference implementation, so CLAUDE.md rule 4 ("do not port `*.unit.test.*`")
arguably does not aim at it — but the rule is stated absolutely, so the exception
is the owner's call, not a porter's.

#### `#57`'s `Clear` failure was an exposed pre-existing gap, not a new requirement — and it is a third instance of the F-040 theme

The commit title ("check attribute values not just names") invites the reading
that our port emitted `disabled` with the wrong *value* and slipped past a
name-only assertion. **It did not, and the value-level check is not what found
this.** Reading the commit in full separates three independent parts, and the
`Clear` failure belongs to the first:

1. `expectEveryPopupButtonReachable` — tab-stop *membership*, new helper in
   `e2e-helpers/target.js`. **This is what found the Clear bug**, via its
   companion test.
2. The `Clear is disabled while there is nothing to clear` test, added to all
   five popup fields — and the `_updateClearButton()` fix for the one field that
   failed it.
3. A value-level extension of #56's dead-selector check (does anything write
   *that value*, and read JS selectors as well as CSS). Groundwork for a future
   `data-part` move. Unrelated to `Clear`.

So the requirement was **not new**. The proof is in upstream's own code before
the fix: `_calendarTabStops()` already filtered on `!clearBtn.disabled`. The
*reader* of the state shipped; the *writer* never existed. Our port reproduced
both halves faithfully — `calendarTabStops` filters on `!b.disabled`
(`DateTimeField.tsx:1647`) while the button carried a comment saying "Never
disabled — the reference gives this button no disabled logic". A filter whose
predicate can never be false is a no-op that reads like a safeguard.

**That makes it structurally identical to the dead CSS in #56** — a read with no
write — and the second instance of that exact shape inside this one component.
It is also a third instance of the **F-040 theme**, "a check that passes while
checking less than it appears to", now with three distinct mechanisms:

| Instance | The thing that checked nothing | Found by |
|---|---|---|
| F-040 · RangeScale | an assertion running before attach, on a readout nothing rewrote | this project (RangeScale port) |
| F-040 · ToggleTip | `checkA11y` scoped to a selector matching nothing | this project (ToggleTip port) |
| the dead `td` CSS (#56) | a stylesheet rule keyed on an attribute nothing writes | this project (DateTimeField port, by reading) |
| **`Clear` (#57)** | **a tab-stop filter on a `disabled` state nothing ever set** | **the library**, via a new membership test |

The first three were found by reading or by suspecting a pass. The fourth needed
a *new kind of test*, and that is the part worth generalising: containment and
membership are different properties, and the suite had spent this whole port
proving the first while asserting nothing about the second. Upstream measured the
gap by mutation testing — 10 of 44 broken class selectors survived the entire
suite, the tab-stop lookups being the largest cluster — which is a technique this
project has not used and which found what four independent ports' worth of
reading did not.

#### A test that injects markup is inert against a port that takes props — so the state has to be demoed

#56's disabled-day test does not author a range; it rewrites the served HTML,
inserting `data-min="<this-year>-<this-month>-15T00:00"` next to every
`data-component="DateTimeField"`, because no kitchensink instance authors a range
(the reference's live demo uses `1900-01-01`, so nothing is ever out of range and
the disabled path had never been rendered anywhere).

**That technique does not survive the port.** `min`/`max` are props here and the
component reflects them *outward* to `data-min`/`data-max`; nothing reads the
attribute back. An attribute injected into the HTML after the fact lands in the
DOM as a duplicate and changes no behaviour, so the test would have failed with
zero disabled cells while the component was correct. The equivalent of upstream's
consumer-authored attribute is the prop, so `meeting-time` now authors
`min={fifteenthOfThisMonth()}` — computed on the server, and every route in this
app is `ƒ` (server-rendered on demand), so it tracks the request date rather than
freezing at build time. The 15th is upstream's own choice, kept for its reason:
it always has in-month days on both sides, so any displayed month contains a
disabled day and an enabled one.

Generalisable: **any upstream test that reaches into markup to set up state
tests the vanilla library's consumer-authoring channel, which in React is props.**
Those tests need a demo state, not a route interceptor — and the interceptor
failing looks exactly like a component defect.

#### Two harness traps hit while verifying this, one of them new

- **The documented concurrency guard deadlocks.** CLAUDE.md says check
  `ps aux | grep "[p]laywright test"` / `pgrep -f "playwright test"` is empty.
  With several agents active, that pattern **matches other agents' wait loops**,
  whose own command lines contain the string `playwright test` — five such
  processes were live with no runner at all. Every waiter therefore waits for
  every other waiter, forever; one of my runs was killed at its timeout having
  never started. Guard on the runner binary instead:
  `pgrep -fl "\.bin/playwright"`, which matched nothing at the same moment. This
  is F-049's advice failing on its own terms, and it is a one-word fix.
- **The `EADDRINUSE` trap reproduced exactly as documented, and cost a run.**
  `pkill -f "next start"` did **not** stop the server: after `npm start` execs,
  the listener's command line is `next-server (v16.3.1)`, which that pattern does
  not match. The new server died with
  `Error: listen EADDRINUSE: address already in use :::3200` while a stale one
  kept answering from a `.next` I had just overwritten under it — and the run
  came back **35 passed / 3 failed**, the three being my target tests' neighbours
  (`passes axe accessibility audit`, `root has data-initialized`) plus the known
  locale one. Both extra failures were artefacts; killing by listener PID
  (`lsof -nP -iTCP:3200 -sTCP:LISTEN -t`) and re-running gave 37/1 twice. Worth
  adding to the playbook: `pkill -f "next start"` is not a reliable stop for a
  Next production server, and reading the log is not sufficient protection if you
  only read it for `Ready in`.

**Result.** DateTimeField **34 passed / 4 failed → 37 passed / 1 failed**,
reproduced on two consecutive clean runs against a production build on `:3200`.
The one remaining failure is `de-DE renders German weekday names, not English
ones`, which is F-041's locale defect and another agent's work; the `Intl` path
was not touched. DateField re-checked at **48 passed / 1 failed**, its documented
baseline, with the same single locale failure — no regression in the component
upstream aligned this one to. (One intermediate DateField run showed a second
failure, `calendar is removed on outside click`; it did not reproduce and is
flake.) `build`, `lint` and `test:unit` (214 tests) all clean;
`git -C reference-components status --short` empty.
