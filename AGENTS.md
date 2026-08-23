# CLAUDE.md — porting playbook

## What this project is

A press test. We port every component in
[`reference-components`](https://github.com/nicklas-bryntesson/reference-components)
(vendored as a git submodule at `reference-components/`) into Next.js + React +
Tailwind v4, styled by `cursor-DESIGN.md`, and record every problem surface in
`Findings.md`.

The research questions: **how does this library port to React, and what breaks
when its class-name-and-CSS model meets Tailwind's utility model?**

## Layout

```
cursor-DESIGN.md          the design system (read-only input)
Findings.md               the deliverable — every decision and problem surface
reference-components/     git submodule. PRISTINE AND DISPOSABLE. Never edit.
findings/<Name>.md        per-component findings fragments, merged into Findings.md
web/                      the Next.js app
  src/styles/
    design-tokens.css     cursor-DESIGN.md as Tailwind v4 @theme tokens
    ui-tokens.css         THE BRIDGE — our design → the library's --ui-* seam
    site-tokens.css       the two --SITE--* layout tokens components actually read
  src/components/
    kitchensink-ui.tsx    shared Section / Block / Cell chrome
    <Name>/
      <Name>.css          copied VERBATIM from the submodule. Byte-identical.
      <Name>.tsx          the React port. Imports its own CSS.
      <Name>.kitchensink.tsx   every state, with the data-id anchors the suite needs
  src/app/kitchen-sink/
    page.tsx              aggregate target (all components)
    <name>/page.tsx       isolated target for one component
  tasks/probes/           throwaway measurement scripts (gitignored)
```

## Non-negotiables

1. **Never edit anything under `reference-components/`.** It stays pristine so we
   keep upstream updates and an unmodified reference to diff against. After any
   test run, `git -C reference-components status` must be empty. Never let your
   shell cwd sit inside it for editing work.
2. **Read the contract before writing code.** For component `X`:
   `reference-components/src/partials/components/X/X.md` is the contract —
   `## Contract`, `## Behaviour`, `## Accessibility`, `## Attributes`,
   `## Kernel dependencies`, `## Non-goals`. Then read
   `X/tests/X.e2e.test.js`, which is the *portable* contract and is stricter
   than the `.md`.
3. **Kernel first.** If `X.md` has a `## Kernel dependencies` section listing
   modules, port those from `reference-components/src/kernel/` into
   `web/src/kernel/` and run their conformance tests before touching the
   component. Port them **once**; every component that declares them composes
   the same verified behaviour.
4. **Do not port `*.unit.test.*` or `*.generate.ts`.** PORTING.md excludes both:
   the unit tests are white-box tests of the reference implementation (they call
   private methods), and the generators are repo-internal tooling. The e2e + axe
   suite is the contract.
5. **Port the logic, not the class.** `AGENTS.md` step 7: "Do not copy the
   TypeScript class — port the logic." Use React state and effects; reflect state
   into `data-*` attributes, because that is where CSS and the tests read it.

## The two-phase rule (this is the whole method)

PORTING.md is emphatic and we follow it exactly. Doing both at once "leaves you
two variables and nothing to bisect".

### Phase A — verbatim

- `cp` the component's `.css` from the submodule **unchanged**. Verify with
  `diff` that it is byte-identical.
- Port the behaviour to React. Build the kitchensink with every `data-id` anchor
  the suite needs.
- Get the conformance suite green. **Tailwind is not involved in Phase A.**
- The only edits permitted to the copied CSS are the ones PORTING.md itself
  sanctions — dropping the runtime-only init-gate rules (below).

### Phase B — translate

Only on a green baseline. Move design values into Tailwind utilities on the same
DOM, keeping every structural class name. Guard it with the net PORTING.md
suggests: snapshot `getComputedStyle` for the popup, footer, segments and trigger
with the popup **open**, translate, snapshot again, diff. The suite asserts
behaviour, not appearance — green afterwards means "I did not break the
interaction", not "it looks right".

Do not start Phase B for a component until told to. Phase A across the set first.

## Traps that have already cost us

- **Class names are contractual.** `data-*` is billed as the public API and
  ADR-0019 invites you to swap element classes for utilities. Do not. The e2e
  suite selects on ~30 element class names — `.trigger` (142 hits), `.popup`
  (118), `.input`, `.segment`, `.track`, `.option`, `.item`, `.calendar-grid`,
  and more. Keep the semantic class and layer utilities **alongside** it:
  ```tsx
  <div className="popup rounded-lg border border-hairline bg-surface-card">
  ```
  See `Findings.md` F-008.
- **Drop the init-gate CSS, keep the `data-initialized` attribute.** The
  `overflow: hidden` → `[data-initialized="true"]` rules clip the popup in a
  framework that renders formed markup, so delete them. But the attribute is a
  test target — suites wait on `[data-initialized="true"]`. Render it. F-010.
- **`.kitchensink-section` is required.** Several suites scope their
  full-section axe run to `.kitchensink-section:has([data-id="<x>-live"])`. It is
  a demo-page class that no contract documents. `<Section>` in
  `kitchensink-ui.tsx` provides it. F-014.
- **`data-id` anchors are exact.** Read the `anchor()` helper at the top of the
  spec and `e2e-helpers/target.js`. A wrong id fails as a missing element, which
  reads as a structural defect.
- **Booleans are `="true"` or absent** — never `="false"`, never bare. In React
  that is `data-x={cond ? "true" : undefined}`; `undefined` is exactly the
  library's "absent". The one exception is when both states must be styled to
  animate between them, which the contract calls out explicitly where it applies.
- **Design comes only from `--ui-*`.** Never read `--SITE--*` for design, never
  invent a host token. If a role is missing, it goes in `web/src/styles/ui-tokens.css`
  with a `Findings.md` entry — not into the component.
- **Entrance animations break axe.** If you add an opacity fade to a popup there
  is a ~150–180 ms window below AA contrast, and Playwright's auto-wait does not
  check opacity. Either keep the reference's no-animation behaviour, animate
  `transform` instead, or run with `AXE_SETTLE=1`.
- **Zero client JS where the contract allows it.** Some components (AffixField,
  and per its `.md` any component whose JS only *computes attributes*) are pure
  end-state and port to a Server Component with no `'use client'`. Prefer that —
  it is the contract's own stated ideal. Everything interactive needs
  `'use client'`.

## Traps found by the ports themselves (read these — they cost real time)

- **Nine specs hard-code `page.goto('/')`.** ChoiceField, ChoiceGroup, Notice,
  Picklist, RangeField, RangeGroup, RangeScale, ThemeSwitch and ToggleTip ignore
  `targetPath()`, and Playwright resolves `'/'` against the ORIGIN of `baseURL`,
  so `TARGET_PATH` is silently inert for them. **Already solved:** `/` serves the
  aggregate kitchensink (`src/app/page.tsx` → `AggregateKitchensink`). Run those
  specs with no `TARGET_PATH` at all. Do **not** build a proxy — one agent did
  and it was wasted work.
- **Pass the spec file path, not `--grep`.** `--grep "ChoiceField"` also matches
  ChoiceGroup; `--grep "Notice"` matches anything with the word. Use
  `npx playwright test src/partials/components/X/tests/X.e2e.test.js`.
- **Some specs run an UNSCOPED `checkA11y(page, '#<Component>')`** against the id
  of the reference *demo section* — `#ChoiceField`, `#Notice`, `#Picklist`. That
  id is documented nowhere. Pass `anchorId="<Component>"` to `<Section>`; it puts
  the id on the `.kitchensink-section` element itself, which is what the
  reference does. Do not invent your own wrapper — one agent did and it audited
  the wrong subtree.
- **`useEffect(() => setState(true), [])` is a LINT ERROR**, not merely
  unidiomatic: `react-hooks/set-state-in-effect`. Two independent ports hit it on
  the same line of reasoning, because the reference's imperative `attach()` —
  and every component that emits `data-initialized`, `data-scrollbar` or
  `data-motion` — points a porter straight at the pattern React 19 rejects. Use
  `useSyncExternalStore` with asymmetric snapshots (client `true`, server
  `false`). Worked precedents: `src/components/MotionRegion/MotionRegion.tsx` and
  `src/components/ScrollArea/ScrollArea.tsx`.
  **It is also faster, measurably.** `useState` + `useEffect` schedules a second
  *passive* commit after hydration; `useSyncExternalStore` resolves inside the
  hydration pass, so two commits become one. ScrollArea's enhancement window went
  from 13.6–27.5 ms to **6.1–11.0 ms** and now matches the reference
  frame-for-frame. It also avoids hydration mismatches, which a guessed initial
  value does not. Note the rule only targets *synchronous* setState in an effect
  body — state genuinely driven by a measurement or a subscription callback stays
  ordinary `useState`.
- **`react-hooks/refs`** — "Passing a ref to a function may read its value during
  render". Read `ref.current` inside a handler or effect and pass the *value*, or
  move the call out of the render path. Do not silence it with a disable comment.
- **A system colour is appearance-aware but NOT design-system-aware.** `Canvas`
  resolves to the UA's `#121212` in dark, not to our card `#232320` or page
  `#1a1a17`. So when measuring a hardcoded value in dark, distinguish three
  tiers: a plain literal (`white` — wrong in both appearances), a system colour
  (`Canvas` — right in light, off in dark), and `var(--color-surface-card)`
  (right in both). More useful than a pass/fail list.
- **A kitchensink demo wider than the viewport is a WCAG 1.4.10 Reflow failure**
  and axe does not test reflow at all, so nothing catches it. Check for document
  horizontal overflow at 320 px (the actual threshold), not just that it "looks
  fine". One fixed-width demo put 9 px of horizontal scroll on the shared page.
- **`useCallback` around anything derived from a render value is a BUILD error**
  — `Compilation Skipped: Existing memoization could not be preserved`. Let the
  React compiler do it.
- **Controlled inputs will break native behaviour silently.** `checked={x}`
  without `onChange` makes a radio group's selection unmovable, and it fails as
  an *apparent native-semantics defect* — the most misleading failure possible
  for components whose whole thesis is "native carries the behaviour". Use
  `defaultChecked` / `defaultValue`. The component `.md` API tables say
  `checked`, which is correct HTML and a dangerous porting instruction.
- **Some components bypass the `--ui-*` seam with hard-coded literals** —
  `ScrollArea`'s `--_sb-track`/`--_sb-thumb` (`oklch()` literals, and the thumb
  doubles as the focus ring at 2.22:1, under 1.4.11), `ChoiceField`'s
  `--_cf-selected: CanvasText`, `Notice`'s `CanvasText` body text. These cannot
  follow the appearance flip. Leave them verbatim in Phase A, record them, and
  propose the fix for Phase B. Do not edit `ui-tokens.css` to chase them.
- **Next.js `async` chunks lose a race the whole e2e suite assumes it wins.**
  Upstream, `src/js/script.js` runs `attach()` from `<script type="module">`. A
  non-async module script is **deferred**, and a deferred script **delays the
  `load` event** — which is exactly when `page.goto()` resolves. So the specs can
  read component state in an ungated `page.evaluate` immediately after `goto` and
  always be safe. Next injects every client chunk as `<script async>`, which does
  **not** delay `load`. Measured on the shared page, 4 runs each:

  | Init strategy | instance present |
  |---|---|
  | `useEffect` (hydration) | **86–141 ms after** `goto` resolved |
  | module-scope `attach()` | 54–91 ms after `goto` resolved |
  | inline parser-blocking bootstrap | **before** `goto` resolved, 4/4 |

  Any assertion with no preceding auto-retrying `expect()` fails. It presents as
  a logic defect and it is not one — but **it is also not a test-only problem**:
  for ~100 ms a hydration-only component does not clamp, does not announce, and
  cannot arbitrate. That is a real dead-control window, not a measurement
  artefact, so do not "fix" it by adding waits to the spec.
  The working fix is an inline parser-blocking bootstrap gated on
  `document.readyState` → `DOMContentLoaded`: after the markup is parsed, still
  before `load`. Keep ONE implementation — serialise the same imported function
  with `String(fn)` and also call it from `useEffect` as a client-navigation
  safety net, guarding on the instance handle exactly as the reference's
  `attach()` does. This is the technique PORTING.md's *Preventing FOUC* section
  prescribes, applied to behaviour rather than paint. Worked precedent:
  `src/components/RangeGroup/RangeGroup.bootstrap.ts`. See Findings.md F-035.
- **A component-scoped axe pass is not evidence the page is accessible.** The
  shared chrome shipped 20+ contrast failures that every component-scoped suite
  missed, and the first section-scoped suite found them immediately.

## Appearance — light AND dark are both in scope

The design system now supplies both halves. Every colour in `design-tokens.css`
is a `light-dark()` pair and the `--ui-*` bridge passes them straight through, so
components follow `color-scheme` with no `dark:` variants and no duplicate
blocks. Verified in Chromium: zero WCAG 2 AA violations across the whole
kitchensink in both appearances.

What this means for a port:

- **Do not add `dark:` utilities.** If a value needs a dark half it belongs in
  `design-tokens.css` as a `light-dark()` pair, which is my file, not yours —
  report it.
- **Any colour you measure, measure in both appearances**, and say which one a
  number came from. A ratio measured only in light is half a finding.
- The projection contract is `data-appearance` on `<html>`: absent = follow the
  OS, `"light"` / `"dark"` pin it. Nothing applies tokens at runtime.
- Verify with `web/tasks/probes/axe-dark.cjs` (run it with `NODE_PATH` pointed at
  the submodule's `node_modules`) — it audits the full page in both appearances.

## Running the suite

Dev server (from `web/`):

```bash
npm run dev            # http://localhost:3000
```

Conformance run — **from the submodule**, pointed at our server. Do not edit the
submodule's config; the env vars are the documented seam:

```bash
cd reference-components

# Specs that honour targetPath() — the isolated route is faster and unambiguous:
BASE_URL=http://localhost:3000 TARGET_PATH=/kitchen-sink/<name> \
  npx playwright test src/partials/components/<Name>/tests/<Name>.e2e.test.js \
  --reporter=line --output=../web/tasks/tr-<Name>

# Specs that hard-code goto('/') — omit TARGET_PATH and let them hit the root:
BASE_URL=http://localhost:3000 \
  npx playwright test src/partials/components/<Name>/tests/<Name>.e2e.test.js \
  --reporter=line --output=../web/tasks/tr-<Name>
```

Always pass a unique `--output` directory — several ports run concurrently and
they otherwise fight over `test-results/`.

`AXE_SETTLE=1` waits for `opacity: 1` before an axe audit. `TARGET_ID` overrides
a single-instance suite's root selector.

### Measure against PRODUCTION, sequentially

```bash
cd web && npm run conformance
```

That builds, starts a production server, runs every component spec plus the two
site-level suites **one at a time**, tallies the result and checks the submodule
is still clean. It refuses to start if another Playwright process is active.

Both constraints are load-bearing, and each one already cost a wrong conclusion:

- **`next dev` is not a valid substrate for this suite.** MonthField and
  TimeField reveal on hydration, growing the shared page by +224 px. In dev that
  lands at t ≈ 330–410 ms — inside Playwright's click gesture, which computes a
  point and *then* moves the mouse. Triggers end up 212 px below the aim, so
  `click` dispatches on an ancestor and the button never receives it. Four
  unrelated components fail, with messages accusing their own mechanisms.
  Measured: ToggleTip 6/5 in dev, **11/11 in production**, no code difference.
  See F-049.
- **Concurrent runs from the submodule's single Playwright install** produce a
  bogus `did not expect test.beforeEach() … No tests found` runner error rather
  than a clean failure. Always check the runner is idle before trusting a number —
  and note `pgrep -f "playwright test"` **matches its own compound command
  string**, so it self-reports busy. Call it standalone.
- **`pkill -f "next start"` does not match the server.** The running process is
  named `next-server`. That pattern is a silent no-op, the restart hits
  `EADDRINUSE`, `next start` never binds, and the OLD server keeps answering
  `200` from a `.next` that later builds have overwritten — unstyled page, dead
  JS, stale HTML, and a `500` on the globals CSS chunk. **This produced three
  wrong reports in this project**, including one where a human opened the page and
  found it visibly broken while the suite was green. Kill by port
  (`lsof -ti:3200 | xargs kill -9`), and **read the server log for `Ready in`
  before testing** — `curl` returning `200` proves only that *something* is
  listening.

And remember F-019: `TARGET_PATH` is **inert** for the nine specs that hard-code
`page.goto('/')`, so "I reproduced it on the isolated route" is not a valid
inference for those nine unless you verified the spec calls `targetPath()`.

### The project's own gates

Beyond the reference suite, run this from `web/` with the dev server up:

```bash
npm run verify
```

which chains: `build` → `lint` → `test:unit` (kernel conformance) →
`verify:appearance` (every `--ui-*` resolves and differs between appearances) →
`verify:axe` (axe over the whole page in BOTH appearances) → `verify:reflow`
(viewport sweep, 320–1280 px).

The last two exist because the reference suite cannot see what they check:
a component-scoped axe pass says nothing about the page (F-017), the component
suites all run in light only (F-020), and **axe does not test reflow at all**, so
a WCAG 1.4.10 failure coexists happily with a fully green audit (F-024).

Then confirm the submodule is untouched:

```bash
git -C reference-components status --short   # must print nothing
```

## Findings

Every decision and every problem surface goes in `Findings.md` as an `F-nnn`
entry: the surface it was found on, the evidence (measure it — contrast ratios,
probe output, test output), and either a **Decision** with reasoning or an **Open
question** for the project owner. When working on one component, write to
`findings/<Name>.md` instead and it gets merged — that keeps parallel ports from
contending for one file.

Entries are append-only. A reversal is a new entry that supersedes the old one.

What earns an entry: anything a porter would want warned about, anything where
the design system and the accessibility contract disagreed, anything where React
or Tailwind could not express what the reference assumed, and anything the
library's own docs got wrong or left out. Positive findings count — "the `1.125ch`
calibration survived a typeface change" is worth as much as a failure.

## Accessibility is the tiebreaker

The library's exit criteria demand **zero** axe WCAG 2 AA violations. When
`cursor-DESIGN.md` and that requirement conflict, accessibility wins, the design
value moves, and the move is recorded in `Findings.md` with its measurement and
flagged as an open question. This has already happened four times — see F-001
(the primary CTA is not AA-compliant as specified), F-003, F-004, F-005.

## Out of scope

- `Combobox` and `TabAccordion` — parked legacy references upstream, no contract,
  no test suite. Not migration targets.
Nothing else. `ThemeSwitch` and `tests/appearance.e2e.test.js` were deferred
while the design system was light-only; the dark palette landed, so both are
back in scope (F-020). Note `appearance.e2e.test.js` asserts on
`.Picklist[data-id="single"]` and `#Picklist`, so it cannot run until Picklist is
ported.
