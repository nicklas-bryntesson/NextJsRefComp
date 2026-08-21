# Notice — findings

Phase A port of `reference-components/src/partials/components/Notice`.
Result: **7 passed / 0 failed** (`Notice.e2e.test.js`), `next build` clean, submodule clean.

```
BASE_URL=http://localhost:3000 npx playwright test src/partials/components/Notice/tests/Notice.e2e.test.js
  7 passed (2.1s)   ·   No accessibility violations detected!
```

Every colour figure below was **measured in light mode** (`color-scheme: light`
pinned per F-002). The dark half of the design system landed after this port; the
`--ui-*` accents and the `CanvasText`/`Canvas` system colours in `Notice.css` will
resolve differently under a dark palette and every ratio here needs re-measuring
then. The DOM and the assertions are unaffected.

---

### F-NEW · Notice's e2e suite predates the `TARGET_PATH` seam and is hard-wired to `/` + `#Notice`

**Surface:** `reference-components/src/partials/components/Notice/tests/Notice.e2e.test.js`
vs. the documented run command in `CLAUDE.md`.

**Evidence.** Every other suite we have ported goes through the env seam:

```js
// AffixField.e2e.test.js
import { targetPath, targetId, scopedCheckA11y } from '../../../../e2e-helpers/target.js'
await page.goto(targetPath())
```

Notice does not. It has no import of `e2e-helpers/target.js` — the directory
`src/partials/components/Notice/tests/` contains only the spec — and every test
body starts from a hardcoded root and a hardcoded section id:

```js
test.beforeEach(async ({ page }) => { await page.goto('/') })
const notice = page.locator('#Notice .Notice').first()
const region = page.locator('#Notice .notice-region[data-id="region"]')
```

`TARGET_PATH` and `TARGET_ID` are therefore dead env vars for this component.
Playwright resolves `goto('/')` as `new URL('/', baseURL)`, so an absolute path
wins over any path component in `BASE_URL` — `BASE_URL=http://localhost:3000/kitchen-sink/notice`
still navigates to `http://localhost:3000/`.

Run with the documented command, all seven tests fail:

```
BASE_URL=http://localhost:3000 TARGET_PATH=/kitchen-sink/notice npx playwright test --grep Notice
  7 failed
  Error: locator.scrollIntoViewIfNeeded: Test timeout of 10000ms exceeded.
   > 12 |   await notice.scrollIntoViewIfNeeded()
```

— it is looking at the Next.js starter page, which has no `#Notice`.

Two consequences for the port:

1. **`id="Notice"` is test contract.** It comes from the reference *demo page*
   (`<section class="kitchensink-section" id="Notice">`), not from any contract in
   `Notice.md`. `<Section>` in `kitchensink-ui.tsx` spends its `id` prop on the
   heading (`id={`${id}-heading`}`) and puts nothing on the `<section>`, so the
   anchor has to be supplied by the component's own kitchensink. This is the same
   class of problem as F-014, one level up: F-014 was a demo-page *class name*,
   this is a demo-page *element id*.
2. **The isolated route cannot be addressed at all.** No env var reaches this
   spec, so the only way to satisfy it is for `/` itself to serve markup
   containing `#Notice` — i.e. the fix has to be global, at
   `web/src/app/page.tsx`, not per-component.

**Decision (revised — the orchestrator fixed this at the source while the port
was in flight).** Nine specs share the `goto('/')` shape, so the fix belongs on
our side of the seam, not in nine per-component workarounds: `/` now serves
`AggregateKitchensink`, and `<Section>` gained an optional `anchorId` that puts
the reference demo section's id on the `<section>` element. Notice's kitchensink
passes `anchorId="Notice"`.

```
BASE_URL=http://localhost:3000 npx playwright test src/partials/components/Notice/tests/Notice.e2e.test.js
  7 passed (2.1s)
```

Two things are worth recording because they were tried and are now dead ends:

- I first solved it with a `node:http` proxy mapping `/` → `/kitchen-sink/notice`
  (it worked — 7 passed — and it has been deleted). **Do not build one.** Two
  agents independently reached for a proxy before the aggregate route existed,
  which is a decent signal that the failure mode reads as "my route is
  unaddressable" rather than "the spec ignores the env var".
- Before `anchorId` existed the only way to supply `#Notice` was a wrapper
  `<div id="Notice">` inside the component's own kitchensink. That works but it
  moves the axe scope: the wrapper sits *outside* `.kitchensink-section`, so
  `checkA11y(page, '#Notice')` then audits a different subtree than the reference
  did. With `anchorId` the id lands on the `.kitchensink-section` element itself,
  which is exactly the reference's `<section class="kitchensink-section"
  id="Notice">`. Use `anchorId`.

The isolated `/kitchen-sink/notice` route is kept — it still builds and is the
right target the moment the spec adopts `targetPath()`.

**Open question for the project owner.** Upstream, Notice's spec should adopt
`e2e-helpers/target.js` like the rest of the family (`targetPath()` +
`targetId('Notice')`). Until it does, `TARGET_PATH` is a silently inert env var
for nine components, and the failure signature is a misleading
`scrollIntoViewIfNeeded` timeout with no hint that the seam was ignored. Worth a
line in `PORTING.md` listing which suites are on the old style.

---

### F-NEW · Notice's axe run is section-scoped, so the *shared kitchensink chrome* fails the component's exit criteria

**Surface:** `checkA11y(page, '#Notice')` in `Notice.e2e.test.js` vs.
`web/src/components/kitchensink-ui.tsx` (`Block`, `Cell`).

**Evidence.** AffixField's suite uses `scopedCheckA11y`, which narrows the audit
to the component root. Notice's older spec audits the **whole section**:

```js
await page.locator('#Notice').scrollIntoViewIfNeeded()
await injectAxe(page)
await checkA11y(page, '#Notice')
```

The first run failed with **one violation, 20 nodes** — and every one of the 20
was in our shared demo chrome, none inside `.Notice`. Probe
(`web/tasks/probes/notice-axe.mjs`, axe-core 4.x, `wcag2a`+`wcag2aa`) named them:

| node | measured | required |
|---|---|---|
| `<Block>` → `h3.text-caption-uppercase.text-muted` (5×) | **3.84:1** — `#807d72` on `#f7f7f4`, 11px normal | 4.5:1 |
| `<Cell>` → `span.text-caption.text-muted-soft` (15×) | **2.73:1** — `#a09c92` on `#ffffff`, 13px normal | 4.5:1 |

Both are genuine WCAG 1.4.3 failures, not scoping artefacts, and
`design-tokens.css` says so itself:

```css
--color-muted: #807d72;        /* sub-titles; also our AA-safe control border */
--color-muted-soft: #a09c92;   /* disabled text only (2.74:1 — WCAG 1.4.3 inactive exception) */
```

`--color-muted-soft` is being used for a **state caption**, which is live,
meaningful label text — not disabled text, so the 1.4.3 inactive-control
exception does not apply. `--color-muted` is documented as a border colour and is
being used as 11px body text, where 3.84:1 is short of AA. This is F-004's
problem recurring on a different surface: the design's mid-greys survive as
borders and fail as small text.

`--color-body` (`#5a5852`) measures **6.63:1** on `--color-canvas` and **7.11:1**
on white — it clears AA on both backgrounds at any size.

**Decision (fixed upstream, in the shared chrome).** I first worked around it
locally with two arbitrary-variant overrides on the `#Notice` wrapper
(`[&_h3]:text-[var(--color-body)]` etc.) because `kitchensink-ui.tsx` was on the
do-not-edit list. The orchestrator has since moved the fix to the right place:
`Block`'s `h3` and `Cell`'s caption are both `text-body` now, and my local
overrides are removed. Re-probed after the change: **zero violations**, suite
7/7.

The finding stands on its own regardless of who fixed it, and the reason is the
part worth keeping: **`kitchensink-ui.tsx` was only passing axe because every
other suite scopes its audit to the component root.** AffixField uses
`scopedCheckA11y`; Notice is the first suite in the set that looks at the page
furniture, and the furniture was not AA. Any future section-scoped suite would
have hit the same 20 nodes. A component-scoped audit is not evidence that the
page is accessible.

Secondary note now that `/` serves all components: Notice's axe call is
`checkA11y(page, '#Notice')`, and with `anchorId` that id resolves to Notice's
own `.kitchensink-section`. So the run stays scoped to Notice and does **not**
pick up the other five components' markup, despite sharing the page.

---

### F-NEW · Notice is the purest zero-JS port in the set — there is no reference implementation to port

**Surface:** `reference-components/src/partials/components/Notice/`.

**Evidence.** The component directory contains `Notice.css`, `Notice.html`,
`Notice.md`, `tests/` — and **no `Notice.ts`/`Notice.js` at all**. `Notice.md`
opens with "No JavaScript." There is no `attach()`, no init gate, no
`data-initialized` attribute, no `## Kernel dependencies` section, and nothing in
`Notice.css` referencing an initialisation state (`grep -n data-initialized
Notice.css` → no match), so the F-010 init-gate drop does not apply here: the
verbatim copy needed **zero** edits and `diff` is byte-identical.

The port is a Server Component with no `'use client'`. `next build` confirms it:

```
Route (app)
└ ○ /kitchen-sink/notice        ○ (Static) prerendered as static content
```

**Decision.** Ship it as a Server Component. Where F-015 recorded React matching
the contract's stated ideal for AffixField (JS that only computes attributes),
Notice is the degenerate and best case: a component whose entire behaviour is
three boolean attributes on one root. React adds exactly one thing over the
reference — the props/type layer that makes the `data-*` API non-stringly-typed
(`variant?: NoticeVariant`, `border?: boolean`) — and subtracts nothing.

The one place React's model *helps* is the part `Notice.md` has to hand-roll. The
reference documents the announcer dance imperatively:

```js
function announce(region, noticeEl) {
  region.replaceChildren()
  requestAnimationFrame(() => region.append(noticeEl))
}
```

In React that whole helper is "render `<NoticeRegion>` unconditionally, put the
Notice in state, and give it a `key`" — keyed reconciliation performs the
clear-then-set mutation, and the region's persistence is structural rather than a
discipline the caller has to remember. I exported `NoticeRegion` alongside
`Notice` for exactly this reason, with a `politeness` prop that encodes the
contract's severity→role mapping (`error`/`warning` → `alert`/`assertive`,
`success`/`info`/`neutral` → `status`/`polite`) so a caller cannot pair an error
with a polite region by accident.

---

### F-NEW · `data-icon` is the one boolean in the library whose API value is the string `"false"`

**Surface:** `Notice.md` "HTML Authoring API", `Notice.css`, and the playbook's
"Booleans are `="true"` or absent" rule.

**Evidence.** `data-border` and `data-emphasis` follow the house rule — the CSS
gates on `[data-border="true"]` and there is no `[data-border="false"]` rule, so
absent is off. `data-icon` is inverted:

```css
.Notice[data-icon="false"] { grid-template-columns: 1fr; }
.Notice[data-icon="false"] .icon { display: none; }
```

Its documented value column is literally `"false"`, and *absent* means the icon
is **shown**. So the React mapping is not the usual
`data-x={cond ? "true" : undefined}` but its mirror:

```tsx
data-icon={icon ? undefined : "false"}
data-border={border ? "true" : undefined}
data-emphasis={emphasis ? "true" : undefined}
```

Getting this backwards is silent: `data-icon="true"` matches no rule, so the
icon renders and the two-column grid stays — the component *looks* correct and
only the `data-icon="false"` test fails, on `gridTemplateColumns`.

**Decision.** Keep the reference's asymmetry rather than "fixing" it to
`data-no-icon`, because the attribute name is the public API and the CSS selector
is verbatim. Encode the inversion once, in the component, behind a normal
`icon?: boolean` prop defaulting to `true`, so no caller ever writes the string.

**Note for the porter:** the suite calls `.evaluate()` on an *unfiltered*
locator, `page.locator('#Notice .Notice[data-icon="false"]')`, with no
`.first()`. A kitchensink with two icon-less Notices fails Playwright strict
mode, not the assertion. Same for `.notice-region[data-id="region"]` — the
kitchensink has a second, polite region, and it is anchored `data-id="region-polite"`
precisely so the exact-match attribute selector still resolves to one node.

---

### F-NEW · The `50rem` measure calibration survives the typeface substitution (72.1 ch vs. the documented ~75)

**Surface:** `Notice.md` "The width cap is the component, not the text" —
"Measured at the cap: the text line reaches roughly **75 characters**".

**Evidence.** Probe `web/tasks/probes/notice-measure.mjs` forces the long-content
Notice to its documented cap and divides the paragraph's laid-out width by the
advance of `0` in the resolved font (the `ch` unit, which is the convention the
`.md` is using):

```
{ noticeW: 800, textW: 728,
  font: '16px Inter, "Inter Fallback", system-ui, ...',
  chars_ch: 72.1, chars_lc: 85 }
```

800px = 50rem, minus 2×16px padding, minus the 24px icon and the 16px gap, gives
the 728px text column. At Inter's `0` advance that is **72.1 characters** —
inside the 80-character WCAG 1.4.8 (AAA) ceiling, and slightly *better* than the
~75 the reference measured in its own stack.

**Decision.** No change. This is the same result as F-013 in a different guise:
a `ch`-relative calibration in the reference held up under a typeface swap. Keep
`--_nt-max-inline-size: 50rem` and keep the `.md`'s warning that ~`54rem` is the
real ceiling.

**Caveat worth recording:** `chars_lc` above is the same width divided by the
*average lowercase advance* (85 characters). WCAG 1.4.8 says "characters" without
naming a metric, and for a proportional face the two readings straddle the limit.
The `.md`'s ~75 is only defensible under the `ch` reading. If someone later wants
AAA line length to be airtight rather than nominal, the cap has to come down to
roughly `46rem`, not `54rem`.

---

### F-NEW · Positive: the `--ui-*` bridge values clear WCAG 1.4.11 on Notice's derived tint without any tuning

**Surface:** `web/src/styles/ui-tokens.css` `--ui-destructive` / `--ui-warning` /
`--ui-success` / `--ui-info` against `--_nt-bg: color-mix(in srgb, var(--_nt-accent) 8%, Canvas)`.

**Evidence.** The Notice icon is `aria-hidden`, so axe never checks it — but
`Notice.md` makes it the *sole* non-colour carrier of severity ("never ship a
variant without its icon"), which puts it squarely under WCAG 1.4.11 non-text
contrast (3:1). Probe `web/tasks/probes/notice-icon-contrast.mjs` reads the
resolved `.icon` colour and the resolved root background (the browser hands back
`color(srgb …)` for a `color-mix()` result, so both formats need parsing) and
computes the ratio:

| variant | accent | icon on its tint | body text on its tint |
|---|---|---|---|
| error | `#cf2d56` | **4.48:1** | 18.64:1 |
| warning | `#9d6d29` | **4.09:1** | 19.05:1 |
| success | `#1e8662` | **4.09:1** | 18.99:1 |
| info | `#66788f` | **4.11:1** | 19.10:1 |
| neutral | `CanvasText` | **17.55:1** | 17.55:1 |

Every icon clears 3:1 with margin, and the four `--ui-*` values were chosen in
F-005 for AA text contrast on *white*, with no thought given to Notice.

**Decision.** No token change. The reason it works is worth naming: because the
tint is *derived from the accent* (`accent 8%, Canvas`) rather than being an
independent surface token, the background can only ever move ~8% of the way from
Canvas toward the accent. Any accent that passes 4.5:1 on Canvas therefore lands
near 4:1 on its own tint automatically. This is the strongest argument in the
library for the single-token-per-variant API in `Notice.md` ("Set **one** token
per variant — `--_nt-accent` — and the tint derives from it"): it makes the
contrast relationship structural instead of something a designer has to re-check
per variant.

---

### F-NEW · Notice bypasses the `--ui-*` seam for its text and surface, reading system colours directly

**Surface:** `Notice.css` public API block.

**Evidence.** Four of the five variants route their accent through the seam
(`var(--ui-destructive, #c0362c)` etc.), but the text and the base surface do
not:

```css
--_nt-bg: color-mix(in srgb, var(--_nt-accent) 8%, Canvas);
--_nt-text-color: CanvasText;
--_nt-title-color: currentColor;
.Notice[data-variant="neutral"], .Notice:not([data-variant]) { --_nt-accent: CanvasText; }
```

Measured on our page: Notice body text resolves to `rgb(0, 0, 0)`, not the design
system's `--color-ink` `#26251e`, and the tint is mixed against `Canvas`
(`#ffffff`) even though the page canvas is `--color-canvas` `#f7f7f4`. The
neutral variant's accent is pure black. So a Notice on our surface is the only
component in the port whose running text is not the design system's warm
near-black, and its tint is computed against a white it is not sitting on.

Nothing fails: black on the tint measures 17.5–19.1:1, and F-002 already pins
`color-scheme: light`, so the system colours resolve deterministically. It is a
consistency gap, not an accessibility one.

**Open question for the project owner.** This is a Phase B decision, flagged now
so it is not discovered as a surprise: does Notice's `--_nt-text-color` get
overridden to `var(--ui-text, …)` / `--color-ink` for visual consistency, or does
the reference's deliberate use of `CanvasText` (which is what makes the
forced-colors block at the bottom of `Notice.css` a no-op rather than a special
case) win? Overriding it costs the automatic forced-colors behaviour; leaving it
costs one component's worth of visual consistency. I did not touch it — Phase A
is verbatim — and `ui-tokens.css` has no `--ui-text` role today, which is itself
the missing seam here.
