# MonthField — Phase A findings

Scope: `MonthField` only. Kernel composed, not re-derived: `WheelColumn`,
`popup-position`, `popup-interaction`, `dates`, `locale`, `css-px`, `Wheel.css`.

**Result: 28 / 28 conformance tests green on the first run**, including both axe
audits (closed, and with the popup open). `npm run build` clean, MonthField lints
clean, 206 kernel unit tests green, `verify:appearance` clean, `verify:axe` clean
in both appearances (one pre-existing known Phase A `color-contrast` defect,
FileUpload's, unrelated), `git -C reference-components status --short` empty.

Two CSS edits, both PORTING.md-sanctioned: `.MonthField { overflow: hidden }`
and `.MonthField[data-initialized="true"] { overflow: visible }` removed. Verified
byte-identical before the edit (`shasum` match), and the only diff after it is
those two rules plus the replacement comment.

---

### F-NEW · The reference feeds `Intl` the *collapsed* translation key, so a locale with no bundled strings renders month names in English — the exact bug ADR-0011 says it fixed

**Surface:** `MonthField.ts` → `this.locale = resolveLocale(readLocale(el), translations)`,
then `getMonthName(year, month, this.locale)`. Measured in Chromium on
`/kitchen-sink/monthfield` (`web/tasks/probes/mf-measure.cjs`).

`resolveLocale` degrades a requested tag to a key that **exists in the
translation table** — `en-GB → en`, `sv-SE → sv`, and anything else → `en`. That
collapsed key is then used for two different jobs: the UI strings (correct) *and*
every `Intl` call that produces a month name (not correct).

ADR-0011 § Decision, point 4, states this was already found and fixed:

> "the components derived the hour cycle and date-segment order from the
> *collapsed* translation key (`en-GB` → `en`) […] Format is now derived from the
> **raw locale tag** (Intl), while the collapsed key is used only for UI-string
> translations".

MonthField's month names were not included in that fix. Measured, with the popup
open, reading the real `.option` text off the month wheel:

| `data-locale` | collapsed key | month wheel renders | `Intl` on the **raw** tag | UI strings |
|---|---|---|---|---|
| `en-GB` | `en` | January … December | June → `June` | English ✓ |
| `sv-SE` | `sv` | januari … december | June → `juni` | Swedish ✓ |
| **`de-DE`** | **`en`** | **January … December** | June → **`Juni`** | English (expected — no `de` strings) |

`Intl.DateTimeFormat.supportedLocalesOf(['de-DE'])` returns `['de-DE']`, so the
platform has the data; only the collapsing throws it away. The month segment's
`aria-valuetext` carries the same wrong string (`"June 2026"` in a German field),
so a screenreader announces it too.

Note what makes this hard to notice: for **every locale the reference kitchensink
authors** the two are identical, because `en-GB→en` and `sv-SE→sv` are
name-preserving collapses. The bug is invisible until a locale without bundled
strings appears — which is the common case for a real consumer.

**Decision:** ported **verbatim** for Phase A (fidelity is the whole point of the
phase, and the output is identical for every authored state). The `de-DE` cell in
the Localization block is our addition and exists solely as the standing probe —
open its picker and the divergence is visible. The Phase B / upstream fix is one
line: keep `localeKey` for `t.*` and pass the **raw** `locale` prop to
`getMonthName`. Marked with a `NOTE (measured …)` comment at the call site in
`MonthField.tsx` so it cannot be lost.

**Upstream suggestion:** apply ADR-0011's own rule to MonthField (and check
WeekField, which renders no names but does derive an ISO week year). Better
still, make it structural: `readLocale`/`resolveLocale` could return **both** —
`{ raw, key }` — so a consumer cannot accidentally hand the translation key to
`Intl`. Right now the two are the same `string` type and the mistake is
type-invisible.

---

### F-NEW · The kernel's `Wheel.css` fades toward the system colour `Canvas`, so the wheel edges paint the UA's `#121212` inside our `#232320` popup

**Surface:** `web/src/kernel/Wheel.css` → `.WheelColumns::after`. Measured
`web/tasks/probes/mf-canvas-fade.cjs`.

The wheel's top/bottom fade is meant to dissolve the spinning numbers into the
popover surface:

```css
.WheelColumns::after {
  background: linear-gradient(Canvas, transparent 38px, transparent calc(100% - 38px), Canvas);
}
```

`Canvas` is a **system colour**: appearance-aware but not design-system-aware —
the distinction CLAUDE.md already records from FileUpload. Resolved values, read
off the live gradient (the first colour stop *is* the colour painted at the
column's top edge):

| Appearance | Popup surface `var(--ui-surface)` | Fade end (`Canvas`) | Ratio |
|---|---|---|---|
| light | `#ffffff` | `#ffffff` | **1.00** — seamless, by coincidence |
| dark | `#232320` (our card) | **`#121212`** (the UA's) | **1.19** — a visible band |

So in dark the fade does not fade *into* the popup; it fades into a darker
rectangle at the top and bottom of every wheel column, in all four popup fields
that compose the kernel. It is a purely cosmetic defect — axe reports zero
violations in either appearance, because the affected pixels carry no text at the
fade's opaque end — but it is exactly the failure mode ADR-0021 names: "a token
that never gained a dark half simply stays light while everything around it
flips", invisible to any structural test.

Three tiers, for the record: a literal (`white`) would be wrong in both
appearances; `Canvas` is right in light and off in dark; `var(--ui-surface)` is
right in both.

**Decision:** leave it verbatim. It is in `web/src/kernel/**`, which this task
must not edit, and Phase A forbids restyling anyway. **Open question for the
kernel owner:** the fade's whole job is to match the surface the popup paints,
and every consumer of `Wheel.css` already declares `--ui-surface`. Changing the
two stops to `var(--ui-surface, Canvas)` keeps the reference's system-colour
default for a consumer who declares nothing and becomes exact for one who does —
a strictly better default with no new token. Same argument as F-006/F-003.
Worth reporting upstream against `kernel/css/Wheel.css`, not against MonthField.

---

### F-NEW · Everything else in MonthField's popup goes through the `--ui-*` seam correctly, and both appearances clear their floors

**Surface:** `web/tasks/probes/mf-measure.cjs`, popup **open**, both appearances.

A positive finding, and the one that makes the `Canvas` fade above stand out as
the single exception. Every other colour the open popup paints is a `var(--ui-*)`
read, so it follows `color-scheme` with no `dark:` variants:

| Painted role | Token chain | Light | Dark | Floor |
|---|---|---|---|---|
| wheel option text on popup | `--_wheel-color` → `--ui-surface-foreground` | **15.38** | **13.93** | 4.5 |
| selected option (bold) | `--_wheel-color-selected` → `--ui-primary` | **5.01** | **6.09** | 4.5 |
| footer buttons | `--ui-primary` | **5.01** | **6.09** | 4.5 |
| popup border vs card | `--_mf-popup-border-color` → `--ui-border` | **4.12** | **4.81** | 3.0 (1.4.11) |
| separator / placeholder | `--_mf-color-muted` → `--ui-muted-foreground` | **7.11** | **7.84** | 4.5 |
| overlay (field) border | `--_mf-border-color: currentColor` | **7.11** | **7.84** | 3.0 (1.4.11) |
| selection band | `--ui-hover` (4 % ink, alpha) | follows | follows | n/a |

Note the last row of the field itself: `--_mf-border-color: currentColor` is not
a `--ui-*` read but it is *better* than one — it inherits the text colour, so a
consumer cannot desynchronise the control edge from its label. It lands at
7.11 / 7.84 against the card, well over 1.4.11's 3:1.

`--_mf-popup-shadow` → `--ui-shadow` is our 1px ring (F-006), and it is what
delineates the popup: `popup bg vs card bg` measures **1.00 in both
appearances**, i.e. the surface alone provides *no* separation. Without F-006's
ring-as-shadow substitution the popup would be invisible against a card.

One further seam bypass, cosmetic and much smaller than the fade:
`--_mf-border-color-hover: CanvasText`. It resolves to `#000000` in light (vs our
ink `#26251e`) and `#ffffff` in dark (vs `#f2f1ec`) — a pure-black/pure-white
hover edge in a warm system that never uses either. 21.00:1 and 15.76:1, so
never a contrast failure; just off-palette. Same shape as ChoiceField's
`--_cf-selected: CanvasText`. Phase B: `var(--ui-foreground, CanvasText)`.

---

### F-NEW · The suite's `data-initialized` wait is the right gate *only if* the attribute is gated on hydration — and here it is, which turns a race into a guarantee

**Surface:** `MonthField.e2e.test.js` `beforeEach`, and the `async`-chunk race
CLAUDE.md now records (Next injects client chunks as `<script async>`, which does
not delay `load`, so `page.goto()` resolves before hydration).

Two ways to satisfy F-010's "keep emitting the attribute":

1. render `data-initialized="true"` literally, as ToggleTip does. The SSR HTML
   then already carries it, so `beforeEach`'s `waitFor` resolves **immediately**
   and gates nothing. Every later assertion races hydration.
2. gate the attribute on the same `useSyncExternalStore` that decides
   `data-input-mode`, whose **server snapshot is `null`**. The attribute appears
   only once the client has actually run.

MonthField takes (2), and it converts the spec's own gate into a true hydration
barrier for all 28 tests. Measured (`web/tasks/probes/mf-contract.cjs`):

```
goto resolved at +105 ms;  data-initialized="true" at +173 ms
dead-control window: 68 ms
```

That is honest rather than cosmetic: for those 68 ms the segments really are
`tabindex="-1"` and the trigger really does nothing, because on a coarse pointer
this component must render a *different* face (ADR-0006) and the pointer query
cannot run on the server. The SSR markup is the correct no-JS end state — native
`<input type="month">` visible, overlay `display: none` — so the window degrades
to the native control rather than to a dead custom one.

**Decision:** option (2), and **no parser-blocking bootstrap.** RangeGroup's
bootstrap works because its `attach()` only computes attributes, so the same
function can run twice from two entry points. MonthField's behaviour *is* React
state — segment values, digit buffer, popup, two `WheelColumn` instances — and
there is no attribute-only subset to hoist. Serialising it would mean shipping a
second, vanilla implementation of the component, which is the fork the kernel
exists to prevent. The correct mitigation for the window is the one the reference
already has: the native input is a real, submittable control the whole time.

**Upstream suggestion:** worth a line in PORTING.md that `data-initialized`
should be emitted *when JS has run*, not unconditionally — the attribute is only
load-bearing as a gate if it can be false.

---

### F-NEW · `react-hooks/refs` fires on a props-factory called during render, not only on the handler itself

**Surface:** `MonthField.tsx`, the first draft's `segmentProps(type)` helper.

CLAUDE.md's entry says a ref-dereferencing helper "lives outside the component
and takes the value as a parameter". That is necessary but not sufficient, and
the gap cost time here. Both segments need ~14 identical ARIA/`data-*` props, so
the obvious shape is a small factory:

```tsx
const segmentProps = (type) => ({ role: "spinbutton", …,
  onKeyDown: (e) => onSegmentKeyDown(e, type),   // ← error
  onBlur: () => { setFocused(null); flushDigitBuffer(type) },  // ← error
})
…
<span {...segmentProps("month")}>
```

`onSegmentKeyDown` and `flushDigitBuffer` read `digitRef.current` / `valRef.current`.
They are only ever *called* from an event, but the rule reports

> `Passing a ref to a function may read its value during render`

on the **reference to them inside the factory**, because the factory is invoked
during render, so the compiler cannot prove the closure escapes to an event
handler. 4 errors, 0 of them real. The identical closure written inline in JSX
(`onKeyDown={(e) => onSegmentKeyDown(e, "month")}`) is accepted, because a JSX
prop is not a render-time call.

**Decision:** the factory returns **only static attributes** (`segmentAria`);
the three handlers are written inline on each `<span>`. Costs six duplicated
lines across two segments and is documented at the call site.

**Generalisable rule, worth adding to the trap list:** with `react-hooks/refs`,
*where a closure is created* matters as much as what it reads. Never build event
handlers inside a helper that render calls — pass them as JSX props. (Noted
because `WeekField.tsx` is currently red on `npm run lint` with the same four
errors at `WeekField.tsx:1006-1012`, arrived at from the same reasoning — a
segmented field pushes every porter into this shape.)

---

### F-NEW · MonthField ships **no** entrance animation — unlike ToggleTip, whose docs say the same and whose CSS disagrees

**Surface:** `MonthField.css`, `kernel/css/Wheel.css`, checked against
`ToggleTip.css`. The task asked for this either way.

```
$ grep -nE "transition|animation|@keyframes" MonthField.css Wheel.css
  (Wheel.css:51  will-change: opacity, transform)   ← a hint, not an animation
$ grep -nE "transition|animation|@keyframes" ToggleTip.css
  153:  transition: opacity 0.15s;
```

The three `opacity` declarations in `MonthField.css` are all static states
(`0.5` disabled, `0` for the hidden native input in each mode) with no
transition. The popup appears at full opacity on the frame it is inserted.

So `e2e-helpers/target.js`'s claim — "the reference popups appear at full
opacity (no fade), so `AXE_SETTLE` is a deliberate no-op by default" — is
**true for MonthField** and false for ToggleTip, which the ToggleTip port already
recorded. The port keeps the no-animation behaviour: both axe runs pass with
`AXE_SETTLE` unset, so nothing masks a real contrast failure behind a settle
wait.

---

### F-NEW · Dropping the init gate is what makes the popup visible, and it costs nothing in Reflow here

**Surface:** the two removed CSS rules; `web/tasks/probes/mf-measure.cjs`.

Worth recording because the removal is *not* obviously free. `.rail` is
`position: absolute; width: min(100vw, calc(100vw - 2rem))` — 288 px at a 320 px
viewport, centred on the field. With `overflow: hidden` on the root that box is
clipped and contributes nothing to scrollable overflow; with the gate dropped it
does, and an absolutely-positioned box **does** propagate to the document's
scroll width. On a field sitting in the right half of a narrow viewport that is a
candidate WCAG 1.4.10 Reflow failure that axe cannot see (F-024).

Measured on `/kitchen-sink/monthfield`, gate dropped, 14 instances:

```
 320px overflow 0px   360px 0px   480px 0px   768px 0px   1024px 0px   1280px 0px
```

Zero at every width. `Cell`'s `min-w-0` (F-024) is doing the work — the flex
track shrinks, the field stays narrow, and the rail's centre never gets close
enough to the right edge. Recorded as a **positive** finding with a caveat: the
result depends on the *host layout*, not on MonthField, so a consumer who places
one of these near the right edge of a narrow fixed-width container can still
produce overflow. The project-wide `verify:reflow` on `/` currently reports 2 px
at 320 px, and it is **not** MonthField — `/` does not yet mount this section
(`curl / | grep -c MonthField` → 0); the offenders it names are a `li.item` and a
`th.border…bg-canvas`.

---

### F-NEW · Seven contract points the conformance suite never asserts — verified by probe

**Surface:** `web/tasks/probes/mf-contract.cjs`. 28 / 28 green is a weaker
statement than it looks; these are all in `MonthField.md` and none are in the
spec.

| Contract point | Source | Measured |
|---|---|---|
| light dismiss must **never** refocus the trigger | ADR-0007 | popup closed, `activeElement` stayed on the element that had focus (`mf-native-default`) — **not** the trigger ✓ |
| Escape *does* refocus | ADR-0007 | `activeElement.className === "trigger"` ✓ |
| `_enforceBounds` clamps the combined value below `data-min` | `## Value sync` | typed `01` with `min=2026-03` → native `2026-03`, month `aria-valuenow=2` ✓ |
| …and above `data-max` | `## Value sync` | typed `12` with `max=2026-09` → native `2026-09`, `aria-valuenow=8` ✓ |
| year segment bounds derive from `data-min`/`data-max` | `## Segments` | `aria-valuemin=2026 aria-valuemax=2026` (unbounded instances: 1926…2126, i.e. ±100) ✓ |
| month digit fast-advance (first digit ≥ 2) | `## Keyboard` | pressing `5` alone → text `05`, focus already on `year`, no 400 ms wait ✓ |
| Backspace empties the native value **without dispatching** | `## Events` | native `""`, event log `[]`, `data-has-value` absent ✓ |
| segments are ONE tab stop (roving tabindex) | `## Keyboard` | `month=0, year=-1` (+ the trigger) ✓ |

The last row is the one a naive port gets wrong most cheaply: rendering
`tabIndex={0}` on both segments passes all 28 tests and silently adds a tab stop.

Also confirmed the kernel's undocumented requirement: each `.Wheel` host carries
a unique `id` and therefore a distinct `aria-activedescendant`
(`…-wheel-month-front` / `…-wheel-year-front`). Sharing one id makes both columns
point at `wheel-front`, and no assertion in the suite would notice.

---

### F-NEW · The value has to live in a ref *and* in state, and the reason is the kernel's own API shape

**Surface:** `MonthField.tsx` → `valRef` + `val`.

Recorded because it looks like a smell and is not, and because the other four
popup fields will meet it identically.

`WheelColumn`'s published contract is a class constructed with `{ value, format,
onChange }` (the kernel port's header explains why it stays a class). A React
component must construct it inside an effect, which means `format` and `onChange`
are closures created **once per popup open**. Reading render state in them
captures the month/year as of the open, so the second wheel spin computes from a
stale value — and nothing in the suite catches it, because each of its wheel
tests spins exactly once.

The second force is the event contract: the suite asserts the *exact* sequence
`['input','change']` per footer press. Dispatching from an effect keyed on state
double-fires under StrictMode and re-fires on unrelated re-renders.

**Decision:** `valRef` is authoritative and `val` is for rendering; one
function, `applyValue`, writes the ref, the DOM value, the dispatch and the
render state in a single synchronous pass — the same ordering as the reference's
`_setSegmentValue → _enforceBounds → _syncToNative` chain. Every mutation
function reads `valRef.current` rather than render state, which is exactly what
makes a closure captured at popup-open time stay correct forever, and what let
the popup effect keep `[open]` as its only dependency (no wheel is ever rebuilt
mid-interaction).

Two suppression mechanisms the reference needs disappear:
- `_suppressEvents` is replaced by an explicit `DispatchMode`
  (`"silent" | "auto" | "force"`) argument, which is per-call rather than an
  instance flag — no re-entrancy window.
- the native `change` listener's self-dispatch guard is a value comparison
  (`raw === isoOf(valRef.current)`) rather than a flag, so it cannot get stuck.

That listener is `addEventListener`, not React's `onChange`: we dispatch native
events ourselves, and in `display` mode the platform picker writes the value —
React's deduplicated synthetic `onChange` sees neither.

---

### F-NEW · `registerLocale` is a published static that cannot survive the port

**Surface:** `MonthField.md` → `## JS API`
("Statics: `MonthField.attach(parent?)` and `MonthField.registerLocale(locale, strings)`").

`attach()` has an obvious React answer — rendering *is* attaching. `registerLocale`
does not. It mutates a module-level map after modules have loaded; a React
component that already rendered with the old map does not re-render, so the call
appears to succeed and changes nothing until something else happens to re-render.
An imperative registry is exactly CLAUDE.md's "a published imperative API cannot
be React state".

**Decision:** not ported. The component takes a `translations` prop merged over
the bundled `en`/`sv` — the declarative equivalent, and it composes: two
instances can carry different tables, which the static registry cannot express.
`en` and `sv` are ported verbatim, so `resolveLocale`'s region-degradation
(`sv-SE → sv`) is unchanged and the suite's `aria-label = "Choose month"`
assertion holds.

---

### F-NEW · Small documentation drifts in `MonthField.md`

**Surface:** `MonthField.md` vs `states/*.hbs`.

- `## Attributes` → `data-locale`: "…`sv-SE` is the kitchensink's authored
  value". It is not: every state partial except `_locale-sv-se.hbs` authors
  `en-GB`. ADR-0011 changed the demo default to English and this sentence was not
  updated with it. A porter following the `.md` would author the wrong locale on
  13 of 14 instances — and would then *fail* the spec, since
  `popup has localized aria-label` asserts the literal English `"Choose month"`.
- `## Events` and the screenreader checklist name the footer buttons "Rensa" /
  "Denna månad", the Swedish strings, in an otherwise-English document. Same
  drift, same cause.
- `## Kernel dependencies` omits the `_getCSSPx` probe that `_updateLayout`
  depends on. It is duplicated privately in six components; this port composes it
  from `@/kernel/css-px` (promoted by the kernel port). Worth listing.

**Decision:** followed the *partials*, not the prose — they are the authored end
state and they agree with the spec. No impact on the port beyond noticing it.

---

### F-NEW · The residual small-ICU risk does not touch MonthField's browser behaviour, and its e2e suite is locale-independent

**Surface:** the kernel port's open risk (`findings/kernel.md`: a small-icu Node
build resolves `sv-SE` to `en-US`, so `getMonthName(2026, 2, 'sv-SE') === 'mars'`
fails in CI while the browser stays correct). Not re-measuring the Node/Chromium
ICU comparison — that is already done and found zero differences.

The narrower question for this component, measured in Chromium:

- **Every string the spec asserts is a bundled translation, not an ICU output.**
  The only locale-sensitive assertion is
  `toHaveAttribute('aria-label', 'Choose month')`, which comes from
  `TRANSLATIONS.en.popupLabel` — a literal in the component. No test reads a
  month name. So MonthField's 28 tests are green on a small-icu host too.
- **The rendered month names are pure ICU** and would be the visible casualty:
  on small-icu, `sv-SE` would render `January…December` in the wheel and in
  `aria-valuetext`. That affects a *server-side* renderer of this component (a
  Node SSR pass emitting the segments), which is precisely what our port does
  — the segments and their `aria-valuetext` are server-rendered.
- Measured here: `Intl.DateTimeFormat.supportedLocalesOf(['sv-SE'])` →
  `['sv-SE']` in Chromium, and `process.config.variables.icu_small === false`
  in this Node, so both halves are full-ICU and the SSR/CSR month names agree
  (`juni` on both).

**Open question:** an SSR host with small-icu and a browser with full ICU would
produce a **hydration mismatch** on the month segment's `aria-valuetext`
(`June 2026` from the server, `juni 2026` from the client) — a class of failure
neither the kernel's unit tests nor the e2e suite can see, because each runs in
one runtime only. Cheap guard for a real deployment: assert
`Intl.DateTimeFormat.supportedLocalesOf(['sv-SE']).length === 1` at build time,
or ship `full-icu`. Worth naming in PORTING.md for anyone server-rendering a
locale-aware component.
