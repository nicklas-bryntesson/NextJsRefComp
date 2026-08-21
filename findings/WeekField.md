# WeekField — findings

**Result: 31 / 31 conformance tests green on the first run**, including both axe
audits (zero WCAG 2 AA violations, closed and popup-open). No assertion was
weakened, no test was skipped, and `git -C reference-components status --short`
is empty.

Project gates from `web/`: `build` ✓ · `lint` ✓ · `test:unit` 206 ✓ ·
`verify:appearance` ✓ · `verify:axe` — WeekField's own route 0 violations in
**both** appearances; the aggregate `/` still carries the one known Phase A
`color-contrast` defect (F-027, not WeekField, which is not yet mounted there) ·
`verify:reflow` — `/kitchen-sink/weekfield` 0 px horizontal overflow at
320/360/480/768/1024/1280 px; the 2 px failure on `/` at 320 px is on
`span.label` / `li.item` / `th.bg-canvas`, i.e. other components' cells.

Probes written for this port (all in `web/tasks/probes/`, gitignored):
`wf-iso-browser.cjs`, `wf-colours.cjs`, `wf-init-gate.cjs`,
`wf-axe-popup-dark.cjs`.

---

### F-NEW · `data-initialized` shipped in the server markup makes the suite's own gate a lie — gate it on hydration instead

**Surface:** `WeekField.tsx`, `WeekField.e2e.test.js` `beforeEach`. Measured with
`web/tasks/probes/wf-init-gate.cjs`.

Every spec in the library opens with
`await page.locator('…[data-initialized="true"]').waitFor()`. Upstream that gate
is honest for a reason nobody writes down: `attach()` runs from a **non-async**
`<script type="module">`, which is deferred and therefore *delays the `load`
event* that `page.goto()` resolves on. By the time the suite looks, the component
is live.

Next injects client chunks as `<script async>`, which does not delay `load`. The
naive port — render `data-initialized="true"` as a literal, as ToggleTip does —
therefore puts the attribute in the **server HTML**, so the gate opens before a
single handler exists. Measured, 4 runs:

```
server HTML carries data-initialized: false   ← after the fix
server HTML carries data-input-mode : true

run 1: present at goto-resolution=no  gate opened +94ms  popup responds immediately=true
run 2: present at goto-resolution=no  gate opened +90ms  popup responds immediately=true
run 3: present at goto-resolution=no  gate opened +94ms  popup responds immediately=true
run 4: present at goto-resolution=no  gate opened +95ms  popup responds immediately=true
```

90–95 ms is not a test artefact — it is a real window in which a rendered,
fully-painted week field does not respond to a click.

**Decision:** gate the attribute on hydration, read through
`useSyncExternalStore` with asymmetric snapshots (server `false`, client `true`)
— the ScrollArea / MotionRegion shape, which is also the only lint-clean one
(`useEffect(() => setState(true), [])` is a `react-hooks/set-state-in-effect`
error). The gate then means what the suite assumes it means, the retrying
`waitFor` covers the entire window, and no bootstrap script or test-side sleep is
needed. This is a *narrower* reading of Findings F-010 than "render the attribute
literally": keep emitting it, but emit it **when it becomes true**, not when the
markup is formed.

**But do NOT gate `data-input-mode` the same way**, and that split is the
interesting part. `WeekField.css` defaults to `.native { display: block }` /
`.overlay { display: none }`, and only `[data-input-mode="custom"]` inverts them.
Withholding that attribute until hydration would flash a raw, unstyled
`<input type="week">` for the same 90 ms. So `data-input-mode` ships in the
server markup (server snapshot `"custom"` — ADR-0006's own safe guess and the
value the suite asserts on a fine pointer) and only the *behaviour* gate waits.
**Paint attributes belong in the SSR markup; behaviour gates must not.** The two
look identical in the reference because its `attach()` sets both in the same
statement.

---

### F-NEW · `--_wf-border-color-hover: CanvasText` is the one token that bypasses the `--ui-*` seam — and it fails as a *design* divergence, not an accessibility one

**Surface:** `WeekField.css` root token block. Measured with
`web/tasks/probes/wf-colours.cjs` in both appearances, popup open.

Every painted colour in the component follows the appearance flip. All 22
measured surfaces differ between `data-appearance="light"` and `"dark"`:

| Surface | light | dark |
|---|---|---|
| popup background | `rgb(255,255,255)` | `rgb(35,35,32)` |
| popup text | `rgb(38,37,30)` | `rgb(242,241,236)` |
| weekday head / week-number cell / outside-month day (muted) | `rgb(90,88,82)` | `rgb(185,183,175)` |
| footer link | `rgb(200,64,0)` | `rgb(255,122,64)` |
| selected week row fill / text | `rgb(200,64,0)` / `rgb(255,255,255)` | `rgb(255,122,64)` / `rgb(26,26,23)` |
| popup border | `rgb(128,125,114)` | `rgb(145,142,132)` |
| popup shadow ink | `rgb(207,205,196)` | `rgb(77,75,69)` |

Contrast, both appearances:

| Pair | Light | Dark | Floor |
|---|---|---|---|
| popup body text on popup | **15.38** | **13.93** | 4.5 |
| muted (weekday head, week numbers, outside-month days) on popup | **7.11** | **7.84** | 4.5 |
| footer link ("This week" / "Clear") on popup | **5.01** | **6.09** | 4.5 |
| selected row text on the primary fill | **5.01** | **6.74** | 4.5 |
| selected row **week-number** on the primary fill | **5.01** | **6.74** | 4.5 |
| popup border vs page (1.4.11) | **3.84** | **5.32** | 3.0 |
| segment / prefix text on page | **6.63** | **8.68** | 4.5 |

Only two of the component's 20 tokens hold an appearance-blind *literal*:

- **`--_wf-border-color: currentColor`** — correct in both. It resolves against
  the inherited `color`, which the design system sets to `--color-body`:
  `rgb(90,88,82)` light, `rgb(185,183,175)` dark, 7.11 / 7.84 against the page.
  A **positive** finding: `currentColor` is the one non-`--ui-*` value that is
  both appearance-aware *and* design-system-aware, because it delegates rather
  than naming a colour.
- **`--_wf-border-color-hover: CanvasText`** — tier 2 of CLAUDE.md's three tiers.
  Appearance-aware but **not** design-system-aware. Measured on the overlay with
  the pointer over it: `rgb(0,0,0)` in light and `rgb(255,255,255)` in dark,
  where the design's ink is `#26251e` / `#f2f1ec`. (Worth knowing for anyone
  re-running this: Playwright's `.click()` leaves the mouse on the trigger, so
  the overlay is `:hover` during a naive measurement — the *resting* border is
  `currentColor` and only the hover state exposes `CanvasText`.)

This one does **not** fail WCAG: pure black on the warm cream measures 19.57:1
and pure white on the warm near-black 17.44:1, i.e. it over-shoots rather than
under-shoots. It is a *fidelity* divergence — a hard black hairline appearing on
hover inside a system whose entire depth model is delicate warm hairlines
(Findings F-003, F-006).

**Decision:** left verbatim in Phase A, per the two-phase rule. **Phase B fix:**
`--_wf-border-color-hover: var(--ui-surface-foreground)`, which is `#26251e` /
`#f2f1ec` — the design's ink, still appearance-reactive, and it keeps the
"hover darkens the edge" intent that `currentColor → CanvasText` was expressing.
Nothing goes into `ui-tokens.css`; the role already exists.

This adds WeekField to the list F-0xx keeps (ScrollArea's `--_sb-*` oklch
literals, ChoiceField's `--_cf-selected: CanvasText`, Notice's `CanvasText` body
text) — with the useful distinction that this instance is *over*-contrasty, so a
pass/fail sweep would never have surfaced it.

---

### F-NEW · The ISO-week hazards: what the kernel already covers, and what only the browser can show

**Surface:** `web/tasks/probes/wf-iso-browser.cjs` — 12 / 12 checks pass in
Chromium, driving the real control (popup nav buttons, real segment keystrokes),
not the arithmetic.

**Already covered, not re-tested here:** the kernel's `dates` port carries 85
unit tests and its porter measured Node-vs-Chromium ICU as identical across six
locales. `getISOWeek`, `getISOWeekYear`, `getDateOfISOWeek`, `formatWeekISO` and
`parseWeekISO` are therefore taken as given. Nothing about week numbering is
re-derived in `WeekField.tsx`. The single week helper the kernel does not export,
`weeksInISOYear`, is written as a **one-line composition of a kernel-tested
function** — `getISOWeek(new Date(y, 11, 28))`, because Dec 28 is always in the
last ISO week of its own week-year — rather than a second implementation of the
"53 weeks iff Jan 1 is a Thursday, or a leap year whose Jan 1 is a Wednesday"
rule. That rule is exactly the kind of thing a port gets subtly wrong.

**What this port measured, which no unit test can reach** — the component's own
*rendering* decisions at the boundary:

| Browser-level check | Evidence |
|---|---|
| week 1 of 2026 renders inside the **December 2025** grid | month label `"December 2025"`, row `data-week="2026-W01" data-weekyear="2026"`, days `29 30 31 1* 2* 3* 4*` |
| that row's Monday is 29 December and is *not* marked outside-month | `days[0] = 29`, `data-outside-month` absent |
| the December 2025 grid spans **two** ISO week-years | weekyears present: `2025, 2026` |
| `data-week === weekyear-W(pad(weeknum))` for every rendered row | `2025-W49 … 2025-W52 2026-W01` |
| 2026 is a **53-week** year and `2026-W53` renders | Dec 2026 rows `…W49 W50 W51 W52 W53` |
| Jan 2027 *also* shows `2026-W53` (2027-01-01 is in the 2026 week-year) | `2026-W53 2027-W01 2027-W02 …` |
| the Dec↔Jan wrap never produces a phantom `2027-W53` | asserted absent |
| 2025 is a **52**-week year — no `2025-W53` anywhere | `…2025-W52 2026-W01` |
| the week segment's `aria-valuemax` tracks the year's real 52/53 | year 2026 → `53`, `1` + ArrowDown wraps to `53`, native `2026-W53` |
| the same for a 52-week year | year 2025 → `52`, wraps to `52`, native `2025-W52` |
| `min`/`max` disable **exactly** the out-of-range rows | `2026-W09[x] 2026-W10 2026-W11 …` |
| the bounds are **inclusive** — the boundary week itself is selectable | `2026-W10` carries no `data-disabled` |

The failure mode this guards against is specific and would have been silent: the
grid is built from `viewYear`/`viewMonth`, so the tempting shortcut is to label a
row `${viewYear}-W${week}`. That is correct for ~50 of every 52 rows and wrong
exactly at the boundary — and the spec's own boundary test only asserts the
*internal consistency* of `data-week` / `data-weekyear` / `data-weeknum`, so a
port that derived all three from `viewYear` would pass it. The invariant that
actually matters (`weekyear` comes from the row's Monday via the kernel) is
measured above, not by the suite.

**Positive finding:** the reference's own comment — "the component always derives
the year from the kernel helpers on the row's Monday, **never** from the visible
month" — is load-bearing documentation, and the one place in this component's
`.md` that saved real work rather than describing it.

---

### F-NEW · `WeekField` declares no wheel, and the popup-field family is not one shape

**Surface:** `WeekField.md` `## Kernel dependencies` + `## Non-goals`, the spec's
selector inventory.

Worth recording because the family reads as interchangeable from outside and is
not. WeekField is a **calendar-grid** picker with a leading week-number column,
matching the native week pickers (iOS Safari 18.2+, Chrome desktop). Its `.md`
says so in bold — *"WeekField does NOT use `WheelColumn` — it is a calendar-grid
picker, not a wheel picker"* — and `## Non-goals` opens with "No wheel picker
(this is a calendar-grid week picker; MonthField owns the wheel model)".

Confirmed against the portable contract: `WeekField.e2e.test.js` contains **zero**
`.Wheel` selectors. The class names it does select on, all preserved verbatim
per F-008:

`.overlay` · `.native` · `.segments` · `.segment[data-segment="week"|"year"]` ·
`.trigger` · `.popup` · `.calendar-grid` · `thead th.week-number-head` ·
`tbody tr` · `td.week-number-cell` · `td[role="gridcell"]` · `.prev-month` ·
`.calendar-footer-now` · `.calendar-footer-clear`

plus `.rail`, `.prefix`, `.separator`, `.arrow`, `.calendar-header`,
`.calendar-month-year`, `.next-month`, `.calendar-footer`, `.announce` from the
stylesheet.

**Decision:** `@/kernel/Wheel.css` is deliberately **not** imported. It would
ship a CSS chunk with no matching element. (The instruction to import it, and the
"a wheel popup is a prime candidate" framing for the colour work, both came from
the family-wide brief rather than this component's contract — the contract wins.)
Two of the four kernel modules the `.md` declares are used
(`popup-position`, `popup-interaction`, `dates`, `locale`); `WheelColumn` and its
`aria-activedescendant`/unique-`id` hazard do not apply here.

---

### F-NEW · The JSX-whitespace trap does not apply to a JS-built segment row — measured

**Surface:** `.segments`, `web/tasks/probes/` ad-hoc min-content measurement.

The known trap: Handlebars puts each inline span on its own source line, giving a
collapsible whitespace text node between siblings and therefore a soft-wrap
opportunity; JSX siblings emit none, so a row of `white-space: nowrap` spans
becomes one unbreakable inline box (measured elsewhere: 285 px vs 155 px
`min-content`). A segmented field is exactly that shape, so this looked like a
certain hit.

It is not, and the reason is worth recording: WeekField's segments are **not
authored in the template**. `_buildSegments()` creates them with
`document.createElement` + `appendChild`, which produces **no whitespace text
nodes at all**. The reference DOM and the JSX DOM are identical here. Measured on
the live instance:

```
whitespaceTextNodes: []      childCount: 4      (prefix, week, separator, year)
segments min-content: 99px   root min-content: 149px   root actual width: 151px
```

`min-content` is within 2 px of the rendered width — no inflation — and the
320 px reflow sweep is clean.

**Decision:** emit **no** `{" "}` separators. Adding them would have been the
"legitimate Phase A fix" for a template-authored row, but here it would *create* a
divergence from the reference DOM rather than restore it. **The rule generalises
to: check whether the reference builds the row in the template or in JS before
reaching for `{" "}`.** Three of the five popup fields build their segments in JS.

---

### F-NEW · `react-hooks/refs` fires on a *helper called during render*, not on the closure that touches the ref

**Surface:** `WeekField.tsx`, six lint errors on first run.

The known trap says a ref-dereferencing helper must live outside the component
and take the value as a parameter. That covers the module-level case
(`updateLayout`, `popupTabStops` here) but not the one that actually bit.

`segmentProps(type)` is a render-time helper returning the spread props for one
segment, including its handlers. `onBlur` closed over `bufferTimer.current` (via
`flushBuffer()`). The closure never runs during render — but `segmentProps()`
*is called* during render, and the rule follows the call:

```
999  react-hooks/refs  Cannot access refs during render
1008 react-hooks/refs  Cannot access refs during render
1009 react-hooks/refs  Passing a ref to a function may read its value during render
```

Identical code as a handler defined directly in JSX, or as a component-body
function *referenced* from JSX, is accepted. So the rule's real boundary is
**"was this function body evaluated during the render pass"**, not "does a
closure eventually read a ref".

**Decision:** hoist `onSegmentFocus` / `onSegmentBlur` to the component body and
wire `onKeyDown` / `onFocus` / `onBlur` in JSX; `segmentProps` returns pure
attributes only. No disable comment. Zero lint errors, and the JSX is more
readable for it. Worth knowing before writing a props-factory helper for a
repeated part — which is the natural shape for a segmented field, and the shape
the rule quietly rejects.

---

### F-NEW · Two published API surfaces from `## JS API` have no honest React equivalent

**Surface:** `WeekField.md` `## JS API`.

The contract publishes `WeekField.attach(parent?)`, `WeekField.registerLocale()`,
`WeekField.supportsNativeWeek()` and an instance `destroy()`. What each became:

| Reference API | React |
|---|---|
| `attach(parent)` | dissolves — mounting *is* attaching; the idempotence guard (`__weekFieldInstance`) has no analogue because React never double-mounts a node |
| `destroy()` | dissolves — effect cleanups are the same thing, expressed once per concern instead of once per component |
| `supportsNativeWeek()` | exported unchanged; it is a pure feature probe |
| `registerLocale(locale, strings)` | **not shipped** |

`registerLocale` mutates a static `Record` at runtime, before or between
`attach()` calls. A published imperative API cannot be React state, and a
module-level mutable registry that render reads is exactly the shape React 19's
rules exist to reject — a `registerLocale()` call after first paint would not
re-render anything that already read the old table.

**Decision:** not ported in Phase A. Nothing in the conformance suite exercises
it, and the two shipped locales (`en`, `sv`) cover every assertion, including the
one that pins the popup label to the literal `"Choose week"`.

**Open question:** the honest React equivalent is a prop or a context provider
carrying the string table, which is a *different* API rather than a port of this
one. Should the port ship `<WeekFieldLocaleProvider>`, accept a `strings` prop, or
leave localisation as the consuming app's concern? This is not WeekField-specific
— all five popup fields plus `Notice` publish a `registerLocale`, so it wants one
project-level answer.

---

### F-NEW · `readLocale`'s `<html lang>` step is unreachable from a server render — a small, deliberate divergence

**Surface:** `WeekField.tsx`, kernel `locale.ts`.

`WeekField.md`: locale resolution is `data-locale` → `<html lang>` → `en`. The
kernel's `readLocale(el)` implements it and is correct — but it needs a live
element, so it is a client-only read. Calling it would make the first client
render differ from the server's for any instance without `data-locale`, which is
a hydration mismatch on every string in the component (segment labels, popup
label, footer buttons, month and weekday names).

**Decision:** the port resolves `resolveLocale(localeProp ?? "en", …)` only. The
`data-locale` step and the `en` terminus are intact; the middle step is dropped.
It is invisible for this kitchensink — every reference state authors
`data-locale`, and our `<html lang="en">` would resolve to `en` regardless — and
`resolveLocale` still does the region degrade that matters (`sv-SE` → `sv`,
verified by the sv-SE state rendering "v." / "Vecka" / "Välj vecka").

**Open question:** the clean fix is for the page to pass `<html lang>` down as
the prop default, since in Next it is a build-time constant in `layout.tsx`
rather than something to be read from the DOM. Worth doing once, for all five
fields, rather than five times.

---

### F-NEW · Positive: `popup-interaction` composed with a *row*-based roving tabindex with no adaptation

**Surface:** `WeekField.tsx`, the three kernel trap tests.

The kernel's `popup-interaction` was ported for the wheel fields, where the tab
stops are wheel columns and footer buttons. WeekField's grid is a different
composite: roving tabindex lives on the `<tr>` (one `tabindex="0"`, the rest
`-1`), so the whole grid is **one** tab stop under the WAI-ARIA grid pattern, and
the ordered stop list is `prev-nav → grid row → next-nav → enabled footer
buttons`.

It composed with zero changes. Three points earned their place in the kernel doc:

1. `tabStops` being a **function** called fresh on every Tab is what makes it
   work — the grid stop is a different element after every arrow keypress and
   after every month change, and the Clear button leaves the list entirely when
   the field is empty. A captured array would have gone stale on the first
   ArrowDown.
2. The doc's note that `tabindex="-1"` elements are legitimate stops
   ("programmatic `.focus()` works on it, which is what lets this compose with
   the component's roving-tabindex navigation instead of fighting it") is exactly
   why a `<tr>` can be a stop at all.
3. The `wheel` listener genuinely has to be native. `preventDefault()` from a
   React `onWheel` is a no-op — React attaches its delegate passively at the
   root — and the spec asserts `ev.defaultPrevented === true`. That test would
   have failed with an idiomatic React handler and read as a missing feature.

All three trap tests pass: Tab past the last footer button wraps inside the
popup, Shift+Tab from `.prev-month` wraps to the last stop, and a synthetic wheel
event on `.popup` is `defaultPrevented`.

---

### F-NEW · The whole-week selection model is the component's real contract, and the suite only half-covers it

**Surface:** `WeekField.md` "The selection model", `WeekField.e2e.test.js`.

Recorded as a note for whoever reviews the port rather than as a defect. The
contract is unusually specific about the interaction model — *"all four arrows
move by a week (O5); there is no single-day focus in a week picker"* — and the
suite checks ArrowDown only. `ArrowLeft`/`ArrowRight` also moving by ±1 week is
the counter-intuitive half (a day grid would move by one day) and is untested;
`PageUp`/`PageDown` moving by a month is untested; clicking the **week-number
cell** selecting the week is documented and untested (the suite clicks the row and
a day cell). All four are implemented and were exercised by hand and by
`wf-iso-browser.cjs`'s month navigation.

The one that would be worth an upstream assertion is `ArrowLeft`, because a
porter reading only the spec would very reasonably implement it as day movement,
and every test would stay green.
