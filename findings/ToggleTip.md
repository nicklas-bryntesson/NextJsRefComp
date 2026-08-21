# findings/ToggleTip.md

Phase A port of `ToggleTip` plus the `popup-position` kernel primitive.

**Status:** 11/11 conformance tests pass; 11/11 kernel conformance assertions pass;
`npm run build` clean; `git -C reference-components status --short` empty.

```
$ BASE_URL=http://localhost:3000 npx playwright test \
    src/partials/components/ToggleTip/tests/ToggleTip.e2e.test.js --reporter=line
  11 passed (3.4s)

$ cd web && npx vitest run src/kernel/tests/popup-position.test.ts
  Test Files  1 passed (1)
       Tests  11 passed (11)
```

Files created:

```
web/src/kernel/popup-position.ts              plain module, no React
web/src/kernel/tests/popup-position.test.ts   reference assertions, byte-identical below the header
web/src/components/ToggleTip/ToggleTip.css    verbatim minus the init gate
web/src/components/ToggleTip/ToggleTip.tsx
web/src/components/ToggleTip/ToggleTip.kitchensink.tsx
web/src/app/kitchen-sink/toggletip/page.tsx
web/tasks/probes/toggletip-measure.mjs        throwaway measurement script (evidence below)
```

`usePopupPosition.ts` was **not** written. The plain module needs no React wrapper: all
three functions are called from inside a layout effect or an event handler, where a hook
buys nothing and would only make the primitive harder for the five popup fields to reuse.

---

### F-NEW · A `<p>` around `<toggle-tip>` silently deletes the popup — and the reference's own demo does it

**Surface:** `reference-components/src/partials/components/ToggleTip/ToggleTip.html`;
`web/src/components/ToggleTip/ToggleTip.kitchensink.tsx`.

The rendered contract puts `<div class="rail">` inside `<toggle-tip>`. A `<div>` start tag
implies the end tag of any open `<p>`, and `<toggle-tip>` is not a *special* element, so the
parser pops it along with the paragraph. Measured in Chrome (probe, fragment parser):

```
input : <p>text <toggle-tip><button></button><div class="rail"><div class="popup"></div></div></toggle-tip> tail</p>
parsed: <p>text <toggle-tip><button></button></toggle-tip></p>
        <div class="rail"><div class="popup"></div></div> tail<p></p>

popupInsideToggleTip : false
toggleTipChildren    : ["button"]
```

With a `<div>` wrapper instead: `popupInsideToggleTip: true`.

This is not theoretical, and it was measured in isolation on an otherwise-green tree. With
the single change `<div className="text-body-md">` → `<p className="text-body-md">` around
the `inline` anchor (mirroring `ToggleTip.html`) and everything else identical:

```
$ BASE_URL=http://localhost:3000 npx playwright test …/ToggleTip.e2e.test.js
  9 failed, 2 passed          # <p> wrapper
  11 passed                   # <div> wrapper (reverted)
```

`toggle-tip .popup` does not exist, so `expect(popup).toBeVisible()` reports "element(s) not
found", and every rule in the verbatim stylesheet (`toggle-tip .popup { … }`, ADR-0019's
"fully qualified from the root") stops matching. The blast radius is larger than the five
`inline` tests, and that is the important part: the server HTML and the parsed DOM are
different trees, so React throws a hydration mismatch and **the whole page loses
interactivity** — including both axe runs and the `center`/`near-top`/`left-edge`/`right-edge`
anchors, which have nothing to do with the offending paragraph. On the aggregate `/` page
that would take the other five ported components down with it.

The reference demo has the same defect, one degree worse — it nests a `<p>` *inside* the
`<toggle-tip>` as well. It never shows up upstream because the reference JS runs
`_buildDOM()` *after* parsing, so it rebuilds the (already-hoisted) children into a correct
tree; and because the `inline` tests only assert visibility, never content.

**Decision:** the kitchensink wraps the inline anchor in a `<div className="text-body-md">`,
with the reasoning inline in the file so nobody "fixes" it back. Recommend `ToggleTip.md`
gain a line under `## Contract`: *the host element may not be phrasing-only content — do not
place `<toggle-tip>` inside `<p>`* — or that `.rail`/`.popup` become `<span>`s, which would
make the component genuinely inline-safe at no cost (both are already `position: absolute`
or `display: block` from CSS, so the tag choice is doing no layout work).

---

### F-NEW · `ToggleTip` **does** have an entrance fade; the reference's own porting seam says it does not

**Surface:** `reference-components/src/partials/components/ToggleTip/ToggleTip.css`;
`reference-components/src/e2e-helpers/target.js`; `CLAUDE.md` "Entrance animations break axe".

Three project documents assert the reference popups appear at full opacity.
`src/e2e-helpers/target.js` is explicit: *"The reference popups appear at full opacity (no
fade), so axe always samples a fully-rendered frame and this is a deliberate **no-op by
default**"*, and `AXE_SETTLE` is described as a seam for *consumers who add* an animation.
`ToggleTip.css` contradicts this directly:

```css
toggle-tip .popup[aria-hidden="false"] {
  display: block;
  transition: opacity 0.15s;
  @starting-style { opacity: 0; }
}
```

Measured on our verbatim copy, sampling `getComputedStyle(.popup).opacity` every 20 ms from
the click:

```
t(ms)   0     20    40     60     80     100    120   140+
op      0     0.112 0.575  0.803  0.853  0.969  0.998 1
```

Effective contrast of the bubble's black text (`rgb(0,0,0)`) on its white background during
that ramp:

```
opacity 0.11 →  1.28:1     (fails AA)
opacity 0.58 →  5.33:1     (passes)
```

So there is a real **~40 ms window below WCAG AA**, not the 150–180 ms the playbook
estimates, but sub-AA all the same. It is invisible to CI only because the reference spec
disables the rule itself, with a comment blaming custom-property resolution:

```js
// color-contrast is disabled: axe cannot resolve CSS custom properties on
// custom elements and incorrectly reports #888888 instead of the computed rgb(0,0,0).
await checkA11y(page, 'toggle-tip[data-id="center"]', { axeOptions: { rules: { 'color-contrast': { enabled: false } } } })
```

That comment is a second, independent finding: the stated reason is custom-property
resolution, but the mid-fade opacity would produce the same false positive, and the
rule-disable masks both.

**Decision (Phase A):** keep the CSS byte-identical apart from the sanctioned init-gate
removal. The brief asked for "no entrance animation / keep the reference's
appear-at-full-opacity behaviour", but the reference does not have that behaviour, and
deleting `transition` + `@starting-style` would be an unsanctioned Phase A edit — two
variables, nothing to bisect. We added nothing; the fade is inherited. Our own measured
text contrast at rest is **21.00:1**, far above AA.

**Open question for the owner:** in Phase B, do we (a) delete the `@starting-style` block so
`ToggleTip` matches what `target.js` promises, (b) move the fade onto `transform`/`scale`
which axe does not sample, or (c) leave it and rely on the rule-disable? Recommendation:
(a) — the fade buys 150 ms of polish and costs a documented AA hole in a component whose
whole purpose is accessible supplementary text. Either way `AXE_SETTLE=1` should not be the
answer, because it hides the transient rather than removing it.

---

### F-NEW · F-006's hairline ring is invisible here — the bubble is delineated by `--ui-border`, not `--ui-shadow`

**Surface:** `web/src/styles/ui-tokens.css` → `--ui-shadow`; `toggle-tip .popup`.

`ToggleTip.md` flags `box-shadow: var(--ui-shadow)` as the one property in the component
with no literal fallback, and F-006 maps the token to `0 0 0 1px var(--color-hairline-strong)`
— the same CSS property used as a 1 px ring. Verified with the popup **open**, at
1280×900, light mode:

```
popup color            rgb(0, 0, 0)
popup background       rgb(255, 255, 255)
box-shadow (computed)  rgb(207, 205, 196) 0px 0px 0px 1px
border-top             1px rgb(128, 125, 114)      ← --ui-border #807d72
page background        rgb(247, 247, 244)

popup text  vs popup bg : 21.00:1
popup bg    vs page bg  :  1.07:1
ring #cfcdc4 vs page bg :  1.48:1
border #807d72 vs page bg: 3.84:1
border #807d72 vs popup bg: 4.12:1
```

**The mapping "works" for this component, but not for the reason F-006 gives.** White on
cream is 1.07:1 — no separation at all — and the ring at 1.48:1 adds essentially nothing
visible. What actually detaches the bubble is the rule *above* the `box-shadow` line:
`border: 1px solid var(--_tt-border-color)`, i.e. `--ui-border` at 3.84:1 against the page
and 4.12:1 against the bubble's own fill. Delete the ring and the bubble still reads as a
floating panel; delete the border and it does not, ring or no ring.

**Decision:** no change to `ui-tokens.css` — the popup is adequately delineated and there is
no WCAG failure (1.4.11 non-text contrast wants 3:1 for a boundary "required to identify" a
component; the border delivers 3.84:1). But F-006's claim that `--ui-shadow` is what keeps
the popover delineated does not hold for `ToggleTip`, and the same will be true of the five
date/time popups, which use the same border+shadow pair. Recommend `--ui-shadow` be
re-derived from `--color-hairline-strong` to something with real separation against cream
(a two-layer ring, or a genuine low-alpha shadow if the no-shadow rule can bend for
top-layer surfaces) *or* that F-006 be superseded with the honest statement that the border
does the work and `--ui-shadow` is decorative.

**Dark mode caveat (per the orchestrator's note):** every number above was measured in
**light mode only**. When `--ui-shadow` becomes a `light-dark()` pair, the risk inverts:
`--_tt-surface-color: Canvas` and `--_tt-text-color: CanvasText` are *system* colours, so
the bubble's fill and text follow `color-scheme` automatically while the ring and border
come from `--ui-*`. If the dark palette gives the ring a *lighter* colour than the dark page
but the bubble fill is also dark, the ring becomes the only separation and its contrast
matters much more than it does today. Worth re-measuring the four ratios above in dark mode
before signing dark off.

---

### F-NEW · No portal, no Popover API — a portal would break both the stylesheet and the e2e selectors

**Surface:** `web/src/components/ToggleTip/ToggleTip.tsx`; ADR-0012; ADR-0019.

ADR-0012 hands the top-layer escape to the consuming project and names the two options
(Popover API top layer, or a portal to `document.body`). For this component the answer is
"neither, not yet", and the reason is structural rather than a preference:

1. **Every rule in the stylesheet is qualified from the custom-element root** —
   `toggle-tip .rail`, `toggle-tip .popup`, `toggle-tip[data-direction="top"] .arrow`.
   ADR-0019 requires exactly that ("every rule is fully qualified from the root … a bare
   `.popup {}` at column 0 is a scoping bug"). A `createPortal` to `document.body` makes
   `.rail` and `.popup` non-descendants, so **none** of those rules match and the bubble
   renders as unstyled text in the corner.
2. **ADR-0019's own escape hatch is unavailable.** Its "detached parts" clause says a part
   rendered outside the root gets a root-scoped `.Component-part` name — `.ToggleTip-popup`.
   But the conformance suite selects `tip.locator('.popup')` in 8 of 11 tests. Renaming to
   satisfy ADR-0019 fails the suite; keeping `.popup` bare while portaling violates
   ADR-0019. **The two documents are in direct conflict the moment a consumer takes the
   portal escape ADR-0012 invites them to take** — and ADR-0012 does not mention it.
3. **`popover` / top layer** would hand light-dismiss to the platform. ADR-0012 already
   flags that this needs re-checking against ADR-0007 (light-dismiss must never refocus the
   trigger); native popover light-dismiss returns focus to the invoker, which is precisely
   the behaviour ADR-0007 forbids.

Verified there is no clipping ancestor on either target page (probe walks the ancestor chain
comparing `overflow`): `no clipping ancestor`. So nothing in our kitchensink exercises the
limitation, and we inherit it unfixed exactly as ADR-0012 intends.

**Decision:** stay in normal flow. Documented at the top of `ToggleTip.tsx` so the next
porter does not "improve" it into a portal.

**Open question:** if the five date/time popups later need the escape (they are far more
likely to land inside a scroll container than a ToggleTip), the resolution has to come
first: either ADR-0019 exempts portaled parts from renaming, or the suite's `.popup`
selectors have to move. That is an upstream decision, not something a port can settle.

---

### F-NEW · React's event model absorbs three of the four reference listeners cleanly; only `mousedown`-outside needs a native listener

**Surface:** `web/src/components/ToggleTip/ToggleTip.tsx`.

`destroy()` in the reference removes four listeners. Mapping them onto React:

| Reference | Port | Notes |
|---|---|---|
| `button.addEventListener('click')` | `onClick` prop | Direct. |
| `element.addEventListener('focusout')` | `onBlur` prop on the root | React's `onBlur` **is** `focusout` — it bubbles and `relatedTarget` survives the synthetic wrapper. The spec's `document.body.focus()` test passes unchanged. |
| `window.addEventListener('resize')` | `useEffect` + native listener | No React equivalent; rAF-coalesced as upstream. |
| `document.addEventListener('mousedown')` | `useEffect` + native listener | **Cannot** be a React prop: `onMouseDown` only sees events inside the subtree, which is the inverse of "outside". |

Positive finding worth recording: the light-dismiss/focus split ADR-0007 mandates falls out
for free here. Because `role="tooltip"` never takes focus, focus is still on the trigger
when the popup closes, so "close without refocusing" needs no code at all — there is simply
no `focus()` call anywhere in the port. The bug ADR-0007 was written to prevent cannot be
reintroduced by accident in this component (it can in the date fields, which do move focus
into the popup).

One React-specific hazard found and avoided: the direction measurement must happen **before**
the open render, so the bubble never paints on the wrong side. The tempting shape is to call
`setDirection` inside the `setOpen` updater — but updaters must be pure and StrictMode
double-invokes them. Measuring in the handler body and letting React batch the two
`setState` calls into one commit gives the same single-render result without the impurity.

---

### F-NEW · The `title` attribute conflict is real, and React makes the documented fix free

**Surface:** `ToggleTip.md` § "Known attribute conflict"; `ToggleTip.tsx`.

`ToggleTip.md` documents that its `title` attribute collides with the global HTML `title`
attribute — authoring `<toggle-tip title="A title">` makes the browser paint a **native**
tooltip on hover, on top of the accessible one — and asks framework implementations to
rename it. In React this is a one-word prop rename with no downstream cost: the prop is
`heading`, nothing named `title` ever reaches the DOM, and the `.title` **class** (which is
contract — the stylesheet styles `toggle-tip .title` and the divider hangs off it) is
untouched. `headingLevel` likewise replaces the `heading-level` attribute.

**Decision:** `heading` / `headingLevel`. Recommend the reference make the same rename in
its own next spec revision — it is the only place in the library where the authoring API
actively fights a native browser behaviour, and the fix costs one attribute name.

---

### F-NEW · The init gate is exactly where PORTING.md says it bites, and it bites this component hardest

**Surface:** `web/src/components/ToggleTip/ToggleTip.css`.

Confirms F-010 on the one component where the failure mode is visible rather than
theoretical. Four rules removed, with the removal documented in place:

```css
toggle-tip                  { overflow: hidden }
toggle-tip > *              { opacity: 0 }
toggle-tip[initialized]     { overflow: visible }
toggle-tip[initialized] > * { opacity: 1 }
```

`toggle-tip` is `width: 1.5rem; height: 1.5rem`, and the popup is a 320 px absolutely
positioned descendant. Keeping `overflow: hidden` clips it to a 24×24 box. The reference
only escapes this because `[initialized]` flips it back — so a port that renders formed
markup *and* keeps the gate would be fine too, since the attribute is present from the first
paint. Removing the rules is still correct (they are runtime, not contract) but the
"clipping" risk is conditional on also dropping the attribute. Both halves of F-010 matter
together, which is easy to miss.

The `initialized` attribute is rendered as a bare, valueless attribute (`initialized=""`),
matching the reference's `setAttribute('initialized', '')`. Note this component uses bare
`initialized`, **not** `data-initialized="true"` like AffixField/FileUpload — worth knowing
before writing a generic wait helper.

---

### F-NEW · `TARGET_PATH` is inert for this suite (already fixed project-side)

**Surface:** `reference-components/src/partials/components/ToggleTip/tests/ToggleTip.e2e.test.js:5`.

`ToggleTip.e2e.test.js` calls `page.goto('/')` rather than `goto(targetPath())`, so the
documented `TARGET_PATH` seam does not reach it. Recorded here only to note the measured
consequence: running with `TARGET_PATH=/kitchen-sink/toggletip` produced 8 failures and
3 passes (the 3 being `closes on second click`, which passes vacuously when the popup never
opens, plus both axe runs, which pass vacuously when the scope element is absent). **A
vacuous pass is the dangerous part** — two of the eleven tests are green on a page that
does not contain the component at all.

Serving the aggregate kitchensink at `/` (landed by the orchestrator while this port was in
flight) fixes it. Recommend the upstream spec switch to `goto(targetPath())` like the other
nine; and, separately, that the axe tests assert the scope element exists before auditing,
so a missing component fails loudly instead of reporting "No accessibility violations
detected!".

A local reverse proxy that served the isolated route at `/` was tried first and **must not be
repeated**: it makes the App Router's RSC payload disagree with `window.location`, hydration
bails, and the page loses all interactivity — every click-driven test fails while the axe
tests still pass, which looks exactly like a broken port.

---

### F-NEW · The kernel port's shape, for the five popup fields that will build on it

**Surface:** `web/src/kernel/popup-position.ts`.

Positive finding: `popup-position` is the cleanest thing in the library to port. Three pure
functions, no DOM, no framework surface. The port is a transliteration — same names, same
signatures, same defaults, same clamp arithmetic — plus one exported type alias
`PopupDirection = 'top' | 'bottom'` so consumers do not re-declare the union.

```ts
calculatePopupOffset(triggerCenterX, containerLeft, containerWidth, popupWidth,
                     viewportWidth = window.innerWidth, viewportInset = 0): number   // %
calculateArrowOffset(triggerCenterX, popupLeft, popupWidth, borderRadius, arrowSize): number // px
detectDirection(triggerRect: Pick<DOMRect,'top'|'bottom'>,
                viewportHeight = window.innerHeight): PopupDirection
export type PopupDirection = 'top' | 'bottom'
```

Deliberately **not** a hook, and no `usePopupPosition.ts` wrapper was added. Every call site
is inside a layout effect or an event handler where the functions are called imperatively on
freshly measured rects; a hook would have to own the measurement, which is the part that
differs per component (ToggleTip measures a rail; the date fields measure a trigger and a
panel). Keeping the primitive plain is what lets six components share it.

Two notes for the field ports:

1. **The default parameters read `window`.** They are the reference's defaults and were kept
   for signature fidelity, but they make the module unsafe to call during SSR. Pass
   `viewportWidth` / `viewportHeight` explicitly if you ever call these outside the browser.
2. **CSS lengths must be resolved by layout, not by the CSSOM.** The reference's `_getCSSPx()`
   probe is not incidental: `--_tt-arrow-size` is `calc(var(--_tt-button-width) / 2)` and
   `--_tt-border-radius` chains to `--ui-radius`, and `getComputedStyle().getPropertyValue()`
   returns those **unresolved**. The only honest way to get px is to append a
   `width: var(--prop, 0px)` probe inside the component root (custom-property inheritance
   requires *inside*), read `getBoundingClientRect().width`, and remove it. This is ported as
   `resolveCssPx(host, property)` in `ToggleTip.tsx`. It mutates a React-owned DOM node —
   acceptable only because append/measure/remove is fully synchronous, so React never
   observes it and no commit intervenes. The five field ports will need the same helper;
   consider promoting it to `web/src/kernel/` when the second consumer arrives rather than
   copying it.

Verified live: with the popup open at 1280 px the port writes
`--_tt-popup-offset: 50%; --_tt-arrow-offset: 0px;` onto the root for a centred trigger, and
`--SITE--PADDING` resolves to `48px` (so `viewportInset` = 24 px). The two clamp tests
(`bubble does not overflow viewport left/right edge`, at 800 px) pass, which is the only
end-to-end proof that the percentage-of-rail return value and the inset halving are wired
correctly.

**Conformance-test decision:** `web/src/kernel/tests/popup-position.test.ts` is the
reference's `popup-position.unit.test.ts` with only the import path changed —
`diff <(tail -n +9 …) …` is empty. PORTING.md excludes `*.unit.test.*` because they are
white-box tests that call private methods; these three functions have no private surface,
and `kernel/README.md` describes them as *"black-box-portable: port the function, run the
conformance test against your implementation"*. Keeping the assertions verbatim is what
makes the file a faithfulness proof rather than a restatement of our own code.

---

### F-NEW · A 224 px post-hydration layout shift from MonthField/TimeField eats the click that opens the ToggleTip — on the dev server only

**Surface:** `web/src/components/AggregateKitchensink.tsx` (`/`); MonthField and TimeField;
`reference-components/src/partials/components/ToggleTip/tests/ToggleTip.e2e.test.js`.

ToggleTip regressed from 11/11 to a flaky 5–8/11 without any change to `ToggleTip.tsx`'s
logic. The root cause is not in this component, not in the `resolveCssPx` kernel promotion,
and not in the px→rem token change. It is **cumulative layout shift from two other
components mounted above it on the aggregate page**, racing Playwright's click.

**Mechanism, measured.** Playwright's `locator.click()` computes a target point from the
element's box, then moves the mouse there. On `/` the document grows **+224 px above the
ToggleTip section** roughly 330–410 ms after `DOMContentLoaded` — after the point has been
computed:

```
mousedown  tgt=button   aim=(206,360)  btnY=572  sy=27615  docH=30404
mouseup    tgt=h3       aim=(206,360)  btnY=572  sy=27615  docH=30404
click      tgt=section  aim=(206,360)  btnY=572  sy=27615  docH=30404
docHeights over 2s: 30180 -> 30404   (first change at t=395ms)
```

The aim stays at y=360 while the trigger has been pushed to y=572 — a **212 px miss**.
`mousedown` still reports the button (Chrome hit-tests before the frame commits), `mouseup`
lands on a `Block` heading, so the browser dispatches `click` on their common ancestor
`section.kitchensink-section`. **The button never receives a click event**, so nothing opens,
and every test that clicks then asserts `.popup` visibility fails — including the positioning
tests, which then fail with `TypeError: Cannot read properties of null (reading 'y')` because
`boundingBox()` on a `display: none` popup is null.

With suite-exact timing (instrumentation installed via `addInitScript`, so nothing is
inserted between `goto` and the click): **9/10 clicks missed**. An earlier probe that ran a
`page.evaluate()` between `goto` and the click reported 0/10 — the probe's own ~30 ms delay
let the shift land first. Worth recording as a methodology note: *any* instrumentation
between navigation and the action hides this class of bug.

**Who shifts.** A `ResizeObserver` over every element under `main`, counting growth events
>1 px:

```
SECTIONS THAT GREW:  2 × section.kitchensink-section  1501 -> 1613   (+112 each = +224)
COMPONENT INSTANCES THAT GREW:  { "MonthField": 17, "TimeField": 16 }
ANY toggle-tip growth?  0        (of 479 growth events total)
```

Per instance the shape is a **post-mount reveal**, not a resize:

```
div[data-component=MonthField][data-id=mf-empty-default]  h 24 -> 40
  input.native   h 24 -> 1
  div.overlay    h  0 -> 30
  div.segments   h  0 -> 24
  button.trigger h  0 -> 18
```

The overlay, segments and trigger render at height **0** and are given their real height on
the client. That is the init-gate shape F-010 warns about, expressed as layout rather than
`overflow`: the server HTML is not the end state, so the page grows when JS lands.

**A/B on one dev server, same code, same harness.** The only variable is whether
MonthField/TimeField are mounted above the ToggleTip:

```
$ node tasks/probes/toggletip-flake2.mjs http://localhost:3000/kitchen-sink/toggletip 10
   0/10 missed          # isolated route — nothing above it shifts
$ node tasks/probes/toggletip-flake2.mjs http://localhost:3000/ 10
  10/10 missed          # aggregate page — +224px lands mid-gesture
```

Suite runs match: dev `/` gives **4–8 of 11** and degrades further under load (more parallel
work → slower hydration → the shift lands later, deeper inside the click window), which is
itself confirmation of the mechanism rather than noise.

**Dev only — but the defect is real in both.** Against a production build of the identical
page the same +224 px shift happens at **t=66 ms**, early enough to land before Playwright's
first action:

```
$ BASE_URL=http://localhost:3100  (next start, same aggregate page, all 16 components)
  11 passed (3.2s)
  11 passed (3.2s)
  11 passed (3.1s)
$ node tasks/probes/toggletip-flake2.mjs http://localhost:3100/ 6
  0/6 missed
```

So the port is correct and its locators resolve uniquely on the aggregate page alongside
DateField/TimeField/MonthField/WeekField (all of which also render `.trigger` and `.popup`).
Dev's slower hydration is what moves the shift into the click window.

**Decision:** no change to `ToggleTip.tsx` or its kitchensink. There is no
implementation-side fix: a coordinate-based click on a trigger that moves 212 px mid-gesture
misses regardless of how the component is built, and the reference's vanilla `button.click`
listener would fail identically. Making the 24×24 trigger bigger, or reordering the
aggregate page so ToggleTip sits above MonthField, would hide a real defect rather than fix
it.

**The fix belongs to MonthField and TimeField:** render the overlay/segments/trigger at
their final height on the server (the end-state ideal CLAUDE.md already prefers), or reserve
the height so the client reveal costs 0 px. **Section order on `/` is alphabetical, so the
components sitting below the shift are exactly ToggleTip and WeekField** — WeekField's
click-driven tests should be expected to flake the same way, and any component added after
`T` alphabetically will inherit it. This is worth fixing on its own merits: 224 px of CLS on
the flagship page is a Core Web Vitals defect, not just a test-harness annoyance.

**Open question:** should `verify` gain a CLS gate — assert `document.scrollHeight` is stable
from first paint — so this class of regression is caught by the project rather than by
whichever component happens to sit below it?

---

### F-NEW · `resolveCssPx`'s promotion to the kernel was clean — ruled out, with evidence

**Surface:** `web/src/kernel/css-px.ts`; `web/src/components/ToggleTip/ToggleTip.tsx`.

Recorded because the promotion was the prime suspect and the "shared primitive extracted for
correctness breaks its first consumer" risk is a real one worth closing explicitly rather
than leaving implied.

The extraction is behaviour-preserving. The one substantive change —
`document.createElement` → `host.ownerDocument.createElement` — is strictly safer. The probe
is still appended inside `host`, which is the part that matters (custom properties inherit,
so `--_tt-arrow-size` must be read from inside the component root, not from `<body>`).
Verified live with the popup open on the aggregate page:

```
MUTATE style=--_tt-popup-offset: 50%; --_tt-arrow-offset: 0px; on .toggle-tip
```

Both custom properties are still written, with the correct values for a centred trigger. The
px→rem token move is likewise inert here, as predicted: the probe measures a rendered box, so
it resolves `calc(var(--_tt-button-width) / 2)` and the `--ui-radius` chain to the same pixel
values whatever unit the tokens are authored in — `--ui-radius` computes to `12px` in both
regimes.

**Decision:** keep the kernel version; no local copy. Positive finding for the "port the
kernel once" trade — the extraction cost nothing and the second consumer (five popup fields)
gets the probe's three non-obvious constraints (inside the host, synchronous, forces layout)
documented once instead of six times.

---

### F-NEW · The `--ui-shadow` open question, closed in dark

**Surface:** `web/src/styles/ui-tokens.css`; `toggle-tip .popup`.

The earlier `--ui-shadow` entry above flagged that all four delineation ratios were
light-only and asked for a dark re-measure once a dark palette existed. It exists now, so
here it is — popup open, `data-appearance` toggled, `toggle-tip[data-id="center"]`:

| | light | dark |
|---|---|---|
| popup fill | `rgb(255,255,255)` | `rgb(18,18,18)` |
| page bg | `rgb(247,247,244)` | `rgb(26,26,23)` |
| text vs popup fill | **21.00:1** | **18.73:1** |
| popup fill vs page bg | 1.07:1 | 1.07:1 |
| `--ui-border` vs page bg | **3.84:1** | **5.32:1** |
| `--ui-border` vs popup fill | 4.12:1 | 5.71:1 |
| `--ui-shadow` ring vs page bg | 1.48:1 | 2.00:1 |

The prediction held and the conclusion generalises. `--_tt-surface-color: Canvas` and
`--_tt-text-color: CanvasText` follow `color-scheme` automatically, so the bubble fill flips
to `rgb(18,18,18)` with no token work — but it lands 1.07:1 from the page in **both**
appearances, i.e. the fill never separates the popup in either mode. The ring stays weak
(1.48 → 2.00, still under the 3:1 of WCAG 1.4.11), and `--ui-border` carries the delineation
in both, comfortably clear of 3:1 and *better* in dark than in light.

**Decision:** no token change, and the open question is closed — the mapping is safe in both
appearances. But the honest statement remains that **`--ui-border` is what detaches this
popover and `--ui-shadow` is decorative**, in dark as in light. F-006's rationale should be
superseded with that wording rather than left implying the ring does the work.
