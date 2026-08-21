# Findings — ScrollArea (Phase A)

**Result: 3 / 3 conformance tests green**, including the scoped axe audit ("No
accessibility violations detected!"). No non-portable assertions; nothing was
weakened to pass. Verified against **both** target paths now that `/` serves the
aggregate kitchensink, passing the spec file explicitly rather than `--grep`:

```
BASE_URL=http://localhost:3000 TARGET_PATH=/kitchen-sink/scrollarea \
  npx playwright test src/partials/components/ScrollArea/tests/ScrollArea.e2e.test.js   # 3 passed
BASE_URL=http://localhost:3000 TARGET_PATH=/ \
  npx playwright test src/partials/components/ScrollArea/tests/ScrollArea.e2e.test.js   # 3 passed
```

`web/src/components/ScrollArea/ScrollArea.css` is byte-identical to the submodule
copy (`diff` clean) and contained no init-gate rules to drop. `npm run lint` and
`npm run build` are both clean.

Created:

- `web/src/components/ScrollArea/ScrollArea.css` — verbatim copy
- `web/src/components/ScrollArea/ScrollArea.tsx` — the port (`'use client'`)
- `web/src/components/ScrollArea/ScrollArea.kitchensink.tsx`
- `web/src/app/kitchen-sink/scrollarea/page.tsx`
- probes (gitignored): `web/tasks/probes/probe-scrollarea-{firstpaint,ref,prod,states,pointer,kb,contrast,contrast2,frames,race,ring,fade,aggregate,overflow}.mjs`

`cd web && npm run build` compiles clean. `git -C reference-components status --short`
prints nothing.

**Two orchestrator items, resolved:** the ScrollArea kitchensink needed no local
contrast workarounds, so the `kitchensink-ui.tsx` `text-muted` → `text-body` fix
required no follow-up here. And `Section`'s new `anchorId` is not needed — this
spec scopes its audit with `scopedCheckA11y(page, SA)` against the component root,
so it never touches the reference demo-section id or F-014's
`.kitchensink-section` dependency.

**Appearance:** every ratio in this file has now been measured in **both**
appearances against the `light-dark()` palette — `--color-surface-card`
`#ffffff` / `#232320` and `--color-canvas` `#f7f7f4` / `#1a1a17`, forced via
`data-appearance` plus Playwright's `colorScheme`. The results were **not** what
either of us predicted, and both colour entries below are corrected rather than
merely annotated.

**Handback, not a ScrollArea defect:** at 480px the aggregate `/` has 9px of
document horizontal overflow (a page-level horizontal scrollbar). Isolated to
`.MotionRegion.w-[28rem].max-w-full` inside a `Cell` — it measures `left: 41,
right: 489` against a 480px viewport, and hiding the whole ScrollArea section
leaves the overflow at 9px unchanged (`probe-scrollarea-overflow.mjs`).
`/kitchen-sink/scrollarea` has 0px. Worth passing to the MotionRegion port:
`max-w-full` does not constrain it because the `Cell` grid track is already wider
than the viewport.

---

### F-NEW · The first component whose JS *measures* rather than *computes* — and a production React build now matches the reference frame for frame

**Surface:** `ScrollArea.tsx`, measured against the reference's own Vite dev server.

F-015 recorded AffixField as the contract's ideal: its JS only *computes
attributes*, so it ports to a Server Component with zero client JS. ScrollArea is
the counter-case and worth naming as a category. Its JS **measures rendered
layout** — `scrollWidth − clientWidth` — and every attribute downstream of that
measurement (`tabindex="0"` on the region, the existence of `.scrollbar`, the
thumb's geometry, `data-scrollbar="true"`) is unknowable on the server. `'use
client'` is not a shortcut here; it is the only correct placement.

So the window the orchestrator predicted does exist. It was measured two ways —
in milliseconds against the browser's own `first-contentful-paint` entry, and in
**rendered frames** via a `requestAnimationFrame` counter started at navigation
commit (`probe-scrollarea-firstpaint.mjs`, `probe-scrollarea-frames.mjs`; Chromium,
480×800, 5 runs each):

| Build | FCP → `tabindex="0"` | frames: root in DOM → `tabindex` | frames: `data-scrollbar` → `tabindex` |
|---|---|---|---|
| Reference (Vite dev) | 69.7 – 87.1 ms | 4 – 5 | **1** |
| This port (`next dev`) | 88.4 – 95.8 ms | 10 – 12 | 1 – 2 |
| This port, `useEffect` gate (`next build`) | 13.6 – 27.5 ms | 4 – 5 | 2 |
| **This port, `useSyncExternalStore` gate (`next build`)** | **6.1 – 11.0 ms** | **3** (5/5 runs) | **1** |

The last row is the important one, and it was **not** the expected result. The
`useSyncExternalStore` rewrite forced by the lint rule (next entry) was supposed
to be behaviour-neutral. It is not: it **closed the one-frame React penalty
entirely**. Re-measured after the change, the production port is 3 frames from
root-in-DOM to `tabindex` with zero variance across 5 runs — *fewer* than the
reference's own 4–5 — and 1 frame from `data-scrollbar` to `tabindex`, exactly
matching the reference.

The mechanism is worth stating because it is the reason to prefer the hook beyond
lint compliance. `useState` + `useEffect(() => setMounted(true), [])` schedules a
**second, passive** commit after hydration: React finishes the hydration commit,
runs effects, then re-renders. `useSyncExternalStore` with differing server and
client snapshots is resolved *as part of* the hydration pass, so
`data-scrollbar`, the `.scrollbar` element and the effect that measures all land
in one commit. Two commits became one, and the port stopped paying for the flag.

The 10–12 frames under `next dev` are hydration plus on-demand compilation, not
the port; the earlier `useEffect`-based prod figures (13.6–27.5 ms, 4–5 frames) are
superseded by the row above.

**What the region actually looks like during the window** — sampled every frame
(`probe-scrollarea-frames.mjs`, run 1, `next dev`, live instance, `maxScroll: 500`):

| frames | `role` | `aria-label` | overflow | `tabindex` | computed `scrollbar-width` | `.scrollbar` exists |
|---|---|---|---|---|---|---|
| 1 – 11 | `region` | `Members table` | 500 | `null` | `auto` | no |
| 12 | `region` | `Members table` | 500 | `null` | `none` | yes |
| 13 | `region` | `Members table` | 500 | `0` | `none` | yes |

Two things in that table matter more than the timings.

1. **The accessible region is never absent.** `role="region"` and the accessible
   name are server-rendered, so from frame 1 a screen reader announces the region
   correctly; only the *tab stop* is late. That is the cheap half of the contract
   arriving free and the expensive half arriving on schedule.
2. **The scroll affordance is never absent either.** Frames 1–11 have computed
   `scrollbar-width: auto` — the native bar is live, because the CSS suppresses it
   only under `[data-scrollbar="true"]`. The flip to `none` and the appearance of
   the custom bar happen in the *same* frame (12). There is no frame where the
   native bar is gone and no custom bar has been built.

The residual defect is the 1-frame gap at frames 12→13, where the native bar is
suppressed and the region is not yet focusable. **The reference has this too, and
by construction:** measured on its own dev server, `data-scrollbar` → `tabindex`
is exactly 1 frame in 5/5 runs, with the same "native bar hidden, custom bar
`hidden`, no tab stop" shape at the intermediate frame. So it is not a React
artefact at all — and after the `useSyncExternalStore` rewrite the port's gap is
1 frame too, identical to the reference. There is no longer any React-attributable
component to this window.

**No assertion is racing it.** The suite's `beforeEach` gates on
`[data-scrollbar="true"]`, which per the table above resolves 1–2 frames *before*
`tabindex` lands, so the gate is in principle insufficient. Probed with a raw
`page.evaluate` read immediately after the gate resolves — deliberately bypassing
Playwright's auto-retry — over 12 runs (`probe-scrollarea-race.mjs`):

```
raw (non-retrying) assertion would have FAILED in 0/12 runs
```

The CDP round-trip after the gate is far longer than two frames, and
`toHaveAttribute` auto-retries on top of that. So the window is real, measurable,
and not a test-stability hazard. Reporting it rather than papering over it, as
asked.

**Decision:** accept the window. Both alternatives were worse:

- Render `tabIndex={0}` on the server. That breaks the contract the other way — a
  ScrollArea whose content fits becomes a dead tab stop, which the `.md`'s manual
  checklist explicitly forbids ("When the content fits, the region is not a tab
  stop"). Measured proof that this is not hypothetical: at a 1400px viewport the
  live instance correctly reports `tabindex: null` / `barHidden: true`
  (`probe-scrollarea-states.mjs`). A wrong attribute for 5 frames is worse than a
  missing one, because it is also wrong at 1400px forever.
- `useLayoutEffect`. Moves the measure before paint on a client render, but
  Next.js warns on it during SSR and it cannot help the hydration path at all —
  the server still has no layout.

The honest framing: **the port cannot be more correct than the measurement, and
the measurement cannot precede paint.** Progressive enhancement is what covers
the gap, and the frame table shows it covering it. Confirmed from the SSR HTML —
the live root serialises as `<div class="ScrollArea" data-component="ScrollArea"
data-id="scrollarea-live">` with no `data-scrollbar`, no `tabindex`, no
`.scrollbar` — which is exactly the no-JS end state the `.md` specifies.

**Open question:** should the suite assert the *pre-enhancement* state? It waits
on `[data-scrollbar="true"]` and so can never observe a port that gets the no-JS
baseline wrong — one shipping `tabindex="0"` from the server, or suppressing the
native bar unconditionally, passes identically. One test with
`javaScriptEnabled: false` asserting "no `data-scrollbar`, no `tabindex`,
`scrollbar-width` not `none`" would cover the progressive-enhancement half of the
contract, which is currently documented but untested. It is also the only test
that would catch the 1–2 frame sub-window regressing into something longer.

---

### F-NEW · The natural translation of `attach()` is a lint *error* under React 19 — and two independent ports reached it by the same reasoning

**Surface:** `ScrollArea.tsx`, `MotionRegion.tsx`, `npm run lint`
(`react-hooks/set-state-in-effect`).

The reference's enhancement model is one imperative statement in a constructor:

```ts
root.setAttribute('data-scrollbar', 'true')   // "my JS has run"
```

Translated to React by anyone reasoning from first principles, that becomes a flag
you flip once the component is alive:

```tsx
const [mounted, setMounted] = useState(false);
useEffect(() => setMounted(true), []);
```

It is the single most-documented React idiom for "am I on the client yet", it is
what a decade of SSR blog posts teach, and under React 19's compiler-aligned lint
rules it is a **hard error**, not a style warning:

```
web/src/components/ScrollArea/ScrollArea.tsx
  194:19  error  react-hooks/set-state-in-effect
> 194 |   useEffect(() => setMounted(true), []);
```

**Two ports hit it on the same line of reasoning, independently.** MotionRegion
needed the same gate for the same structural reason (its signals are `matchMedia`
and `navigator.connection`, unreadable on the server) and landed on the same
`useState` + `useEffect` shape before the rule rejected it. That is the finding:
this is not one author's habit, it is where the reference's architecture *points*.
Any component in the library whose JS establishes "I have initialized" — which is
every component that emits `data-initialized` (F-010), `data-scrollbar`, or
`data-motion` — funnels a React porter into exactly the pattern React now forbids.

The fix is `useSyncExternalStore` with a no-op `subscribe` and asymmetric
snapshots:

```tsx
const noopSubscribe = () => () => {};
const getHydrated = () => true;         // client
const getHydratedServer = () => false;  // server

const hydrated = useSyncExternalStore(noopSubscribe, getHydrated, getHydratedServer);
```

**Decision:** adopt it, and treat it as the project's standard shape for the
library's initialization gates rather than a local workaround — there is now
precedent in two components (`MotionRegion.tsx` uses the identically-named
`noopSubscribe` / `getHydrated` / `getHydratedServer` triple).

Three reasons it is better than a lint escape hatch, in increasing order of
importance:

1. It is **more honest about SSR**. The third argument is literally "what the
   server knows", and for a component whose whole job is measuring layout the
   answer is *nothing*. The flag stops being a lifecycle detail and becomes a
   statement about the rendering boundary.
2. It is **faster** — one commit instead of two, which measurably removed a frame
   from the enhancement window (previous entry). A lint-driven refactor that
   improves the metric it was not aiming at is worth recording.
3. The DOM is **unchanged**. Re-verified after the rewrite: SSR HTML for the live
   root still serialises as `<div class="ScrollArea" data-component="ScrollArea"
   data-id="scrollarea-live">` — no `data-scrollbar`, no `tabindex` anywhere on
   the page, no `class="scrollbar"` — and the suite is 3/3 against both `/` and
   `/kitchen-sink/scrollarea`.

**Cost, stated plainly:** the fix is not discoverable. `useSyncExternalStore` is
documented as an interop hook for external state libraries; nothing in its docs
suggests "use this to know whether you have hydrated", and its third parameter is
the least-known part of the least-known hook in the API. A porter following the
reference's architecture reaches a lint error whose message
(`set-state-in-effect`) does not name the remedy. This is the sharpest
React-specific porting friction found so far — sharper than F-011, because F-011
was one unsatisfiable assertion whereas this is a pattern the whole library
invites.

**Note for the remaining ports:** `hasOverflow` is *not* affected and stays
`useState`. The rule targets `setState` called synchronously in an effect body;
`setHasOverflow` is called from `measure()`, which only ever runs inside a
`requestAnimationFrame` callback or a `ResizeObserver`/`MutationObserver`
callback. Lint is clean with it exactly as written.

---

### F-NEW · The scrollbar's colours are hard-coded oklch literals — the `--ui-*` seam cannot reach them, and the focus ring's compliance is now an accident of appearance

**Surface:** `ScrollArea.css` lines 30–31, `.viewport:focus-visible`.
**Measured in both appearances** against the `light-dark()` palette.

The reference stylesheet declares:

```css
--_sb-track: oklch(0.92 0.015 257.46);
--_sb-thumb: oklch(0.75 0.03 257.46);
```

These are **literal values, not `--ui-*` tokens** — the only component surface
found so far that bypasses the theming seam ADR-0018 calls "the ONE surface
components read design from". A consumer who answers every `--ui-*` token
exhaustively (F-002) still gets a cool blue-grey scrollbar in a warm-cream design
system, with no seam to change it through.

That is a taste problem. The accessibility problem is that `--_sb-thumb` is also
the **focus indicator** for the scroll region:

```css
.ScrollArea .viewport:focus-visible {
  outline: 2px solid var(--_sb-thumb);
  outline-offset: -2px;
}
```

Measured in-browser with the region actually focused (canvas-resolved sRGB, WCAG
2.x relative-luminance formula — `probe-scrollarea-contrast2.mjs`). The two
`--_sb-*` values are byte-identical in both appearances, as expected for literals;
the **surfaces** move underneath them:

| Pair | Light | | Dark | | Required |
|---|---|---|---|---|---|
| `--_sb-thumb` vs card | `#a2afc1` / `#ffffff` | **2.22** ✗ | `#a2afc1` / `#232320` | **7.08** ✓ | 3:1 (1.4.11 focus indicator) |
| `--_sb-thumb` vs page canvas | `#a2afc1` / `#f7f7f4` | **2.07** ✗ | `#a2afc1` / `#1a1a17` | **7.84** ✓ | 3:1 |
| `--_sb-thumb` vs `--_sb-track` | `#a2afc1` / `#dee5ef` | **1.75** ✗ | `#a2afc1` / `#dee5ef` | **1.75** ✗ | 3:1 (1.4.11 component part) |
| `--_sb-track` vs card | `#dee5ef` / `#ffffff` | 1.27 | `#dee5ef` / `#232320` | 12.43 | — (decorative) |
| `--ui-border` vs card (for comparison) | `#807d72` / `#ffffff` | 4.12 ✓ | `#918e84` / `#232320` | 4.81 ✓ | 3:1 |

**The orchestrator's prediction was the right worry aimed at the wrong axis, and
the real answer is more interesting.** `#a2afc1` is a *light* grey-blue, so on the
warm near-black ground it does not get worse — it jumps to **7.08:1** and passes
1.4.11 comfortably. The focus ring is non-compliant in **light** and compliant in
**dark**, and neither outcome was chosen: both are accidents of a literal sitting
still while the palette moves under it. That is a worse property than being
uniformly wrong, because it means the defect cannot be caught by testing one
appearance — and the appearance in which it fails is the default one.

The invariant row is the one that never passes: **`--_sb-thumb` vs `--_sb-track`
is 1.75:1 in both appearances**, because both operands are literals. Under 1.4.11
that is the thumb-against-track boundary of an interactive-looking component part,
and it fails everywhere, permanently, by construction.

So the component `.md`'s promise — *"sighted keyboard users see a strong
`:focus-visible` ring"*, and a manual checklist item asking the tester to confirm
"its focus is strongly visible" — holds in exactly one of the two appearances the
library ships support for.

**Probe pitfall worth recording, because it nearly produced a wrong finding:**
`getComputedStyle(el).outlineColor` on an element that is *not currently focused*
returns the initial `outline-color: currentColor`, i.e. the text colour — which in
this project is `--color-body` (`#5a5852` light / `#b9b7af` dark) and looks like a
perfectly compliant focus ring. The first dark-mode run reported exactly that and
implied the reference's ring had been overridden by a project style. Confirmed
otherwise via CDP `CSS.getMatchedStylesForNode` with `forcePseudoState:
['focus-visible']` (`probe-scrollarea-ring.mjs`): the **only** matched rule
carrying `outline` is `.ScrollArea .viewport:focus-visible` (specificity 0-3-0),
and with the region genuinely focused the computed `outline-color` is
`lab(70.9069 -1.72895 -10.9757)` = `#a2afc1`. Measure focus ring contrast on a
focused element or not at all.

**The suite is green anyway, and that is the point.** axe does not evaluate
focus-indicator contrast — no rule computes an `outline` colour against its
surroundings, because axe cannot know which element will be focused. The stated
exit criterion (zero axe WCAG 2 AA violations) therefore structurally cannot see
this, and a port that trusts the criterion ships a sub-3:1 focus ring. This is
F-003's shape repeating one layer down.

**Aesthetically, dark mode is where the literals become impossible to miss.**
`--_sb-track` `#dee5ef` measures **12.43:1** against the dark card — a near-white
bar sitting on a warm near-black surface, in a design system whose every other
colour flipped. It is compliant and it is glaring. The contrast numbers say the
focus ring is fine in dark; the screenshot says the whole scrollbar is a foreign
object. Both are consequences of the same missing seam.

**Decision (Phase A):** change nothing. The CSS is verbatim by rule, and the
defect is upstream, not in the port — recording it with the measurement is the
deliverable.

**Decision (Phase B, proposed):** replace the two literals with the seam plus a
literal fallback — `--_sb-thumb: var(--ui-border, oklch(0.75 0.03 257.46))`.
Measured, `--ui-border` now resolves to `#807d72` light / `#918e84` dark and
clears 3:1 on every surface in both appearances (**4.12** / **3.84** light,
**4.81** / **5.32** dark). One line, it fixes the light-mode focus-ring failure,
it makes the pass in dark deliberate instead of accidental, and it follows the
appearance flip for free. Still the only Phase B change this component needs for
accessibility rather than taste.

**Report, not edit:** this needs **no new `--ui-*` role**. `--ui-border` already
carries exactly the "interactive boundary at a 3:1 floor" meaning F-003 assigned
it, so `web/src/styles/ui-tokens.css` is untouched and needs no addition.

**Upstream suggestion:** `--_sb-track` / `--_sb-thumb` should read through
`--ui-*` like every other design value in the library, and the focus ring should
not reuse the thumb colour at all — a focus indicator has a 3:1 obligation that a
scrollbar-thumb fill does not, so sharing one token guarantees that tuning either
breaks the other. The `.md`'s "strong ring" claim should be backed by a measured
floor.

---

### F-NEW · `--_sc-fade-color: Canvas` is exact on a light card and wrong everywhere else — a system colour follows the appearance flip, but to the *UA's* surface, not yours

**Surface:** `ScrollArea.css` → `--_sc-fade-color`; `web/src/styles/design-tokens.css`.
**Measured in both appearances.** This entry corrects the light-only version of it
that I filed first — the correction is the finding.

The fades are opaque colour gradients, and the `.md` is blunt about the coupling:
the colour **must match the surface behind the ScrollArea**. The CSS defaults it to
the `Canvas` system colour. Measured — the fade's opaque gradient stop against the
two surfaces it can actually sit on (`probe-scrollarea-fade.mjs`):

| appearance | `Canvas` resolves to | our card | ratio | our page | ratio |
|---|---|---|---|---|---|
| light | `#ffffff` | `#ffffff` | **1.000** | `#f7f7f4` | 1.073 |
| dark | `#121212` | `#232320` | **1.189** | `#1a1a17` | 1.074 |

**In light, `Canvas` is byte-for-byte `--color-surface-card`.** Inside a `<Block>`
the fades are invisible at rest and tone out content mid-scroll exactly as
designed, with zero configuration — a genuine 1.000 match, and a pleasant accident
of two independent decisions lining up.

**In dark it stops matching anything.** `Canvas` under `color-scheme: dark`
resolves to the **user agent's** dark surface, `#121212` — not our card `#232320`,
not our page `#1a1a17`. The fade is now a slightly-too-dark smudge at each edge
(1.189:1 against the card it sits on). It follows the appearance flip, which is
real and valuable, but it follows it to Chromium's idea of a dark canvas rather
than to the design system's.

**This is the correction, and it changes the lesson.** I first filed this as "the
one colour in the component that survives dark mode for free", contrasted against
the `--_sb-*` literals that cannot. Measured, that is only half right. A system
colour is *appearance-aware* but it is not *design-system-aware*: it tracks the
appearance and then lands on a surface the design system never chose. `Canvas` is
strictly better than `white` — the reference's CSS comment argues for it at length
and that argument holds, since `white` would have been a 21:1 catastrophe on dark
— but "better than a fixed colour" is not "correct". The only value that is
actually correct in both appearances is the design system's own
`light-dark()` token, reached through the documented custom property. Three tiers,
visible in one 129-line stylesheet:

| approach | tracks appearance | matches *your* surface |
|---|---|---|
| `white` (the `.md`'s documented default) | ✗ | ✗ |
| `Canvas` (what the CSS actually ships) | ✓ | ✗ |
| `var(--color-surface-card)` (authored) | ✓ | ✓ |

**Decision:** keep the verbatim CSS in Phase A and keep every kitchensink instance
on a card surface, which is where the design system's data tables live anyway —
documented in a header comment in `ScrollArea.kitchensink.tsx`. In Phase B author
`--_sc-fade-color: var(--color-surface-card)` on the instance. That is authoring
through the documented public API, not patching the component, and it is the only
form that is right in both appearances.

**Documentation defect (minor):** `ScrollArea.md`'s custom-property table gives
the default as `white`; the CSS ships `Canvas` and its comment explains at length
why `white` was rejected. The table was never updated. Reading only the `.md`, a
porter concludes the fade is light-mode-hostile when the CSS already improved on
that. The `.md` should document `Canvas` *and* say that a consumer with its own
surface tokens must still override it.

**Open question, now with a measurement behind it:** the `.md` lists `mask-image`
fades as an enhancement "left out only because the colour fade needs no feature
detection". `mask-image` has been baseline in every engine for years, and it would
delete this entire class of bug — fading to *transparent* has no surface coupling,
so there is nothing to match, nothing to re-measure per appearance, and no third
tier in the table above. Given that the dark-mode number is a real mismatch rather
than a hypothetical one, is the colour fade still the right baseline, or should the
reference adopt masking and drop `--_sc-fade-color` entirely?

---

### F-NEW · The reference's "one source of truth" model forces a deliberate split between React state and imperative DOM writes

**Surface:** `ScrollArea.tsx`.

`ScrollArea.ts`'s header states the model: *"`viewport.scrollLeft` is the truth;
the thumb is a pure PROJECTION of (metrics, scrollLeft)"*. Ported naively — every
projected value in `useState` — that becomes a full re-render of a wide table on
every scroll frame and every `pointermove` of a thumb drag, for values the
contract itself declines to call state.

The port splits them on that line, and the split is principled rather than a
performance hedge:

| Value | Home | Why |
|---|---|---|
| `hydrated` | `useSyncExternalStore` | Not state at all — a fact about the host, with a *server* snapshot of `false`. Gates `data-scrollbar` and the bar's existence. See the lint entry above. |
| `hasOverflow` | React state | Changes at most once per resize breakpoint; drives one declarative attribute (`tabIndex`). |
| thumb `inline-size` / `transform` | imperative, via ref | 60 fps projection, not state. |
| `.scrollbar[data-visible]` | imperative, via ref | Driven by a 900 ms `setTimeout` and pointer enter/leave. |
| `.scrollbar[hidden]` | imperative, via ref | See below — it *cannot* be a prop. |

`hidden` is the load-bearing case and it is a genuine React constraint, not a
preference. The reference's `#measure()` does:

```ts
this.#bar.hidden = !hasOverflow                              // put the bar in layout
const trackWidth = hasOverflow ? this.#bar.clientWidth : 0   // then read its width
```

with the comment *"The bar must be in layout BEFORE we read its width, else a
hidden bar reports clientWidth 0 and the thumb would render at width 0 on first
show."* That is a **write-then-read-layout in the same synchronous block**. If
`hidden` were a React prop the write becomes a `setState`, the DOM does not catch
up until the next commit, and the read in the same tick still sees `clientWidth:
0` — the thumb renders at width 0 and needs a second measure pass. React's
rendering model has no way to express "mutate this attribute and read layout back
immediately"; `flushSync` inside a `ResizeObserver` callback would, at the cost of
a synchronous re-render of the table on every resize tick.

**Decision:** `hidden`, `data-visible` and the thumb geometry are written through
refs; `hasOverflow` stays React state and `hydrated` comes from
`useSyncExternalStore`. React never reconciles
`hidden` back, because the JSX prop is the constant `hidden` and React only
touches a DOM property when its prop value *changes* — verified across the
`hasOverflow` re-render (`probe-scrollarea-states.mjs`: at 1400px the live
instance reports `barHidden: true`, at 480px `false`, with no attribute fighting).

Behaviour was verified end to end rather than assumed
(`probe-scrollarea-pointer.mjs`, 480px, live instance with `maxScroll: 500`,
`trackWidth: 398`, `thumbWidth: 184`):

| Interaction | Expected | Measured |
|---|---|---|
| drag thumb +120px | `120 / (398−184) × 500 = 280.4` | `scrollLeft: 280`, `transform: translateX(120px)` |
| click track at far right from 0 | `clientWidth × 0.9` | `scrollLeft: 387` |
| scroll, mouse away, wait 1.1 s | `data-visible` removed after 900 ms | `"true"` → `null` |
| ArrowRight ×3 from 0 (region focused) | native horizontal scroll | `37 → 76 → 117` |

**Positive finding:** the pure functions (`resolveMaxScroll`, `projectThumb`,
`resolveNextState`) and the four-state machine ported **verbatim** — same
signatures, same `Object.freeze`d tables, byte-for-byte the same arithmetic — and
the measured drag geometry matches the closed-form projection exactly. Isolating
the maths from the DOM, which the reference did for its own unit tests, is what
made the port mechanical: the only thing that had to be redesigned was *where the
side effects live*, and that is a 40-line effect. This is the strongest argument
in the library for the "pure functions + thin imperative shell" shape.

---

### F-NEW · The suite's three tests cover a fraction of the contract, and what it covers it covers well

**Surface:** `ScrollArea.e2e.test.js` (48 lines, 3 tests).

A scoping observation, not a complaint. The suite asserts exactly the
`scrolling-container.md` a11y contract — named focusable `role="region"` on
overflow, native arrow-key scrolling, zero axe violations — and all three passed
on the first run with no iteration. It is the leanest suite in the set and the
first one where nothing had to be worked around: no non-portable assertion (cf.
F-011), no demo-page class dependency (cf. F-014, since the audit is scoped to the
component root via `scopedCheckA11y(page, SA)` rather than to
`.kitchensink-section:has(…)`), and no `anchorId` needed.

What it does **not** cover, all of which the `.md` specifies and this port
implements:

- the DISABLED state (content fits → no `tabindex`, bar `hidden`). The suite forces
  a 480px viewport so the target always overflows and never observes it. Covered
  here by `data-id="scrollarea-fits"`, plus the live instance at 1400px where it
  flips to `barHidden: true` / `tabindex: null` (`probe-scrollarea-states.mjs`).
- the accessible-name gap-fill (`aria-label` absent → `"Scrollable content"`).
  Covered by `data-id="scrollarea-gapfill"`; measured `label: "Scrollable content"`.
- thumb drag, track paging, the 900 ms auto-hide — all pointer-only, all measured
  above, none asserted.
- the no-JS baseline (see the first entry's open question).
- `aria-hidden="true"` on the generated bar, which is what keeps it from becoming a
  second tab stop. Measured present on all four instances; asserted nowhere.
- the focus-ring contrast the `.md` promises (second entry — 2.22:1, and axe
  cannot see it).

**Layout note for whoever touches the aggregate page:** `.ScrollArea` sets
`margin-inline: calc(var(--_sc-offset) * -1)` and deliberately breaks out of its
container, so each instance wants a full-width `min-w-0` wrapper rather than being
a flex-row sibling inside `<Block>`. `ScrollArea.kitchensink.tsx` already does
that, and it is now confirmed on the live aggregate rather than inferred
(`probe-scrollarea-aggregate.mjs`, 480px): all four instances present
(`scrollarea-live` / `-fits` / `-gapfill` / `-clip-demo`), the live root wrapped in
`w-full min-w-0`, `.kitchensink-section:has([data-id="scrollarea-live"])` resolving,
the root at `x: 25` inside a Block at `x: 16` — i.e. the −16px break-out is absorbed
by the Block's padding and does not escape it — and `tabindex="0"` on the region.
The suite is 3/3 against `TARGET_PATH=/` as well as the isolated route.

---

### F-NEW · `Home`/`End` do not scroll a horizontal-only region, contradicting the `.md`

**Surface:** `ScrollArea.md` → *Accessibility → Keyboard*; measured in Chromium.

The `.md` says: *"the browser scrolls it natively with the arrow keys (and
PageUp/PageDown, Home/End). No custom key handling."* Measured on the focused live
region (`probe-scrollarea-kb.mjs`), starting from `scrollLeft: 117` with
`maxScroll: 500`:

```
End  -> scrollLeft 120   (expected 500)
Home -> scrollLeft 120   (expected 0)
```

`Home`/`End` act on the **block** axis of a scroll container, and this component is
`overflow-y: hidden` by design (vertical scrolling is a documented non-goal). So
they do essentially nothing here. Arrow keys are the real horizontal affordance
and they work: `37 → 76 → 117` on three presses.

This is **not a port defect** — the port adds no key handling at all, exactly as
the contract requires, so the reference behaves identically. It is a documentation
overclaim, and it matters because that sentence is the component's *justification*
for having no custom key handling ("native scrolling is correct across engines,
Safari included"). A reviewer checking the claim against `Home`/`End` would
conclude the keyboard support is broken when the arrow keys are in fact fine.

**Decision:** no code change; the "no custom key handling" rule is correct and
worth keeping. Report the doc line.

**Upstream suggestion:** drop `Home/End` from that sentence, or state that they are
block-axis keys and therefore inert in a horizontal-only scroller.
