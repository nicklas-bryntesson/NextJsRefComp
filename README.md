# NextJsRefComp

A press test: porting every component in
[`reference-components`](https://github.com/nicklas-bryntesson/reference-components)
into Next.js + React 19 + Tailwind v4, under a real design system, to find out
where an accessibility contract library survives the trip and where it does not.

**The deliverable is [`Findings.md`](Findings.md)** — 50 project-level findings
plus 178 per-component ones in [`findings/`](findings/). The code is the
apparatus; the findings are the result.

## Deploying to Vercel

**Set the project's Root Directory to `web`.** The Next.js app lives there, not at
the repo root — the root holds the design input, the findings and the reference
submodule. A deploy from the repo root will fail to find a Next app.

Nothing else needs configuring. The app has no environment variables and no
external services. Note that every route is **dynamically rendered**: the root
layout reads an `appearance-preference` cookie to server-render the colour scheme
without a flash, which opts the whole tree out of static prerendering. That trade
is measured and explained in `Findings.md` F-022.

The `reference-components` submodule is only needed to run the conformance suite.
It is not required to build.

## Layout

```
cursor-DESIGN.md          the design system this port had to swallow (read-only input)
Findings.md               the deliverable — every decision and problem surface
findings/<Name>.md        per-component detail, with the measurements
CLAUDE.md · AGENTS.md     the porting playbook the agents worked from
reference-components/     git submodule — pristine and disposable, never edited
web/                      the Next.js app
  src/styles/             design tokens → the library's --ui-* seam (the bridge)
  src/kernel/             shared primitives, ported once, 206 unit tests
  src/components/<Name>/  .css copied verbatim + the React port + its kitchensink
  src/app/                / and /kitchen-sink are the conformance targets
```

## Running it

```bash
cd web
npm install
npm run dev            # http://localhost:3000
```

## Verifying it

```bash
cd web
npm run verify         # build, lint, unit tests, appearance tokens, axe in both
                       # appearances, WCAG 1.4.10 reflow sweep 320–1280px
npm run conformance    # the reference e2e suite against a production build
```

Both matter, and the second one has two hard requirements learned the hard way:
**measure against a production build, sequentially.** `next dev` hydrates after
`page.goto()` resolves, which puts a post-hydration layout shift inside
Playwright's click gesture and fails four unrelated components with messages
accusing their own mechanisms — measured, `Findings.md` F-049. Concurrent runs
from the submodule's single Playwright install produce a bogus
`did not expect test.beforeEach()` error rather than a clean failure.

`npm run conformance` enforces both. It also refuses to start if another
Playwright process is running.

Current verified result: **365 passed / 7 failed**, fourteen of eighteen
components fully green, all seven failures classified as non-portable assertions
or spec defects rather than defects in the port. Read that as a lower bound on
failures rather than a conformance statement — F-040 explains why.
