# TimeField

Phase A port. **32 / 32 conformance tests green on the first run**, including both
axe audits (closed and popup-open), and 0 axe WCAG 2 AA violations over the whole
isolated route in **both** appearances. `npm run build`, `npm run test:unit`
(206), `verify:appearance` and a 320–1280 px reflow sweep of the route are all
clean. `git -C reference-components status --short` prints nothing.

Run:

```
BASE_URL=http://localhost:3000 TARGET_PATH=/kitchen-sink/timefield \
  npx playwright test src/partials/components/TimeField/tests/TimeField.e2e.test.js
→ 32 passed (11.3s)
```

---

### F-NEW · The kernel absorbed everything shared; the only thing left to write was time arithmetic

**Surface:** `TimeField.tsx` vs `TimeField.ts` (1013 lines).

PORTING.md's claim for the kernel is that shared behaviour "is never re-interpreted
per component". Held, completely. What came from `web/src/kernel/` unmodified:

| Kernel module | What it removed from the port |
|---|---|
| `WheelColumn` | the three wheel columns: 3D geometry, momentum/snap physics, loop wrap, `aria-valuenow`/`aria-activedescendant`, cross-column scroll lock |
| `popup-interaction` | the cyclic Tab trap **and** the wheel-scroll containment — both e2e-asserted, neither written here |
| `popup-position` | `calculatePopupOffset` / `calculateArrowOffset` / `detectDirection` |
| `css-px` | `resolveCssPx`, i.e. the reference's private `_getCSSPx()` probe, which the reference duplicates in six components |
| `locale` | `resolveLocale` (`en-GB` → `en`) |
| `Wheel.css` | all wheel visuals |

Nothing was missing, and nothing had to be re-derived. The three functions I did
write locally — `parseTimeValue`, `formatSegment`, `wrapValue` — are exactly the
three the contract says are *not* kernel material: "`utils/dates` is **not** used
— TimeField does its own time parsing". So the boundary the kernel doc draws is
the boundary the port actually needed.

Two smaller pieces are ports of `TimeField.ts` logic expressed as pure functions
rather than DOM mutation: `toTimeString` (`_syncToNative`'s 12h→24h conversion +
the "partial state leaves the native input empty" rule) and `incrementValue`
(`_incrementSegment`, including the wrap-chaining recursion — minute 59→00 carries
into the hour). Measured: hour `10`, minute `59`, ArrowUp → hour `11`, minute
`00`, native `11:00`.

**Decision:** compose, don't re-derive. Recorded as a positive finding because it
is the first component in the set to consume *four* JS kernel modules at once, and
the composition cost was zero.

---

### F-NEW · `TimeField.md` contradicts its own kitchensink about the locale, and following the doc fails four tests

**Surface:** `TimeField.md` → `## Attributes`, `data-locale` row.

The doc says:

> `data-locale` | BCP 47 | … Resolved as `data-locale` → `<html lang>` → `en`;
> **`sv-SE` is the kitchensink's authored value**

It is not. All 18 `states/*.hbs` files author `data-locale="en-GB"` (or `en-US` for
the 12h demo); `grep -c 'sv-SE' states/*.hbs` → 0. The `## Manual accessibility
testing` section reinforces the wrong value ("I hear the label (\"Mötestid\")",
"I hear \"Välj tid\"").

A porter who trusts the doc and authors `sv-SE` fails four assertions, none of
which mentions a locale:

| Assertion | With `sv-SE` |
|---|---|
| `popup` `aria-label` = `"Choose time"` | gets `"Välj tid"` |
| hour segment `aria-valuemin/max` = `0`/`23` | sv-SE is 24h, so this one survives |
| `popup hour column aria-valuemax` = `23` | survives |
| Swedish strings on `.footer-clear` / `.footer-now` | not asserted, but diverges from the demo |

Only the `aria-label` actually breaks, but it breaks in a way that reads as a
translation bug rather than a doc error. ADR-0011 ("demos default to English") is
the settled position and the states obey it; the `.md` was not updated with them.

**Decision:** the kitchensink authors `en-GB` everywhere, matching the states and
the suite. The `sv` translations are still shipped in the port
(`timeFieldTranslations.sv`) so `registerLocale`'s surface is real.

**Upstream suggestion:** delete the `sv-SE` claim from the `data-locale` row and
re-word the manual-testing checklist in English, or restore a Swedish live state.
The doc and the demo disagreeing is worse than either choice.

---

### F-NEW · Two of the reference's init steps are client-side DOM *queries* with no render-time equivalent

**Surface:** `_initInteractiveMode()`.

`attach()` does two things that are not "compute an attribute from my own data",
and both need an explicit answer in a server-rendered framework:

1. **`readLocale(el)`** falls back to `el.ownerDocument.documentElement.lang`. On
   the server there is no element yet, and reading it after hydration would either
   arrive a frame late or produce a hydration mismatch (the segment *labels* and
   the 12h/24h *segment list* both depend on it, so it is markup, not decoration).
2. **`document.querySelector('label[for="' + fieldId + '"]')`**, then
   `segments.setAttribute('aria-labelledby', labelEl.id)` — the component
   discovers a label that lives *outside* its own root and back-fills an id onto
   it.

**Decision:**
1. `locale` is a **prop**, defaulting to `"en"`. That is the same value
   `readLocale` would resolve for our pages (the root layout emits `lang="en"`),
   so no behaviour is lost, but the fallback is now static instead of discovered.
2. The component **renders its own label** as a fragment sibling before the root —
   exactly where the reference states put it — so the
   `for` / `id` / `aria-labelledby` triangle is *authored* rather than found.

(2) is worth flagging for any framework port, not just this one: the reference's
query is a silent enhancement. If the label is rendered by the page (the obvious
React shape) and the port keeps the reference's query, the port must run that
query in an effect; if it does neither, the `role="group"` of segments simply has
**no accessible name** — and **axe does not report an unnamed `role="group"`**, so
the scoped audit stays green. Verified: our segments group carries
`aria-labelledby="meeting-time-label"` and the audit is green either way.

**Upstream suggestion:** put `aria-labelledby` in the authored markup of the
states, as `.segments`' contract, rather than deriving it from a document-wide
`label[for]` search.

---

### F-NEW · TimeField ships **no** entrance animation — unlike ToggleTip, its docs are right

**Surface:** `TimeField.css`, `Wheel.css`, `e2e-helpers/target.js` → `waitForStable`.

The ToggleTip port found the reference *does* fade its popup despite the docs
saying popups appear at full opacity. Checked here explicitly:

```
grep -nE "transition|animation|@starting-style|opacity" TimeField.css Wheel.css
TimeField.css:44   opacity: 0.5;   → [data-disabled="true"] (the whole field)
TimeField.css:50   opacity: 0;     → the hidden native input in custom mode
TimeField.css:74   opacity: 0;     → the transparent native input in display mode
Wheel.css:51       will-change: opacity, transform;   → a hint, not a value
```

No `transition`, no `animation`, no `@starting-style`, nothing on `.popup`. The
`AXE_SETTLE` seam is a genuine no-op for this component, and the port keeps it
that way: `scopedCheckA11y` with the popup open passes with **0** violations
without `AXE_SETTLE`, in light **and** dark.

**Decision:** appear-at-full-opacity, no animation added. Recorded as a positive
finding — for this component the contract's claim is accurate, so the ToggleTip
discrepancy is a ToggleTip bug rather than a family-wide doc problem.

---

### F-NEW · Three colour tiers, all three present in one component — measured in both appearances

**Surface:** `TimeField.css` tokens, `.WheelColumns::after` (kernel).

The distinction earlier ports established (literal / system colour / `--ui-*`
token) shows up in a single stylesheet here. Measured in Chromium at 1280 px, popup
open, `data-appearance` pinned:

| Surface | Declared as | Light | Dark | Verdict |
|---|---|---|---|---|
| resting field border | `--_tf-border-color: currentColor` | `rgb(90,88,82)` | `rgb(185,183,175)` | **right in both** — `currentColor` inherits our `--color-body`, so it follows the design system *and* the appearance without naming a token |
| **hover** field border | `--_tf-border-color-hover: CanvasText` | `rgb(0,0,0)` | `rgb(255,255,255)` | appearance-aware, **not** design-system-aware: our ink is `#26251e` / `#f2f1ec`, so hover jumps to pure black / pure white |
| popup surface + text | `--ui-surface` / `--ui-surface-foreground` | `#fff` / `rgb(38,37,30)`, 15.38:1 | `#232320` / `rgb(242,241,236)`, 13.93:1 | right in both |
| footer **Now** | `--ui-primary` | 5.01:1 | 6.09:1 | right in both |
| footer **Clear** disabled | `--_tf-color-muted` → `--ui-muted-foreground` | 7.11:1 | 7.84:1 | right in both (and 1.4.3 would exempt it anyway) |
| wheel top/bottom fade | `Canvas` (kernel `.WheelColumns::after`) | `rgb(255,255,255)` = popup, seam invisible | `rgb(18,18,18)` vs popup `rgb(35,35,32)` — **1.19:1 seam** | wrong in dark |

Three notes.

**1. The hover token is the one component-level bypass, and it is a fidelity bug,
not an accessibility one.** 21:1 (light) and 15.76:1 (dark) against the card are
far past 1.4.11 — it is *too* contrasty, and it is the only place in the component
where a mouse-over visibly leaves the palette. Phase B fix is one token:
`--_tf-border-color-hover: var(--ui-surface-foreground, CanvasText)`, which
measures `rgb(38,37,30)` / `rgb(242,241,236)` — 12.6:1 / 11.5:1 against the card,
still comfortably over the 3:1 floor. Left **verbatim** in Phase A.

**2. `currentColor` is a fourth tier, and this is a recommendation to the library
rather than an observation.** The three tiers the ScrollArea port established
grade how badly a value survives an appearance flip. `currentColor` sits above all
three: it is **appearance-aware *and* design-system-aware, with no token and no
`light-dark()` pair**, because it inherits whatever the host already set on text.
Every other "free dark mode" mechanism in this library routes through a system
colour, which follows the *scheme* but lands on the *UA's* palette rather than the
consumer's — that is the whole content of tier two.

**Recommended, concretely: where a component needs a colour that should track the
host's text colour, declare `currentColor`, not a system colour and not a
literal.** It costs the `--ui-*` seam nothing — no new token, no consumer
obligation, no `## Required tokens` entry — and it cannot drift, because there is
nothing to keep in sync. TimeField already proves both halves in one stylesheet:
its resting border (`currentColor`) lands on our `--color-body` in both
appearances, and its hover border (`CanvasText`, two lines below) lands on pure
`#000`/`#fff`. Same component, same property, same appearance flip — one follows
the design system and one does not, and the only difference is which keyword was
chosen.

The candidates are mechanical to find: `grep -rn "CanvasText" src/partials` over
the family returns the `--_*-border-color-hover` declarations, and every one of
them wants the host's ink rather than the UA's.

**3. The dark wheel fade is the kernel's, already recorded (findings/kernel.md).**
Corroborated with numbers rather than re-reported: the fade paints `#121212` where
the popup is `#232320`, so in dark the wheel column has a visible darker band at
top and bottom. Not editable from here.

**Also worth recording: axe cannot see the selection band.**
`.WheelColumns::before` is a `::before` background, so axe computes the centred
option's contrast against the popup surface (15.38:1) rather than against the
band. Composited by hand, the real pair is `--ui-primary` on the band —
`rgb(200,64,0)` on `rgb(246,246,246)` = **4.64:1** light, `rgb(255,122,64)` on
`rgb(43,43,40)` = **5.48:1** dark. Both clear AA, so nothing is wrong; but a
consumer whose primary is weaker would fail 1.4.3 *invisibly to axe*, because the
failing background is a pseudo-element.

---

### F-NEW · Progressive enhancement means this component has no dead-control window — the native input covers hydration

**Surface:** `data-input-mode`, ADR-0006, and the orchestrator's `<script async>`
finding.

The RangeGroup port measured that Next injects client chunks as `<script async>`,
which does not delay `load`, so a hydration-gated component is inert for ~86–141 ms
after `page.goto()` resolves — a real dead-control window, not just a test race.

TimeField is immune, and the reason is ADR-0006 rather than anything I did. The
`data-input-mode` switch is resolved through `useSyncExternalStore` whose **server**
snapshot is `null`, so the server-rendered markup carries no `data-input-mode` — and
the verbatim stylesheet's *default* branch is `.native { display: block }` +
`.overlay { display: none }`. Before hydration the user sees, and can fully use, the
browser's own `<input type="time">`. The custom segmented face replaces it in the
same commit that sets `data-initialized="true"`.

So the enhancement window degrades to the native control instead of to a dead
control. No inline bootstrap is needed here, and the spec is safe as written for a
second reason: its `beforeEach` gates on
`[data-initialized="true"]`, an auto-retrying `waitFor` — and because that
attribute is emitted by the very store snapshot that resolves during hydration, the
gate is *exact* (attribute present ⟺ handlers attached) rather than approximate.

**Decision:** no bootstrap. Recorded as a positive finding, and as the reason
ADR-0006's two-faces model is worth more in a hydrating framework than it is in
the reference: it doubles as the no-JS end state.

---

### F-NEW · The kernel is silently compensating for a component-level omission — the coupling it was extracted to prevent

**Surface:** `_openPopup()` and `popup-interaction.md` → `nextTabStop`.

The component opens a `role="dialog" aria-modal="true"` surface and never moves
focus into it. Measured, immediately after clicking the trigger:

```
activeElement = .trigger          insidePopup = false
after one Tab → .Wheel[data-segment="hour"]   insidePopup = true
```

**The headline is the second line, not the first.** What makes the popup usable is
`nextTabStop`'s documented snap-to-end: "when `current` is not one of the stops …
it snaps onto an end: the first stop going forward". The kernel doc frames that as
a safety net for *a stray Tab* — focus that wandered off a stop while already
inside the dialog. In practice it is doing **entry into the dialog**, on every
mouse-opened popup, for a case the component never handles at all.

That is the exact coupling the kernel was extracted to prevent. ADR-0004 justifies
the kernel as the place where shared behaviour lives so it "is never
re-interpreted per component"; it does not license the kernel to *supply*
behaviour a component owes. Two concrete costs:

- **The omission is invisible.** Remove the snap-to-end (a change a kernel
  maintainer could reasonably make, since its stated purpose is a stray-Tab
  guard) and five components lose popup keyboard entry at once, with no test
  failing in the kernel's own suite.
- **The component contract is now untrue on its own.** `TimeField.md` documents a
  `Tab` (popup) row — "Cyclic focus trap: wheels → footer buttons" — which
  describes containment. Nothing in the contract says how focus gets in.

**What a mouse user loses, concretely.** They click the trigger, the popup opens,
they press **Escape** — and nothing happens. The Escape handler is bound on the
popup element (both in the reference and, faithfully, here), and focus never
entered the popup, so the keydown never reaches it. The user must click outside to
dismiss. Keyboard users never see this, because their first Tab puts them inside.

**Why it survived review:** every keyboard assertion in the suite calls
`.focus()` on the hour wheel first, with the comment *"Focus inside the popup so
the popup's keydown handler receives the event"*. The suite documents the
workaround instead of failing on the cause.

**Open question:** should `_openPopup()` focus the first wheel, and should Escape be
bound on the component root rather than on the popup? Focusing the first wheel is
the standard modal-dialog pattern and fixes Escape-after-mouse-open for free, at
the cost of moving focus on a pointer action. It interacts with ADR-0007, which
splits *close* paths by origin (Escape refocuses, light-dismiss does not) — the
same reasoning plausibly applies to open. Binding Escape on the root is the
cheaper half and has no downside I can find. Left faithful in Phase A.

---

### F-NEW · Roving tabindex is one-way: measured in all four fields — three broken, one immune

**Surface:** `_focusTrigger()`. **Supersedes the "needs four measurements" caveat
in F-042 — here are the four measurements.**

```js
_focusTrigger(): void {
  this._segmentEls.forEach(s => { s.removeAttribute('data-focused'); s.setAttribute('tabindex', '-1') })
  this.trigger.focus()
}
```

Every segment goes to `tabindex="-1"` and nothing ever restores a `0`.

**The WCAG criteria, committed.** This is a **2.1.1 Keyboard (Level A) failure**:
after Tab-out, the field's segment editing has *no remaining keyboard route* —
there is no other key, no other control, and no other focusable path back into the
segments. Arrow keys cannot help, because reaching a segment to press them is the
thing that is lost. The only recovery is a mouse click on a segment or a page
reload, and 2.1.1 requires all functionality to be operable through a keyboard
interface. **2.4.3 Focus Order (Level A) is also implicated** but is the weaker
claim: the backwards order silently skips a control that was in the order a moment
earlier, so the sequence is no longer one that "preserves meaning and operability"
— though 2.4.3 is usually read as being about the order of things that *are*
reachable, which after `_focusTrigger()` the segments are not. **The honest
headline is 2.1.1.**

**What a user actually loses:** they tab into the field, type a time, tab once more
to reach the calendar/clock trigger, decide to correct the value, press Shift+Tab —
and land on the *previous field on the page*. The value they just typed can no
longer be edited without a mouse. For a keyboard-only user with a filled but wrong
value, the field is now read-only.

**Exact repro** (Chromium, aggregate `/` for the first two, isolated routes for the
last two; focus the last segment, Tab, then Shift+Tab):

| Component | segments | Tab lands on | segment tabindexes after | Shift+Tab lands on |
|---|---|---|---|---|
| **TimeField** | `hour, minute` | `.trigger` (in field) | `['-1','-1']` | `.trigger` of `TimeField/tf-with-seconds` — **outside the field** |
| **MonthField** | `month, year` | `.trigger` (in field) | `['-1','-1']` | `.trigger` of `MonthField/mf-with-range` — **outside the field** |
| **WeekField** | `week, year` | `.trigger` (in field) | `['-1','-1']` | `.trigger` — **outside the field** |
| **DateField** | `day, month, year` | `.trigger` (in field) | `['-1','-1','`**`0`**`']` | `.segment[data-segment="year"]` — **back inside** ✔ |

So **three of the four segmented fields are broken and DateField is immune**, and
the reason is structural rather than lucky: `grep -n "_focusTrigger"` finds the
method in `TimeField.ts`, `MonthField.ts` and `WeekField.ts` and **not** in
`DateField.ts`. DateField's `_handleSegmentKey` has no `case 'Tab'` at all — it
lets the browser move focus, so `_setSegmentFocused`'s roving `0` survives on the
last-focused segment and Shift+Tab returns to it.

That makes this a much easier fix to argue upstream: **the correct shape already
exists inside the family**, in the oldest member of it. The three that intercept
Tab did so to force the trigger to be next, and clearing every `tabindex` was
collateral.

**Exact fix**, one line per component. In our port
(`TimeField.tsx` → `handleSegmentKeyDown`, `case "Tab"`):

```diff
       case "Tab":
         if (!e.shiftKey && isLast) {
           e.preventDefault();
-          setRoving(null);
           setFocused(null);
           triggerRef.current?.focus();
         }
```

and in the reference (`TimeField.ts`, `MonthField.ts`, `WeekField.ts`):

```diff
   _focusTrigger(): void {
-    this._segmentEls.forEach(s => {
-      s.removeAttribute('data-focused')
-      s.setAttribute('tabindex', '-1')
-    })
+    // Clear the visual focus ring, but KEEP the roving tab stop so Shift+Tab
+    // from the trigger returns to the segment group (WCAG 2.1.1).
+    this._segmentEls.forEach(s => s.removeAttribute('data-focused'))
     this.trigger.focus()
   }
```

`data-focused` still has to be cleared — it is the segment's highlight, and the
segment no longer has focus. Only the `tabindex` write is wrong. **No assertion in
any of the four suites touches the post-Tab tabindex state**, so the fix is
free of test churn.

**Neither axe nor the conformance suite can see it, and that is the finding about
the library's verification model** (alongside F-040). axe has no rule for "a
roving tabindex that never roves back": at the moment axe runs, every segment is
either a valid tab stop or a legitimately `-1` sibling, and no snapshot of the DOM
is invalid. The suites assert only that Tab *reaches* the trigger — none of the
four tabs back. So this is not a case of a test being wrong; it is a case of a
whole class of defect (state that is destroyed by an interaction and never
restored) being outside what a single-snapshot audit and an assertion-per-action
suite can express. Catching it requires a *round-trip* test — do the thing, undo
the thing, assert the DOM is where it started.

**Decision:** ported faithfully, on the coordinator's instruction and for the
reason recorded in F-042 — a port that silently repairs the reference destroys the
evidence, and F-030's `WheelColumn.destroy()` is an exception only because that
defect corrupts *other* components' results. This one is contained within the
field.

---

### F-NEW · React's `onChange` cannot carry the native value seam; the input has to stay uncontrolled

**Surface:** `_bindValueSync()`, `_syncToNative()`.

Three separate React constraints converge on the same shape here, and getting any
one of them wrong fails as an apparent logic defect:

1. **The native input must be uncontrolled** (`defaultValue`) and written
   imperatively. The suite reads it with `inputValue()` and — in the
   `'"Now" and "Clear" dispatch input + change'` test — attaches
   `addEventListener('input'|'change')` and asserts the exact sequence
   `['input','change','input','change']`. A controlled `value=` would fight our own
   writes; `onChange` alone would never fire for a programmatic dispatch.
2. **The reference's `_bindValueSync` listener must be a *native* listener.**
   React's synthetic `onChange` is deduplicated and does not see
   `el.dispatchEvent(new Event('change'))`. Verified: `native.value = '07:05';
   dispatchEvent(new Event('change'))` on a closed empty field syncs the segments
   to `07:05` and sets `data-has-value="true"`. With a React `onChange` it does
   nothing — and that is precisely the path a *native mobile picker* uses in
   `data-input-mode="display"`, so the bug would only show up on touch.
3. **`_suppressEvents` maps to a ref, not state.** It guards a re-entrant path
   *within a single tick*, which state cannot express.

**One deliberate behavioural divergence, in the port's favour.** The reference
mutates segments one at a time and each mutation calls `_syncToNative`, so a
wrap-chain (`minute 59 → ArrowUp` carrying into the hour) writes the value twice
and dispatches `input`+`change` **twice**. The port computes the whole next value
first and commits once, so it dispatches one pair. The contract asks for events
"when a **complete** value is written … and once per popup Clear/Now press", and a
single user keypress producing two `change` events is a form-integration hazard.
Recorded rather than hidden; the suite asserts exact sequences only for Now/Clear,
which both match.

---

### F-NEW · The JSX-whitespace trap does not apply here, because the reference builds its segments in JS

**Surface:** `_buildSegments()` vs the JSX segment map.

The known trap: Handlebars puts each inline span on its own source line, giving
collapsible whitespace text nodes (= soft-wrap opportunities) that JSX siblings do
not emit; one port measured `min-content` 285 px as JSX vs 155 px with `{" "}`.

TimeField is exactly the at-risk shape — a row of segment and separator spans — but
it is *not* affected, and the reason is worth recording: the reference's segments
are not authored in the template at all. `.segments` ships **empty** and
`_buildSegments()` fills it with `createElement` + `appendChild`, which produces
**no whitespace text nodes**. Verified on the port:

```
.segments childNodes → ['segment', 'separator', 'segment']            (24h)
                     → ['segment','separator','segment','separator','segment']  (12h)
field min-content    → 99 px
```

So JSX siblings reproduce the reference's DOM *exactly* here, no `{" "}` needed,
and adding one would have introduced a text node the reference does not have. The
lesson generalises: check whether the reference authors the inline row in markup
(trap applies) or builds it in JS (trap does not).

Reflow is clean as a result — `reflow-sweep.cjs /kitchen-sink/timefield` reports
`0px` overflow at 320 / 360 / 480 / 768 / 1024 / 1280 px.

---

### F-NEW · The 100vw slide rail cannot reach the document's scroll area — and the init gate was never what stopped it

**Surface:** `.TimeField .rail`, F-010. **Corrects my own earlier explanation; the
RTL measurement the coordinator asked for is what disproved it.**

F-010 says to drop `overflow: hidden` from `.TimeField` together with the
`[data-initialized="true"] { overflow: visible }` flip. Both were removed (the only
two hunks `diff` shows against the verbatim file). That leaves `.rail` —
`position: absolute; width: min(100vw, calc(100vw - 2rem)); height: 0`, present
whether or not the popup is open — with nothing obviously clipping it, which looked
like a WCAG 1.4.10 hazard that axe cannot see.

I first reported 0 px of overflow and explained it as the rail overhanging to the
**left**, which is not scrollable in LTR. **That explanation was wrong.** Measured
in both writing directions:

| dir | viewport | `scrollWidth - clientWidth` | scrollable right / left | rail extent |
|---|---|---|---|---|
| ltr | 320 | **0 px** | 0 / 0 | −53 … **365** |
| ltr | 360 | **0 px** | 0 / 0 | −73 … **385** |
| ltr | 768 | **0 px** | 0 / 0 | −277 … **831** |
| rtl | 320 | **0 px** | 0 / 0 | −45 … **373** |
| rtl | 360 | **0 px** | 0 / 0 | −25 … **433** |
| rtl | 768 | **0 px** | 0 / 0 | −63 … **1045** |

The rail overhangs the **right** edge by 45–277 px in *both* directions and still
contributes exactly zero scrollable overflow, and the document cannot be scrolled
horizontally in either direction (`window.scrollTo(±99999, 0)` leaves `scrollX` at
0). So direction is irrelevant, and the containment is structural.

**The mechanism.** Walking the ancestor chain with computed `overflow-x`, every
ancestor up to `<html>` is `visible` — there is no `overflow-x: hidden` anywhere in
our styles masking this — yet the overflow stops at the first ancestor:

```
DIV.rail        overflow-x visible  position absolute  width 288  scrollWidth 288
DIV.overlay     overflow-x visible  position static    width 100  scrollWidth  98   ← stops here
DIV.TimeField   overflow-x visible  position relative  width 100  scrollWidth 100
…               all visible, all scrollWidth == clientWidth
HTML            scrollWidth 320 == clientWidth 320
```

An absolutely positioned box's scrollable overflow is contributed to its
**containing block** — here `.TimeField`, because it is `position: relative` — and
is not propagated onwards through the normal-flow chain to the viewport. So
`position: relative` on the component root is what makes a 100vw rail safe, and it
is doing that job in the reference too.

**Two consequences worth recording.**

1. **`overflow: hidden` on the root was never protecting the page from the rail.**
   It is purely the pre-init FOUC guard PORTING.md says it is, so dropping it (F-010)
   costs nothing in reflow terms — which is a stronger statement than "we measured
   0 px and got away with it", and it generalises to the other four popup fields,
   all of which use the same rail + `position: relative` root.
2. **My earlier open question is withdrawn.** A TimeField placed near the right edge
   of a wide container does *not* add horizontal scroll — the earlier measurement I
   read as "lucky" (rail right edge 365 in a 320 px viewport, overflow 0) was
   already the proof, and I mis-attributed it to writing direction.

**And a positive on top of it:** with the popup **open** at 320 px, the bubble is
clamped fully inside the viewport in both directions — `[8, 232]` in LTR and
`[88, 312]` in RTL, against a `0…320` viewport, with 8 px being exactly half the
`--SITE--PADDING` inset the contract specifies. `calculatePopupOffset` is
viewport-absolute rather than direction-aware, so it clamps correctly under
`dir="rtl"` with no RTL-specific code — even though "No RTL layout" is an explicit
TimeField non-goal. The kernel maths is more portable than the component claims.

---

### F-NEW · Every `.Wheel` host needs a unique `id`, and TimeField is the component that proves it

**Surface:** `WheelColumn.render()`, `WheelColumn.md`.

Corroborating the kernel port's undocumented finding from the component with the
most sibling columns in the family (three, with `data-step < 60`):
`aria-activedescendant` is derived as `` `${this.el.id || "wheel"}-front` ``, so
three id-less columns all point at `wheel-front` and a screenreader resolves the
wrong option — or none.

The port gives each host `id={`${dataId}-wheel-${type}`}`. Verified on the seconds
variant:

```
tf-with-seconds-wheel-hour    → aria-activedescendant tf-with-seconds-wheel-hour-front    valuenow 13
tf-with-seconds-wheel-minute  → …-minute-front   valuenow 45
tf-with-seconds-wheel-second  → …-second-front   valuenow 30
duplicate non-empty ids on the page (16 TimeField instances) → none
```

`WheelColumn.md`'s "DOM contract" section documents `class` and `tabindex` for the
host but not `id`. **Upstream suggestion:** add it — it is the difference between
correct and silently wrong ARIA, and nothing fails without it.

---

### F-NEW · Two smaller notes

**`ADR-0008`'s field-height contract holds, measured.** The overlay's bordered box
is `40 px` (`min-block-size: 2.5rem`) and the trailing clock icon's box is
`18 × 18` with `display: block`, in Inter rather than the reference's typeface.
Note the ADR names the token `--tf-field-min-block-size` while the CSS (correctly,
per ADR-0017) declares `--_tf-field-min-block-size` — the ADR predates the
underscore convention and was not updated.

**Two native-reference demo labels are still Swedish upstream** (`_native-default`
and `_native-disabled` both say "Tid" while every other state says "Time"), which
contradicts ADR-0011. The port uses "Time". Trivial, but it is the same
doc-vs-demo drift as the `sv-SE` finding above, so the two are probably one
cleanup.
