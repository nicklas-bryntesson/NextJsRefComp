# Phase 1 — ThemeSwitch

Port status: **15 / 17** conformance tests green on `/`
(`ThemeSwitch.e2e.test.js`), and the site-level `tests/appearance.e2e.test.js`
back to **8 / 8**. Both suites run together, five consecutive runs, identical
result each time: **23 passed / 2 failed**. The two failures are the same
non-portable assertion (the persistence medium), analysed in F-NEW·5.

`npm run build`, `npm run lint`, `npm run test:unit` (206), `verify:appearance`
and `verify:axe` (both appearances) are clean. `verify:reflow` fails at 320 px
and 360 px on `/`, on `li.item` / `span.track` / `input.RangeField` /
`span.digits` — none of them ThemeSwitch; the isolated route
`/kitchen-sink/themeswitch` is **0 px overflow at all six widths**.
`git -C reference-components status --short` prints nothing.

Files created:

- `web/src/components/ThemeSwitch/ThemeSwitch.css` — verbatim copy, byte-identical
  (`shasum 60307225d22a33e35bcfa488af5fb4ac88c1be04` on both sides). This
  stylesheet contains no init-gate rules, so nothing was dropped.
- `web/src/components/ThemeSwitch/ThemeSwitch.tsx` — `'use client'`; also exports
  `ThemeSwitchReadout`, which reads the DOM end-state rather than the event
  (F-NEW·2b).
- `web/src/components/ThemeSwitch/ThemeSwitch.kitchensink.tsx` — an **async Server
  Component**: it reads the cookie and hands the preference down (F-NEW·4).
- `web/src/app/kitchen-sink/themeswitch/page.tsx`
- `web/tasks/probes/ts-conformance.cjs`, `ts-flash.cjs`, `ts-system-cost.cjs` —
  throwaway measurement harnesses.

The kernel (`web/src/kernel/theme-preference.ts`) and the server projection in
`app/layout.tsx` were already in place and were composed, not re-derived.

---

### F-NEW · A React component that *reconciles* the DOM to its own state is hostile to every other writer — including the reference's own suite

**Surface:** `ThemeSwitch.tsx`, and `tests/appearance.e2e.test.js` regressing from
8/8 to 6/8 the moment the component was mounted on `/`.

The natural port of the reference's `project()` is one effect keyed on the
resolved appearance: it covers attach, a user change, and an OS flip while the
preference is `system`, all in one place, and it makes the projected attribute a
pure derivation of the component's state. That is idiomatic React and it is
**wrong for this contract**.

`tests/appearance.e2e.test.js` writes `data-appearance` on `<html>` **directly**
and reads `getComputedStyle(':root').colorScheme` two frames later. With the
effect in place it got `light dark` — the value for an *absent* attribute.

**Evidence.** `Element.prototype.setAttribute` / `removeAttribute` were patched
from a Playwright init script to log every write to `data-appearance` on the root,
with a stack:

```
op=removeAttribute  t=395.5ms  at ThemeSwitch.useEffect → commitHookPassiveMountEffects
op=removeAttribute  t=400.0ms  at ThemeSwitch.useEffect → commitHookPassiveMountEffects
```

Three separate facts fall out of those two lines:

1. The removal is the **mount** effect, not the change handler. With
   `preference = 'system'` its correct action *for itself* is `removeAttribute` —
   and it happily removes a value it did not write.
2. It fires **twice**: StrictMode double-invokes passive effects in dev.
3. It lands at ~395 ms, i.e. **after** a test that writes the attribute
   immediately post-`goto`. So it is a race with hydration, and it failed
   intermittently — measured 1 FAIL in 3 runs of the suite's exact sequence:

```
run 0 light-> light  dark-> light dark  FAIL
run 1 light-> light  dark-> dark        PASS
run 2 light-> light  dark-> dark        PASS
```

The vanilla reference cannot hit this: projection only ever runs inside its
`change` handler, and there is no state to re-assert from. The React version
turns a *control* into an *authority that continuously enforces its own state* —
a strictly stronger claim than ADR-0021 makes, which is that the **DOM end-state**
is contractual and the attribute's only job is pinning `color-scheme`. Anything
else that writes it (the suite, a server render, a host's own theme tooling) gets
stomped, non-deterministically.

The related trap is worse and was checked explicitly: because the root layout
already renders `data-appearance` from the cookie, an effect that re-projects from
a *client-side default* on mount would stomp the server's correct value after
first paint — reintroducing exactly the flash the cookie structure exists to
prevent. (It did not happen here only because the component's own resolution
agreed with the server's; it would have with any other prop default.)

**Decision.** Project on **user action only**. The attribute write lives in
`onChange` and nowhere else; the effect keyed on `[preference, appearance]`
survives but does one thing — dispatch `theme-change`. An event is not an
authority claim, so an OS flip under `system` still announces without touching the
DOM. After the change: 5/5 PASS on the race sequence, and
`tests/appearance.e2e.test.js` back to 8/8 — five consecutive runs of both suites
together give the same 23 passed / 2 failed.

**Generalisation worth carrying to the rest of the port:** where a reference
component writes *outside its own subtree*, "reflect state into the DOM with an
effect" is the wrong translation. Inside its own subtree, React owning the DOM is
the whole point; outside it, the component is one writer among several and must
write only when something happened.

---

### F-NEW·2b · The `theme-change`-on-attach event is redundant in a server-rendered port, and it made the suite flaky

**Surface:** `ThemeSwitch.tsx`, `ThemeSwitch.e2e.test.js:162` (*theme-change
carries the resolved detail*).

Same shape as the finding above, one layer out. `ThemeSwitch.md` says the event
fires "On attach and on every change", so the first port dispatched from the same
effect on mount. The spec registers its listener **after** `page.goto` and then
clicks:

```js
const detail = page.evaluate(() => new Promise((resolve) => {
  document.querySelector(TS).addEventListener('theme-change', (e) => resolve(e.detail), { once: true })
}))
await page.locator(`${TS} label[for="ts-dark"]`).click()
expect(await detail).toEqual({ preference: 'dark', appearance: 'dark' })
```

In the reference the attach event has fired long before that listener exists — a
module runs during parsing. In React it fires at **hydration commit** (measured
~395 ms in dev), which can be *after* the listener registers, and `{ once: true }`
then resolves the promise with the pre-click state `{system, light}`. Measured: it
passed three consecutive full runs and failed the fourth. A flaky conformance test
is worse than a failing one, because the next porter will not believe it.

**Decision.** Do not dispatch on attach. The effect keeps a `useRef` of the last
announced `preference|appearance` pair, seeds it on the first commit (which also
absorbs StrictMode's second invocation) and dispatches only on a genuine
transition — a user change, or an OS flip while the preference is `system`. Five
consecutive runs of both suites since: no flake.

This is not merely a workaround. The attach event exists in the reference because
its client JS is what *computes* the appearance: until it runs, nothing in the
document knows the answer, so it has to announce. Here the answer is in the markup
before the first byte of CSS, so the initial read is
`document.documentElement.dataset.appearance` — synchronous, correct, and
available to a host's chart or map code at module scope with no listener at all.
`ThemeSwitchReadout` was rewritten to demonstrate exactly that: it observes the
root attribute (`MutationObserver` through `useSyncExternalStore`) plus the live
media query, derives `preference`/`appearance` through the kernel, and subscribes
to no event. It therefore cannot miss an announcement or drift from what the page
is showing.

**Behavioural difference a consumer must be told about:** a host that only
listens for `theme-change` will not receive an initial value from this port. That
is a documentable consequence of the end-state contract, not a defect — but
`ThemeSwitch.md`'s Events table should say that the attach dispatch exists to
cover client-side resolution and is unnecessary where the appearance is
server-rendered.

---

### F-NEW · The flash-free claim, measured: 183–185 frames, zero of them wrong

**Surface:** `web/tasks/probes/ts-flash.cjs`, production build (`next build` +
`next start`) of a full copy of the app, cookie `appearance-preference=dark`,
emulated OS preference **light** (so a flash would be maximally visible), a brand
new browser context per run (cold: empty HTTP cache), sampling the computed
`background-color` of `<body>` and the resolved `color-scheme` of `<html>` in a
`requestAnimationFrame` loop installed **before any document script**.

Reference colours on this page: light `rgb(247, 247, 244)`, dark `rgb(26, 26, 23)`.

| Run | frames sampled | frames with a painted body | distinct colours | wrong-appearance frames |
|---|---|---|---|---|
| 1 | 183 | 183 | `rgb(26, 26, 23)` only | **0** |
| 2 | 185 | 185 | `rgb(26, 26, 23)` only | **0** |
| 3 | 183 | 183 | `rgb(26, 26, 23)` only | **0** |

First sampled frame is at 17–35 ms and is already dark; `color-scheme` reads
`dark` and `data-appearance="dark"` in every single frame. There is no frame in
which the page is light. The claim holds *by construction*, not by being fast:
the attribute is in the server HTML before the first byte of CSS, and the client
never writes it again (F-NEW·3).

**The comparison.** Same instrumentation, same browser, three synthetic documents
served from `page.route` so the only variable is *where the appearance is
resolved* (stored = dark, OS = light, the module fetched over a 120 ms link):

| Structure | wrong-appearance frames | duration |
|---|---|---|
| cookie read on the server, attribute in the markup (ours) | **0** | — |
| `localStorage` + render-blocking inline `<head>` script (the reference's own recommendation) | **0** | — |
| `localStorage` read from a module (no head script) | **14–15** | **~110–117 ms** |

So the inline-script route is genuinely flash-free too — PORTING.md is right to
offer it as conformant. What it costs is a script whose only job is repairing the
first paint, a `try/catch` around blocked storage, and a state (`system`) it
cannot express. What the cookie route costs is dynamic rendering for the whole
app (already recorded as F-022 by the layout author). The third row is what a
naive port ships: a ~7-frame-at-60Hz white flash on every load for every user who
chose dark, which no assertion in either suite would catch.

**Decision:** keep the server structure. Positive finding: this is one of the few
places where Next's model is *strictly better* than the reference's — the
"required of the host" inline script in `ThemeSwitch.md` becomes unnecessary
rather than merely tidier.

---

### F-NEW · The `system` path really does cost nothing — zero attribute writes, in six scenarios

**Surface:** `web/tasks/probes/ts-system-cost.cjs`. A `MutationObserver` on
`data-appearance`, installed before any document script, counting every write from
navigation commit through hydration and an OS flip.

| Scenario | writes to `data-appearance` | settled |
|---|---|---|
| A. no cookie, OS light | **0** | `attr=null`, `color-scheme: light dark`, body `rgb(247,247,244)` |
| B. no cookie, OS light → dark | **0** | `attr=null`, body `rgb(26,26,23)` |
| C. cookie `dark`, OS light | **0** | `attr="dark"`, `color-scheme: dark` |
| D. cookie `dark`, OS light → dark | **0** | `attr="dark"` (choice held) |
| E. cookie `light`, OS dark | **0** | `attr="light"` (choice held) |
| F. cookie `Dark` (case) | **0** | `attr=null` — `resolvePreference` is case-sensitive, so it is `system` |
| sanity: clicking *Dark* | **2** (`null→dark`, then `dark→dark`) | proves the instrument is alive |

Two things to note, both of which cost an hour to learn:

- **An init script runs at document-start, where `document.documentElement` can be
  `null`.** `observe(document.documentElement, …)` throws there and leaves a
  *silently dead* instrument that reports zero for everything. The first version of
  this probe did exactly that and "proved" zero writes even for a user click.
  Observe `document` with `subtree: true`. Any probe that counts DOM writes needs
  the sanity row above or it is not evidence.
- The OS flip under `system` (row B) changes the *rendering* — body goes from
  `rgb(247,247,244)` to `rgb(26,26,23)` — with **no JavaScript involved at all**.
  `color-scheme: light dark` does it. That is ADR-0021's "doing less is the
  correctness argument", verified end to end.

The second write in the sanity row is `router.refresh()` re-rendering the root
layout and React writing the same value back — i.e. the server and the client
agreeing, visibly.

---

### F-NEW · Yes, the cookie write and the layout read can disagree — Next's client Router Cache is the mechanism

**Surface:** `ThemeSwitch.tsx` `onChange`, `app/layout.tsx`, measured on a
throwaway route with a `<Link>` (since removed).

The question was whether a client-written cookie and a server-read cookie can get
out of step. They can, and the failure is invisible until a navigation:

```
1 hard load /zz-nav-probe (no cookie)        attr=null   body light
2 soft nav  → /kitchen-sink/themeswitch      attr=null   body light
3 choose Dark                                attr=dark   body dark    cookie=dark
4 history back  → /zz-nav-probe              attr=dark   body dark
5 history forward → /kitchen-sink/themeswitch attr=null  body LIGHT   ← reverted
6 hard reload                                attr=dark   body dark    ← and back again
```

Step 5 is a *same-document* soft navigation (a marker on `window` survives all
five steps), and the mutation log shows `data-appearance: "dark" → null`. Next
served the RSC payload it had cached for that route **before** the cookie was
written; reconciling it removed the attribute the user had just chosen. The
cookie still says `dark`. A reload fixes it. From the user's seat: "dark mode
turns itself off when I navigate, and comes back if I refresh" — the worst class
of bug, because the persisted state and the rendered state disagree and neither is
obviously at fault.

The Next 16 docs name both the cache and the remedy —
`node_modules/next/dist/docs/01-app/04-glossary.md`: *"An in-memory cache in the
browser that stores RSC Payload for visited and prefetched routes… can be
invalidated with revalidateTag, revalidatePath, updateTag, `router.refresh`,
`cookies.set`, or `cookies.delete`"*.

**Decision.** `router.refresh()` after the cookie write. Verified: step 5 now
keeps `attr=dark` and the correct radio checked; focus stays on the segment the
user activated (`document.activeElement.id === 'ts-dark'`), which the `.md`'s
manual checklist requires. Measured cost, production build, isolated route:
**one** RSC request per toggle, **9,731 bytes**. On the aggregate page it will be
proportionally larger. That is the real price of "the cookie is server state": a
client that mutates it must invalidate the cache that was built from it.

**Two smaller ways to get the same disagreement, both measured or checked:**

- **Cookie path.** `document.cookie` defaults to the *directory of the current
  document*, not `/`. With `path=/kitchen-sink/themeswitch` the choice applies on
  the page it was made on and nowhere else, silently:
  `{"/kitchen-sink/themeswitch": ["dark", …], "/kitchen-sink": [null, "rgb(247,247,244)"]}`.
  With `path=/` both are `dark`. One missing attribute, zero errors, and a theme
  switch that "only works on one page".
- **A blocked write is silent.** `localStorage.setItem` *throws* when storage is
  unavailable — which is why the reference wraps it in `try/catch` and comments
  that the preference "just will not survive a reload". Assigning
  `document.cookie` throws nothing at all: it no-ops. So the cookie medium turns a
  catchable failure into an undetectable one — the page goes dark, the next load
  is light again, and no code path ever learns. **Not measured** (I have no
  reliable way to block cookies in Chromium from Playwright), so it stays an open
  item rather than a finding with evidence. If it matters, the check is to read
  `document.cookie` back after writing and dispatch something diagnostic when the
  value is absent.

**What cannot disagree, by construction:** the *checked radio*. The cookie is read
exactly once, on the server, in the same request that produced
`<html data-appearance>` — `ThemeSwitch.kitchensink.tsx` reads it and passes
`defaultPreference` down. Reading `document.cookie` again in the client component
would have been a second source of truth for one value; passing it down makes
agreement structural. Zero hydration warnings, verified with the cookie set to
`dark` and the OS emulated light (probe T18: no console errors or warnings at all).

---

### F-NEW · The suite hard-codes `localStorage` for a component whose contract says the medium is the host's choice

**Surface:** `ThemeSwitch.e2e.test.js:102` and `:113` — the only two failures.

`ThemeSwitch.md` (*Non-goals*): "**No opinion on persistence** — cookie,
`localStorage` or server session are all conformant". ADR-0021 §5: "the persistence
medium is explicitly the host's choice". ADR-0009 makes the DOM end-state the
contract. The spec then asserts the medium twice:

```js
expect(await page.evaluate((k) => localStorage.getItem(k), STORAGE_KEY)).toBe('dark')   // :107
```

and, in *a stored choice is restored before first paint, without the component*,
seeds `localStorage` in an init script and blocks `/main.js` — the reference's own
bundle, a URL that does not exist in any other stack.

Both fail for us, and both fail on the *medium*, never on the behaviour:

- `a choice survives a reload` — the four things it is nominally about all pass in
  our probe: cookie written (`dark`), attribute present after reload, matching
  segment re-checked, and the attribute present **in the server HTML before any
  JS** (`/<html[^>]*data-appearance="dark"/` matches `page.content()` after reload).
  Only `localStorage.getItem` is `null`.
- `a stored choice is restored before first paint, without the component` — the
  claim is that the restore is *not* the component's doing. Our structure proves a
  strictly stronger version of it: with **all** JavaScript aborted
  (`page.route('**/*.js', abort)`) and only a cookie, `data-appearance` is `dark`
  and `data-initialized` is absent. The spec's version cannot express that,
  because it can only seed `localStorage`, which no server can read.

**Decision.** Leave both failing, as F-011 established for a non-portable
assertion. A one-line `localStorage` mirror alongside the cookie would turn the
first one green, and I did not add it: it would create a second store that is
written and never read — a stale copy of the source of truth, kept only to satisfy
a test the component's own documentation contradicts. That is the same trade F-011
declined and it should be declined the same way. (If the project owner wants the
green, the line is
`localStorage.setItem(APPEARANCE_COOKIE, next)` in `onChange`, and it makes 16/17.)

**Upstream suggestion.** Assert the *claim*, not the medium:

```js
// survives a reload — medium-agnostic
await page.reload()
expect(await appearanceAttr(page)).toBe('dark')
await expect(page.locator(`${TS} input[value="dark"]`)).toBeChecked()

// restored before the component runs — let the host choose the seed
// e.g. a fixture hook: await seedPreference(page, 'dark')
```

Related, and the reason this spec is worth reading twice: `data-initialized` is
asserted **absent** at `:128` and appears nowhere else in the file. It is the one
component so far where the F-010 rule ("drop the gate CSS, keep emitting the
attribute") and the spec point in opposite directions. We keep emitting it — the
test that reads it is already failing on its first assertion, and every other
suite in the library treats the attribute as a target.

---

### F-NEW · The sibling chains survived JSX with no contortion at all

**Surface:** `ThemeSwitch.tsx`, and the reference markup diffed against our
server HTML.

Three constraints in the contract are pure DOM adjacency —
`<legend>` first child, `input + label`, `.indicator` last child of `.options` —
and all three are the kind of thing a component framework usually breaks, because
the natural way to render three of anything is to wrap each in a keyed element.

It cost one import. `<Fragment key={…}>` renders **no DOM node**, so a `.map()`
over the three segments emits `input, label, input, label, input, label` as direct
children of `.options`, and the indicator after them. The rendered markup is
identical to `ThemeSwitch.html` modulo React's attribute ordering
(`checked=""` lands after `name`, before `value`).

Measured, from the spec's own assertions:

- *the indicator lands on the selected segment* — off by **0.00 px** for all three
  values, and width identical. That single test is the sibling chain: it can only
  pass if `input:nth-of-type(N):checked ~ .indicator` resolves, which requires no
  wrapper anywhere between them.
- selection styling (`input:checked + label`) works, so `+` resolves too.
- the group is named by the clipped `<legend>` (`getByRole('group', { name:
  'Colour theme' })`).

The trap that remains is `key`. Put the `key` on a wrapper `<div>` — the reflex —
and both selectors die at once, with no error and no failing type: the indicator
sits at segment 1 forever and the selected icon never inverts. It would read as a
CSS problem. `key` belongs on the Fragment.

**Positive finding, and a small correction to the pessimism in F-008's neighbourhood:**
the "class-name-and-CSS model" survived contact with JSX here better than the
`data-*` model did anywhere else. Nothing about this port needed the stylesheet
touched: `40 × 40 px` segments (the ADR-0008 field height, still exact after the
design tokens moved from px to rem), `1.125rem` icons, and an **inset** focus ring
measuring **21.00:1** against the indicator fill (`outline-offset: -3px`), i.e.
the Picklist lesson holds unchanged in React.

---

### F-NEW · ADR-0021's "lock-in test" — we sidestep it rather than pass it, and that is the stronger result

**Surface:** ADR-0021 §2, `web/src/styles/ui-tokens.css`.

The ADR sets itself a falsifiable test: *"a Tailwind consumer maps
`[data-appearance="dark"]` to its `dark` variant in one line, or points Tailwind's
`darkMode` selector at it. If it takes more than one line, we leaked."*

We are a Tailwind v4 consumer and we wrote **zero** such lines. There is no
`@custom-variant dark`, no `darkMode` selector, and not a single `dark:` utility
anywhere in the app — grep confirms it. Every colour is a `light-dark()` pair in
`design-tokens.css`, passed through the `--ui-*` bridge, so both halves of every
token resolve from the *same* declaration and the active `color-scheme` picks.
The only appearance-aware CSS in the project is the two lines ADR-0021 itself
prescribes, and they live in the token layer where the ADR puts them:

```css
:root[data-appearance="light"] { color-scheme: light; }
:root[data-appearance="dark"]  { color-scheme: dark; }
```

So: **the test as written does not apply, and the property it was protecting
holds.** The library's footprint on us is one attribute name and one platform
declaration — which is exactly what §2 promised — but the bridging line the test
predicts we would need does not exist, because `light-dark()` makes a dark
*variant* unnecessary rather than cheap. Verified in Chromium by
`verify:appearance`: every `--ui-*` accent resolves to a different value in dark
than in light, the shadow ink differs, and `--ui-border` clears 3:1 as a control
edge in both (4.12:1 light, 4.81:1 dark).

**Where it would still cost more than one line:** a consumer whose dark values are
*not* expressible as a per-token pair — a different type scale, different spacing,
different component structure in dark — gets nothing from `light-dark()` and has
to write a real variant. And `light-dark()` support is the load-bearing
assumption: where it is unsupported the declaration is invalid at computed-value
time and every token silently falls back to its light literal, which the ADR
already documents as graceful degradation. That degradation is exactly the case
where a consumer *would* need the one-line mapping as a fallback, so the ADR's
test is not redundant — it is just measuring a path this port never takes.

**Suggested rewording, since the ADR asks to be told when the test is wrong:**
"a consumer must be able to bridge `[data-appearance]` to their own dark mechanism
in one line — or need no bridge at all, if their tokens are appearance-aware by
construction."

---

### F-NEW · Open question: this is the one component whose contract we could satisfy *without* JavaScript, and neither implementation does

**Surface:** `ThemeSwitch.tsx`, `app/layout.tsx`.

Both the reference and this port need JS for the control itself: the radio group
fires `change`, JS writes the store and projects. With JS off, the switch renders,
takes focus, moves selection — and does nothing.

Our structure is one step from removing that dependency, and the reference's
cannot be. The appearance is already restored from a cookie, server-side, with
zero client JS (measured: with `page.route('**/*.js', abort)` the attribute is
still `dark`). The missing half is writing the cookie without JS — a `<form
method="post">` wrapping the fieldset, a Server Action or route handler that sets
the cookie and redirects back, and the segments as submit buttons. That is a
genuinely no-JS ThemeSwitch: a full page load per change, which for a preference
control is an entirely reasonable trade, and it is what the "end-state is the
contract, not the mechanism" position (ADR-0009) invites.

I did not build it: it changes the markup (`<form>`, submit inputs) in ways the
conformance suite's radio assertions would have to be re-read against, and it is a
design decision, not a port. Recording it because it is the sharpest example so
far of the server framework being able to satisfy a contract *better* than the
reference implementation can — the same shape as F-015, one level up.

**Open question for the project owner:** is a progressive-enhancement ThemeSwitch
in scope for Phase B? If it is, it wants a line in `ThemeSwitch.md` too — the
`.md` currently frames persistence as free choice but assumes JS everywhere.
