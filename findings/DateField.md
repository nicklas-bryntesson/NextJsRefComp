# DateField — Phase A findings

**Result: 43 / 43 conformance tests green, on the first run, and 43/43 on four
consecutive runs.** All three axe audits clean (initial render, calendar open,
picker view). `npm run verify` clean apart from the two pre-existing defects it
names (`color-contrast` × 2 nodes → F-027; the 2 px reflow overflow at 320 px on
`/`, which comes from `li.item` / `span.label` / a `th` — DateField is not on `/`
yet and its own route is 0 px at every width). `git -C reference-components
status --short` prints nothing.

Size: the reference is 1179 lines (962 non-comment). The port is 1381 lines
(1102 non-comment), of which **~300 are JSX markup** — the calendar the reference
authors as a 45-line `<template>` duplicated into all 16 state partials (~720
lines of `.hbs`) and then clones imperatively. Comparing like with like, the
*behaviour* is 962 → ~810 lines, and everything numeric came from the kernel:
`dates` (month grid, leap years, ISO, segment order), `popup-position`,
`popup-interaction`, `WheelColumn`, `css-px`, `locale`. Not one line of date
arithmetic or popover maths was written here.

---

### F-NEW · A `<template>` cannot be ported to React, and reproducing it fails the suite

**Surface:** `DateField.md` → `## Contract`; `DateField.e2e.test.js` → *calendar
does not exist in DOM when closed*.

The contract authors the calendar inside
`<template data-template="datefield-calendar">` and says JS "clones the calendar
dialog from the `<template>` into `.rail` on open — do not author the segment
spans or the cloned calendar outside the template." A porter reading that will
try to render the `<template>`.

It cannot work. React's `createElement('template')` appends children as **real
children of the `<template>` element**, not into its inert `.content`
`DocumentFragment` — only the HTML *parser* populates `.content`. So a
React-rendered template puts a live, query-visible `.popup` in the DOM, and

```js
await expect(page.locator(`${TARGET} .popup`)).toHaveCount(0)
```

fails while the calendar is closed. The template would also be pointless: it
exists solely to give vanilla JS a clone source.

**Decision.** No `<template>`. `{open && <div className="popup">…</div>}` inside
`.rail`. This is ADR-0009's own principle applied to markup rather than
attributes — the contract specifies the finished DOM, not the mechanism that
produced it, and conditional rendering reaches the identical end-state (present
and visible inside `.rail` when open, absent when closed) with strictly less
machinery. Recorded because the contract's wording reads as prescriptive and the
failure it causes reads as a structural defect.

**Upstream suggestion:** `DateField.md`'s "do not author … outside the template"
is a *reference-implementation* instruction wearing contract clothes. The
portable fact is "the popup is a child of `.rail` when open and absent when
closed"; the template belongs in a "how the reference does it" note.

---

### F-NEW · The Next async-chunk hydration race exists here too — but ADR-0006 already answers it, and a bootstrap would make it worse

**Surface:** `DateField.e2e.test.js` `beforeEach`; measured with
`web/tasks/probes/df-hydration-race.cjs`, `df-focus-gate3.cjs`.

The project-level warning holds: `page.goto()` resolves on `load`, and Next's
`<script async>` chunks do not delay `load`. Measured on
`/kitchen-sink/datefield`, 4 runs:

```
goto resolved +96..102 ms · data-initialized +165..171 ms  → 69–70 ms AFTER goto
```

Three things make DateField's answer different from RangeGroup's, and all three
are worth having on record for the other four popup fields.

**1. There is no dead-control window, because ADR-0006 already built the
fallback.** Pre-hydration DOM, read with no retrying `expect()`:

| | value |
|---|---|
| `data-initialized` | `null` |
| `data-input-mode` | `null` |
| `getComputedStyle('.custom').display` | `none` |
| `.trigger` client rects | **0 (not rendered)** |
| `.segments` `aria-labelledby` | `"birthdate-label"` ✓ |
| `[data-segment="day"]` `aria-valuenow` | `null` ✓ |

Because the verbatim CSS is `.DateField .custom { display: none }` until
`[data-input-mode="custom"]`, what the user sees for those 69 ms is
`.DateField .native { display: block }` — **a fully functional native
`input[type=date]`**. Not an inert imitation. ADR-0006's two-face model *is* the
progressive-enhancement bootstrap; the coarse-pointer face doubles as the
pre-hydration face. That is a genuinely strong piece of design and it fell out
for free.

**2. The same gate incidentally protects ~40 of the 43 assertions.** Every test
that reaches the component through `.trigger.click()`, `.segment.press()` or a
day cell goes through a Playwright *actionability* wait, which requires
visibility — and visibility here requires `data-input-mode`, which requires
hydration. The gate is the reference's own CSS, not something the port added.

**3. The two exceptions are real and pass on margin, not on a gate.**
*"Space opens calendar from trigger"* and *"Enter opens calendar from trigger"*
do `trigger.focus()` + `page.keyboard.press(...)`, and `locator.focus()` does
**not** wait for visibility. Measured directly:

```
goto → trigger.focus() → keyboard.press('Space')            popup opened = false  (4/4)
goto → scrollIntoViewIfNeeded → focus() → press('Space')    popup opened = true   (3/3)
goto → scrollIntoViewIfNeeded → injectAxe → focus() → press popup opened = true   (3/3)
```

The spec's own `beforeEach` (`scrollIntoViewIfNeeded` + `injectAxe`) costs
125–140 ms against a 69 ms window — roughly a 2× margin, which is why 4
consecutive suite runs are 43/43. Strip the `beforeEach` and the two tests fail
immediately. So they are *latency-dependent*, not gated.

**Decision — do NOT add a parser-blocking bootstrap.** Stamping
`data-input-mode="custom"` early is the obvious move and it is **actively
harmful**: it makes `.custom` visible before any React listener exists, which
turns Playwright's actionability wait from a hydration gate into a no-op and
throws away protection (1) and (2). It would trade two latency-dependent tests
for ~40 genuinely racy ones, and trade a working native input for a dead custom
one. The bootstrap technique is right for a component whose pre-hydration markup
*looks* live and is not (RangeGroup); it is wrong for one that ships a real
native control underneath.

**Open question / upstream suggestion:** the two `focus()` tests should use
`await trigger.click()`, or gate on `[data-initialized="true"]` in `beforeEach`
the way most other specs do. Every other DateField assertion is either satisfied
by server-rendered HTML or preceded by a retrying wait — these two are the only
ones whose result depends on how fast the host's JS arrives, which is exactly
what a portable contract should not measure.

---

### F-NEW · The one non-retrying attribute read is only safe because the label link is rendered, not queried

**Surface:** `DateField.e2e.test.js` → *segments group has aria-labelledby or
aria-label*.

```js
const labelledBy = await segments.getAttribute('aria-labelledby')   // no retry
expect(labelledBy || ariaLabel).toBeTruthy()
```

The reference builds this at init: it queries `label[for="<id>"]`, assigns the
label an id if it has none, and writes `aria-labelledby` onto `.segments`. Ported
literally — a layout effect doing a `document.querySelector` — that attribute
does not exist until hydration, and this assertion has no retry, so it fails
inside the 69 ms window described above.

**Decision.** The component renders its own `<label id="<id>-label" for="<id>">`
and emits `aria-labelledby="<id>-label"` during render. Measured present in the
pre-hydration HTML. Same end-state, no DOM query, no effect, and — the part that
actually matters — **no window in which the field's only accessible name is
missing**. The reference's post-init wiring is a real (if brief) a11y gap that
the framework removes rather than reproduces.

Recorded for the other four popup fields: all five specs make the same
non-retrying read.

---

### F-NEW · `.WheelColumns::after` paints a bare `Canvas` fade — in the kernel, over our card

**Surface:** `web/src/kernel/Wheel.css` (do not edit); measured with
`web/tasks/probes/df-measure.cjs`.

The wheel's top/bottom fade is authored as

```css
background: linear-gradient(Canvas, transparent …, transparent …, Canvas);
```

Measured `background-image` on `.WheelColumns::after`, both appearances, against
the popup surface it is supposed to fade *into*:

| Appearance | fade stop (`Canvas`) | popup surface (`--ui-surface`) | match? |
|---|---|---|---|
| light | `rgb(255,255,255)` | `rgb(255,255,255)` | ✓ (coincidence) |
| dark | `rgb(18,18,18)` — the UA's `#121212` | `rgb(35,35,32)` — our card `#232320` | ✗ |

This is exactly the three-tier distinction FileUpload established, now found in
the **kernel's** CSS rather than a component's: a literal is wrong in both
appearances, a system colour is right in light and off in dark, only
`var(--ui-surface)` is right in both. In light the two happen to be the same
`#ffffff`, so the bug is invisible; in dark the fade paints a near-black smudge
across the top and bottom rows of the wheel band while the panel behind it is
warm dark grey. Purely cosmetic — the faded rows are `aria-hidden="true"`, so
axe never evaluates them and all three axe runs are clean.

**Decision.** Left verbatim; `Wheel.css` is kernel and out of my scope. The Phase
B fix is one substitution, `linear-gradient(var(--ui-surface, Canvas), …)`, which
keeps the system colour as the fallback the library intends and costs nothing.
Flagged rather than edited, per instructions. **It affects all four wheel
components**, so it is worth fixing once in the kernel rather than four times.

---

### F-NEW · `--_df-segments-border-color-hover: CanvasText` — pure black / pure white on hover

**Surface:** `DateField.css` line 20; measured in both appearances.

| Appearance | `CanvasText` resolves to | our ink (`--ui-surface-foreground`) | hover border vs card |
|---|---|---|---|
| light | `rgb(0,0,0)` | `#26251e` `rgb(38,37,30)` | 21.00:1 |
| dark | `rgb(255,255,255)` | `#f2f1ec` `rgb(242,241,236)` | 15.76:1 |

Unlike ChoiceField's `--_cf-selected: CanvasText` (which carries *text*), this is
a 1 px border, so the 1.4.11 floor of 3:1 is met by a factor of five in both
appearances and there is no accessibility defect. It is a **fidelity** defect:
the field's resting border is `currentColor` (measured `rgb(90,88,82)`, our
`--color-body`) and on hover it jumps to a pure black or pure white that exists
nowhere in `cursor-DESIGN.md`. In a warm cream/near-black system, pure black
hover is visibly colder than everything around it.

**Decision.** Verbatim in Phase A. Phase B: `var(--ui-surface-foreground,
CanvasText)` — the seam the library's own ADR-0018 defines, with the system
colour kept as the fallback. No new token needed, so `ui-tokens.css` is untouched.

---

### F-NEW · axe measures the wrong background under the wheel band, and cannot know it

**Surface:** `Wheel.css` `.WheelColumns::before`; measured with
`web/tasks/probes/df-wheel-contrast.cjs`.

The selected wheel option is `--ui-primary` at 16px/700. It sits on the
`.WheelColumns::before` selection band, which is `--ui-hover` — an **alpha**
fill on a **pseudo-element**. Both facts break naive measurement: alpha must be
composited, and axe's background resolution walks real ancestors and never sees a
pseudo-element's paint.

| Appearance | band (composited) | selected on **band** (real) | selected on **popup** (what axe sees) |
|---|---|---|---|
| light | `rgb(246,246,246)` | **4.64:1** | 5.01:1 |
| dark | `rgb(43,43,40)` | **5.48:1** | 6.09:1 |

Both clear AA, so this is a clean result — recorded as a **measurement-method**
finding, not a defect. The band costs 0.37 of a contrast stop in light and axe is
structurally blind to it, so a design system with a heavier `--ui-hover` would
push the real ratio under 4.5 while every axe run stayed green. Anyone tuning
`--ui-hover` should composite and measure by hand; the automated gate will not
help. (First noted here because DateField is the first ported component whose
text sits on a pseudo-element fill.)

Corollary, and it is the reference's own claim vindicated: the *unselected*
options render at `opacity: 0.146` mid-rotation — far below AA when composited —
and trip nothing, because `WheelColumn` marks them `aria-hidden="true"`.
`DateField.md` credits system colours for making "faded/transient text never trip
a contrast check"; the actual mechanism is the `aria-hidden`, which is more
robust and survives our literal-valued tokens.

---

### F-NEW · DateField's stylesheet really has no entrance animation — unlike ToggleTip's

**Surface:** `DateField.css`, `ToggleTip.css`.

The playbook asks whether DateField repeats ToggleTip's discrepancy (its docs
promise no fade; its stylesheet ships `transition: opacity 0.15s`). It does not.
`grep -n 'transition\|animation\|@keyframes' DateField.css` returns nothing; the
only `opacity` declarations are `0.5` for the disabled state and `0` for the two
hidden-native-input rules. The calendar appears at full opacity on the frame it
mounts, which is exactly what `e2e-helpers/target.js` says the reference popups
do and why `AXE_SETTLE` is a documented no-op by default.

**Decision.** No animation added, and none is wanted: all three scoped axe runs
sample a fully-painted frame and pass without `AXE_SETTLE`. Positive finding —
the component the whole family copies gets this right, and ToggleTip is the
outlier rather than the pattern.

---

### F-NEW · The JSX-whitespace trap does not apply to a flex segment row — measured

**Surface:** `.segments`; measured with `web/tasks/probes/df-behaviour.cjs`.

The playbook's warning is real elsewhere: Handlebars puts each inline span on its
own source line, giving a collapsible whitespace text node and therefore a
soft-wrap opportunity that JSX siblings do not emit (285 px vs 155 px
`min-content` measured on another component). `.segments` is a row of six inline
spans plus a button, so it looks like the same shape.

It is not, and the reason is one line of the verbatim CSS:

```css
.DateField .segments { display: inline-flex; align-items: center; … }
```

In a flex container, child text nodes consisting only of whitespace are
**discarded** (CSS Flexbox §4, "Flex Items"). So the reference's whitespace never
produced a wrap opportunity either — there is nothing to restore. Measured on the
port, with no `{" "}` anywhere:

```
display: inline-flex   flex-wrap: nowrap   min-content: 153px   actual: 153px
```

`min-content` equals the rendered width, i.e. the row is already at its
irreducible size, and the whole page is 0 px overflow at 320 px.

**Decision.** No `{" "}`. Recorded as a positive finding with a rule the other
four popup fields can apply directly: **check the container's `display` before
reaching for `{" "}`.** The trap needs an *inline* formatting context; a flex or
grid row is immune, and adding `{" "}` there would only add noise (and would have
perturbed the `textContent` the spec reads off `.month-year-trigger`).

---

### F-NEW · The popover survives 320 px with the calendar open — the reflow risk in `.rail` never fires

**Surface:** `.rail { width: min(100vw, var(--_df-rail-max-width)) }` +
`calculatePopupOffset`; measured with `web/tasks/probes/df-measure.cjs`.

`.rail` is `position: absolute; left: 50%; transform: translateX(-50%)` at
`min(100vw, …)` wide, hanging off a component that is *not* page-centred — the
textbook recipe for document horizontal overflow, which axe does not test at all
(F-024). Measured with the calendar **open**, which no other check does:

| Viewport | document overflow | rail | popup box | direction |
|---|---|---|---|---|
| 320 px | **0 px** | 320 px | 24 → 312 (288 px) | top |
| 360 px | 0 px | 360 px | 29 → 317 | top |
| 480–1024 px | 0 px | = viewport | 29 → 317 | top |
| 1280 px | 0 px | 1280 px | 69 → 357 | top |

Two things do the work. `min(100vw, …)` caps the rail at the viewport, and
`calculatePopupOffset`'s `viewportInset` — fed
`resolveCssPx(root, '--_df-site-padding') / 2`, i.e. half `--SITE--PADDING`, as
the contract specifies — keeps the 288 px popup 24 px clear of the left edge at
320 px. The kernel's maths is doing exactly what it claims.

Worth pairing with F-007, which identified `--MAX--WIDTH--SITE` as one of only
two site tokens anything actually consumes. Here it feeds
`--_df-rail-max-width: calc(100rem + 18rem)` = 1888 px, and the measured rail is
`100vw` at **every** width tested. So the token is consumed but **inert below a
1888 px viewport** — it has no observable effect on any layout this project
renders. Not a defect; useful to know before treating it as load-bearing.

---

### F-NEW · [PORT FIX] The reference clamps the day on a month change but not on a year change, and leap day desyncs the field

**Surface:** `DateField.ts` → `_setSegmentValue`, the `type === 'month'` branch.

`_setSegmentValue` recomputes the day segment's `aria-valuemax` and clamps an
overflowing day **only when the month changes**. The `year` branch is
`seg.setAttribute('aria-valuetext', …)` and nothing else. With 29 February 2024
selected, pressing ArrowUp on the year segment gives:

- segments read `29 / 02 / 2025`
- `_trySyncToNative` builds `new Date(2025, 1, 29)`, which **rolls over** to
  1 March, and writes `2025-03-01` to the native input

The visible field and the submitted value disagree, silently, and the announced
string (`.announce`) reads the rolled-over date. The `dates` kernel already
exports `clampDayToMonth` for precisely this; the reference just does not call it
on this path.

**Decision.** Clamp on both axes — `withSegment()` applies the same rule whether
`month` or `year` moved. Measured on the port:

```
29 Feb 2024, ArrowUp on year → native = "2025-02-28", segments = 28 / 02 / 2025
```

Marked `[PORT FIX]` in source. Flagged rather than silently improved because the
whole family shares this shape: **DateTimeField, MonthField and WeekField should
each check whether their own year path clamps.**

---

### F-NEW · [PORT FIX] The reference's form-`reset` handler leaves the segments and the input disagreeing

**Surface:** `DateField.ts` → `_handleFormReset`.

```js
this._handleFormReset = () => {
  this.selectedDate = null
  this._segmentEls.forEach(seg => this._clearSegment(seg))
}
```

The browser restores an input's **`value` attribute** immediately *after* the
`reset` event, so on a field authored `value="1990-06-15"` this leaves the native
input holding `1990-06-15` and the segments showing `dd/mm/yyyy`. The port reads
`input.value` on the next tick instead and mirrors whatever the form actually
restored, so the two can never disagree. Not covered by the suite (the
kitchensink has no `<form>`), which is why it survived.

---

### F-NEW · Locale collapse gives you regional segment ORDER with English month NAMES

**Surface:** `_resolveLocale()` / `readLocale` + `resolveLocale`; measured with
`web/tasks/probes/df-behaviour.cjs`.

The reference deliberately keeps two locale values and the distinction is a good
one: `localeTag` is the raw BCP 47 tag (drives `Intl` segment order) and `locale`
is the tag collapsed to a **translation-table key**. But `locale` — the collapsed
key — is then also what is passed to `getMonthName`, `getWeekdayNames`,
`toLocaleDateString` and the day-cell `aria-label`. Measured:

| `data-locale` | segment order | month `aria-valuetext` |
|---|---|---|
| `en-GB` | `day / month / year` ✓ | `June` |
| `en-US` | `month / day / year` ✓ | `June` |
| `sv-SE` | `year - month - day` ✓ | `juni` ✓ |

The three demos cannot expose the problem: `en-*` collapses to `en` (right
answer by luck) and `sv` happens to be in the two-entry table. Add a `de-DE`
field and you get German `D.M.Y` ordering with **English** month names, weekday
headers and `dateStyle: 'long'` day labels, because `resolveLocale` falls back to
`en` for any tag the table does not carry. The formatting locale and the UI-string
locale are different concerns and the code uses one value for both.

**Decision.** Mirrored verbatim — this is Phase A and the behaviour is the
contract's. **Upstream suggestion:** format with `localeTag` and translate with
`locale`. `Intl` needs no translation table and degrades gracefully on its own,
so `getMonthName(y, m, this.localeTag)` is strictly better and costs one word.
`DateField.md` also documents `data-locale` as controlling "segment labels and
calendar month/weekday names" without mentioning that the names silently fall
back to English for an untranslated language — the demo set is chosen such that
you cannot find out.

---

### F-NEW · `--ui-shadow`-as-a-ring and the popup: F-006 holds up under a real popover

**Surface:** `.DateField .popup { box-shadow: var(--_df-calendar-shadow) }`;
measured both appearances.

F-006 replaced the forbidden drop shadow with `0 0 0 1px
var(--color-hairline-strong)`, a ring in the same CSS property. Measured on the
open calendar:

| Appearance | popup surface | popup border (`--ui-border`) | shadow ring |
|---|---|---|---|
| light | `rgb(255,255,255)` | `rgb(128,125,114)` | `rgb(207,205,196)` |
| dark | `rgb(35,35,32)` | `rgb(145,142,132)` | `rgb(77,75,69)` |

The popup already carries `border: 1px solid var(--_df-calendar-border-color)`, so
the ring lands immediately outside a border that is itself 4.12:1 / 4.81:1
against the surface. The ring is therefore doing nothing an unaided eye can use —
it is a second hairline behind a stronger one. Positive in the sense that nothing
is broken and 1.4.11 is met by the border alone; worth knowing that on this
component F-006's substitution is redundant rather than load-bearing, unlike on
ToggleTip where `--ui-shadow` has no literal fallback at all.

---

### F-NEW · Two small documentation defects in the component's own files

**Surface:** `DateField.css`, `DateField.md` vs `states/*.hbs`.

1. **Dead rule.** `.DateField .popup .calendar-header span { font-weight: bold;
   flex: 1; text-align: center }` matches nothing: the header's middle child is
   `<button class="month-year-trigger">`, not a span. So the month/year label
   gets neither `flex: 1` nor centring — the header holds its layout only because
   it is `justify-content: space-between`. Vestigial from a version where the
   label was not yet interactive. Harmless, but a porter translating this rule to
   a utility in Phase B would spend time on a selector that never applies.

2. **Contract and states disagree.** `DateField.md`'s contract HTML gives both
   panels `class="panel"` (`<div class="panel" data-panel="calendar">`,
   `<div class="panel year-month-picker WheelColumns">`); all sixteen
   `states/*.hbs` omit `panel`. No consequence — every CSS rule and every spec
   selector keys on `[data-panel]` — but the two documents that a porter reads
   side by side describe different DOM. The port emits `panel`, following the
   contract.

---

### F-NEW · ADR-0006's presentation half wants no JavaScript at all

**Surface:** `data-input-mode`; the 69 ms window measured above.

`data-input-mode` does two separable jobs:

- **presentation** — which layer is `display`ed, and (in display mode) that the
  native input sits transparently on top. Every rule keyed on it in
  `DateField.css` is `display` / `position` / `opacity` / `pointer-events`.
- **semantics** — `aria-hidden` on `.custom`, `tabindex="-1"` on the segments,
  which of the two layers is the accessible control.

The presentation half is `@media (pointer: coarse)`, which needs no JavaScript,
no hydration and no attribute — it would be correct in the **first paint**, not
69 ms later. Only the semantics half genuinely needs script, and only because
`aria-hidden` cannot be set from CSS.

**Open question for Phase B / upstream.** Splitting it that way would make the
component's appearance correct before any JS arrives on *every* stack, not just
this one, and would leave `data-input-mode` as an honest declaration of *which
control is accessible* rather than a paint switch. The cost is that the attribute
stops being the single inspectable source of truth ADR-0006 prizes — the media
query and the attribute could in principle disagree on a hybrid device. Worth a
decision rather than a silent change, so nothing was changed.

---

### F-NEW · Positive: the kernel absorbed exactly what PORTING.md promised

**Surface:** the whole port.

Recorded because it is the claim the kernel exists to make, and it held without
qualification.

| Behaviour the suite asserts | Where it came from | Lines written here |
|---|---|---|
| looping month wheel wraps Dec↔Jan | `WheelColumn` (`loop: true`) | 0 |
| year wheel caps at min/max | `WheelColumn` (`loop: false`) | 0 |
| wheels are `role="spinbutton"` with live `aria-valuenow` | `WheelColumn` | 0 |
| `wheel` on the popup surface is `defaultPrevented` | `trapPopupInteraction` | 0 |
| Tab wraps last→first; Shift+Tab first→last | `trapPopupInteraction` + `nextTabStop` | 0 |
| grid is ONE composite tab stop | `nextTabStop` over a DOM-derived stop list | ~30 |
| `data-direction` top/bottom | `detectDirection` | 0 |
| popup stays 24 px clear at 320 px | `calculatePopupOffset` | 0 |
| leap years, month grid, ISO week-safe formatting | `dates` | 0 |
| `calc()`/`var()` → px | `resolveCssPx` | 0 |

Two kernel details that were load-bearing and are worth restating for the other
four porters, because neither is in the module docs:

- **Every `.Wheel` host needs a unique `id`.** `aria-activedescendant` is derived
  from it and defaults to `wheel-front`, so sibling columns collide. Verified
  here: `birthdate-picker-month` / `birthdate-picker-year` →
  `aria-activedescendant="…-month-front"` / `"…-year-front"`. With 16 DateField
  instances on one page that is 32 wheel hosts, all distinct.
- **`WheelColumn` stays a class, and the component owns a `useRef` to it.** Its
  published contract *is* the class (`stepBy`, `setValue`, `destroy`), and its
  rAF loop mutates ~9 nodes per frame — routing that through React state would be
  the single worst thing this port could do. Constructed in an effect keyed only
  on `[open, panel]`, with every callback reading refs/setters so a spin never
  rebuilds (and therefore never resets) the wheel mid-gesture.

---

### F-NEW · Positive: ADR-0007's two close paths fall out of React cleanly, and there is a third caller

**Surface:** `closeCalendar(refocusTrigger)`.

ADR-0007 splits close by origin: Escape refocuses the trigger, outside-click must
never call `trigger.focus()` (it steals the click target and scroll-jumps the
page). In React this is one boolean parameter and three call sites, and the third
is the interesting one:

| Origin | refocus | why |
|---|---|---|
| Escape, footer button, day selection | ✓ | keyboard/activation continuity |
| document `click` outside the root | ✗ | ADR-0007 — focus belongs to the click target |
| **a segment receiving focus** | ✗ | focus is already going somewhere deliberate |

The third is the reference's `_setSegmentFocused` → `_closeCalendar(false)`, and
it is the same rule as light dismiss for a different reason: refocusing the
trigger would fight the focus move that caused the close. ADR-0007 frames the
split as "keyboard vs pointer"; the honest rule is **"does the close event
already imply a focus destination?"** — which covers all three cases and would
have covered this one without needing a second look at the reference.

The outside-click listener still needs the reference's `setTimeout(…, 0)` arming
delay in React, for the same reason it needs it in vanilla: the effect that
installs it runs while the opening click is still propagating toward `document`.
