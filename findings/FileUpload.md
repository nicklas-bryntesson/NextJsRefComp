# Findings — FileUpload (Phase A)

**Result: 21 / 21 conformance tests green**, including both axe audits ("No
accessibility violations detected!" — the scoped run and the full
`.kitchensink-section` run). Green on the **first** run, before any iteration. No
non-portable assertions; nothing was weakened to pass.

```
cd reference-components
BASE_URL=http://localhost:3000 TARGET_PATH=/kitchen-sink/fileupload \
  npx playwright test src/partials/components/FileUpload/tests/FileUpload.e2e.test.js \
  --reporter=line --output=../web/tasks/tr-FileUpload
#   21 passed (5.3s)
```

`web/src/components/FileUpload/FileUpload.css` is byte-identical to the
submodule copy (`diff` clean) and contained **no init-gate rules to drop** — the
`overflow: hidden` → `[data-initialized="true"]` pattern PORTING.md sanctions
removing never existed in this component (`grep data-initialized FileUpload.css`
is empty). The attribute is still emitted, because it is the test target.
`npm run build` and `npm run lint` are both clean. `git -C reference-components
status --short` prints nothing.

**Fixture:** nothing to copy. The spec resolves its PDF as
`path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'test.pdf')`
— relative to the *spec file*, i.e. inside the submodule at
`reference-components/src/partials/components/FileUpload/tests/fixtures/test.pdf`,
which already exists. `setInputFiles` reads it from the Playwright process's own
filesystem, never over HTTP, so no path under `web/` participates. The other
seven file selections in the spec build their buffers inline
(`Buffer.from('hello')`) and need no file at all.

Created:

- `web/src/components/FileUpload/FileUpload.css` — verbatim copy
- `web/src/components/FileUpload/FileUpload.tsx` — the port (`'use client'`)
- `web/src/components/FileUpload/FileUpload.kitchensink.tsx`
- `web/src/app/kitchen-sink/fileupload/page.tsx`
- `web/tasks/probes/fileupload-colours.cjs` (gitignored) — every colour the
  component paints, in both appearances, with and without the `--ui-*` seam

No `anchorId` is passed to `<Section>`: FileUpload's spec scopes its two axe runs
to `[data-component="FileUpload"][data-initialized="true"]` and to a bare
`.kitchensink-section`. Neither needs an `#FileUpload` id.

---

### F-NEW · ADR-0021's headline debt was already paid off — by the commit that recorded it

**Surface:** `docs/adr/0021`, `FileUpload.css`, submodule git history.

ADR-0021's *Risks to manage* says: "**FileUpload holds five genuinely hardcoded
colours** (not token fallbacks). It is the only component with real debt here."
That sentence is **stale as written**. The five colours were removed by commit
`13cdd98` — the same squashed PR (#39) that *added* ADR-0021. Its own commit body
says so: "FileUpload's five genuinely hardcoded colours (the only real component
debt) now derive from the seam."

The five, and where each went:

| Was (pre-`13cdd98`) | Is now | Tier |
|---|---|---|
| `--_fu-trigger-bg-hover: #f0f0f0` | `color-mix(in srgb, CanvasText 6%, Canvas)` | system colour |
| `--_fu-trigger-bg-active: #e0e0e0` | `color-mix(in srgb, CanvasText 12%, Canvas)` | system colour |
| `--_fu-error-color: #c00` | `var(--ui-destructive, #c00)` | seam + literal fallback |
| `--_fu-drop-zone-border-color: #0070f3` | `var(--ui-primary, #0070f3)` | seam + literal fallback |
| `--_fu-drop-zone-bg: #f0f7ff` | `color-mix(in srgb, var(--ui-primary, #0070f3) 8%, Canvas)` | seam + literal fallback |

(A sixth, `.item-size { color: #6e6e6e }`, became `var(--ui-muted-foreground,
#6e6e6e)` in the same commit. The ADR says "five"; the commit body separately
names the hint `#6e6e6e → #a1a1a1`, so the count depends on whether the hint is
included. Either way the file today holds **zero** unconditioned colour literals:
`grep -E '#[0-9a-fA-F]{3,8}'` returns four hits and all four sit inside a
`var(--ui-*, …)` fallback slot.)

**Decision:** record this as a documentation defect, not a code defect, and do
not "fix" anything in Phase A — there is nothing left to fix. The porting
consequence is real though: an agent or consumer who reads ADR-0021 and goes
hunting for five literals will either find nothing and doubt their tooling, or
mis-identify the four *fallbacks* as the debt and try to remove them, which would
delete the graceful-degradation path ADR-0021's *Costs* section deliberately
relies on.

**Upstream suggestion:** the ADR's *Risks to manage* section should be re-stated
in the past tense, or moved to *Consequences → Positive*, with a pointer to the
commit. An ADR that records a risk its own implementation retired reads as open
debt forever.

---

### F-NEW · `Canvas` is appearance-aware but not design-system-aware, and the trigger fill is where it shows

**Surface:** `--_fu-trigger-bg: Canvas`, measured on `/kitchen-sink/fileupload`.

This is the one **live** colour problem in the port, and it is the third tier
ScrollArea's port identified rather than a hardcoded literal. Measured with
`web/tasks/probes/fileupload-colours.cjs` (colours read back through a 1×1
canvas, so `color-mix()`, `color(srgb …)` and system colours all normalise):

| Appearance | Trigger fill (`Canvas`) | Ground (our card) | Ratio |
|---|---|---|---|
| light | `#ffffff` | `#ffffff` | **1.00:1** |
| dark | `#121212` | `#232320` | **1.19:1**, and *darker* than its ground |

In light the coincidence is total — `Canvas` resolves to the same `#ffffff` as
`--color-surface-card`, so the button is invisible as a shape and only its
`currentColor` border draws it (7.11:1, so WCAG 1.4.11 is satisfied and axe is
clean). In dark the UA's `Canvas` is `#121212` while our card is `#232320`: the
trigger renders **recessed**, a near-black hole punched into a warm dark card,
which is the same defect ADR-0021's own "popup read as a hole, not a panel" fix
describes — reproduced in a component that fix did not touch.

The three tiers are worth stating plainly, because only the middle one is
subtle:

1. a plain literal (`white`, `#f0f0f0`) — wrong in dark, and often wrong in light
   too once the host has a non-white surface;
2. a **system colour** (`Canvas`, `CanvasText`) — follows the appearance, but
   follows the *UA's* idea of it, not the host's tokens. Correct-looking in light
   only because most design systems put white near the top of their scale;
3. `var(--ui-surface, …)` — correct in both, because the host answers it.

The hover and active fills inherit the same problem in a milder form. They are
`color-mix(… CanvasText n%, Canvas)`, and in light `CanvasText`/`Canvas` are pure
black/white, so they compute to **exactly `#f0f0f0` and `#e0e0e0`** — the literals
they replaced, byte for byte (1.14:1 and 1.32:1 against the card). The fix bought
dark-mode reactivity (`#202020` / `#2e2e2e`) and changed nothing at all in light.

**Open question — Phase B needs a role the seam does not have.** `--_fu-trigger-bg`
wants "the surface a secondary button sits on", and the `--ui-*` seam has no such
token: `--ui-surface` is the *popover/panel* surface, and using it here would be a
lie that happens to have the right value. The three candidates are

- add `--ui-control-surface` (+ `--ui-control-surface-hover` / `-active`) to
  `web/src/styles/ui-tokens.css` and re-point `--_fu-trigger-*` in Phase B — this
  is a **new `--ui-*` role that does not exist yet**, and it is the same shape as
  F-003's `--ui-control-border` request, so the two should be decided together;
- reuse `--ui-surface` and accept the semantic overload;
- leave `Canvas` and accept that the trigger is recessed in dark.

Recommendation: the first, and upstream should own it — a component family with
buttons needs a control surface in its seam. Not actioned in Phase A (the rule is
verbatim), and `ui-tokens.css` is not mine to edit.

---

### F-NEW · The drop-zone hint fails AA in light, and FileUpload's own suite is structurally blind to it

**Surface:** `.FileUpload[data-drop-zone="true"] .drop-label { opacity: 0.7 }`.

The only *rendered* accessibility failure the port found, and the suite cannot
see it because **both** of FileUpload's axe runs disable the rule:

```js
'color-contrast': { enabled: false },   // in BOTH checkA11y calls
```

The suppression is justified in a comment — WCAG 1.4.3 exempts disabled
components and axe does not honour `aria-disabled` on a group container. But it
is applied to the *whole section*, so it also switches off contrast checking for
every enabled state in the component. Re-running axe over the same page with
`color-contrast` **on** and only `[data-disabled="true"]` excluded (the narrower
net `web/tasks/probes/axe-dark.cjs` uses) surfaces it immediately:

```
=== light: 1 violation type(s)
  [serious] color-contrast (2)
    div[data-id="fileupload-drop-zone"] > .drop-label
      3.44:1  (#8c8a86 on #ffffff, 14px normal) — expected 4.5:1
    div[data-id="fileupload-drop-zone-dragging"] > .drop-label
      3.23:1  (#8a8680 on #fbf0eb, 14px normal) — expected 4.5:1
=== dark: 0 violation type(s)
```

Three things make this interesting rather than routine:

- **It is a light-mode-only failure.** In dark the same `opacity: 0.7` over the
  same ink measures 4.59:1 and passes, because our dark foreground has more
  headroom above the card than the light one has below white. A ratio measured in
  one appearance really is half a finding.
- **It is not our design system's fault.** The colour is `currentColor` —
  `--color-body`, which measures 7.11:1 on its own. `opacity: 0.7` is the
  reference's choice, and 0.7 × 7.11 lands at 3.45. Any host whose body ink is
  not near-black inherits the same failure.
- **`aria-hidden` does not save it.** The `.md` (correctly) marks the hint
  `aria-hidden`, because drag-and-drop is a pointer affordance and the trigger is
  the accessible action. Axe still flags it, and rightly: sighted users read that
  text. A dodge via the a11y tree would not have worked here even if it had been
  attempted.

**Decision (Phase A):** leave `opacity: 0.7` verbatim.

**Phase B fix, measured.** The minimum opacity that clears 4.5:1 against *every*
ground the label actually lands on — including the `--ui-primary`-tinted dragging
fill, which is the tightest — is **0.88**; `opacity: 0.9` gives comfortable
headroom in all four cells:

| Ground | 0.70 | 0.80 | **0.90** |
|---|---|---|---|
| light, card `#ffffff` | 3.45 | 4.33 | **5.51** |
| light, dragging tint `#fbf0eb` | 3.24 | 4.01 | **5.02** |
| dark, card `#232320` | 4.59 | 5.55 | **6.7+** |

No new token is needed — this one is a one-character change to a number.

**Upstream suggestion:** `opacity` on text is the wrong knob for a de-emphasis
that has a contrast floor, because it composites against whatever the host put
behind it and therefore cannot be verified in the library. `color:
var(--ui-muted-foreground)` at full opacity would move the obligation to the seam,
where the host has already answered it (7.11:1 / 7.84:1 here).

---

### F-NEW · The `var(--ui-*, #hex)` fallback path is not AA in dark — degradation is graceful in light only

**Surface:** the four literal fallbacks in `FileUpload.css`; ADR-0021 *Costs*.

ADR-0021 documents the fallback path as graceful: where `light-dark()` is
unsupported the custom property goes unset and "components fall back to the
literal in `var(--ui-x, #hex)` — i.e. light values. Degradation is graceful and
must be documented, not guarded."

It is graceful only if the user's appearance is also light. `color-scheme` and
`light-dark()` support are not the same feature, so a browser that supports
`color-scheme: dark` but not `light-dark()` renders a **dark page with light
fallback colours**. Measured by neutralising the seam (`--ui-destructive: initial`
etc. makes the property guaranteed-invalid, which is exactly the unsupported-
`light-dark()` state) in both appearances:

| Fallback literal | Role | Light | Dark | Floor |
|---|---|---|---|---|
| `#c00` | `.item-error` text | 5.89:1 ✓ | **2.68:1 ✗** | 4.5 |
| `#6e6e6e` | `.item-size` text | 5.10:1 ✓ | **3.09:1 ✗** | 4.5 |
| `#0070f3` | dragging border | 4.55:1 ✓ | 3.46:1 ✓ | 3.0 (1.4.11) |
| `#0070f3` @8% | dragging fill | 1.11:1 n/a | 1.11:1 n/a | — |

With the seam answered (our `ui-tokens.css`) every one of them passes in both
appearances: error text 5.04 / 6.58, `.item-size` 7.11 / 7.84, dragging border
5.01 / 6.09. So the port itself is clean — this is a finding about the
library's stated degradation story.

**Open question:** should the fallbacks be `light-dark()` pairs too, e.g.
`var(--ui-destructive, light-dark(#c00, #ff8a80))`? That is circular where
`light-dark()` is the missing feature. The honest alternatives are to make the
fallbacks system colours (`LinkText`, and `CanvasText` for the hint, both of which
*are* appearance-aware without `light-dark()`), or to state in the ADR that the
degradation is documented as light-only rather than as graceful.

---

### F-NEW · An end-state suite that mutates the DOM forces a React port to read the DOM

**Surface:** `FileUpload.e2e.test.js` — four tests use `page.evaluate` +
`setAttribute`.

The suite reconfigures a live instance and expects the *next* file selection to
honour the new configuration:

```js
inputEl.setAttribute('accept', '.pdf')              // ×3 tests
liveEl.setAttribute('data-max-size', '1')           // ×1
el.querySelector('.input').setAttribute('multiple', '')  // ×1
```

For the reference this is invisible — `_validateEntry()` reads `this.input.accept`
and `this.root.dataset.maxSize` on every call, so the DOM *is* the state. A React
port that validates against its **props** passes 17 tests and fails 4, and fails
them as apparent validation defects: the invalid file renders as `valid`, which
looks like a broken accept-matcher rather than a stale read.

The port therefore reads `accept`, `multiple` and `data-max-size` off the DOM
inside the change handler and passes the values to a pure validator. That is
faithful, and it is also the only thing that can work — but note what it costs:
those three attributes become **inputs the component does not own**, so a
consumer who changes an `accept` prop and a consumer who calls `setAttribute` get
the same behaviour, and React's normal "props are the source of truth" invariant
does not hold for them.

This is a softer sibling of F-011. The suite's header promises end-state, not
mechanism; asserting through `setAttribute` is not *quite* a mechanism assertion,
because the end state genuinely differs — but it does assume the implementation
re-reads the DOM on every validation, which is a vanilla-JS habit rather than a
contract.

**Decision:** read the DOM, and document it at the top of `FileUpload.tsx` so the
next porter does not "clean it up" into props.

**Upstream suggestion:** the two `accept` tests could set the attribute on a
*static* state's instance and assert its rendered output, or the demo page could
expose a second live instance with `accept=".pdf"` authored. Either removes the
re-read assumption and keeps the assertion.

---

### F-NEW · A new React trap: `react-hooks/refs` fires on a helper called from a `useState` initializer

**Surface:** `npm run lint`. Adds a third entry to the playbook's React-trap
list, alongside `set-state-in-effect` and the `useCallback` build error.

The natural first cut of the port had one validator closing over the refs, so
that both the seeding path and the change handler could share it:

```ts
function validate(entry: FileEntry) {
  const liveAccept = inputRef.current?.getAttribute('accept') ?? accept   // ← error
  …
}
const [entries, setEntries] = useState(() => seeds.map(validate))
```

That is a lint **error**, not a warning:

```
205:55  error  Cannot access refs during render
        Passing a ref to a function may read its value during render  react-hooks/refs
```

The rule is right, and the diagnostic is better than it first looks: the lint
points at the `useState` initializer, not at the ref read, because the
*initializer* is the render-path call site. During that call `inputRef.current` is
`null`, so the "live DOM" read silently degrades to the prop fallback — the code
would have worked, by accident, and for the wrong reason.

**Decision:** hoist the validator to module scope as a pure function of
`(entry, accept, maxSize)`. The seeding render passes props (the only values that
exist yet); the change handler passes the DOM reads. The two callers now differ
*visibly* in which source of truth they use, which is the distinction the
previous shape hid.

Generalisable rule for this repo: **any helper that dereferences a ref belongs
outside the component, taking the dereferenced value as a parameter.** A
ref-closing helper is only safe if every call site is an effect or an event
handler, and lint cannot prove that, so it refuses the whole shape.

---

### F-NEW · The reference's "preserve authored static markup" branch has no React analogue

**Surface:** `FileUpload.ts` → `_init()`.

```ts
// Only re-render when we have entries from a data source (input.files or
// data-initial-files). When entries is empty, preserve any pre-rendered
// static markup — kitchensink states use this for visual-only states.
if (this._entries.length > 0) { this._renderList() }
```

This branch exists only because vanilla JS mounts onto DOM that someone else
wrote. React renders the DOM, so there is no prior markup to preserve and no
condition under which the "preserve" arm could be taken: the author must supply
the files as data either way.

The reference's own kitchensink leans on the distinction — `_multiple` and
`_invalid-mixed` hand-author `<li class="item">` children, while `_with-files` and
`_server-files` drive the same output from `data-initial-files`. Two authoring
paths, one end state.

**Decision:** model both paths as props rather than collapsing them, so the
kitchensink stays a faithful mirror:

- `initialFiles?: string` — the JSON, emitted as `data-initial-files` **and**
  parsed. The `server files` test selects on `[data-initial-files*="abc123"]`, so
  the attribute is contractual, not decorative.
- `files?: SeedFile[]` — seeds the same entries with **no** attribute, which is
  what the statically-authored states are.

Collapsing them into one prop would have been simpler and would still have passed
21/21 — but it would have put `data-initial-files` on states the reference leaves
without it, and that attribute is a selector in the suite. Worth flagging as the
kind of "harmless simplification" that is only harmless until someone greps.

Same shape as F-012 (`bare`/`authored` collapsing in AffixField), and the same
consequence: the suite silently stops covering something. Here the uncovered
thing is *"JS leaves authored markup alone"*, which in React is not a behaviour
that can regress.

---

### F-NEW · `data-initialized` is a hydration barrier here, not just a test target

**Surface:** `FileUpload.tsx`, `e2e-helpers/target.js`, the spec's `beforeEach`.

Two different spellings of the same attribute are in play, and both must hold:

| Reader | Selector |
|---|---|
| `e2e-helpers/target.js` → `DEFAULT_TARGET.FileUpload` | `[data-component="FileUpload"][data-initialized]` — **existence** |
| the spec itself, 20 of 21 tests | `[data-component="FileUpload"][data-initialized="true"]` — **value** |

Emitting `data-initialized` bare would satisfy `target.js` (which nothing in this
spec actually calls — only `targetPath()` is imported) and fail the spec. Emitting
`="true"` satisfies both. F-010 already says "render the attribute"; the addition
is that it must be `="true"` even though the documented target only tests
existence.

The more useful half: rendering it **only after hydration** is load-bearing, not
cosmetic. `useSyncExternalStore(noopSubscribe, () => true, () => false)` — the
MotionRegion/ScrollArea shape — means the attribute is absent in the SSR HTML and
appears in the hydration commit. Because every one of the spec's 21 locators is
gated on it, Playwright's auto-wait becomes a **hydration barrier for free**: no
test can click a trigger or call `setInputFiles` before `onChange` and `onClick`
are attached. Had the attribute been rendered unconditionally on the server, the
markup would have advertised itself as initialised while its handlers were not
yet wired, and `setInputFiles` would have fired a `change` into the void — an
intermittent, load-dependent failure, worst-case for CI.

So the honest value and the safe value coincide, which is the same conclusion
MotionRegion reached from a different direction (there it was a media query the
server cannot read; here it is event listeners the server cannot attach).

---

### F-NEW · Positive: DOM order is the contract, and reading `.last()` / `.first()` first made the port a straight copy

**Surface:** `FileUpload.kitchensink.tsx`.

FileUpload's spec never uses a `data-id`. It resolves instances positionally:

- the interactive instance is `.last()` on
  `[data-component="FileUpload"][data-initialized="true"]` — 17 tests;
- the drop-zone instance is `.first()` on `[data-drop-zone="true"][…]` — 1 test
  that drives a *real* selection and removal through it;
- the server instance is `.first()` on `[data-initial-files*="abc123"]` — a
  content match on an attribute value.

So the kitchensink must put the live demo **after every other FileUpload**, and
the plain drop-zone **before** the pinned `data-dragging-over` one. Both fall out
of mirroring `FileUpload.html`'s section order, which is why this went green
first try — but neither is written down anywhere, and getting either wrong fails
as a *behavioural* defect in an unrelated-looking test ("focus moves to trigger
after removing the only file" would fail because `.last()` had landed on a
pinned-state instance with no handlers of its own).

Recorded as a positive because it is the F-008 lesson paying off: the 53 class
selectors that make this the densest spec in the library are also what made it
the *easiest* to satisfy. Once every class name, `data-*` and DOM ordering
constraint was inventoried from the spec before writing markup, there was nothing
left to guess. Density is only a hazard if you discover it incrementally.

---

### F-NEW · Positive: the uncontrolled-`<input type="file">` constraint is the reference's design, not a React concession

**Surface:** `FileUpload.tsx`, `_rebuildFileInput()`.

The playbook warns that a controlled input breaks native behaviour silently, and
`input[type=file]` is the extreme case: there is no `value` React may set at all.
That looks like a React limitation until you read the reference, which reaches for
`DataTransfer` for the *same* reason — the browser forbids programmatic
assignment except through a `FileList`, and the reference wraps the assignment in
`try/catch` because some environments forbid even that.

So the port is a transliteration, not a workaround: component state owns
`entries`, an effect writes the valid user-selected subset back through
`DataTransfer`, and invalid entries stay visible in the list while never reaching
the form payload. The one difference is *when* — an effect keyed on `entries`
rather than an explicit call at the end of each mutation — which is strictly
better, because it cannot be forgotten at a new mutation site. The reference has
three call sites for `_rebuildFileInput()`; the port has none to remember.

Recorded alongside F-015: for the second time, the constraint the contract
describes as a platform limitation turns out to be the shape React already
prefers.

---

## Handback — WCAG 1.4.10 Reflow at 320 px

Reproduced with `web/tasks/probes/reflow-locate.cjs`: 65 px of document overflow
at 320 px, all of it attributed to the FileUpload section. Bisected to **two
independent causes**, one mine and one inherited. FileUpload's own contribution
is now **2 px at 320 px and 0 px at 360 / 480 / 768 px**, down from 65 px.

| | doc overflow `/` | FileUpload-only | doc overflow isolated | FileUpload-only |
|---|---|---|---|---|
| 320 px | 73 (RangeScale owns 71) | **2** | **2** | 2 |
| 360 px | 33 (RangeScale) | **0** | **0** | 0 |
| 480 px | 0 | 0 | **0** | 0 |
| 768 px | 0 | 0 | **0** | 0 |

`reflow-locate.cjs` now reports `RangeScale without: 2px contributes 71px` — i.e.
hiding RangeScale leaves exactly FileUpload's residual 2 px, and hiding
FileUpload changes nothing. The remaining page-level failure is not ours.

Re-verified after both fixes: **21 / 21 on the isolated route and 21 / 21 on the
aggregate `/`**. `FileUpload.css` still byte-identical; `npm run lint` clean.

---

### F-NEW · JSX drops the whitespace text nodes that let an inline row reflow

**Surface:** `FileUpload.tsx` → `entryParts()`. **This was the bigger half of the
reflow failure, and it is a pure porting defect — invisible in every test.**

In **single** mode the file container is `<div class="selected">`, which the
verbatim stylesheet leaves at `display: block`. Its children are therefore
*inline* spans, and the stylesheet marks all three `white-space: nowrap`:

```css
.FileUpload .item-name  { white-space: nowrap; overflow: hidden; text-overflow: ellipsis }
.FileUpload .item-size  { white-space: nowrap }
.FileUpload .item-error { white-space: nowrap }
```

The reference's Handlebars partials put each span on its own source line, so the
browser gets a collapsible whitespace text node — a **soft-wrap opportunity** —
between every pair. JSX siblings produce no text node at all, so the entire row
becomes one unbreakable inline box. Measured `min-content` of the root at 320 px:

| State | JSX siblings | with `{" "}` separators | reference |
|---|---|---|---|
| `invalid-size` ("File exceeds maximum size") | **285 px** | **155 px** | 155 px |
| `invalid-type` ("File type not allowed") | **236 px** | **117 px** | 117 px |

The demo cell is 238 px wide at a 320 px viewport, so `invalid-size` overflowed by
47 px purely because of missing whitespace. Verified by injecting real text nodes
between the spans at runtime (`document.createTextNode(' ')`) — 285 → 155 with no
CSS change whatsoever.

**Decision:** emit `{" "}` between the parts in `entryParts()`. This is not a
workaround, it is **restoring DOM the reference actually has** — `.selected` in
`_invalid-size.hbs` genuinely contains those whitespace nodes. Byte-identical CSS
is preserved; the port's markup got closer to the reference, not further.

Why this is worth a finding rather than a footnote:

- **No test can see it.** All 21 conformance tests passed before and after.
  `toHaveText` matches inside a span, `textContent` ignores sibling whitespace,
  and axe has no reflow rule at all (WCAG 1.4.10 is not machine-testable by axe).
  Only a viewport-width probe finds it.
- **It is silent in every other mode.** In *multiple* mode `.item` is a flex row,
  where whitespace text nodes are discarded, so the same `entryParts()` renders
  identically. The defect exists only where the reference's own CSS leaves a
  container as `display: block` — which is exactly the mode the `.md` documents
  as "the file's spans and button render inline, with no `<li>` wrapper".
- **It generalises.** Any port of this library that renders an inline row of
  `nowrap` spans from JSX (or any template engine that does not emit source
  whitespace) inherits it. `Notice`, `AffixField` and `Picklist` all have inline
  span rows; none of them combine that with `white-space: nowrap`, which is why
  FileUpload is where it surfaced.

**Upstream suggestion:** a layout that depends on source-code whitespace for its
wrap points is fragile in exactly this way. `.selected` would be more robust as
`display: flex; flex-wrap: wrap` (matching `.item`), or the three spans could
drop `nowrap` and rely on `overflow-wrap`. Either makes the reflow behaviour a
property of the stylesheet rather than of the consumer's templating engine.

---

### F-NEW · A bare `input[type=file]` has a 344 px unshrinkable intrinsic width

**Surface:** `FileUpload.kitchensink.tsx` → the "Native reference" block. Mine,
and fixed.

The second half of the overflow was not the component at all — it was the two
native controls the kitchensink shows for comparison. Chromium gives an
unstyled `<input type="file">` a `min-content` width of **344 px**: its shadow
content is a "Choose File" button plus a "No file chosen" label, and neither
shrinks. In a 238 px demo cell that overflowed by 106 px, and because grid items
stretch to their track, it dragged the `Cell` caption span out to 344 px too —
which is why `reflow-locate.cjs` reported `span.text-caption.text-body w=344` as
an "innermost offender". The caption was a victim, not a cause.

Two things made this hard to see:

- `Cell`'s new `min-w-0` correctly lets the *track* shrink, but a track can never
  go below its content's `min-content`, and this content's `min-content` is a UA
  constant. `min-w-0` is necessary and not sufficient.
- The overflow is attributable to a `<span>` two levels away from the element
  that causes it, so the obvious reading ("a caption that cannot wrap") is wrong.

**Decision:** `className="w-full min-w-0"` on both native inputs. `width: 100%`
overrides the intrinsic sizing and the UA clips its own shadow content, taking
FileUpload's contribution from 65 px to 2 px. This is demo chrome in my own file,
not component styling, and it is recorded in a comment at the call site so it is
not "tidied away" as a stray utility.

Worth noting for other ports: **any kitchensink that shows a native control for
comparison is a reflow risk**, because native controls are sized by the UA and
several of them (`file`, `date`, `datetime-local`, `week`) have generous
intrinsic minimums. The "Native reference" block is a convention of this repo's
kitchensinks, so this is not a FileUpload-specific hazard.

---

### F-NEW · The residual 2 px is inherited verbatim CSS: `nowrap` on an unshrinkable flex item

**Surface:** `.FileUpload .item-error { white-space: nowrap }` in the verbatim
stylesheet. **Phase A no-touch — recorded, with the Phase B fix measured.**

After both fixes above, one state still overflows: `invalid-mixed`, the only
**multiple**-mode state carrying an error. There `.item` is a flex row, and the
whitespace fix cannot help because flex discards whitespace text nodes. The
container's `min-content` is the sum of its items' minimums, and two of the three
spans cannot shrink at all:

| Flex item | `min-content` contribution | Why |
|---|---|---|
| `.item-name` | 68 px | `nowrap`, but `overflow: hidden` → automatic minimum size **is** reducible |
| `.item-size` | 37 px | `nowrap`, no `overflow` → **irreducible** |
| `.item-error` | **117 px** | `nowrap`, no `overflow` → **irreducible** ("File type not allowed") |

Measured root `min-content` for `invalid-mixed`, and the effect of each candidate
injected at 320 px:

| Stylesheet | root `min-content` | fits the 238 px cell? |
|---|---|---|
| verbatim (as shipped) | **281 px** | ✗ — overflows by 43 px |
| `.item-error { white-space: normal }` | **208 px** | ✓ |
| `+ .item-size { white-space: normal }` | **189 px** | ✓ |
| `.item-name { min-width: 0 }` (tested, no effect) | 281 px | ✗ |

**Phase B fix, verified:** the single declaration
`.FileUpload .item-error { white-space: normal }` takes the document to **0 px
overflow at 320, 360, 480 and 768 px on both routes**, and FileUpload's own
contribution to 0 px at every width. `.item-size` needs no change — "48 MB"
never binds. One line, no new token, no `--ui-*` role.

**Decision:** leave it verbatim in Phase A. This is a genuine upstream defect, not
a porting artefact: the reference's own demo page overflows the same way at
320 px, and 1.4.10 is a Level AA criterion the library's exit criteria do not
currently check — its whole conformance story is axe, and **axe has no reflow
rule**. So 21/21 plus two clean axe runs coexisted with a real AA failure for the
entire port. That is the same shape as the `.drop-label` finding (a rule the suite
switches off) but worse: here there is no rule to switch off.

**Open question:** `white-space: nowrap` on `.item-error` and `.item-size` looks
deliberate — it keeps a size and an error message on one line, which is the right
default at any comfortable width. The honest fix is probably not "always wrap" but
letting the row wrap instead: `.item { flex-wrap: wrap }` plus
`.item-error { flex-basis: 100% }` keeps one-line layout when it fits and stacks
the error underneath when it does not. That is a design decision, so it wants a
call rather than my choosing it — but *something* has to give, because the current
rules make a 320 px viewport impossible.

**Upstream suggestion:** add a reflow assertion to the conformance suite. It is
three lines and it catches a class of AA failure axe structurally cannot:

```js
test('reflows at 320px without horizontal scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 })
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBe(0)
})
```
