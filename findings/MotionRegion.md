# MotionRegion — findings

Port of `reference-components/src/partials/components/MotionRegion` plus its kernel
dependency `js/motion-policy` (ADR-0010). Phase A only — CSS copied verbatim, no
Tailwind translation of design values.

**Conformance:** `MotionRegion.e2e.test.js` — **5 passed / 0 failed**, against both
`TARGET_PATH=/kitchen-sink/motionregion` and `TARGET_PATH=/`. Axe: "No accessibility
violations detected!" (run in the browser default appearance, i.e. light —
dark mode landed after these runs and was not re-measured here; no colour value
is asserted by this port, which ships no `--ui-*` overrides). **Kernel unit conformance: 15 passed / 0 failed.** `next build` clean.
`git -C reference-components status --short` empty.

---

### F-NEW · `prefers-reduced-motion` cannot be read during SSR, so the port has a pre-hydration window the client-only reference never has

**Surface:** `MotionRegion.tsx`, `MotionRegion.kitchensink.css`.

`data-motion` is the resolution of five signals, and three of them (`matchMedia`,
`navigator.connection`, `IntersectionObserver`) exist only in a browser. The server
therefore has **no honest value** to emit — and the contract already anticipates
this: `MotionRegion.md` says `data-motion` is "absent until the component
initializes". So the port renders `data-motion={initialized ? motion : undefined}`
and `data-initialized` only after mount.

The reference has the same window (its `attach()` runs after parse). The question is
whether SSR + hydration widens it, and what the CSS backend does inside it. Measured
with `web/tasks/probes/motion-region-hydration.mjs` (Playwright, real Chromium,
`emulateMedia`), timing from the moment the region element exists in the DOM to the
moment `data-motion` appears:

| Build | `prefers-reduced-motion` | window with no `data-motion` | resolved value |
|---|---|---|---|
| `next build` + `next start` | `no-preference` | **22.7 – 30.0 ms** | `running` |
| `next build` + `next start` | `reduce` | **26.5 – 33.7 ms** | `paused` |
| `next dev` | `no-preference` | 92.1 ms | `running` |
| `next dev` | `reduce` | 93.4 ms | `paused` |

Production figures are the range over 16 samples with the final
`useSyncExternalStore` implementation (median ≈ 27 ms). An earlier
`useEffect` + `setState` build of the same component measured 29.5 / 30.0 ms —
inside this noise band, so **this probe cannot resolve the second-commit cost the
ScrollArea port measured**: it times from "the region element exists in the DOM"
to "`data-motion` is present", which is dominated by JS download + hydration
scheduling, not by how many commits React needs once hydration starts. The
architectural claim still holds (`useSyncExternalStore` resolves inside the
hydration pass; `useEffect` + `setState` schedules a second passive commit) — it
is simply not the term that dominates this particular window.

Two further measurements:

1. **No hydration mismatch.** `web/tasks/probes/mr-hydration-errors.mjs` captured
   every non-`log` console message and `pageerror` on `/kitchen-sink/motionregion`
   and `/`, under both preferences: **zero** hydration warnings, zero page errors.
   The SSR HTML contains neither `data-motion` nor `class="control"` (verified by
   fetching the markup), and the first client render agrees with it, because the
   signals are read through `useSyncExternalStore` with a server snapshot of "nothing
   known yet" rather than by comparing against a guess.
2. **Inside the window the reference's own CSS gate cannot fire.** The reference
   backend gates on `[data-motion="paused"]`, which does not match while the
   attribute is *absent*, so `animation-play-state` is its default `running`.
   Counterfactual measured directly (`web/tasks/probes/mr-gate-counterfactual.mjs`)
   under `reduce`, with the attribute stripped to reproduce the pre-init state:

   ```
   { preInitWithGate: 'paused', rulesRemoved: 1, preInitWithoutGate: 'running' }
   ```

   ~30 ms of animation at first paint for a user who asked the OS to stop moving
   things is a WCAG 2.3.3 miss, small but real, and it is *worse* in dev because
   Next injects stylesheets via JS there — the demo CSS is not applied at all during
   the window.

**Decision:** close the window in the **authored backend**, not the component, and
scope the fix to the pre-init state only. `MotionRegion.kitchensink.css` adds:

```css
@media (prefers-reduced-motion: reduce) {
  .MotionRegion:not([data-motion]) .demo-animation { animation-play-state: paused; }
}
```

This is zero-JS, it is the kind of rule the contract says a CSS backend owns, and
`:not([data-motion])` is deliberate: once the component has spoken, the kernel's
precedence is the only authority — in particular a user's explicit start must still
override reduced motion, which a blanket `@media` pause would silently break. A
port that gated the whole backend on the media query would pass the same e2e suite
while violating the contract's stated precedence.

**Open question for the project owner:** should this become part of the *documented
backend contract* upstream ("gate on `:not([data-motion="running"])`, not on
`[data-motion="paused"]`")? The reference `.md` tells backend authors to write the
weaker rule, which is fine for a client-only library and is a latent
first-paint defect for any SSR consumer. This is a contract-level gap, not a port
defect.

---

### F-NEW · The kernel stayed genuinely framework-agnostic — and per ADR-0010 it should not become a hook

**Surface:** `web/src/kernel/motion-policy.ts`.

`motion-policy` ported as a **plain module**: two pure functions, no DOM, no React,
no browser globals — structurally identical to the reference. Nothing about React
pushed on it, because the friction in this component is all about *when* signals can
be read, not about how the decision is computed.

No `useMotionPolicy` hook was added, and that is a deliberate call rather than an
omission. A React wrapper would only be worth having if it owned the *signal
gathering* (matchMedia / connection / IntersectionObserver), and ADR-0010 explicitly
defers that: "Reconsider when — a second motion component needs the policy … fold
shared signal-gathering into the kernel **then**". MotionRegion is the only consumer
today, so folding gathering into a kernel hook now would invent a shared abstraction
from a single example, and would drag DOM and React into a module whose whole value
is having neither.

**Decision:** keep `motion-policy.ts` a plain module; keep signal gathering in the
component. Revisit — as a hook this time — when a second motion component lands.
**Positive finding:** the cleanest kernel port so far. The kernel/component seam the
ADR chose is exactly the seam React wanted.

---

### F-NEW · PORTING.md's blanket exclusion of `*.unit.test.*` is wrong for pure kernel modules — this one re-pointed with a one-line change

**Surface:** `reference-components/src/kernel/js/tests/motion-policy.unit.test.ts` →
`web/src/kernel/tests/motion-policy.test.ts`.

PORTING.md excludes `*.unit.test.*` from the portable contract because the reference
unit tests are white-box — they call private methods of the reference classes. That
reasoning holds for the *components*. It does not hold for the pure kernel modules,
and `motion-policy` proves it: its "unit" test is already black-box, importing only
the two published functions and asserting on their documented return shapes.

Adaptation cost, measured — `diff` of the reference file against the port's body:

```
7c8
< } from "../motion-policy"
---
> } from '../motion-policy'
```

That is the entire delta: the import specifier, and only because the port uses double
quotes. Every one of the 15 assertions ran unmodified against the port:

```
Test Files  1 passed (1)
      Tests  15 passed (15)
```

**Decision:** re-point the kernel's pure-logic unit tests, and say so in the file
header so nobody mistakes it for a PORTING.md violation. Vitest is now set up in
`web/`: `vitest` devDependency, `web/vitest.config.mts`
(`environment: "node"` — the pure kernel needs no jsdom;
`include: ["src/**/tests/**/*.test.ts"]`), and `npm run test:unit`. **Vitest
ownership is settled — this port added it.** The harness immediately picked up a
second kernel port landing in parallel (`popup-position`), and both suites are green:
26 tests total.

**Open question:** should PORTING.md's exclusion be narrowed upstream to
"`src/partials/components/**/*.unit.test.*`", leaving `src/kernel/**` unit tests
inside the portable contract? For a primitive whose whole selling point is "specified
once, unit-tested exhaustively", shipping the tests as part of the contract is nearly
free and is the only thing that proves the port kept the precedence rules.

---

### F-NEW · `useSyncExternalStore` is the honest React expression of a media-query signal; the reference's imperative shape is a lint error under the React Compiler

**Surface:** `MotionRegion.tsx`.

The reference gathers signals imperatively in `setupSignals()` and stores them on the
instance. The literal React translation — read `matchMedia(...).matches` in a mount
effect and `setState` — is flagged by this app's ESLint config:

```
src/components/MotionRegion/MotionRegion.tsx:134:7
  error  Calling setState synchronously within an effect can trigger cascading
         renders   react-hooks/set-state-in-effect
```

(The `ScrollArea` port hit the same rule on its own `setMounted(true)` mount flag, so
this is a pattern-level friction, not a one-off.)

`useSyncExternalStore` is the right primitive and, more importantly, the *safer* one:
it has a first-class **server snapshot**, which is exactly the thing the SSR problem
above needs. The port uses it three times — the hydration flag
(`() => true` / `() => false`), `prefers-reduced-motion`, and `navigator.connection`
(the two connection signals travel as one primitive string, `"0|4g"`, because a
snapshot must be comparable by identity and a fresh object per read causes an
infinite re-render loop). Visibility stays `useState` + an effect, correctly: an
`IntersectionObserver` pushes to a callback, and `setState` from a callback is
exactly what the rule permits.

**Decision:** express environment signals as external stores, not as effects.
**Positive finding:** React has a better vocabulary for this than the reference does
— the reference's `onSignalChange` re-reads everything on any change, whereas each
store re-renders only on its own change, and the server snapshot makes "we do not
know yet" a value rather than an implicit pre-init state.

---

### F-NEW · The React Compiler refuses hand-written memoization in this component

**Surface:** `MotionRegion.tsx`, the toggle handler.

Wrapping `onToggle` in `useCallback(..., [motion])` — the reflex for a handler passed
to a child — fails the build's lint gate:

```
src/components/MotionRegion/MotionRegion.tsx:238:32
  error  Compilation Skipped: Existing memoization could not be preserved
```

`motion` is a value derived during render from the kernel; the compiler cannot prove
the hand-written memo matches what it would infer, so it bails out of compiling the
component altogether — i.e. the manual optimisation *costs* the automatic one.

**Decision:** plain function, let the compiler memoize. Worth knowing for every other
port in this repo: `useCallback` around anything derived from a computed render value
is now a build error, not a style preference.

---

### F-NEW · A JS-injected control becomes a conditional render, and that is strictly better

**Surface:** `MotionRegion.tsx`.

The reference creates the WCAG 2.2.2 pause control in `init()` (`createElement` +
`prepend`), so without JS there is no control and the `<noscript>` native-controls
video is the floor. The port renders it under `{initialized && …}` — same observable
result, but the label, the icon path and `data-icon` are now derived from one value
instead of being kept in sync by `updateControl()`. The reference's three-line
"update the DOM to match state" method has no counterpart in the port: there is
nothing to forget to update.

Rendering the control server-side was rejected deliberately: it would be a dead
button for a no-JS user, and its `aria-label` would have to state a motion state the
server cannot know.

**Positive finding:** the two shapes React removed here — `updateControl()` and the
`appliedVideoState` guard's reason for existing — are both classes of drift bug.
(The guard itself is kept: `play()`/`pause()` on a real `<video>` is still an
imperative side effect, and firing them redundantly produces the "play() interrupted
by pause()" console error.)

---

### F-NEW · `MotionRegion.css` copied verbatim with no exceptions — no init-gate rules to drop

**Surface:** `web/src/components/MotionRegion/MotionRegion.css`.

`diff` against the submodule is empty; 49 lines, byte-identical. Unlike the popup
components (F-010) there are no `[data-initialized="true"]` gate rules to remove, so
Phase A here is a pure copy. The stylesheet also stops exactly where the contract
says it does — it styles the injected `.control` and gives the root a positioning
context, and deliberately does not touch the media.

**Positive finding:** a component whose CSS makes no assumption about *when* markup
appears ports with zero edits. That is a property of the reference's design, not of
luck: the control is the only thing it styles, and the control is injected.

---

### F-NEW · The reference's demo backend lives in an inline `<style>` with nowhere to go in React

**Surface:** `MotionRegion.kitchensink.css` (new file).

`MotionRegion.html` carries the CSS-animated demo backend in an inline `<style>`
block inside the demo section, and that markup is *authored content*, not component
CSS — the whole point of the `data-motion` seam. In React there is no equivalent
place: a `<style>` tag in JSX is hoisted unpredictably, and appending it to
`MotionRegion.css` would break the byte-identity requirement on the verbatim copy.

**Decision:** a sibling `MotionRegion.kitchensink.css`, imported by the kitchensink
only, holding the demo backend (`.demo-animation`, the `@keyframes`, the
`.MotionRegion video` sizing) plus the pre-init gate from the first finding. The
component stylesheet stays a byte-for-byte copy, and the file boundary now *states*
the architectural claim the inline `<style>` only implied: the backend is not part of
the component. `.demo-animation` is a test-contract class name (the suite asserts
`animation-play-state` on it), so it is preserved exactly — F-008 applies to demo
markup too.

---

### F-NEW · The media-agnostic seam forces one imperative DOM query in React

**Surface:** `MotionRegion.tsx`, the video adapter.

The region governs *authored* media it does not own, and asks one question about it:
"is there a `<video>` in here?" In vanilla that is `root.querySelector('video')`. In
React the children are an opaque `ReactNode`, so the port does the same query in an
effect — and then needs a state write to publish the resolved video id as the
control's `aria-controls`, because that id is only knowable after the first commit.

The alternatives were worse: `aria-controls` pointing at an id that may not exist is
an axe `aria-valid-attr-value` violation, and rendering it unconditionally is
therefore not an option. Taking the video as a prop or a render-prop would be more
idiomatic React but changes the component's public shape, which is the one thing a
conformance port must not do.

**Decision:** keep the querySelector, keep the single bounded state write (the id
never changes, so it cannot cascade). **Open question:** if a React-native API for
this library is ever designed rather than ported, `<MotionRegion media={ref}>` or a
`{(state) => …}` child would express the seam without a DOM query — worth deciding
deliberately rather than inheriting.

---

### F-NEW · On the aggregate page the region is legitimately `paused` at load — the visibility gate is doing its job

**Surface:** `/` vs `/kitchen-sink/motionregion`.

Measured after init, no scrolling: `data-motion` is `running` on the isolated route
(the region is above the fold) and `paused` on the aggregate `/` (it is below it).
Both are correct — visibility is the universal tier — and the suite passes on both
because `beforeEach` calls `scrollIntoViewIfNeeded()` first.

**Positive finding / warning for other porters:** this is the one component in the
set whose expected state depends on *where it sits on the host page*. Any additional
assertion written against `/` without scrolling first will read a correct `paused` as
a failure. The reference suite gets this right; a hand-written smoke test would not.

---

### F-NEW · A kitchensink demo width is a WCAG 1.4.10 Reflow failure that no component-scoped axe run can catch

**Surface:** `MotionRegion.kitchensink.tsx` / `MotionRegion.kitchensink.css`. Found by
the ScrollArea agent while verifying its own break-out behaviour; the overflow was
mine.

The demo instances were sized `w-[28rem] max-w-full` — the reflex idiom, and wrong.
Measured document-level horizontal overflow (`documentElement.scrollWidth -
clientWidth`) with `web/tasks/probes/mr-reflow.mjs`, before the fix:

| viewport | `/` | `/kitchen-sink/motionregion` | innermost offender |
|---|---|---|---|
| 320 px | **169 px** | **169 px** | `.MotionRegion.w-[28rem].max-w-full` — `left: 41, right: 489` |
| 480 px | **9 px** | **9 px** | same |
| 768 px | 0 | 0 | — |

`max-w-full` cannot rescue it: a fixed 448 px grid item *sizes the auto track it
sits in*, so `100%` resolves against 448 px, not the viewport. Two things make this
worth an entry rather than a silent fix:

1. **WCAG 1.4.10 requires reflow without two-dimensional scrolling down to 320 CSS
   px, and axe does not test reflow at all** — not scoped, not full-page. Every axe
   run in this project was green while the shared page failed 1.4.10 at 320 px. Same
   class as F-017: a component-scoped green says nothing about the page, and here a
   *page*-scoped green would not have caught it either. Reflow needs a viewport
   sweep, which is a different instrument.
2. **Going fully fluid is also wrong**, and measuring caught that too. With
   `w-full max-w-[28rem]` the overflow went to 0 at every width — but the auto grid
   track then collapsed to the width of the caption above it: the live demo measured
   **142 px wide at a 1280 px viewport**, i.e. the fix silently destroyed the demo.

**Decision:** state the width in viewport units, which are not circular with track
sizing, in a `.motion-region-demo` class in the kitchensink stylesheet:

```css
.motion-region-demo { inline-size: min(28rem, calc(100vw - 8rem)); }
```

Measured after the fix — **zero document overflow at 320, 360, 480, 768, 1024 and
1280 px on both `/` and `/kitchen-sink/motionregion`**, with the demo keeping its
full 448 px design width from 768 px up (320 px → 192 px, 360 px → 232 px,
480 px → 352 px). The `8rem` is page + section chrome plus slack for a classic
scrollbar, which `100vw` ignores.

**Reported rather than fixed:** the general fix belongs in the shared `Cell` grid in
`kitchensink-ui.tsx`. A `min-w-0` on its track would let every component use the
obvious `w-[28rem] max-w-full` idiom and get reflow for free, instead of each port
discovering the circularity for itself. I have not touched that file. **Suggestion
for the harness:** add the viewport sweep above as a standing check — it is ~20 lines,
it runs in under two seconds, and it catches a WCAG failure the entire axe suite is
blind to.
