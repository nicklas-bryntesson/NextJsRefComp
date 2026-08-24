# Findings

A running log of decisions taken and problem surfaces found while porting
[`reference-components`](https://github.com/nicklas-bryntesson/reference-components)
into Next.js + Tailwind under the `cursor-DESIGN.md` design system.

Each entry is `F-nnn`, states the surface it was found on, and ends with either a
**Decision** (settled, with the reasoning) or an **Open question** (needs a call
from the project owner). Entries are append-only; a reversal gets a new entry
that supersedes the old one.

---

## Phase 0 — Foundation

### F-000 · Project layout: the app sits in `web/`, not the repo root

**Surface:** scaffolding.

`create-next-app` refuses to scaffold into a directory whose basename contains
capital letters (`NextJsRefComp`) because npm package names can't. Scaffolding
into `web/` and relocating the contents to the root was blocked by the sandbox,
so the app stayed in `web/`.

**Decision:** keep it. The layout is arguably better than root-level anyway —
the repo root now holds the three things that are *about* the port
(`cursor-DESIGN.md`, `Findings.md`, `reference-components/`) and `web/` holds the
thing being ported into. PORTING.md's only structural requirement is that the
shell's cwd is never inside the submodule, which this satisfies.

---

### F-001 · Cursor Orange cannot carry white text at AA — the signature CTA fails as specified

**Surface:** `cursor-DESIGN.md` → `--ui-primary`.

`button-primary` specifies background `#f54e00` with `#ffffff` text at
`typography.button` — 14px / weight 500. Measured:

| Pair | Ratio | AA (4.5 normal text) |
|---|---|---|
| `#ffffff` on `#f54e00` | **3.52** | ✗ |
| `#f54e00` as text on `#f7f7f4` | **3.28** | ✗ |
| `#ffffff` on `#d04200` (doc's press state) | **4.71** | ✓ |

14px/500 is not WCAG "large text" (that needs 18.66px bold or 24px), so 3:1 does
not apply — 4.5 does. The design doc's primary CTA is not AA-compliant as
written, and the library's exit criteria demand *zero* axe WCAG 2 AA violations.
Something has to give, and it cannot be the exit criterion.

**Decision:** promote the doc's own press colour `#d04200` to the resting fill
for `--ui-primary`. It is already in the palette, it is the same hue family, and
it clears AA at 4.71. `--color-primary` (`#f54e00`) stays in the theme for
decorative use (wordmark, non-text accents) where 3:1 is the applicable floor.

**Open question:** this darkens the brand's most recognisable colour by one stop
on every CTA. The alternatives are ink-on-orange text (13.1:1, but loses the
white-on-orange look entirely) or raising the button label to 18.66px bold
(breaks `typography.button` and the "never bold" rule). Confirm the choice.

---

### F-002 · The library is themed through *system colours*; our design system is light-only

**Surface:** `PORTING.md` → *Appearance*, `ui-tokens.css`.

The library follows light/dark through `color-scheme: light dark` plus
`Canvas`/`CanvasText`, so the whole set reacts to the OS for free.
PORTING.md calls that line "the single most expensive line to lose in the whole
port" — losing it silently renders light for a dark-OS user.

`cursor-DESIGN.md` is a warm-cream light-only system. It has no dark palette,
and inventing one is unauthorised design work.

We are the first row of PORTING.md's own decision table — *one colour scheme →
map `--ui-*` to your colours and move on*. But there is a trap in taking that
row: pinning `color-scheme: light` is **not sufficient on its own**. Any
`--ui-*` token left to fall through to its `Canvas`/`CanvasText` default would
still resolve against the pinned scheme correctly — but any token we *forgot*
would inherit a neutral grey that has nothing to do with the design.

**Decision:** pin `color-scheme: light` **and** answer every single `--ui-*`
token with an explicit literal from our palette. `ui-tokens.css` is exhaustive
on purpose; no token is allowed to fall through. Because nothing has to be
resolved before first paint, there is no FOUC to prevent and no head script —
the entire *Preventing FOUC* section of PORTING.md becomes inapplicable, which is
the payoff for being light-only.

**Consequence — two things are now out of scope:** the `ThemeSwitch` component
and `reference-components/tests/appearance.e2e.test.js`. Both exist to exercise
an appearance override we deliberately do not have. They are deferred, not
failed. Re-scoping them is a cookie read plus one `data-appearance` attribute on
`<html>` — but it needs a dark palette first.

**Open question:** is light-only the intended end state, or should we derive a
dark counterpart so the appearance machinery can be press-tested too? That
machinery is one of the more interesting parts of the library and we are
currently skipping it.

---

### F-003 · One `--ui-border` token serves two roles with different WCAG obligations

**Surface:** `ui-tokens.css`, WCAG 1.4.11 Non-text Contrast.

The library ships a single `--ui-border` described as "borders + dividers/
hairlines". Those are two jobs:

- a **decorative divider** has no contrast floor;
- the **boundary that identifies a form control** needs 3:1 against its
  surroundings.

The design system's depth model is hairline-only — no shadows — and its
hairlines are deliberately delicate:

| Token | vs canvas `#f7f7f4` | vs card `#ffffff` | 3:1? |
|---|---|---|---|
| `hairline` `#e6e5e0` | 1.18 | 1.27 | ✗ |
| `hairline-strong` `#cfcdc4` | 1.48 | 1.59 | ✗ |
| `muted` `#807d72` | **3.84** | **4.12** | ✓ |

Wired naively, every ported field would have an invisible border and fail 1.4.11.
"Hairline-only depth" is an editorial marketing-site aesthetic; it does not
survive contact with form controls, where the border *is* the affordance.

**Decision:** `--ui-border` gets `--color-muted` (`#807d72`). Our own dividers
keep the delicate `hairline` via Tailwind utilities — the split is real, we just
express it on our side of the seam rather than the library's.

**Upstream suggestion:** the seam would be more honest as two tokens —
`--ui-border` (decorative) and something like `--ui-control-border` (interactive,
3:1 floor). A consumer currently has to notice the conflation to avoid shipping
an accessibility bug, and PORTING.md's own advice ("if a role is missing, add it
to `ui-tokens.css`") isn't available to a consumer who keeps the submodule
pristine.

---

### F-004 · The design's `muted` fails AA as placeholder text

**Surface:** `ui-tokens.css` → `--ui-muted-foreground`.

`muted` `#807d72` measures 4.12:1 on a white field — under AA. The library's own
default is a `color-mix` sized specifically to clear 4.5, with a comment
recording that the ratio was picked against the tightest surface the token lands
on rather than against `Canvas`. That intent is worth preserving.

**Decision:** map `--ui-muted-foreground` to `--color-body` (`#5a5852`, 7.11:1).
`muted` keeps its documented role as sub-title colour in our own utilities, where
the text is larger and the floor is lower.

Related: `muted-soft` `#a09c92` measures 2.74:1 and is documented for disabled
text. That is acceptable — WCAG 1.4.3 exempts inactive components — but it is
only acceptable *for that role*, so it must not leak into hint or helper text.

---

### F-005 · The library needs four state colours; the design system defines two

**Surface:** `ui-tokens.css` → `--ui-warning`, `--ui-info`.

`--ui-destructive` / `--ui-warning` / `--ui-success` / `--ui-info` are all
consumed (field-invalid and the `Notice` variants). `cursor-DESIGN.md` supplies
only `semantic-error` and `semantic-success` — and `semantic-success` `#1f8a65`
measures 4.30:1, itself just under AA.

**Decision (provisional):** `success` nudged to `#1e8662` (4.52:1). `warning`
and `info` derived by darkening the nearest timeline pastel to AA —
`timeline-done` → `#9d6d29` (4.51:1) and `timeline-read` → `#66788f` (4.52:1).

**Open question — this brushes against an explicit "Don't".** The design doc
says timeline pastels are for in-product agent visualisations only and must never
become system action colours, which is precisely what deriving from them does.
The honest position is that the palette has a genuine gap: a design system
consumed by real form components needs a warning and an informational hue, and
this one has neither. Two proper hues are wanted here rather than my derivation.

---

### F-006 · No drop shadows, but a popover still has to detach

**Surface:** `ui-tokens.css` → `--ui-shadow`.

The design forbids drop shadows; depth is hairlines plus ink-on-cream. But the
popup family reads `--ui-shadow` to separate a floating panel from the content
behind it, and white-on-cream is 1.18:1 — not separation. `ToggleTip.md` also
records that `box-shadow: var(--ui-shadow)` is the one property in that component
with **no literal fallback**: without the token there is simply no shadow.

**Decision:** `--ui-shadow: 0 0 0 1px var(--color-hairline-strong)` — the same
CSS property, used as a 1px ring rather than a shadow. It honours the no-shadow
rule literally and by intent (hairlines carry depth) while keeping the popover
delineated.

---

### F-007 · Only two of the library's dozen site tokens are actually consumed

**Surface:** `site-tokens.css`.

The library's `01-Setup/tokens.css` ships a full layout scaffolding —
`--SITE--PADDING--*`, `--MAX--WIDTH--*`, `--GRID--*`, breakpoints. Grepping the
components and kernel for actual consumption returns exactly two:
`--SITE--PADDING` (popover viewport-edge clearance, read by the five popup fields
and `ToggleTip`) and `--MAX--WIDTH--SITE` (read by `DateField` /
`DateTimeField`).

**Decision:** define only those two, mapped onto our spacing scale and content
cap. Importing the library's `tokens.css` wholesale would drag its demo grid
system into ours to satisfy nothing.

Worth noting the naming asymmetry the library's own ADR-0017 already flags as
untidied: `--SITE--PADDING` and `--MAX--WIDTH--SITE` put the qualifier on
opposite ends. Harmless, but it defeats a prefix grep.

---

### F-008 · `data-*` is billed as the public API — but the conformance suite hard-codes ~30 class names

**Surface:** the e2e suite. **This is the central tension for a Tailwind port.**

ADR-0002 states `data-*` attributes are the component's public API, and ADR-0019
presents a "swap map" telling consumers that `lowercase-kebab` element classes are
"our internal element styling — replace with your utilities on the same DOM".
Read together, those promise that class names are ours to discard.

They are not. PORTING.md names the e2e + axe suite as *the portable contract*, and
that suite selects on element class names throughout. Grepping every
`*.e2e.test.js` for class selectors:

| Class | Hits | Class | Hits |
|---|---|---|---|
| `.trigger` | 142 | `.calendar-grid` | 14 |
| `.popup` | 118 | `.option` | 13 |
| `.Wheel` | 38 | `.item-remove` | 9 |
| `.Picklist` | 30 | `.footer-now` | 8 |
| `.input` | 28 | `.item` · `.ink` | 8 |
| `.segment` | 25 | `.lower` · `.upper` | 7 |
| `.RangeField` | 25 | `.suffix` · `.section` | 6 |
| `.month-year-trigger` | 23 | `.stops` · `.notice-region` | 5 |
| `.track` · `.native` | 16 | `.item-error` | 5 |

…plus `.body`, `.grid`, `.Notice`, `.RangeScale`, `.ChoiceGroup`,
`.calendar-footer-now`, `.kitchensink-section` and others. Highest density:
`FileUpload` (53 class selectors), `RangeScale` (33), `Picklist` (24).

So the real contract is wider than the documented one: **`data-*` *plus* the
element class names**. Any port that takes the swap map at face value and
replaces `.popup` with `flex rounded-lg bg-white …` breaks the suite instantly —
and breaks it on *missing elements*, which reads as a structural defect rather
than a renaming.

**Decision:** treat the element class names as **structural hooks that must be
preserved verbatim**, and layer Tailwind alongside rather than instead:

```tsx
<div className="popup rounded-lg border border-hairline bg-surface-card">
```

The semantic class is the test/CSS contract; the utilities are the design. This
is the standard "semantic hook + utilities" Tailwind pattern, and it costs
nothing — but it must be a deliberate rule from the first component, because
retrofitting it after a suite has gone red is guesswork about which of 30 names
were load-bearing.

**Upstream suggestion:** if class names are contractual, ADR-0019's swap map
should say so — or the suite should select on `data-part="popup"` and leave class
names genuinely free. The current docs actively mislead a consumer into a broken
port. This is the single most valuable finding of the port so far.

---

### F-009 · Tailwind's model and "copy the `.css` verbatim" are directly opposed

**Surface:** `PORTING.md` → step 2 and *Restyle to your own convention*.

PORTING.md is emphatic: copy each component's `.css` **verbatim**, get the suite
green, and only then translate to your own convention — "doing both at once
leaves you two variables and nothing to bisect". It also warns the suite cannot
catch a botched translation, since it asserts behaviour, not appearance.

Tailwind's whole proposition is the opposite: no component stylesheet at all,
utilities in markup. A Tailwind-native port skips straight to the end state the
guide tells you to reach separately — and gives up the bisectable baseline.

**Decision:** follow PORTING.md, in two explicit phases per component.

1. **Phase A — verbatim.** Copy `<Name>.css` unchanged into
   `web/src/components/<Name>/`, import it, port the behaviour to React, get the
   suite green. Tailwind is not involved. The only edits permitted to the copied
   CSS are the ones PORTING.md itself sanctions: dropping the runtime-only
   init-gate rules (see F-010).
2. **Phase B — translate.** Move design values to Tailwind utilities on the same
   DOM, keeping every structural class name (F-008). Guard it with the cheap net
   PORTING.md suggests — snapshot `getComputedStyle` for the popup, footer,
   segments and trigger with the popup **open**, translate, snapshot again, diff.

Phase B is where the actual research question lives, so it gets its own findings
once a component has reached it. Recorded now because the temptation to collapse
the phases is strongest at the start, and collapsing them would forfeit the
comparison this whole POC exists to make.

---

### F-010 · The init gate must be dropped, but `data-initialized` must be kept

**Surface:** `PORTING.md` → *Runtime-only CSS*, `e2e-helpers/target.js`.

The reference hides unstyled content until its vanilla JS boots:
`.DateField { overflow: hidden }`, flipped to `visible` by
`[data-initialized="true"]`. PORTING.md says to drop those rules — a framework
rendering formed markup never needs the gate, and leaving it in *clips the popup*.

But the attribute is not only a gate. `target.js` resolves the `FileUpload` test
target as `[data-component="FileUpload"][data-initialized]`, and PORTING.md's
own *What the tests expect* section says tests locate components by
`data-id` / `data-initialized="true"` state attributes.

**Decision:** drop the init-gated **CSS rules**, keep emitting the
**attribute**. In React that means rendering `data-initialized="true"` from the
client component — which is honest, since by the time it hydrates it *is*
initialised. Deleting the attribute along with the CSS is the trap here, and it
would fail the suite on a missing element.

---

## Phase 1 — AffixField

**Result: 15 / 16 conformance tests green on the first run**, including both axe
audits (zero WCAG 2 AA violations) and the geometry test. The one failure is
F-011 below, and it is not a defect in the port.

---

### F-011 · A byte-identity assertion on `style` is unreachable from React

**Surface:** `AffixField.e2e.test.js` → *the fully-authored variant is untouched*.

The assertion:

```js
await expect(root).toHaveAttribute('style', '--_af-prefix-chars: 1; --_af-suffix-chars: 3')
```

React normalises the `style` prop when it serialises it, and it does so
unconditionally. Probed directly (`web/tasks/probes/probe-style.mjs`):

| Input | Rendered |
|---|---|
| `{'--_af-prefix-chars': 1}` | `--_af-prefix-chars:1` |
| `{'--_af-prefix-chars': '1'}` | `--_af-prefix-chars:1` |
| `{'--_af-prefix-chars': ' 1'}` | `--_af-prefix-chars:1` |

There is no spacing variant React will emit, and `style` cannot be passed as a
raw string — React throws (*"The `style` prop expects a mapping from style
properties to values, not a string"*). So the assertion is **structurally
unsatisfiable** by any idiomatic React implementation.

More interesting than the incompatibility is *what the assertion is for*. Its
own comment says: "any JS write would re-serialize it (spacing/semicolon
normalization)" — it is a fingerprint check proving the reference's client JS did
not touch an authored value. That is a **mechanism** test, sitting in a suite
whose header states, in the file's first paragraph, that "the suite asserts the
END-STATE, not the mechanism" and that "a server-rendered implementation with
zero client JS that renders the same end-state passes this suite unchanged".

It does not. This one assertion is the exception to the file's own promise, and
it fails precisely the implementation the contract holds up as the ideal.

Note the end-state it is *nominally* about — that the counts are `1` and `3` — is
already asserted independently, and passes.

**Decision:** leave it failing and treat it as a known non-portable assertion
rather than bend the component around it. The workaround exists — render that one
variant's root through `dangerouslySetInnerHTML` to control the raw attribute
string — but it would replace a real React component with a hand-written HTML
blob purely to satisfy a whitespace comparison, and would misrepresent the port.

**Upstream suggestion:** assert the mechanism through the CSSOM rather than the
attribute text, e.g.

```js
expect(await root.evaluate(el => el.style.getPropertyValue('--_af-prefix-chars').trim())).toBe('1')
```

That still catches a JS overwrite of an authored count (the value would differ if
gap-fill had won) without depending on the host framework's whitespace habits.

---

### F-012 · A zero-JS port collapses the `bare` / `authored` distinction

**Surface:** the `affixfield-bare` and `affixfield-authored` variants.

The reference ships these as two variants to demonstrate two *paths* to one DOM:
`bare` authors minimal markup and lets JS gap-fill; `authored` renders the full
end-state server-side and proves JS touches nothing.

In a Server Component both variants are rendered from the same function, so the
distinction disappears — they produce identical DOM, and the test *"JS gap-fills
the presence attributes on the bare variant"* passes without any gap-filling
having occurred.

That is not a problem — the end state is what is contractual, and both are
correct. It is worth recording because **the suite can no longer tell the two
apart**, so it silently stops covering something it was written to cover. A port
that later introduces client JS would not be warned if that JS started
overwriting authored values.

---

### F-013 · The `1.125ch` calibration survived a typeface change

**Surface:** *input value area clears both affixes (bounding boxes)* — passed.

`--_af-ch-unit: 1.125ch` is documented as "the production-proven default from
SVL — calibrate it against your typeface like any other design token". We
render in **Inter**, not the reference's typeface, and the geometry test — which
measures real rendered boxes and fails if the reserved padding falls short of the
rendered affix — passes untouched.

So the calibration factor generalises across at least two proportional sans
faces. Recorded as a positive finding: the character-count layout model is more
portable than its own documentation claims, and no calibration work was needed.
Worth re-checking if the design ever adopts CursorGothic proper, which is the
licensed face Inter is standing in for.

---

### F-014 · The suite depends on a class name that belongs to the reference *demo page*

**Surface:** `AffixField.e2e.test.js` → *all kitchensink states pass axe*.

```js
await checkA11y(page, '.kitchensink-section:has([data-id="affixfield-live"])', …)
```

`.kitchensink-section` is not part of any component contract — it is a wrapper
class from the reference's own demo page. Nothing in PORTING.md or AGENTS.md
mentions owing it, and the component `.md` has no reason to. A port discovers it
by reading the spec source, or by watching the test fail on a null scope.

This is F-008 widening: the real contract is `data-*` **plus** element class
names **plus** a demo-page wrapper class. Our kitchen-sink page renders
`.kitchensink-section` per component section for exactly this reason.

**Upstream suggestion:** scope the full-section axe run to something the porter
already owes — e.g. a `[data-kitchensink-section]` attribute documented in
PORTING.md, or derive the scope from the component root's closest section.

---

### F-015 · React's strongest showing: the contract's ideal implementation is idiomatic here

**Surface:** `AffixField.tsx`.

Worth recording as a win rather than a problem. `AffixField.md` describes a
zero-client-JS, server-rendered implementation as the *more correct* placement of
the logic, and frames it as an aspiration for server stacks ("an ASP.NET Tag
Helper can render the identical end-state with no client JS at all").

In Next.js App Router that is not an aspiration, it is the default. `AffixField`
is a plain Server Component with no `'use client'`, and the five `attach()` steps
become render-time expressions:

| Reference `attach()` step | React |
|---|---|
| set `data-has-prefix` / `-suffix` | `data-has-prefix={hasPrefix ? "true" : undefined}` |
| set `--_af-*-chars` from `textContent.trim().length` | `prefix.trim().length` in the style object |
| map `data-input-characters` → `--_af-input-chars` | one prop |
| wire affix ids + `aria-describedby` | derived, ordered array join |
| set `data-initialized="true"` | rendered literally |

Zero bytes of JavaScript ship for this component. The reference's "authored
values always win" gap-fill logic — the guard clauses that make `attach()`
idempotent and non-destructive — disappears entirely, because there is nothing to
gap-fill when the render *is* the authoring step.

`undefined` doing the work of "absent" is the detail that makes this clean: the
library's boolean convention is `="true"` or *no attribute*, and that is exactly
React's conditional-attribute semantics. The two conventions happen to line up
perfectly.

---

## Phase 2 — Fan-out, and the appearance seam

Wave 1 ported six components in parallel via subagents, each working from
`CLAUDE.md` with no shared context. Results, all re-verified after the
project-wide palette change below:

| Component | Conformance | Notes |
|---|---|---|
| AffixField | 15 / 16 | the one failure is F-011, non-portable |
| ChoiceField | 8 / 8 | Server Component, zero client JS |
| Notice | 7 / 7 | Server Component, zero client JS |
| ScrollArea | 3 / 3 | `'use client'` — first component that *measures* |
| MotionRegion | 5 / 5 | + 15 kernel unit tests (`motion-policy`) |
| ToggleTip | 11 / 11 | + 11 kernel unit tests (`popup-position`) |

Plus 35 kernel unit tests green across `motion-policy`, `popup-position` and
`theme-preference`. Per-component detail lives in `findings/<Name>.md`; what
follows are the project-level findings.

---

### F-017 · A component-scoped axe pass is not evidence the page is accessible

**Surface:** `kitchensink-ui.tsx`, found by the ChoiceField and Notice ports.

Our shared kitchensink chrome shipped **20+ colour-contrast failures** and every
suite up to that point had missed them, because they all scope their audit to the
component root (`scopedCheckA11y`). The ChoiceField spec runs an *unscoped*
`checkA11y(page, '#ChoiceField')` over its whole section and found them
immediately:

| Element | Token | Ratio | Floor |
|---|---|---|---|
| `Block` heading | `text-muted` `#807d72` on `#f7f7f4` | 3.84 | 4.5 |
| `Cell` caption | `text-muted-soft` `#a09c92` on `#ffffff` | 2.73 | 4.5 |

The second is the sharper lesson: `design-tokens.css` **already carried a comment
on that token** saying "disabled text only (WCAG 1.4.3 inactive exception)", and
it still ended up on a live state caption — which gets no exception. F-004 warned
that `muted-soft` "must not leak into hint or helper text"; it leaked into the
chrome instead, in the same session that wrote the warning.

**Decision:** both roles now use `text-body` (~6.3:1). More durably: a
component-scoped green is a statement about one component, and the page needs its
own audit. `web/tasks/probes/axe-dark.cjs` now runs axe over the entire
kitchensink in both appearances, and it is the check that has to be green before
anything is called done.

---

### F-018 · Some suites scope axe to the id of the reference *demo section*

**Surface:** `ChoiceField.e2e.test.js`, `Notice.e2e.test.js`, `Picklist`.

Several specs run `checkA11y(page, '#<Component>')` — `#ChoiceField`, `#Notice`,
`#Picklist`. That id belongs to the reference's own demo page markup. It is in no
component contract, in no ADR, and nowhere in PORTING.md. A port discovers it by
watching axe run against a null scope, which does not fail loudly — it audits
nothing and reports success.

This is F-008 and F-014 widening again: the real contract is `data-*`, **plus**
element class names, **plus** `.kitchensink-section`, **plus** a per-component
section id.

**Decision:** `<Section>` takes an optional `anchorId` that puts the id on the
`.kitchensink-section` element itself. That placement matters — the first port to
hit this wrapped its own div *outside* `.kitchensink-section`, so the audit
covered a different subtree than the reference's and passed for the wrong reason.

**Upstream suggestion:** an unscoped `checkA11y` that silently audits nothing when
its scope is missing is a worse failure mode than a hard error. Asserting the
scope exists first would turn every one of these into a clear message.

---

### F-019 · Nine specs hard-code `page.goto('/')`, so `TARGET_PATH` is inert

**Surface:** the e2e suite. **This is the most expensive undocumented gap so far.**

PORTING.md documents `TARGET_PATH` as the seam for pointing the suite at your own
page: *"`TARGET_PATH` — the page the tests navigate to (default `/`). Set it when
your demo lives elsewhere."* And `e2e-helpers/target.js` exposes `targetPath()`
for exactly that.

Nine of the eighteen component specs never call it. They write
`await page.goto('/')` directly:

> ChoiceField · ChoiceGroup · Notice · Picklist · RangeField · RangeGroup ·
> RangeScale · ThemeSwitch · ToggleTip

Playwright resolves a bare `'/'` against the **origin** of `baseURL`, so
`TARGET_PATH` is silently discarded and the suite lands on whatever the host
serves at the site root. Every assertion then fails on a missing element — which
reads as a catastrophic structural defect in the port, not as a routing mismatch.
One agent lost meaningful time building an HTTP proxy to rewrite `/` before the
cause was identified.

The reference repo cannot notice this, because its own `/` *is* the kitchensink.

**Decision:** serve the aggregate kitchensink at `/` as well as `/kitchen-sink`.
That is the same shape as the reference rather than a workaround, and it satisfies
both spec styles at once — the nine that hard-code `/` find their component, and
the nine that honour `targetPath()` can still be pointed at an isolated route,
which is faster and makes a failure unambiguous.

A proxy is the wrong fix twice over: it also breaks App Router hydration, which a
second agent independently measured.

**Upstream suggestion:** replace `goto('/')` with `goto(targetPath())` in those
nine files. It is a one-line change per spec and it makes the documented seam true.

---

### F-020 · The dark palette is derived design work, and it was the right call

**Surface:** `design-tokens.css`, `ui-tokens.css`. **Supersedes F-002.**

F-002 took PORTING.md's first decision-table row — one colour scheme, map
`--ui-*`, move on — and pinned `color-scheme: light`. That forfeited the
`ThemeSwitch` component and `tests/appearance.e2e.test.js`, i.e. one of the more
interesting seams in the library, on the grounds that `cursor-DESIGN.md` ships no
dark palette and inventing one is unauthorised.

Reversed. The design doc is explicit that design belongs to the consuming
project, and ADR-0021 is explicit that *values* are never the library's business
("What `dark` actually looks like — ❌ never; defaults only"). Supplying the dark
half is therefore the port's job, not a liberty it takes.

Two principles held the derivation together:

- **The system is warm.** The dark ground is a warm near-black `#1a1a17`
  mirroring the warm cream, not a neutral or cool grey — a cool dark ground reads
  as a different brand.
- **Lightness inverts, hue does not.** Cursor Orange lifts to `#ff7a40` on dark
  and its foreground flips to the dark canvas, so the CTA stays one colour family
  across both appearances rather than becoming a second accent.

Every pair the `--ui-*` seam forms was measured against its WCAG floor in both
appearances before being committed (`web/tasks/probes/dark-palette.mjs`), then
re-measured in Chromium (`verify-appearance.cjs`) because `light-dark()` fails
*silently* — an unsupported or malformed declaration is invalid at computed-value
time, the custom property goes unset, and `var(--ui-x, #literal)` quietly falls
back to the light literal. Browser-verified results:

| Check | Light | Dark |
|---|---|---|
| body text on page | 6.63:1 | 8.68:1 |
| `--ui-primary-foreground` on the primary fill | 5.01:1 | 6.74:1 |
| `--ui-border` as a control edge (1.4.11, 3:1) | 4.12:1 | 4.81:1 |
| all nine probed `--ui-*` differ between appearances | ✓ | ✓ |
| shadow ink differs | ✓ | ✓ |
| axe over the whole kitchensink | 0 violations | 0 violations |

Because every token is a `light-dark()` pair, the whole design system follows
`color-scheme` with **no `dark:` variants and no duplicate blocks** — Tailwind
utilities built from the tokens (`bg-canvas`, `text-ink`) are appearance-reactive
for free. That is a genuinely better answer than the `darkMode` selector mapping
ADR-0021 anticipates for Tailwind consumers, and it is worth reporting upstream as
a third conformant route alongside the ADR's Route A and Route B.

The one caveat that bit immediately: pinning or switching the scheme is not
enough on its own. **Every** `--ui-*` must carry an explicit value, because a
token left to fall through to `Canvas`/`CanvasText` follows the OS rather than the
projected attribute. `ui-tokens.css` is exhaustive for that reason.

---

### F-021 · `warning` and `info` are additions to the design system, not derivations

**Surface:** `design-tokens.css`. **Supersedes the provisional half of F-005.**

F-005 derived `--ui-warning` and `--ui-info` by darkening the nearest timeline
pastel to AA, and flagged that this brushes against an explicit "Don't" —
`cursor-DESIGN.md` reserves the timeline pastels for in-product agent
visualisations and says they must never become system action colours.

Resolved by respecting the Don't. The palette has a genuine gap: a design system
consumed by real form components needs four state roles and this one defines two.
So `warning` and `info` are now **additions** rather than borrowings:

- **`warning`** — a warm amber (`#9d6d29` / `#e0a94e`). A warm system should not
  reach for a cool caution colour, and amber is the near-universal convention.
- **`info`** — a cool-neutral slate (`#5b6b7f` / `#9db3cc`). Informational, and
  deliberately not a second brand hue.

`success` also moved: the doc's `#1f8a65` measures 4.30:1 on white, just under AA,
so it is `#1e8662` (4.52:1) in light and `#5fc79b` in dark.

An unexpected corroboration came out of the Notice port. Because Notice derives
its background from its accent (`color-mix(accent 8%, Canvas)`) rather than
pairing hand-picked values, **every variant's icon clears WCAG 1.4.11
automatically** — error 4.48:1, warning 4.09, success 4.09, info 4.11, neutral
17.55 — even though these four values were chosen for text on a white card with
no thought given to Notice at all. The contrast relationship there is structural,
not per-variant designer diligence, which is a strong argument for the library's
single-accent-token variant API.

---

### F-022 · The flash-free appearance structure costs static rendering, app-wide

**Surface:** `web/src/app/layout.tsx`. **The sharpest Next.js-specific finding.**

PORTING.md ranks two conformant ways to restore an explicit appearance without a
flash, and is unambiguous about the preference:

> **Server-rendered (preferred — no client JS, no flash by construction).** Read
> your cookie during render and emit the attribute in the markup. […] The
> preference has to live somewhere the *server* can read, so use a **cookie, not
> `localStorage`**.

Implemented exactly that: the root layout is an async Server Component that reads
the `appearance-preference` cookie and runs it through the ported
`theme-preference` kernel. Verified by curl, before any JavaScript exists:

```
no cookie          → <html lang="en" class="…">                          (system)
cookie=dark        → <html lang="en" data-appearance="dark" class="…">
cookie=light       → <html lang="en" data-appearance="light" class="…">
cookie=Dark        → <html lang="en" class="…">        (case-sensitive → system)
```

**The cost, measured.** Reading a cookie in the **root** layout makes every route
in the application dynamically rendered — Next.js cannot prerender a tree whose
`<html>` element depends on a request header. The build output moved wholesale:

```
before:  ○ /  ○ /kitchen-sink  ○ /kitchen-sink/affixfield  …   (Static)
after:   ƒ /  ƒ /kitchen-sink  ƒ /kitchen-sink/affixfield  …   (Dynamic)
```

Nine routes, all of them, including pages with no appearance-dependent content.
That is the real trade PORTING.md's ranking does not price: in Next.js the
*preferred* structure is bought with the entire app's static rendering, and the
structure it ranks second — an inline `<head>` script reading `localStorage` —
keeps every page static at the cost of reintroducing a render-blocking script
whose only job is repairing the first paint.

**Decision:** keep the cookie. This is a POC whose purpose is to press-test the
contract, and the contract's preferred structure is the one worth exercising. The
kernel makes the choice cheap to reverse — `resolvePreference` is already called
from both a server and a client runtime, so switching to the script route means
changing where it is called, not what it decides.

**Worth knowing if this were production:** the middle path is to stop projecting
from the root layout and instead let a route segment or a client boundary own it,
keeping static rendering for everything that does not need the attribute. That
trades one flash-free guarantee for nine static routes, and which way it should go
depends entirely on how much of the app is actually appearance-sensitive.

**Upstream suggestion:** PORTING.md's two structures are presented as a clean
preference ordering. For a framework with static prerendering they are a genuine
trade-off, and naming that would help the next porter decide rather than assume.

---

### F-023 · A compliant design system disables the text-spacing suite's own canary

**Surface:** `tests/text-spacing.e2e.test.js`. Site-level, WCAG 1.4.12.

The three substantive assertions **pass**: no text is clipped by the overrides,
the page gains no horizontal scroll, and interactive targets keep their size. The
components survive forced text spacing, which is the criterion.

Two of the six tests fail, and neither is a port defect.

**1. "the detector finds a planted violation" — the canary cannot fire.**

The suite is unusually self-aware about the risk of becoming theatre. Its comment
says so directly: *"This test plants a violation that cannot survive the
overrides and requires the detector to find it. If it ever passes silently, the
exclusions have eaten the suite."* The canary appends a one-line box, pins its
`block-size` to the height it renders at *right now*, then forces
`line-height: 1.5` and requires the box to clip.

That mechanism assumes the host renders **below** 1.5. Measured
(`web/tasks/probes/text-spacing-canary.cjs`):

```
BEFORE overrides: { pinnedHeight: 24, lineHeight: '24px', fontSize: '16px', scrollHeight: 24 }
AFTER  overrides: { lineHeight: '24px', fontSize: '16px', scrollHeight: 24, clipped: false }
line-height ratio before: 1.500   after: 1.500
```

`cursor-DESIGN.md` specifies `body-md` at line-height 1.5, so our base is
*exactly* the value the override forces. Nothing grows, the planted box never
clips, and the detector correctly finds nothing.

So the canary is disabled by a host that already satisfies the line-height half of
1.4.12 at rest. A design system being **more** compliant makes the library's
anti-theatre check unable to prove itself — and it fails in a way that looks like
a broken detector rather than an inapplicable premise.

Worth being precise about what is and is not lost: the other three axes
(`letter-spacing`, `word-spacing`, paragraph spacing) still change and still
exercise the real assertions, so the suite is not inert. What is unverified is
that the *clipping* detector's exclusion list has not eaten its own subject —
which is exactly the thing the canary existed to prove.

**Decision:** leave it failing and record it. Suppressing it would be worse than
the gap: the canary's whole point is that a silent pass means the exclusions won.

**Upstream suggestion:** pin the canary to a ratio *below* the current computed
line-height rather than at it — e.g. set `block-size` to `1em` explicitly, or
plant the violation on the `letter-spacing` axis (force a box to exactly the
width of its text, which grows under `0.12em` regardless of the host's baseline).
Either makes the canary independent of how compliant the consuming project
already is.

**2. "the overrides actually apply, and the page grows" — not enough components yet.**

Its first assertion is `expect(before.sectionCount).toBeGreaterThan(10)`. The page
currently carries 7 `.kitchensink-section` elements. This resolves itself as the
remaining components land; it is a coverage floor, not a defect.

Also worth recording from this suite: **"every component on the page is inside a
covered section" passes**, and its comment explains why it exists — ToggleTip was
once silently outside coverage in a leftover `.examplePanel` wrapper. That is the
same failure shape as F-014 and F-018, and it is the one place the library
defends against it by asserting a *relationship* rather than a count. Good pattern
to note: our own `<Section>` component makes it structurally hard to fall out.

---

## Phase 3 — Wave 2, the kernel, and the cross-cutting defects

Wave 2 added seven components and the whole remaining kernel. Conformance on the
shared page at the end of the wave:

| Component | Result | | Component | Result |
|---|---|---|---|---|
| Picklist | 27 / 27 | | ChoiceGroup | 8 / 8 |
| FileUpload | 21 / 21 | | Notice | 7 / 7 |
| RangeField | 21 / 21 | | MotionRegion | 5 / 5 |
| RangeScale | 30 / 31 | | ScrollArea | 3 / 3 |
| AffixField | 15 / 16 | | RangeGroup | 10 / 19 ⚠ |
| ToggleTip | 11 / 11 | | ThemeSwitch | 14 / 17 ⚠ |
| ChoiceField | 8 / 8 | | | |

Site-level: `appearance` 8 / 8, `text-spacing` 5 / 6. Kernel: **206 unit tests**,
up from 35 — `locale`, `dates`, `WheelColumn`, `popup-interaction`, `css-px`,
plus `Wheel.css` copied verbatim.

---

### F-024 · axe does not test reflow, and a grid item defeats `max-w-full`

**Surface:** the shared kitchensink page, WCAG 1.4.10 Reflow. Found independently
by three ports.

Reflow requires content to reflow without two-dimensional scrolling down to
**320 CSS px**. Nothing in this project's toolchain was testing it: axe has no
reflow rule at all, so a fully green audit — component-scoped *and* page-scoped,
in both appearances — coexisted with a Level AA failure the whole time.

Measured document overflow at 320 px, bisected by hiding each section in turn:

| Owner | Contribution | Cause |
|---|---|---|
| MotionRegion | 169 px | a fixed `w-[28rem]` demo |
| FileUpload | 65 px | two separate causes, see F-028 and below |
| RangeScale | 71 px | still under investigation at time of writing |

The mechanism is worth stating precisely, because the obvious fix does not work.
A grid or flex item defaults to `min-width: auto`, so **a fixed-width child sizes
the auto track it sits in** — which makes `max-w-full` useless, because `100%`
then resolves against the item's own fixed width rather than against the
viewport. `min-w-0` on the track is what lets it shrink.

Two further traps measured along the way:

- The tempting fluid rewrite `w-full max-w-[28rem]` takes overflow to zero at
  every width **and collapses the track to the caption's width** — the demo
  measured 142 px at a 1280 px viewport. The working form was
  `inline-size: min(28rem, calc(100vw - 8rem))`, because viewport units are not
  circular with track sizing.
- `min-w-0` is necessary but **not sufficient**: a track cannot go below its
  content's `min-content`, and a bare `<input type="file">` has a UA
  `min-content` of **344 px** (its shadow "Choose File / No file chosen" is
  unshrinkable). That needs `w-full min-w-0` at the call site.

**Decision:** `min-w-0` on `Cell` in the shared chrome, plus a standing viewport
sweep (`web/tasks/probes/reflow-sweep.cjs`, wired into `npm run verify`) that
names the innermost offending element rather than just reporting a number. Two
seconds, and it is the only instrument that sees this class of failure.

**Upstream suggestion:** the library already ships a site-level suite for a
criterion nobody usually tests (`text-spacing.e2e.test.js` for 1.4.12). Reflow is
its sibling and belongs beside it — roughly twenty lines, and the two criteria
interact (1.4.12's own comment notes that text growing sideways must wrap rather
than widen the page).

---

### F-025 · CSS import order is load-bearing, and a bundler decides it for you

**Surface:** `AggregateKitchensink.tsx`. Found independently by the Picklist and
ChoiceGroup ports.

Three components style a `.content` element at **identical specificity (0,2,0)**
— `.Notice .content { display: flex }`, `.ChoiceGroup .content`,
`.Picklist .content { display: flow-root }` — and the contracts deliberately
*nest* a Notice inside a ChoiceGroup's and a Picklist's `.content`. Source order
is therefore the only tie-break, and the loser silently drops `gap` and
`min-inline-size: 0`.

Measured both ways: ChoiceGroup imported after Notice → the nested
`.Notice .content` computes `flow-root` and loses its gap; imported before →
`flex`, `gap 4px`, matching the reference.

The reference resolves this with a hand-ordered `@import` list. We resolve it with
the module graph, which is **not** a thing a porter chooses deliberately — it
falls out of import order in one file, and Next's own CSS documentation warns
that dev and production ordering can differ (checked: they agree here).

**Decision:** keep the aggregate's imports alphabetical, which happens to
reproduce the reference's outcome for both collisions, and say so in a comment at
the top of the file with a warning to measure rather than assume if a new
component adds a `.content` rule.

**Upstream suggestion:** ADR-0019 makes the element lexicon deliberately generic
(`.content`, `.popup`, `.options`) and relies on `.Component` prefixing to keep
bare names safe. That works within a component and fails **between** components
when one nests another — which the contracts require. `.Picklist > .content` is a
one-character fix that removes the ambiguity entirely, and the ADR's own reasoning
("a fully-qualified selector is deterministic to read") argues for it.

---

### F-026 · A px type scale makes the library's whole `em` model inert

**Surface:** `design-tokens.css`. Found by the RangeField port, which correctly
attributed a failing assertion in *its* spec to a defect in **our** token layer.

`cursor-DESIGN.md` specifies the entire scale in px, and we transcribed it
literally — including `body { font-size: var(--text-body-md) }` at `16px`. That
pins the root, and the consequence is not local:

| Root font size | Field input | Field box |
|---|---|---|
| 16 px | 16 px | 24 px |
| 32 px | **16 px** | **24 px** |
| 32 px, with `body { font-size: 1rem }` | 32 px | 48 px |

Two separate things break, not one:

- **The library's central sizing mechanism.** ADR-0025 has components "express
  relationships, never a scale" — a hint at `0.875em` is the statement
  *"supporting text is smaller than what it supports"*, designed to survive
  whatever scale the consumer installs. A px root removes the thing those
  relationships are relative *to*. The range family's contract asserts "the whole
  control scales with the root font size", and that assertion was failing.
- **WCAG 1.4.4 Resize Text.** A px `font-size` on `body` ignores the user's
  browser font-size preference outright.

**Decision:** the whole scale is `rem`, and `letter-spacing` is `em` so tracking
stays proportional when type scales. Values are unchanged at a 16 px root, so the
design renders byte-identically — this cost nothing and bought back both. Spacing
and radius tokens moved too, for the same reason. Verified live: doubling the root
now doubles a field's font and its box height exactly, and RangeField went from
20/21 to **21/21** without its porter touching the component.

The general lesson for anyone consuming this library: **a design system handed
over in px will silently disable it.** Nothing fails loudly; a contract assertion
somewhere just stops holding.

---

### F-027 · A component's own suite disables the rule that would catch its defect

**Surface:** `FileUpload.css`, `FileUpload.e2e.test.js`.

`.drop-label { opacity: 0.7 }` measures **3.44:1** on the card and **3.23:1** over
the dragging tint — both under AA. Dark passes at 4.59:1. axe flags it as two
serious nodes.

FileUpload's conformance suite **disables `color-contrast` in both of its axe
runs**, so the suite is structurally blind to a real Level AA failure in the
component it is auditing. The rule is switched off for a legitimate-sounding
reason elsewhere in the repo (WCAG 1.4.3 exempts *disabled* components, and axe
cannot see that exemption) — but here it also hides a live element.

**Decision:** left verbatim, because Phase A forbids editing the copied CSS. Not
silenced either: `web/tasks/probes/axe-dark.cjs` reports it as a named known
Phase A defect and counts it separately from new violations, so the rule keeps
catching regressions. Phase B fix is measured — `opacity: 0.9` clears every
ground (5.51 / 5.02 / 6.60).

**Upstream suggestion:** narrow the exemption instead of disabling the rule
globally for a section. Excluding `[data-disabled="true"]` subtrees — which is
what our page-level probe does — keeps `color-contrast` live everywhere else and
is the honest expression of the 1.4.3 exception.

---

### F-028 · JSX drops the whitespace text nodes that let an inline row reflow

**Surface:** `FileUpload.tsx`. **The most purely React-specific finding of the
port.**

The reference's Handlebars partials put each inline span on its own source line.
That leaves a collapsible whitespace text node between them — which is a
**soft-wrap opportunity**. JSX siblings emit no text node at all, so a row of
`white-space: nowrap` spans becomes one unbreakable inline box.

Measured `min-content` of the component root at 320 px:

| State | JSX siblings | with `{" "}` | reference |
|---|---|---|---|
| `invalid-size` | **285 px** | **155 px** | 155 px |
| `invalid-type` | **236 px** | **117 px** | 117 px |

Confirmed independently by injecting real `createTextNode(' ')` at runtime:
285 → 155 with zero CSS change. The available cell is 238 px at a 320 px viewport,
so this alone was a 1.4.10 failure.

What makes it nasty is that **nothing can see it**. `toHaveText` matches inside
the span. `textContent` ignores sibling whitespace. axe has no reflow rule. So
21/21 plus two clean axe runs coexisted with the defect, and the only reason it
surfaced at all is that a page-level viewport sweep was added for an unrelated
component.

**Decision:** emit `{" "}` between the spans. This is **restoring DOM the
reference actually has**, not a workaround, so it is a legitimate Phase A edit —
but check it changes no `textContent` assertion first. It is inert in flex
contexts, where whitespace nodes are discarded anyway.

This one generalises well beyond this library: any port from a text-templating
language to JSX loses every inter-element whitespace node, and the failure mode
is a layout that is subtly less flexible than the original with no visible
difference at desktop width.

---

### F-029 · The reference's kernel unit tests are 100% portable — proven, not estimated

**Surface:** `src/kernel/**/tests/`. **Directly contradicts PORTING.md.**

PORTING.md excludes `*.unit.test.*` from the portable contract:

> These are white-box tests of the *reference implementation* (they call private
> methods and import the TS class directly). They are **not** the portable
> contract and carry a TS-adaptation tax for no benefit.

That is right for components and **wrong for the kernel**. Measured per module:

| Module | Tests | Reference test adaptable? |
|---|---|---|
| `dates` | 85 (60 reference + 25 added) | **verbatim, zero-character delta** |
| `WheelColumn` | 37 (19 + 18) | verbatim + a `@vitest-environment` docblock |
| `popup-interaction` | 23 (9 + 14) | verbatim + docblock |
| `motion-policy` | 15 | verbatim (earlier port: "the entire delta was the import specifier's quote style") |
| `theme-preference` | 12 | verbatim |
| `locale` | 18 (all new) | **no reference test exists** |
| `css-px` | 8 (all new) | no reference module — six components duplicate the probe |

The claim was proven rather than asserted: all three reference `*.unit.test.ts`
files were copied in **byte-for-byte** and run — **88 tests passed unmodified**,
import paths included, because our `kernel/tests/` layout mirrors theirs. The
evidence is parked in `web/tasks/probes/verbatim-ref-tests/`.

Note the coverage gaps this exposed: `popup-interaction`'s reference test covers
only `nextTabStop`, leaving the actual trap wiring at **zero** coverage, and
`locale` has no test at all (the kernel README says "covered via component
tests").

**Upstream suggestion:** narrow the exclusion to
`src/partials/components/**/*.unit.test.*`. For pure kernel modules the tests are
the cheapest possible proof a port is faithful, and PORTING.md elsewhere already
tells you to "run their conformance tests" for kernel primitives — so the document
contradicts itself on this point.

---

### F-030 · `WheelColumn.destroy()` strands a module-level lock — a real upstream defect

**Surface:** `src/kernel/js/WheelColumn.ts`. **The most consequential bug found by
porting.**

`WheelColumn` arbitrates trackpad scrolling between sibling columns through a
module-level `_activeWheelCol` lock, released in `_commit()` after a 100 ms snap
window. `destroy()` does not clear it.

So: scroll a wheel column, then close the popup **within that 100 ms window**.
`_commit()` never runs, the lock keeps pointing at a destroyed instance, and
**every wheel column in the application ignores trackpad scroll for the rest of
the page's life.** Keyboard and pointer still work, which is exactly why it would
survive review — it presents as "the wheel feels broken sometimes".

Fixed in our port with one line in `destroy()`, marked `[PORT FIX]`, with a
regression test proven to fail without it (36/37) and pass with it (37/37).

Worth noting *why* the port found it and the reference had not: the reference's
kitchensink mounts its wheels once and never tears them down, while a React port
destroys and recreates on every unmount — so the framework's lifecycle exercised a
path the original environment never did.

**Upstream suggestion:** the one-line fix, plus the regression test. This is a
library defect, not a porting artefact.

---

### F-031 · `<output>` is a live region in the accessibility tree, and the test forbidding it cannot see that

**Surface:** `RangeScale.md`, `RangeScale.e2e.test.js`.

The contract's most emphatic rule is that the readout must **never** be a live
region — "a live region would say the value twice". The suite guards it with
`not.toHaveAttribute('aria-live')` and `not.toHaveAttribute('role')`.

Both pass. And CDP reports the element as `role=status, live=polite,
atomic=true`.

`<output>`'s **implicit** role *is* `status`, which carries an implicit
`aria-live="polite"`; the component then rewrites its text on every `input`
event. The defect is in the ARIA mapping, not in the DOM — so a DOM-attribute
assertion is the one instrument that cannot detect it. axe does not flag it.
Audible only under a real screen reader, which is exactly what the library's own
manual checklist exists for.

**Related, and worse, because it is in the reference's own kitchensink:** the
`_no-output` state authors a static `aria-valuetext="50 %"`. One ArrowRight gives
`value=51`, `--_rs-p=0.51`, and an accessibility tree reading
`valuenow:51 valuetext:"50 %"`. The eye sees 51; the screen reader says "50 %"
forever, because `valuetext` overrides `valuenow`. ADR-0024 warns about exactly
this channel split and does not warn about the static-`valuetext` route to it.

**Upstream suggestion:** assert the computed accessibility node, not the
attribute. Playwright can read it; the guard then means what it says.

---

### F-032 · React's synthetic `onChange` is deduplicated, and the specs drive inputs natively

**Surface:** RangeScale, RangeGroup, ChoiceField. Hit by three ports.

React installs its own `value` descriptor on native inputs and deduplicates
change events. Several specs drive an input the way any framework-agnostic test
would:

```js
el.value = '700'
el.dispatchEvent(new Event('input'))
```

React never sees those. A `onChange` handler is silently not called, and the
failure surfaces as a **layout or width-instability bug** rather than as a missing
event — three or four assertions away from the cause.

A native `addEventListener` is mandatory, not stylistic. The same is true of the
`wheel` listener for scroll containment: React's `onWheel` delegate is
**passive**, so `preventDefault()` is a no-op and containment silently fails —
`{ passive: false }` on a native listener is the only working form.

Related and separate: **a published imperative API cannot be React state.** Specs
call `root.__rangeScaleInstance.sync()` and read `getComputedStyle` on the very
next line. There is no version of React state that satisfies that, so the
imperative shape is forced by the contract rather than chosen — which is worth
saying plainly, because it looks like an unidiomatic port until you read the spec.

---

### F-033 · `dates` and `locale` are genuinely portable — Node and Chromium ICU agree exactly

**Surface:** `src/kernel/utils/`. A positive finding, deliberately measured
because the risk was real.

`Intl` output varies by ICU version, and Node's ICU is not the browser's — so a
kernel whose unit tests run under Node and whose components run in Chromium could
pass its tests and still render the wrong month name. Checked directly
(`web/tasks/probes/icu-compare.cjs`): Node 24.13.1 / ICU 78.2 (full) against
Chromium 147, comparing month names, Monday-first weekday arrays and
`formatToParts` across `sv-SE`, `en-US`, `en-GB`, `de-DE`, `ja-JP`, `ar-EG` —
**zero differences**.

The residual risk is named rather than hand-waved: a **small-icu** Node build
would break the reference's two Swedish string assertions while the browser stays
correct. ICU-independent invariants were added beside them so a small-icu
environment fails informatively instead of mysteriously.

---

### F-034 · ADR-0021's statement of FileUpload's debt was made stale by its own PR

**Surface:** `docs/adr/0021-*.md`.

ADR-0021's "Risks to manage" says:

> **FileUpload holds five genuinely hardcoded colours** (not token fallbacks). It
> is the only component with real debt here.

The FileUpload port went looking for them and found none. Traced to commit
`13cdd98` — the same squashed PR that *added* ADR-0021 — whose body says
"FileUpload's five genuinely hardcoded colours (the only real component debt) now
derive from the seam". The file today has zero unconditioned literals: four `#hex`
occurrences, all inside `var(--ui-*, …)` fallback slots.

So an immutable ADR describes debt that its own commit had already paid. Not a
serious defect, but a porter who reads the ADR ledger as current state — which is
how it is presented — will go looking for something that is not there.

Two genuinely useful things came out of looking:

- **The light-mode fix was a no-op.** `CanvasText`/`Canvas` are pure black/white
  in light, so `color-mix(CanvasText 6%, Canvas)` computes to **exactly** the
  `#f0f0f0` literal it replaced. The entire gain was dark-mode reactivity.
- **The `var(--ui-*, #hex)` fallback path is not AA in dark.** ADR-0021 calls the
  unsupported-`light-dark()` degradation "graceful". With the seam neutralised:
  `#c00` → **2.68:1**, `#6e6e6e` → **3.09:1**. Graceful in light only. A consumer
  on a browser without `light-dark()`, in dark mode, gets sub-AA state colours
  with nothing failing.

**Upstream suggestion:** ADRs are immutable by design, which is right — but a
"Superseded / partially resolved" pointer would keep the ledger readable as
history without it reading as current state.

---

## Phase 4 — The framework-level findings

### F-035 · Next's `async` chunks lose a race the entire e2e suite assumes it wins

**Surface:** every ported component. **The single most generalisable finding of
the project.** Diagnosed by the RangeGroup port after nine failures that looked
like a selector collision.

The reference loads its behaviour from `src/js/script.js` via
`<script type="module" src="/main.js">`. A non-async module script is
**deferred**, and a deferred script **delays the `load` event** — which is
exactly when Playwright's `page.goto()` resolves. So upstream, a spec can do an
ungated `page.evaluate` read immediately after `goto` and be safe every time. The
specs are correct as written.

Next.js injects **every** client chunk as `<script async>`. An `async` script does
**not** delay `load`. Measured on the shared page, four runs each:

| Init strategy | instance present |
|---|---|
| `useEffect` (hydration) | **86–141 ms after** `goto` resolved |
| module-scope `attach()` | 54–91 ms after `goto` resolved |
| inline parser-blocking bootstrap | **before** `goto` resolved, 4/4 |

Every assertion with no preceding auto-retrying `expect()` fails — and it fails
as an apparent *logic* defect, several assertions away from the cause. The
isolated route had the same race at ~54 ms; a 200 ms settle in a hand-written
probe had been hiding it.

**The crucial part: this is not a test-only problem.** For roughly 100 ms after
`load`, a hydration-only component does not clamp, does not announce its span,
and cannot arbitrate an overlapping pair. That is a real dead-control window, so
"add a wait to the spec" would have hidden a genuine defect.

**Decision:** an inline **parser-blocking** bootstrap gated on
`document.readyState` → `DOMContentLoaded` — after the markup below it is parsed,
still before `load`, placement-independent. One implementation only: the same
imported function is serialised with `String(fn)` for the inline script *and*
called from `useEffect` as a client-navigation safety net, guarding on the
instance handle exactly as the reference's `attach()` does. This is the technique
PORTING.md's *Preventing FOUC* section prescribes, applied to behaviour rather
than paint. Result: RangeGroup 19/19 on the shared page, twice consecutively.

**Upstream suggestion:** the suite's implicit dependency on a deferred script
delaying `load` is invisible and load-bearing. Either document it in PORTING.md
("your init must complete before `load`, or gate your reads"), or make the reads
retry. Any consumer on a framework that ships `async` chunks — which is most of
them now — hits this on their first component and has no way to know why.

---

### F-036 · Next's client Router Cache can make the cookie and the layout disagree

**Surface:** `layout.tsx` + `ThemeSwitch.tsx`. Found and reproduced by the
ThemeSwitch port.

F-022 chose the cookie-plus-server-render structure because PORTING.md prefers it
and it is flash-free by construction. It is — measured below — but it has a
framework-specific failure mode the reference cannot have.

Reproduced: choose dark → navigate history *forward* to a route whose RSC payload
was cached **before** the cookie was written → `data-appearance` goes
`"dark" → null`, the page renders light, and **the cookie still says dark**. A
reload fixes it. The client Router Cache served a payload rendered under the old
cookie.

**Decision:** `router.refresh()` after the cookie write. Verified to fix it, and
verified to preserve focus. Cost measured: **one RSC request, 9,731 bytes** per
toggle.

Also measured, and worth its own line: **without `path=/` on the cookie the choice
silently applies only under the path it was set from.** Nothing fails; the
appearance just stops following the user around the site.

**The flash-free claim, proven rather than asserted.** Production build, cookie
`dark`, emulated OS **light** (so a flash would be maximally visible), fresh
context per run, rAF sampling installed before any document script:

| Run | frames sampled | colours seen | wrong-appearance frames |
|---|---|---|---|
| 1 | 183 | `rgb(26,26,23)` only | **0** |
| 2 | 185 | same | **0** |
| 3 | 183 | same | **0** |

First sample at 17–35 ms is already dark. Same-browser synthetic comparison at a
120 ms module RTT: server cookie **0** wrong frames, `localStorage` + a
render-blocking head script **0**, `localStorage` read from a module
**14–15 frames / ~110–117 ms**. So PORTING.md's ranking is correct, and its
warning about a module-loaded restore is quantified.

And the `system` path really does cost nothing: **zero** `data-appearance` writes
across six scenarios (no cookie ± OS flip, cookie dark/light ± flip, `Dark` →
system), with the instrument sanity-checked by a real click showing two writes.

---

### F-037 · Reflow: the reference's own kitchensink fails far worse than the port

**Surface:** WCAG 1.4.10. **Reframes F-024.**

F-024 recorded that our shared page overflowed horizontally at 320 px and that
axe cannot see it. The obvious next question is whether the reference does too,
since we copy its CSS verbatim. Measured against the reference's own dev server
(`web/tasks/probes/reflow-reference.cjs`):

| Viewport | Reference overflow | Offending elements | Our port |
|---|---|---|---|
| 320 px | **737 px** | 857 | ~73 px |
| 360 px | **697 px** | 742 | ~33 px |
| 480 px | **582 px** | 501 | 0 px |
| 768 px | **311 px** | 110 | 0 px |

The reference fails at **every width up to 768 px**. So this is an untested
upstream criterion, not a defect the port introduced — and the port is an order of
magnitude better on it.

Being precise about attribution, because the numbers invite an unfair reading: the
dominant contributors upstream are its demo harness, not its components — the
interaction-state **tables** (`th` at 181 px each, three abreast) and `div.rail`
sized to the full viewport. Our kitchensink uses a wrapping flex layout instead of
tables, which is most of the difference. But some offenders upstream *are*
component parts (`span.segment`, `span.separator` overflowing their row), and our
residual failures are likewise a mix: one is ours (F-028's whitespace nodes, now
fixed) and one is inherited (`.item-error { white-space: nowrap }` with no
`overflow`, an irreducible 117 px `min-content`, Phase B fix measured).

**Decision:** keep the inherited residual verbatim per the two-phase rule, keep
the sweep in `npm run verify` so it cannot regress silently, and report the
comparison rather than either half of it alone.

**Upstream suggestion:** unchanged from F-024 — a reflow sweep belongs beside
`text-spacing.e2e.test.js`. It is about twenty lines, and it would currently fail
loudly on the library's own demo page, which is precisely the value.

---

### F-038 · The ThemeSwitch spec hard-codes `localStorage`, which its own contract forbids

**Surface:** `ThemeSwitch.e2e.test.js`. 15 / 17, and both failures are this.

`ThemeSwitch.md` and ADR-0021 are both explicit that the persistence medium is
the host's choice:

> This reference computes it client-side from `localStorage`; an Astro or Razor
> consumer reads a cookie and renders `<html data-appearance="dark">`
> server-side with zero client JS. **Both satisfy the same contract and pass the
> same e2e assertions.** The persistence medium is deliberately not specified.

The suite reads and writes `localStorage` directly, so a cookie-based host fails
two assertions. The claim in the `.md` — "pass the same e2e assertions" — is not
true of the suite as written. Same class as F-011: a mechanism assertion inside a
suite that declares itself end-state-only.

The port proved a **stronger** version of what the tests were trying to check:
with **all JavaScript aborted** and only a cookie present, the document still
carries `data-appearance="dark"` and `data-initialized` is absent. That is the
restored-before-first-paint property the assertions exist to defend, demonstrated
in the one configuration where client-side restoration cannot be doing the work.

**Decision:** leave the two failing. A one-line `localStorage` mirror would make
it 16/17, but it would be a write-only second store existing purely to satisfy a
test — the same trade rejected in F-011.

**Upstream suggestion:** assert the DOM end-state (`data-appearance` on the root)
and let the host seed it however it likes — a `page.addInitScript` for the
localStorage host, a cookie for the server-rendered one.

---

### F-039 · Where React's component model genuinely breaks a contract's composition seam

**Surface:** the range family. Reported jointly by the RangeField/RangeGroup and
RangeScale ports, which reached it from opposite directions.

The mechanism, stated once: **in the reference, every tier's DOM is authored by
the consumer and the component only attaches behaviour. In React, every tier's DOM
is authored by the component.** So reference tiers compose by nesting *markup* —
free at any arity, with any attribute set — while React tiers can only compose by
nesting *components*, which forces each tier to fix its children's markup, arity
and attributes.

Consequences both porters hit independently:

- ADR-0023's "the lane knows nothing about arity" does not survive. `RangeScale.tsx`
  renders a singular subtree and cannot hold a pair, so RangeGroup writes the lane
  markup itself.
- From the other side, RangeScale needs `RangeField.css` for the 24 px thumb
  geometry (three assertions read the input's `blockSize` *as* the thumb size) but
  cannot compose `RangeField.tsx`, because that emits `<label>` + `<input>` as one
  fragment and adds `data-component="RangeField"`, which the reference's RangeScale
  states deliberately omit. So it imports the stylesheet and inlines the input.

The residue is ~10 duplicated lines. ADR-0023's promotion trigger is *"a third
component needs the same value↔position conversion"*, and literally counting,
there are two. But the porters' joint argument is that **the trigger measures the
wrong thing**: the conversion is four lines of arithmetic that cannot plausibly
drift. What is duplicated and *can* drift is the **publication protocol** — the
`--_rs-a`/`--_rs-b`/`--_rs-p` names, the sorted-by-value-not-document-order rule
(the spec has a dedicated test precisely because it is easy to get wrong),
`--_rs-p` meaning the last field, and `__rangeScaleInstance = { sync }` having to
be synchronous.

**Joint upstream recommendation:** promote a kernel module owning the *protocol*
rather than the maths — `publish(lane, fields)`, `attachLane(lane, fields)`,
`LANE_VARS` — roughly 25 lines plus a conformance test, called with one field by
RangeScale and two by RangeGroup. Rewrite ADR-0023's trigger to *"a second
component writes the lane's published properties or installs its lane handle"*.
And add one sentence to `RangeScale.md`: in a framework where components own
their markup, the lane must accept its fields as children.

**A positive finding on the same surface, worth stating because it cuts the other
way:** the library's anti-DRY stance (ADR-0004) helped decisively. RangeField went
green before its porter opened RangeGroup, and nothing about the pair could
regress it — which the porter noted is impossible with the array-valued
single-component design every mainstream library ships.

---

### F-040 · The suite has vacuous passes, and a green result is not self-validating

**Surface:** the conformance suite as a whole. **This is the finding that
qualifies every other number in this document.** Found independently by the
RangeScale and ToggleTip ports.

RangeScale's runner reports **31 passed**, reproducibly, across four runs. Its
porter reported the substantive figure as **30 / 31** and showed why:

*Crossing a digit boundary* runs immediately after `goto` with no actionability
round trip, so on the shared page it executes **before the lane attaches**. It
dispatches an `input` event with no listener present, the readout is therefore
never rewritten, and the width it measures trivially cannot have changed. The
assertion passes because nothing happened.

Gated on attachment, it fails — and the underlying defect is real:

| Page | gated on attach | hydrated | readout across 0 / 400 / 990 / 1000 | widths | verdict |
|---|---|---|---|---|---|
| `/` | no | **false** | `"400 tkr"` ×4 — never rewritten | 65 | **PASS (vacuous)** |
| `/` | yes | true | `"0 tkr"`, `"400 tkr"`, `"990 tkr"`, `"1000 tkr"` | 65, 66 | **FAIL** |
| isolated | either | true | rewritten correctly | 65, 66 | FAIL |

So F-035's hydration window cuts **both** ways: it turns real behaviour into
apparent logic defects, *and* it turns real defects into passes. The second
direction is far more dangerous, because nothing prompts you to look.

The ToggleTip port found the same shape from a different angle: two of its eleven
tests — including both axe runs, which cheerfully report "No accessibility
violations detected!" — **pass when the component is absent from the page
entirely.** An axe run scoped to a selector that matches nothing audits nothing
and succeeds. That is also how F-018's undocumented `#Component` section ids
stayed invisible for as long as they did.

**What this means for every figure in this document:** a passing count from this
suite is a *lower bound on failures*, not a statement of conformance. Where a port
has said "green", it means the runner was green — the two ports that went looking
found a vacuous pass each, and no port audited all of its own passes for
vacuity. The honest tally is therefore "204 reported passes, at least one of them
vacuous and knowingly so".

**Decision:** report it exactly that way, and treat "green" from this suite as
necessary rather than sufficient — which is what PORTING.md already says about
appearance ("Tests green is necessary, not sufficient") and turns out to be true
of behaviour too.

**Upstream suggestions**, in order of value:

1. **Assert the scope exists before auditing.** One line in `scopedCheckA11y`
   turns every silent no-op axe run into a clear failure. This is the cheapest and
   highest-value change in the whole list.
2. **Gate on the readiness attribute the library already defines.** PORTING.md
   names `data-initialized="true"` as the state attribute tests locate components
   by. Several specs neither set nor wait on it — RangeScale's is one. A
   `beforeEach` gate would have made this defect visible instead of invisible.
3. **Add a positive control to the suites that can support one**, in the spirit of
   `text-spacing.e2e.test.js`'s planted violation. That file's own comment has the
   right instinct — *"If it ever passes silently, the exclusions have eaten the
   suite"* — and it is the only suite in the repo that defends itself this way.
   Ironically it is also the one whose canary our compliant design system disabled
   (F-023), so the pattern needs the fix suggested there to be dependable.

---

## Phase 5 — The popup field family

### F-041 · The reference sends a collapsed translation key to `Intl`, so `de-DE` renders English months

**Surface:** `MonthField.ts` (and the family's locale handling). **A real upstream
defect, and one ADR-0011 claims to have fixed.**

The component collapses a locale tag to a translation key for its UI strings —
sensible — and then passes **that key**, not the raw tag, to `Intl` for month
names. Measured in Chromium off the live month wheel:

| `data-locale` | collapsed key | wheel renders | `Intl` on the raw tag |
|---|---|---|---|
| `en-GB` | `en` | January…December | June |
| `sv-SE` | `sv` | januari…december | juni |
| **`de-DE`** | **`en`** | **January…December** | **Juni** |

`Intl.DateTimeFormat.supportedLocalesOf(['de-DE'])` returns `['de-DE']`, so the
data is present — only the collapse discards it.

Two things make this a good finding rather than a small bug:

- **ADR-0011 § Decision point 4 states this is already fixed** — "format is now
  derived from the raw locale tag". MonthField's month *names* were not included
  in that change. Same shape as F-034: the ADR ledger describes a state the code
  is not in.
- **It is invisible in the reference's own kitchensink**, because the only two
  locales demoed are `en-GB` and `sv-SE`, and for both of those the collapse is
  name-preserving (`en-GB→en`, `sv-SE→sv`). Any locale whose region matters —
  which is most of them — silently falls back to English.

Ported verbatim for Phase A with a standing `de-DE` probe cell in the kitchensink
so the defect is visible rather than described. One-line Phase B fix.

Related, and worth knowing for any SSR consumer: the spec asserts no `Intl`
output at all (`'Choose month'` is a bundled literal), so the small-ICU risk named
in F-033 **cannot fail the 28 tests** — but it *would* desync server-rendered
month names from client-rendered ones, i.e. a hydration mismatch that neither
runtime's tests can see.

---

### F-042 · Roving tabindex is one-way: the segments become keyboard-unreachable

**Surface:** `TimeField.ts`, `_focusTrigger()`. **Probably the most serious
accessibility defect found in the library.**

The segmented field uses a roving tabindex so the whole segment group is one tab
stop. `_focusTrigger()` sets **every** segment to `tabindex="-1"` — and nothing
ever restores a `0`.

Measured: Tab off the last segment → focus moves to the trigger, segment
tabindexes read `['-1','-1']`, and Shift+Tab from there lands on the **previous
TimeField's trigger**. The segments of the field you were just editing are now
unreachable by keyboard for the rest of the page's life.

That is a WCAG 2.1.1 Keyboard failure — the field's editing functionality has no
remaining keyboard route — and arguably 2.4.3 Focus Order as well, since Shift+Tab
skips backwards past a control that should be in the order.

**Neither axe nor the conformance suite can see it.** axe has no rule for a roving
tabindex that never rovs back; the suite has no test that tabs out and back in.
This sits directly alongside F-040: the verification model has a blind spot, and
this is what fell into it.

**Decision:** ported faithfully. A port that silently repairs the reference's
defects destroys the evidence that is this project's actual deliverable, and
Phase A's fidelity rule applies to behaviour as much as to CSS. The one exception
in the tree is F-030's `WheelColumn.destroy()`, and it is a genuine exception
rather than a precedent: that defect breaks *other components*, so leaving it in
would have corrupted four other ports' results. This one is contained.

The one-line fix is identified (drop the blanket `setRoving(null)` and restore a
`0` on the segment that had focus). Whether it is family-wide across all four
fields needs four measurements rather than one inference; recorded as
outstanding.

---

### F-043 · An `aria-modal` popup that opens with focus outside itself

**Surface:** `TimeField.ts`. Measured: on open, `activeElement` is `.trigger` and
`insidePopup` is `false`.

So for a **mouse** user, Escape does nothing — the key handler is inside the
popup, and focus never entered it. A keyboard user is fine, because their Tab
lands them inside.

The interesting half is what rescues it: the kernel's `nextTabStop` snap-to-end
behaviour. The kernel is silently compensating for a case the component never
handles — which is precisely the kind of coupling the kernel was extracted to
*prevent*. `popup-interaction.md` presents the trap as containment for focus that
is already inside; here it is also doing entry.

This also explains why the defect survives review: the suite's tests drive the
popup by keyboard, so the trap does its work and everything passes.

---

### F-044 · A fourth tier of appearance-awareness, better than the three we had

**Surface:** `TimeField.css`. A positive finding that supersedes part of the
ScrollArea port's tiering.

The ScrollArea port established three tiers for how a value survives an
appearance flip: a plain literal (`white`) is wrong in both; a system colour
(`Canvas`) is right in light but resolves to the UA's `#121212` in dark rather
than our card `#232320`; only `var(--color-surface-card)` is right in both.

`--_tf-border-color: currentColor` is a fourth and better tier: **appearance-aware
*and* design-system-aware, with no token at all.** It inherits the host's text
colour, so it tracks both the scheme and the design system for free, and it costs
the seam nothing. Picklist's `currentColor` chip border reaches the same result
from the other direction — the port measured it as structurally unable to drift
below 1.4.11's 3:1 floor.

**Recommendation to the library:** where a component needs a colour that *should*
track the host's text colour, `currentColor` beats both a literal and a system
colour. Several `--_*-border-color: CanvasText` declarations in the family are
candidates — TimeField's own hover border resolves to pure `#000`/`#fff` against
our warm ink `#26251e`/`#f2f1ec`, which is a fidelity loss rather than an
accessibility one (21:1 and 15.76:1 both pass), but it is a loss for no benefit.

---

### F-045 · The kernel's wheel fade has a dark-mode defect that reaches four components

**Surface:** `src/kernel/css/Wheel.css`, `.WheelColumns::after`.

The fade masking the top and bottom of a wheel column blends to the system colour
`Canvas`. In light that is `#ffffff` — coincidentally *exactly* our card colour,
so it is pixel-perfect for free. In dark it resolves to the UA's `#121212`
against our `#232320` popup: a ratio of **1.19**, i.e. a visible dark band at both
ends of every wheel column.

Because it is in the kernel, it reaches **all four wheel fields at once** —
measured independently by the MonthField and TimeField ports, which corroborated
the same numbers.

This is the sharpest illustration of the tiering in F-044: the coincidence that
`Canvas` equals `#ffffff` in light is what makes the defect invisible until
someone switches appearance, and no component author did anything wrong. Proposed
fix is one token: `var(--ui-surface, Canvas)`, which keeps the current behaviour
as the fallback.

Left verbatim — the kernel is a copied deliverable under the same Phase A rule as
component CSS.

---

### F-046 · `data-initialized` must be gated on hydration, or it gates nothing

**Surface:** every `'use client'` component. Measured by the MonthField port,
and it refines F-010.

F-010 established that the init-gated CSS goes and the attribute stays. What it
did not settle is *when* the attribute should appear.

Rendering `data-initialized="true"` server-side makes the specs'
`beforeEach` wait — `page.locator('...[data-initialized="true"]').waitFor()` —
resolve **instantly**, gating nothing. Gated on hydration instead, it becomes a
true readiness barrier for every test in the suite.

Given F-035 (Next's `async` chunks mean hydration lands after `load`) and F-040
(a spec reading state before attachment can produce a *vacuous pass*, not merely a
spurious failure), this is the difference between a suite that is measuring the
component and a suite that is measuring nothing.

Measured dead-control windows: MonthField 68 ms, RangeGroup ~100 ms, ScrollArea
6–11 ms in production.

**And one component has no window at all, for a documented reason.** TimeField's
input-mode store has a server snapshot of `null`, and the stylesheet's default
branch shows the **native `<input type="time">`** — ADR-0006's coarse-pointer
fallback. So before hydration the field is fully usable, and the `<script async>`
race degrades to the native control rather than to a dead one. That is the
progressive-enhancement story working exactly as designed, and it is the strongest
argument in the library for keeping a native fallback in the markup rather than
rendering the enhanced form directly.

---

### F-047 · Paint attributes belong in SSR; behaviour gates must not — one rule, two halves

**Surface:** every `'use client'` component. Measured by the WeekField port, and
it completes F-046.

F-046 established that `data-initialized` must be gated on hydration or the
suite's own `beforeEach` gate resolves instantly and gates nothing. WeekField
found the necessary other half: **not every `data-*` can be withheld.**

`data-input-mode` is a *paint* attribute — WeekField's stylesheet defaults to
`.overlay { display: none }`, so withholding it until hydration flashes a raw
native input. It has to be in the server markup.

So the rule is a distinction, not a blanket:

| Attribute kind | Where it belongs | Failure if you get it wrong |
|---|---|---|
| **Paint** — CSS keys off it to decide what is visible | server markup | a flash of the wrong control |
| **Behaviour gate** — tests and code read it to mean "handlers are attached" | after hydration | the suite's readiness gate becomes a no-op (F-040) |

`data-initialized` is the second kind; `data-input-mode` is the first. ADR-0002
puts them in one namespace and ADR-0009 says the contract is the DOM end-state
without distinguishing *when* each part of that end-state may appear — which is
exactly the distinction a server-rendered port needs.

Measured dead-control windows across the family: WeekField 90–95 ms, MonthField
68 ms, RangeGroup ~100 ms, ScrollArea 6–11 ms (production). TimeField has none, for
the documented reason in F-046.

**Upstream suggestion:** say this in PORTING.md. It is one sentence — *"an
attribute the CSS paints from must be in your server markup; an attribute meaning
'initialised' must not be"* — and it is currently something each porter has to
derive from a flash or a vacuous pass.

---

### F-048 · Locale: one project-level answer for all five fields

**Surface:** `locale.md`, and the family's `readLocale` / `registerLocale` API.
Raised as an open question by the MonthField, TimeField and WeekField ports
independently, so it is answered here once rather than three times.

The reference offers three ways in, and two of them do not survive a server
render:

- **`readLocale()` walks up from the element to read `<html lang>`.** A client-only
  DOM read that determines rendered text is a hydration mismatch by construction:
  the server renders with one locale, the client re-derives another, React
  complains, and the ToggleTip port already measured that a hydration mismatch
  kills interactivity for the **whole page**, not just the component.
- **`registerLocale()` is a published imperative API** for adding translations at
  runtime. As with `__rangeScaleInstance.sync()` (F-032), there is no version of
  React state that satisfies an imperative call whose effect must be visible
  synchronously to the next line of a test.
- **`data-locale` on the element** works unchanged, and is what all three ports
  used.

**Decision, applying to every field:** the locale arrives as a **prop**, rendered
into `data-locale` on the server. `readLocale`'s `<html lang>` walk is not ported.
`registerLocale` is not ported; the equivalent in a React tree is a translations
prop or a module-level registry populated at import time, before any render.

This is squarely inside what ADR-0009 permits — the contract is the DOM
end-state, and `data-locale` on the root *is* that end-state — so nothing is lost
except a convenience that only a client-only runtime can offer. Worth noting the
irony: `readLocale` exists so an author does not have to repeat the locale per
instance, and a server render makes repeating it free.

**Upstream suggestion:** `locale.md` should say that `readLocale` is client-only
by construction and name `data-locale` as the portable path. It currently presents
the two as equivalent conveniences.

Related, and the reason this matters more than it looks: F-041's `Intl` defect
means the locale that reaches `Intl` is not always the one the author set. A
consumer wiring locale through a prop has one place to check that; a consumer
relying on an ancestor `lang` attribute has none.

---

### F-049 · The same suite scores differently against `next dev` and a production build, with no code difference

**Surface:** the whole conformance suite. **A correction to my own reported
numbers, and a methodology finding.** Diagnosed by the ToggleTip port and
independently corroborated by the Picklist port from the geometry side.

I reported regressions in ToggleTip (11→6), Picklist (27→23), RangeField (21→20)
and RangeScale. Measured against a production build, all of them are green:

| Component | `next dev` | `next build && next start` |
|---|---|---|
| ToggleTip | 6 / 5 | **11 / 11** |
| Picklist | 23 / 4 | **27 / 27** |
| RangeField | 20 / 1 | **21 / 21** |
| RangeScale | 28 / 3 | 30 / 1 *(its porter's own honest figure)* |

No code changed between the two. The regressions were mine to report and mine to
retract.

**The mechanism.** MonthField and TimeField do not render at their final height:
their server HTML is not the end state, so each instance *reveals* on hydration
(`div.overlay 0→30`, `div.segments 0→24`, `button.trigger 0→18`,
`input.native 24→1`). Across 33 instances the document grows **+224 px**, and both
ports measured the same numbers independently:

```
after goto resolves : scrollHeight 30180   .Picklist[data-id="single"] top 13817.5
+250 ms             : scrollHeight 30404   top 13929.5     → +224 doc, +112 shift
```

Playwright computes a click point and *then* moves the mouse. In dev the shift
lands at t ≈ 330–410 ms — inside that gesture. The trigger is pushed 212 px below
the aim; `mousedown` still reports the button (Chrome hit-tests before the frame
commits); `mouseup` lands on a `Block` heading; so `click` is dispatched on their
common ancestor `section.kitchensink-section`. **The button never receives a
click.** In production the same shift completes at t = 66 ms, before Playwright's
first action.

Section order on `/` is alphabetical, which is why the affected components were
exactly the ones *below* MonthField and TimeField.

**What makes this bad rather than merely annoying: the failure messages accuse
the wrong component, and they accuse it of its own thesis.** Picklist's read
"chips wrap when they must not" and "the label does not toggle its input" — the
chip mechanism's whole point — when the cause is another component's hydration
reveal 13,000 px up the page. And the Picklist port proved the accusation false on
its own terms: `.options` computes `flex-wrap: nowrap`, and a nowrap flex row
*cannot* produce two rows, so that assertion can only fail by measuring across a
shift.

**Three more corrections I owe, all mine:**

1. I claimed the failures "reproduce on the isolated route, so it is not a
   shared-page interaction". They did not. `ToggleTip`, `Picklist`, `RangeField`
   and `RangeScale` are among the nine specs of F-019 that hard-code
   `page.goto('/')`, so `TARGET_PATH` is inert for them — both of my runs hit the
   aggregate page. The conclusion had no basis.
2. My `min-w-0` bisection (Picklist 4 failures → 3) was noise from a flaky
   gesture, not a real contribution. The reflow-versus-no-wrap tension I drew from
   it is demoted to an observation with no evidence it costs a test.
3. My first tally was additionally contaminated by another agent running
   Playwright concurrently against the same submodule install, which produces a
   bogus `test.beforeEach() … No tests found` runner error rather than a clean
   failure.

**Decisions:**

- **Conformance is measured against a production build.** `next dev` is for
  development; it is not a valid substrate for this suite, and every figure in
  this report that is not explicitly labelled otherwise should be read as
  production.
- **Run the suite sequentially.** Concurrent runs from one shared submodule
  install are not safe.
- **The layout shift is a real defect in its own right**, not just a test
  artefact: +112 px per instance on hydration is a Cumulative Layout Shift
  problem, and CLS is a Core Web Vitals metric that no test in this project
  measures. Routed to the MonthField and TimeField ports — the fix is to render
  at final height or reserve it.

**Upstream suggestion**, from the Picklist port and worth acting on: the geometry
assertions take two separate `boundingBox()` calls and compare them, which is a
race in the *assertion* regardless of environment. Moving both reads inside one
`page.evaluate()` makes them atomic and costs nothing.

---

### F-050 · An unscoped test selector that works only because `<template>` hides closed popups

**Surface:** `WeekField`, `TimeField`, `MonthField`, `DateField` specs — the three
`popup-interaction` tests in each, 12 occurrences. **Not a kernel defect.** My
first diagnosis said it was; that was wrong, and the real cause is more
interesting.

The symptom: WeekField is **31/31** on its own route and **28/3** on the shared
page, measured against production so F-049's artefact is excluded. The three
failures are exactly the kernel's surface — Tab trap, Shift+Tab wrap, wheel
`defaultPrevented` — so a kernel collision was the obvious hypothesis, especially
after F-030 found module-level shared state in `WheelColumn`.

It is not. Look at what the tests actually do:

```js
await page.locator(`${WF} .trigger`).click()          // correctly scoped
await expect(page.locator(`${WF} .popup`)).toBeVisible()   // correctly scoped
const inside = await page.evaluate(() =>
  document.querySelector('.popup')?.contains(document.activeElement) ?? false,
)                                                      // NOT scoped — document-wide
```

The click and the visibility check are scoped to the component. The assertion is
not: `document.querySelector('.popup')` returns the **first `.popup` in the
document**. The wheel test is the same shape — it dispatches its event on that
first popup, which has no trap registered because it is closed.

**Why it is correct upstream, and this is the whole finding.** All five popup
fields author a `<template data-template="…-popup">` and clone its content at open
time (`this._popupTemplate.content.cloneNode(true)`). A `<template>`'s content
lives in a **separate document fragment**, so a closed popup is *not in the
document at all* — `document.querySelector('.popup')` can only ever find the open
one. The unscoped selector is not sloppy upstream; it is load-bearing on a
mechanism nobody wrote down.

**Why it breaks in React.** React cannot render into a `<template>`'s content — it
appends children to the `<template>` *element* instead, which the DateField port
discovered the hard way (`.popup` becomes query-visible while closed and *"calendar
does not exist in DOM when closed"* fails). So every React port must either
conditionally render the popup or keep it in the document. Ours conditionally
renders the four fields' popups — but **ToggleTip has no template**, so its 12
closed popups sit in the document permanently. Measured on the aggregate page:

```
popupsInDocument: 12      inTemplates: 0
firstPopupOwner: null     firstPopupHidden: "true"
```

All twelve belong to ToggleTip (no `[data-component]` ancestor — its root is a
`<toggle-tip>` custom element). So `document.querySelector('.popup')` returns a
**closed ToggleTip popup**, and all four popup fields fail their three trap tests
on any page that also renders a ToggleTip.

**Decision:** nothing to fix in the port. The kernel is correct — the trap
demonstrably works, which is why the same tests pass on a page with one popup
owner. The four fields keep their conditional rendering, because rendering a
closed popup into the document is what fails the *other* assertion.

**Upstream suggestion:** scope the assertion. `${WF} .popup` is already computed
two lines above; passing the selector into the `evaluate` is a one-line change per
occurrence, twelve in total, and it makes the tests say what they mean. Worth
noting the general lesson too: **`page.evaluate` is the place scoping discipline
gets lost**, because the locator API's scoping does not follow you across the
boundary. Every one of these tests is scoped correctly right up until it steps
into the browser.

And a note for the porting guide: the `<template>`-clone mechanism is not
mentioned in PORTING.md or in any component `.md`, yet it determines what a
document-wide query can see. A porter on any framework that cannot populate a
`<template>` inherits a changed DOM invariant that four suites silently depend on.

---

## Phase 6 — The loop closes: upstream fixes, and the port catching up

Six of this port's findings landed upstream within two days, and two PRs were
opened from this repo. Bumping the submodule from `99ff470` to `c2d12c2` then
turned the port red in a specific and intended way: **15 failures, every one of
them an upstream fix the port had not applied**, not a regression. That commit was
kept separate so the drift exists in history rather than vanishing into the commit
that repairs it.

What follows are findings from applying them — which turned out to be more
interesting than "applied".

---

### F-051 · The port's diagnosis was right and its patch was one level too low

**Surface:** `_focusTrigger()` in TimeField, MonthField, WeekField.
**Corrects F-042's proposed remedy.**

F-042 measured the defect correctly: the roving tabindex was one-way, segments
became keyboard-unreachable after Tab-out, WCAG 2.1.1. It also proposed a
one-line fix — keep the `Tab` interception, restore `tabindex="0"` on the segment
that had focus.

Upstream fixed it the other way: **`07bac06` deletes the `Tab` handling
entirely.** `_focusTrigger()` and `case 'Tab'` both go from all three fields —
43 lines out, none in. The reasoning is that the interception only reproduced what
the browser already does: the trigger is the next tabbable in DOM order, and
`_setSegmentFocused` has already left the focused segment at `tabindex="0"`. The
handler's whole contribution was destroying the roving state on its way through.

So the port treated the blanket clear as the bug, when the bug was **intercepting
`Tab` at all**. The fix converges the three broken fields onto the two that were
already correct, rather than adding a hand-maintained invariant to all five.

**The generalisable rule**, and it is worth carrying to the next port: *when a
ported handler's only job is to re-implement a browser default, the fix is
deletion, not correction.* React makes the other half free — each segment's
`onFocus` already sets the roving state, so "the tab stop follows focus" needs no
code, only the absence of code fighting it.

Result: TimeField **39 / 0**, MonthField 33 / 1, WeekField 36 / 1 (the remaining
one each is the `Intl` locale fix, a different agent's work). All 15 of upstream's
new tests pass unmodified, including the composite-widget exclusion the calendar
grid and wheel columns had to satisfy — and note upstream added *tab-stop
membership* tests on top of the two roving ones, because containment is not
membership.

**The prediction held.** F-042 derived DateField's immunity structurally — it has
no `case 'Tab'`, so the browser moves focus and the roving `0` survives — and
flagged that family breadth needed four measurements rather than one inference.
Upstream measured all five independently and got exactly that split. Its own
commit message puts it from the other side: *"no inference would have produced
that"*. Both are true, and the distinction matters: the **split** had to be
measured, but given the mechanism the **immunity** was derivable.

---

### F-052 · `pkill -f "next start"` does not match the server, and the failure is silent

**Surface:** the project's own tooling. **The root cause of three wrong reports in
this document.**

The running Next production server is named `next-server`, not `next start`. So
`pkill -f "next start"` matches nothing and exits successfully. A restart then
hits `EADDRINUSE`, `next start` never binds — and the **old** server keeps
answering `200` from a `.next` that later builds have overwritten.

The observable result: an unstyled page (a `500` on the globals CSS chunk, whose
file was replaced under the running process), dead client JS from stale chunks,
and HTML from a build before the newest components were mounted. Every symptom
looks like an application defect.

It cost this project three wrong reports, the worst of which was reporting a set
of "regressions" that did not exist, and being corrected by a human opening the
page and finding it visibly broken while the suite was green.

**Decision:** kill by port (`lsof -ti:$PORT | xargs kill -9`) and **read the
server log for `Ready in` before testing**. `curl` returning `200` proves only
that *something* is listening — which is exactly the trap. Both are now in
`web/scripts/conformance.sh` and in the playbook.

Related, found the same way: `pgrep -f "playwright test"` **matches its own
compound command string**, so a guard written inline self-reports busy. Call it
standalone.

Neither of these is about the library. They are recorded because this project's
sharpest recurring theme is that the measuring apparatus fails more quietly than
the thing being measured, and these are two more instances.

---

### F-053 · Upstream found two `WheelColumn` defects this port structurally could not see

**Surface:** `src/kernel/js/WheelColumn.ts`, upstream `52356b8`. **The first time
in this project the loop runs the other way** — the library finding port drift
rather than the port finding library defects.

`52356b8` fixed three defects. This port had found **one** (F-030, the stranded
module-level lock). The other two, and why we were blind to each:

**Tapping a wheel option never worked with a mouse.** `setPointerCapture`
retargets the compatibility mouse events, so `mousedown`/`mouseup`/`click` all
arrive with `.Wheel` as the target; the `click` handler's `closest('.option')`
found nothing and returned silently. It worked on touch only.

We could not see it because **our own jsdom stub for `setPointerCapture` erases
the retargeting that *is* the bug.** The test double removed the mechanism under
test. That is worth stating plainly: a stub written to make a DOM API available
can also make a defect in that API unreachable, and nothing about the test looks
wrong.

**The spinbutton published the previous value.** The snap and reduced-motion paths
called `render()` before `_commit()`, and `render()` writes
`aria-valuenow`/`aria-valuetext` out of `_currentValue`. So there was no
`aria-valuenow` at all on the first gesture from an empty field, and one step
stale for every gesture after.

We had two `aria-valuenow` assertions and both passed — because both drive the
value through `setValue()` or the constructor, which set the value *before*
rendering on their own. **Coverage of an attribute is not coverage of the paths
that write it.** That is the same shape as F-040's vacuous passes, arrived at from
a third direction.

**And the lock fix was the same fix, independently derived.** Upstream's
`if (_activeWheelCol === this) _activeWheelCol = null` is character-for-character
the body of our `releaseWheelLock()` — same guard, same position in `destroy()`
(our indirection existed only to dodge a `no-this-alias` lint rule). So the
`[PORT FIX]` marker is removed and upstream's form adopted: **the port now carries
no behavioural deviation from the reference.** Two people reading the same code
from opposite ends reached an identical one-line fix, which is the strongest
evidence available that it was the right one.

F-045's dark band is measured gone: the wheel fade now ends at `rgb(35,35,32)`
against a `rgb(35,35,32)` popup — ratio **1.000**, where F-045 measured 1.19.
Upstream fixed the same `Canvas`-as-surface mistake in `ScrollArea.css` and
`ToggleTip.css` too, and re-copying those verbatim brought both across.

---

### F-054 · An upstream regression test that is itself not portable

**Surface:** upstream `3c7df5b`'s `de-DE` tests. Four of this port's remaining
eight failures.

The locale fix itself ported cleanly, and separates the two concerns exactly as
F-041's analysis said it should — `localeTag` for everything `Intl` touches,
`locale` for our own translated strings. Upstream knew three things the port's
report did not: the collapsed key reached `Intl` at roughly **20 call sites across
all four** calendar fields, not just MonthField; WeekField's `Wk` / `Week 23` are
strings the library itself wrote with no `de` bundle, so they stay English on
purpose; and the root cause is the demo set — *"a demo set that agrees with the
bug is not coverage."*

Re-measured in Chromium on a production build, popups open:

| Instance | before | after |
|---|---|---|
| MonthField wheel | `February…October` | **`Februar März April Mai…Oktober`** |
| DateField | `Mon…Sun` / `June 1990` | **`Mo Di Mi Do Fr Sa So`** / **`Juni 1990`** |
| DateTimeField | `Mon…Sun` / `May 2026` | **`Mo Di Mi Do Fr Sa So`** / **`Mai 2026`** |
| WeekField | `Wk Mon…Sun` / `June 2026` | **`Wk` + `Mo Di Mi Do Fr Sa So`** / **`Juni 2026`** |

`en-GB` and `sv-SE` byte-identical before and after.

**And the four tests still fail.** They set up their state by rewriting
`data-locale` in the served HTML via `page.route`. That works only because the
reference reads the DOM at `attach()`. Per F-048 this port inverts that — locale
is a **prop**, and `data-locale` is a rendered *output* — so the rewrite lands on
an attribute nothing reads back, the tests open an `en-GB` instance, and are
surprised to find English.

Pointed at a `de-DE` instance through the suite's own documented `TARGET_ID`
seam, **all four pass**. So the component fix is complete and the gap is purely
where the test gets its locale from.

**Decision:** leave them failing. Adding a client-side `data-locale` read would
satisfy the test by reintroducing exactly the pattern F-048 rejected — a
client-only DOM read that determines rendered text, i.e. a hydration mismatch — to
buy nothing but a test technique.

**Upstream suggestion:** select a `de-DE` demo instance by `data-id` rather than
rewriting the response. Same coverage, no assumption about *when* the component
reads its locale.

This is the fourth member of a family now: F-011 (byte-identical `style`), F-038
(`localStorage`), F-050 (unscoped `.popup`), and this. Every one is a **mechanism
assumption inside a suite whose own test 8 says it asserts the end state**.

---

### F-055 · The dead-attribute check the port proposed exists upstream, is general, and finds less than reading did

**Surface:** upstream `f7ab857` and `c2d12c2`, DateTimeField.

The port's DateTimeField findings proposed a check nobody had: *assert that every
attribute selector in a component's stylesheet is reachable from the DOM it
renders.* It found real dead CSS by reading — `td[data-today="true"]` and
`td[data-disabled="true"]` styled, never set, so today was not bold and an
out-of-range day looked normal, while DateField's JS set both.

Upstream built it: `tests/dead-attribute-selectors.unit.test.ts`, one `it()` per
component across all eighteen, plus a `philosophy.md` rule. Three honest results:

- **It catches `data-today` but would not have caught `data-disabled`.** It reads
  attribute *names*, not element context, and DateTimeField writes `data-disabled`
  on its own root — so the name is present somewhere and the check is satisfied.
  Reading found more than the automated form does.
- **The runtime version the port actually suggested was built and rejected.**
  Checking reachability against the live DOM flagged **81 of 193** selectors,
  mostly mutually exclusive enum states. The idea was right and the proposed
  implementation was wrong.
- **It runs over submodule sources only, so our ports are uncovered** — and its
  regexes would port nearly unchanged (`(data-[a-z0-9-]+)\s*=` already matches
  JSX). It would have flagged our dead `data-today` read.

**And `#57`'s `Clear` failure was an exposed old gap, not a new requirement.** The
commit is titled "check attribute values not just names", but the value-level
check did not find it — the *tab-stop membership* test did. Upstream's
`_calendarTabStops()` already filtered on `!clearBtn.disabled` before the fix: the
**reader shipped and the writer never existed**. Our port faithfully reproduced
both halves, including a comment asserting the button is never disabled.

Structurally identical to the dead CSS: a read with no write. That makes it the
third instance of F-040's theme — an assertion checking less than it appeared to —
and the first of the three found by the library rather than by this port.

---

### F-056 · Two more failures in the measuring apparatus, both mine

**Surface:** `web/scripts/conformance.sh`. **The fourth and fifth instances of
this project's most persistent theme.**

**`pgrep -f "playwright test"` matches wait loops, not just runners.** The guard I
wrote to prevent concurrent runs matched every shell that merely *mentioned* the
string — other agents' waiters, other guards, its own command line. With several
agents active it self-blocked, and every waiter waited for every other waiter; one
agent's run was killed at timeout having never started. Fixed to match the binary:
`pgrep -fl "\.bin/playwright"`.

**DateTimeField was missing from my own conformance array.** The first
authoritative sweep reported **360 / 7** and looked entirely plausible. The real
figure with all eighteen components is **397 / 8**. A runner that silently covers
seventeen of eighteen is precisely the failure mode F-040 is about, committed by
the person who wrote F-040.

Neither is about the library. They are here because the pattern is now
unmistakable and worth stating as a conclusion rather than an anecdote: across
this project the **measuring apparatus failed more often, and more quietly, than
the thing being measured**. Stale server answering 200 (F-052), dev-server
hydration inside a click gesture (F-049), concurrent runners producing a bogus
runner error (F-049), a self-blocking guard, a runner missing a component, and a
jsdom stub that erased the defect under test (F-053).

The library's own suite has the same property — that is F-040 — and it is the one
finding from this port that generalises past this library entirely.

---

## Phase 7 — Looking at it

The suite was green and the page still looked wrong in three places, all found by
a human opening it. Two turned out to be the same bug, and it is the sharpest
Tailwind-specific finding of the project.

---

### F-057 · The library's element lexicon collides with Tailwind's utility names

**Surface:** `.grid` and `.ring`. **This validates ADR-0026 harder than the
test-selector argument did.**

ADR-0019 gives internal parts deliberately generic, single-word lowercase names —
`.content`, `.options`, `.popup`, `.trigger`, `.rail`, `.arrow`, `.grid`, `.ring`
— **precisely so a consuming project can swap them for its own utilities.**
Generic single words are also exactly what a utility framework generates. Measured
in Chromium:

| Part | Computed | What the user saw |
|---|---|---|
| `.grid` on the calendar `<table>` | `display: grid`, `grid-template-columns: 262px` | Not a table at all — a one-column grid. Cells fell back to their intrinsic 7 × 32 px = 224 px inside a 262 px box, leaving **38 px of dead space** to the right of every calendar. |
| `.ring` on each wheel column | `box-shadow: rgb(38,37,30) 0 0 0 1px`, from Tailwind's `--tw-ring-shadow: 0 0 0 calc(1px + 0px) currentcolor` | A 1 px grey rectangle around every wheel column. `currentcolor` resolved to `--color-ink`. |

`.container` and `.table` are also Tailwind utilities. Neither is currently styled
by a component, so neither bites — yet.

**The mechanism is precise, and it is the useful part.** The collision only bites
where the library **relies on a UA default instead of declaring the property**.
`.DateField .popup .grid` sets `width` and `border-collapse` but never `display`
— a `<table>`'s display comes from the UA stylesheet, and any author-level
`.grid { display: grid }` beats it. Same for `.ring`: no `box-shadow` is
declared, so Tailwind's ring lands unopposed. Where the library *does* declare
(`.popup { border: … }`) there is no collision at all, because the rooted
selector is more specific and wins normally.

So this is not a specificity problem and cannot be fixed by ordering. It is a
**gap in the declared surface**: every generic class name that leaves a property
at its UA default is an open slot for a utility of the same name.

**Decision:** repaired in our layer, `web/src/styles/tailwind-collisions.css`,
not in the verbatim component CSS — the collision is a property of this project's
environment, not a defect in the reference. Two rules. Verified: `.grid` computes
`display: table` and fills the popup (cells grew from 32 px to ~37 px, which is
also a WCAG 2.5.8 target-size improvement), `.ring` computes `box-shadow: none`.

**Upstream, two options.** ADR-0026 is the durable one — part identity as
`data-part` means no part name can collide with a class-based utility ever again,
and this is a much more concrete argument for it than "the suite selects on class
names". The cheap one is to declare the defaults: `display: table` on the grid,
and treat any lexicon word that is also a common utility name as requiring an
explicit declaration for the property that utility sets.

**And note what caught it: a person looking at the page.** Not the suite — every
one of the 397 assertions passed with a one-column calendar and a boxed wheel,
because none of them measures appearance. PORTING.md says this outright — *"the
suite proves behaviour and a11y, not appearance"* and *"verify it with a
deliberate side-by-side against the reference's live demo"* — and this is the
first time in the project that instruction actually paid.

I also got it wrong twice before getting it right: my first probe read `.Wheel`
rather than `.ring`, and my second truncated the `box-shadow` string at 60
characters — the visible ring was in the part I cut off. I reported "there is no
border" and was wrong. Recorded because F-056's theme is the apparatus failing
quietly, and this is an instance of it in the diagnosis rather than the harness.

---

### F-058 · The arrow's outline is progressive enhancement; the bubble's border is not

**Surface:** `.arrow` across the popup family. A design decision, recorded
because the split is the interesting part.

The arrow is a rotated square with `background-color` and no border, so it reads
as a notch cut out of the bubble's outline. The obvious fix — put a border on it —
draws a line across the bubble's edge where the two overlap.

**The split:**

- **The bubble's border is load-bearing and stays in the base.** Measured: a
  popover sits at **1.07:1** against the page, and `--ui-shadow` is a 1 px
  hairline ring at **1.48:1** (F-006), so `--ui-border` at **3.84:1** is the only
  thing delineating the panel. WCAG 1.4.11 applies to a floating panel's
  boundary. So "drop the border" — the cheapest option — is not available to this
  design system, and that is a measured conclusion rather than a preference.
- **The arrow's outline is decoration and goes behind a feature gate.** Without
  it the arrow is a filled blob: cosmetically imperfect, functionally complete.
  ADR-0005's rule exactly — load-bearing behaviour never depends on feature
  detection.

**What changed since the library's own backlog spec.**
`2026-05-08-datefield-svg-mask-arrow-design.md` proposed a JS-generated SVG mask,
and named its own blocker: *"`clip-path: polygon()` supports CSS variables but no
curves; `clip-path: path()` supports curves but not CSS variables"*. Two things
close that gap now: `shape()` accepts both curves and `var()`, and `border-shape`
takes a `<basic-shape>` — so the arrow offset the components already compute into
`--_df-arrow-offset` feeds straight in, with no path-string generation, no
`<defs><mask>`, and no `getComputedStyle` of the radius. And unlike a mask, a
border *has* a stroke, which was the point. Measured available in Chromium 147.

The spec can probably be closed as superseded by the platform. The gate is
written out in `tailwind-collisions.css` with the geometry left to Phase B, where
the rest of the translation lives.

One constraint the gate has to respect: **`.arrow` may become visually inert but
must not be removed from the DOM** — the conformance suite selects it (F-008).

---

### F-059 · CSS anchor positioning cannot be progressive enhancement here, and the reason is structural

**Surface:** `src/kernel/js/popup-position.ts`. Parked, not actioned.

`anchor-name`, `position-area` and `position-try-fallbacks` all measured
available in Chromium 147, which invites the thought that a kernel module with 11
conformance tests could become a few lines of CSS. It cannot, and the reason is
worth recording because it is not the obvious one.

**It is not primarily about support** — and measuring one engine is not support
data, which is a mistake I made in raising it.

**It is that anchor positioning is a layout mechanism, not a paint change.**
`border-shape` (F-058) is safe to gate because the DOM is identical either way:
delete the block and the arrow is a filled square. Anchor positioning requires
the popup to stand in a particular relation to its anchor, *and* requires the JS
that currently computes offsets not to run for anchored instances. That is two
code paths and potentially two DOM structures, which **fails the deletability
test outright** — the `@supports` branch could not be removed without touching
code outside it.

**And the safety property is the real blocker.** The component currently
guarantees the popup never spills: `--SITE--PADDING` clearance, clamping in
`calculatePopupOffset`, and 11 kernel tests asserting it.
`position-try-fallbacks` offers flip and shift, but *proving* equivalence to
"never spills, at 320 px, in RTL, inside an overflow ancestor" is a sandbox
exercise, not a refactor — `position-visibility` and ADR-0012's documented
clipping limitation both sit inside that question.

**Decision:** parked as an ADR-shaped question for the library, not a fix for this
port. Whoever picks it up should expect a sprint of verification before a line of
production CSS, and the deliverable is the equivalence proof, not the CSS.

---

### F-060 · ADR-0006's native fallback is functionally right and dimensionally wrong

**Surface:** all five popup fields. **Closes the CLS item opened in F-049.**

ADR-0006 says a custom control falls back to the native one on coarse pointers,
and F-046 recorded the payoff: because the input-mode store's server snapshot is
`null`, the stylesheet's default branch paints the native `<input>` as the
control, so the field is **fully usable before hydration**. That is progressive
enhancement working exactly as designed.

It is also the wrong box. A native `<input type="date">` paints well under the
2.5rem that ADR-0008's field-height contract guarantees the custom layer, so
every instance jumps when the mode resolves. Measured per route, document height
before and after hydration:

| Field | Instances | Before | After |
|---|---|---|---|
| MonthField | 17 | **Δ112 px**, CLS 0.0555 | **Δ0**, CLS 0.0116 |
| DateField | 17 | **Δ96 px**, CLS 0.031 | **Δ0**, CLS 0.0071 |
| TimeField | 16 | Δ0 | Δ0, CLS 0.0013 |
| DateTimeField | 18 | Δ0 | Δ0, CLS 0.0064 |
| WeekField | 17 | Δ0 | Δ0, CLS 0 |

Two things worth noting about how this was found and closed:

**DateField was never on the list.** F-049 named MonthField and TimeField from the
ToggleTip port's bisection of the *shared* page. Measuring each field on its own
route found TimeField already clean and **DateField shifting 96 px** — a component
nobody had flagged. The earlier attribution was correct about the shared page and
incomplete about the cause.

**The fix already existed in the port.** DateTimeField's porter reserved the
pre-hydration height from the stylesheet's own token
(`min-block-size: var(--_dtf-field-min-block-size)` while `inputMode === null`,
dropped once it resolves) and landed at Δ0. Applying the identical pattern to
MonthField and DateField closed both. Reading the token rather than hardcoding
`2.5rem` means the reservation tracks whatever the verbatim stylesheet declares.

**Why it mattered beyond Core Web Vitals.** This is the mechanism behind F-049:
Playwright computes a click point and *then* moves the mouse, so a shift landing
inside that gesture pushed triggers out from under the aim and failed four
unrelated components with messages accusing their own mechanisms. Fixing the
shift removes the cause rather than the symptom.

Residual CLS is 0.0064–0.0116, all of it horizontal — the native input and the
overlay differ by about 5 px of inline size, and there is no token for that.
Well inside the 0.1 "good" threshold, and left alone rather than hardcoded.

**Upstream suggestion:** ADR-0008 fixes the field's height contract for the
*resolved* states and says nothing about the pre-resolution state, which is a
state the contract genuinely has — every SSR consumer renders it. One sentence
would cover it: *the pre-`attach()` native control reserves the same minimum
block size as the custom layer that replaces it.* Verified no conformance change:
**397 / 8** before and after.

---

## Phase 8 — The second port: Razor primitives

A different porting problem from the same author's other repo: the Razor
TagHelper set that covers everything the accessibility library does not —
buttons, cards, headings, media, prose, teasers. Eight components, three shared
statics, ~1 060 lines of component CSS, and **no conformance suite at all**.

The owner's sequencing, deliberately three separable steps: lift the structure →
restyle to `cursor-DESIGN.md` → convert to Tailwind. The Button family (five
sources, one stylesheet) went first because the rest build on it.

---

### F-061 · Bridging the semantic tier was half right, and colour was the half it missed

**Surface:** `web/src/styles/primitive-tokens.css`. **My error, found by the port.**

The source is a two-tier token system: SCREAMING constants (`--COLOR-N90`, a cool
blue-tinted neutral ramp at hue 257°) feeding lowercase semantics
(`--text-primary`, `--bg-purple-primary`). I bridged the **semantic** tier only,
reasoning that constant-to-constant mapping would mean inventing forty warm
equivalents and would preserve a palette structure we do not want, while the
semantic tier is the layer that carries meaning.

Sound reasoning, wrong premise. `Button.css` reads colour **straight from the
constant tier** — `var(--COLOR-B80)`, `var(--COLOR-N00)` — bypassing the
semantics entirely. Measured after step 1: primary and secondary buttons
pixel-identical, `background-color: rgba(0,0,0,0)`, text falling back to
inherited `--color-body`. **Typography and spacing came through; colour did
not.**

So the tier a component *declares* through is not the tier it *reads* through,
and a bridge built on the declared architecture covers only what the components
happen to route that way. The only colours that did render came from the source's
own inline fallbacks — `var(--COLOR-R60, #d63031)` — and `R60`/`G60` do not exist
in the source palette either, so those fallbacks were always the live value.

**Decision:** the gap is closed in step 2 by retinting to our tokens rather than
by extending the bridge downward. Adding forty constant mappings would make the
bridge carry a palette we are replacing.

**The generalisable point:** a two-tier token system is only as good as its
components' discipline about which tier they read. Verify by grepping the
components for constant-tier reads before trusting a semantic bridge — a
measurement, not an assumption.

---

### F-062 · The blank-property gate does not survive a Tailwind conversion, and the cost lands on the consumer

**Surface:** `Button.css`, step 3. **The clearest answer yet to the project's
original Tailwind question.**

`Button.css` is built on the idiom the reference library's philosophy is also
built on: declare a custom property **blank** in the base rule
(`--_borderRadius: ;`), then have a variant gate fill it. About thirty blank
properties, and it is the same "conditional properties live behind a gate"
pattern `philosophy.md` prescribes.

Converted to utilities, **it becomes dead code.** The gate has nothing to gate
because the value now lives in a class on the element. Deleting it is a genuine
simplification — thirty declarations gone, `CtaButton.css` emptied entirely, and
`Button.css` reduced to debug pseudo-elements no utility can reach.

**And it removes the seam a consumer overrides through.** The source's own
`style.css` re-tints buttons over a hero image in **nine lines**, by setting
those blank properties in a scoped rule. After the conversion that override has
nowhere to attach: the winning value is a utility class on each element, so
re-tinting means either editing every call site or fighting specificity.

That is the trade stated precisely, and it is not visible from either end alone:
**the utility conversion is a real simplification for the component author and a
real loss for the component's consumer.** ADR-0017 and ADR-0018 exist to give a
consumer exactly that override surface. A Tailwind port keeps the design tokens
and discards the *per-component* override seam.

Recorded as the finding rather than resolved. Whether to keep a token seam
alongside the utilities is a design decision, not a porting one.

---

### F-063 · Two state colours were sized against the wrong ground, in the exact way the library warns about

**Surface:** `design-tokens.css`. **My error, caught by a subagent that refused
to work around it in my files.**

F-005 and F-021 sized the four state colours against a **white card** and
reported them clearing AA. Two of them do not clear it against the **cream
canvas** they also land on:

| Token | on card | on canvas | on canvas-soft |
|---|---|---|---|
| `--color-semantic-success` `#1e8662` | 4.52 ✓ | **4.22 ✗** | **4.33 ✗** |
| `--color-semantic-warning` `#9d6d29` | 4.51 ✓ | **4.20 ✗** | **4.32 ✗** |
| `--color-semantic-error` `#cf2d56` | 5.04 | 4.70 | 4.82 |
| `--color-semantic-info` `#5b6b7f` | 5.45 | 5.08 | 5.21 |

Both sat *just* over 4.5 on white, which is the signature of a value tuned to the
wrong reference and the reason it looked settled.

**The library warned about this in the file I was mirroring.** `ui-tokens.css`
says of its own muted foreground: *"the ratio is picked against the TIGHTEST
surface it lands on, not against Canvas"* — and F-004 quotes that sentence
approvingly while doing the opposite two entries later.

**Decision:** success → `#1d805e` (4.55 on canvas), warning → `#966827` (4.53).
Both re-verified on all three grounds. Dark halves unaffected — they were sized
against the dark card, which is their tightest ground.

Worth noting how it surfaced: the Button porter hit success at 4.22 under a
button label, was told `web/src/styles/**` was off-limits, and **worked around it
in its own component with a token-derived `color-mix` while reporting the token
as the real defect** rather than silently patching my file. That is the behaviour
the file boundaries were for.

---

### F-064 · The override seam dies at step 2, not step 3, and it dies to the cascade LAYER — not to specificity

**Surface:** `Card.css` under Tailwind v4. **Supersedes the mechanism in F-062;
its conclusion stands and its explanation was wrong.**

F-062 concluded that the blank-property gate idiom becomes dead code under a
Tailwind conversion, and that this removes the seam a consumer overrides
through. Both true. But the Card port measured *when* and *why*, and the answer
is earlier and worse.

**Tailwind v4 emits its utilities inside `@layer utilities`. A component
stylesheet imported from a JS module is UNLAYERED. Unlayered normal declarations
beat every layer, regardless of specificity.**

So `:where(.Card)` — written at specificity zero *precisely* so that one
consumer class can win — is irrelevant. The component wins because it is
unlayered, and `:where()` is exactly what makes that invisible: the author sees
zero specificity and reasonably expects to lose.

That means the seam was already dead **at step 2**, before any conversion, and
step 3 does not restore it. After conversion both sides sit in the utilities
layer, where Tailwind emits `.bg-*` **alphabetically** — so a consumer override
wins if and only if its token name sorts after the component's.
`bg-surface-card` beats `bg-ink` and `bg-canvas`; it would lose to
`bg-surface-strong`. Ordering by identifier, not by intent.

**And the worst part is measured:** the two halves of a single override resolve
by *different rules*. `[&_*]:text-canvas` wins on **specificity**; `bg-ink`
loses on **layer**. So a half-applied override is the default outcome, not an
edge case — the port measured real AA failures of **1.07:1 and 1.10:1** in a
demo before restructuring it.

This also reconciles F-057, which looked contradictory: there Tailwind's `.grid`
beat the library's `.grid`. It did, because the library never *declared*
`display` — there was nothing unlayered to win. Where component CSS declares,
it wins; where it leaves a UA default, the utility wins. Two mechanisms, one
consistent rule.

**Decision — recorded, not acted on.** The fix is one line per component
stylesheet: wrap it in `@layer components { }`, which puts it below utilities and
restores the normal Tailwind expectation *and* the consumer seam. It is not taken
yet for two reasons worth stating. First, the reference-component stylesheets are
verbatim Phase A copies, and wrapping one in a layer is an edit to the copy.
Second, it trades against a deliberate early decision: components import their own
CSS so each stays deletable in one move (see `globals.css`), and a JS-imported
stylesheet cannot be assigned a layer at the import site the way
`@import … layer(components)` can. Moving to a central layered import list would
restore the cascade and give up the deletability.

That is a genuine architectural trade, not a bug fix, and it belongs to a Phase B
decision rather than to a component port. **It is also the single most useful
thing this project has to say to anyone putting a component library and Tailwind
in the same app.**

---

### F-065 · A predictor for whether a Tailwind conversion is mechanical

**Surface:** Button versus Card, steps 2–3. A positive finding.

The Button family's conversion cost three things: the blank-property gate became
dead code, two `px-*` utilities collided at equal specificity where Tailwind's
value-sorted stylesheet order picked the winner, and the `calc()` relationships
had to be resolved to values. Card's conversion cost **none** of them —
**0 property diffs across 26 instances × 2 appearances × 2 elements**, and
`Card.css` went from 45 lines to *empty*.

That is not luck, and the port worked out why:

| Button | Card |
|---|---|
| axes overlap — several gates write the same property | axes are **orthogonal**: padding, border and elevation each own different properties, so no gate ever overrode another |
| has states (`:hover`, `:active`, `:disabled`) — properties written more than once | **no states** — nothing written twice |
| uses `calc()` — relationships, not values | **no `calc()`** — nothing relational to lose |

So there is a cheap test before committing to step 3: **grep the stylesheet for
`calc(`, for any pseudo-class state, and for any selector carrying two
attributes.** All three absent means the conversion is mechanical. Any present
means the conversion has a cost to price first.

Button was three for three. Card was zero for three. A second data point does not
make a law, but the mechanism behind each of the three is clear enough to act on.

---

### F-066 · An unbridged token does not degrade to nothing — it degrades to the host reset, which can be the opposite of the intent

**Surface:** `Card.css`. **Sharpens F-061.**

F-061 recorded that the token bridge answers the semantic tier while component
CSS often reads the constant tier directly, so colour simply did not arrive.
"Did not arrive" turns out to be too generous.

`Card.css` has exactly **one** `--COLOR-` read in 45 lines, and it is the border
colour — the one axis actually carrying design. With the token unbridged, the
`var()` was invalid, and because it sat inside a **shorthand** (`border`), an
invalid `var()` makes the whole shorthand invalid at computed-value time. The
property fell back to what the host reset had left.

Measured result: `data-border="true"` computed `border-style: **none**`, while
`data-border="false"` kept Tailwind preflight's `solid`. **The axis rendered
inverted.**

So the failure mode of an unbridged token is not absence, it is whatever the
consuming project's reset happens to say — and with a shorthand it can take three
other properties with it. Grepping components for constant-tier reads before
trusting a semantic bridge (F-061's conclusion) matters more than F-061 implied:
the symptom may not look like a missing value at all.

---

### F-067 · A fourth React 19 compiler rule, and the pattern is now unmistakable

**Surface:** the primitive ports. Extends F-051's observation.

Four distinct compiler rules have now rejected four idioms that a port from
imperative markup-plus-JS arrives at naturally:

| Rule | The idiom it rejects | Found in |
|---|---|---|
| `react-hooks/set-state-in-effect` | `useEffect(() => setState(true), [])` — the "am I hydrated" gate | MotionRegion, ScrollArea |
| `react-hooks/refs` | a props factory or validator dereferencing a ref during render | FileUpload, MonthField, WeekField |
| `react-hooks/immutability` | a render-loop accumulator; state mirrored into a ref an effect depends on | CircleDiagram, CoverCompositionVideo |
| `react-hooks/static-components` | `const Element = tag; <Element>` — a component choosing its own tag name | Card, and two other TagHelpers exposing `element` |

The last is the most structural: **a TagHelper that picks its own tag has no JSX
form in React 19.** `output.TagName = "a"` is ordinary in Razor and three
TagHelpers in this set expose an `element` prop; `createElement` is the only
route. That is not a style preference, it is a capability the source language has
and the target does not.

Where the fix has been measured it has been *better* rather than merely
compliant — `useSyncExternalStore` was faster (two commits became one, and
ScrollArea's enhancement window went 13.6–27.5 ms → 6.1–11.0 ms), and hoisting
the ref-dereferencing helper removed a read that was silently degrading to a
fallback. Whether that holds for the immutability pair is still open and has been
asked for explicitly rather than assumed.

---

### F-068 · CTABlock: not a variant, not dead — a Card composition with the wrong root, and the provenance is conclusive

**Surface:** `CTABlock.css`, one of the four orphan stylesheets with no TagHelper.

The reconnaissance answer is that it is **a live component that is a *composition*
of Card**, and it has no TagHelper because it is not one: it is an Umbraco
rich-text block partial. `seed.sql:191` creates the doctype `rteCTABlock`,
`rteCTABlock.cshtml` renders it, `style.css:14` imports the CSS. Its "props" are
content-model fields, which is why the C# contract is missing.

Twelve of its twenty declarations are Card's — same radius literal, same
`var(--COLOR-N30)` border, same flex column — **including both `TODO` comments
copied verbatim.** Copied comments are conclusive provenance in a way duplicated
declarations are not. Three declarations genuinely differ (a smaller gap, a
`margin-block` that belongs to the rich-text flow rather than the card, and the
root element) plus one part it owns, `.CTABlock-actions`.

**And the root element is a defect, measured rather than assumed.** Card's
element allow-list excludes `aside`, which looked like a blocker until the port
rendered a faithful `<aside class="CTABlock">` and got a real axe violation in
both appearances — `landmark-complementary-is-top-level` — because a CTABlock
renders inside rich-text content inside `<main>`. **Card's allow-list is right and
CTABlock's root is wrong**, and the source produces the same violation today.

**Recommendation:** a `<div>` root, then collapse the stylesheet to
`.CTABlock-actions` plus the margin and let `app-card` supply the frame. That is
sixteen of twenty declarations deleted and an accessibility defect fixed, and it
is a good upstream item for the Razor repo.

---

### F-069 · The family collapse serves the design doc; the size map is what does not

**Surface:** `Heading.css`, `Prose.css`, step 2. **The measurement I asked for
instead of an impression, and it overturned the expectation.**

The source runs four families — Fira Sans headings, **Abril Fatface** display,
**Noto Serif** body, Inter labels — against our one sans. That looked like the
port's largest and most damaging change. Measured, it is neither.

**Cap-height ratio:** Abril 0.70, Fira 0.69, Noto 0.71 → Inter **0.73**. The four
faces are **metrically interchangeable**, which is the mechanical explanation for
something otherwise suspicious: step 1 already looked broadly right.

**And the collapse actively serves the design doc.** Normalised to a 100 px cap
height, display **ink coverage falls 33.7 % → 25.7 %, a 24 % reduction, while the
advance width moves 1 %.** A 24 % ink reduction at unchanged proportion is a
mechanical description of `cursor-DESIGN.md`'s stated intent — *"a
magazine-editorial voice rather than tech-bombastic"*. The doc asked for less ink
at the same footprint, and swapping a fat display serif for Inter 400 delivers
exactly that.

**What does not survive is the size map, and it is a separate axis.** The
editorial voice is achievable at `display-1` (72 px, −2.16 px tracking) and not at
`display-2` or `display-3` — those are **−36 %** and **−46 %** against the source.
Nine steps onto six costs one collision and yields seven distinct sizes, which is
nearly free on paper. In practice it fails three measured ways:

- the display ramp becomes a **cliff**: ×2.00 then ×1.38, against the source's
  ×1.14 / ×1.17
- **`h6` lands 11 px below 16 px body text**, which inverts the hierarchy
- `h5` is size-identical to body

**Decision:** the family collapse stands, on the evidence. The size map needs
three more steps between `display-md` and `title-md`, and `h6` needs a floor at
body size. That is a change to `cursor-DESIGN.md`'s scale, so it is the project
owner's call — recorded as an open question, not applied.

**And `--baseline-offset-*` never ran.** F-062 neutralised it at 1 on the ADR-0025
argument that a value which only changes appearance is taste. Grepped and then
measured: two reads, both inside `Heading.css`'s `@supports not` fallback, both
`calc(<length> + <unitless>)` — which computes to **0 px in all four
combinations**, including with the token absent, because the `var()` fallback `0`
is unitless too. The branch is also unreachable in current Chromium. The decision
was right; the reason was weaker than stated — it was already inert in both
branches at every value.

---

### F-070 · Prose cannot be converted to utilities, and the proof is a specificity inversion

**Surface:** `Prose.css`, step 3. **A negative result, argued — and the sharpest
limit found on the Tailwind question.**

Prose styles descendant elements it never renders (`.Prose p`, `.Prose li`, …).
Utilities attach to elements. So the only conversion route is Tailwind's
arbitrary-descendant escape hatch, `[&_p]:…`.

That generates `.class p` at specificity **0,1,1**. The shipped stylesheet uses
`:where(.Prose) p` at **0,0,1** — deliberately, so a consumer can override with a
single class. Measured with the consumer's rule placed *first*, so only
specificity could decide the winner:

| | consumer override |
|---|---|
| today (`:where()` CSS) | **wins** — 11 px applied |
| after conversion (`[&_p]:`) | **loses** — 102 px applied |

Converting Prose destroys the only feature Prose has. It stays as CSS, and that
is the finding rather than a failure.

**Confirmed on the real consumer, which makes it more than theory.**
`TeaserTagHelper` hand-writes both components' markup rather than nesting them.
Against the converted and unconverted pair:

- **Heading (step 3 applied): 4 of 6 properties wrong.**
- **Prose (step 3 declined): 5 of 5 correct.**

Every instrument was clean throughout — computed diff clean, axe clean, unit
tests passing. **So a conversion can silently break a consumer that reproduces
the markup, and nothing in this project detects it.** That is now flagged to the
Teaser port as a decision it must make explicitly: compose `<Heading>` as a
component, or revert its step 3.

**A correction to F-062, and a useful one:** the *gate* dies under conversion, but
the **token indirection survives**. `text-(length:--fontSize-h1)` was verified
computed-identical to step 2. So a utility conversion does not force raw values —
design tokens can still be read through the utility. F-062 conflated the two
losses; only one is real.

---

### F-071 · The text-spacing canary was broken twice, and the second reason is worse

**Surface:** `tests/text-spacing.e2e.test.js`. **Extends F-023.**

F-023 recorded that the reference suite's planted-violation canary cannot fire
against a design system already rendering at `line-height: 1.5`. True, and
incomplete.

The canary pins its plant's box from `getBoundingClientRect().height`. At
`line-height: 1` the descenders already exceed the line box, so the plant is
**already clipped by 2 px before the overrides are applied** — and the suite's own
baseline filter, which exists to ignore pre-existing defects, therefore discards
it. So the canary fails to fire for a reason entirely independent of the host's
line-height. Pinning from `scrollHeight` instead fixes it; the port's probe now
prints `planted violation DETECTED` before every run.

**And with a working canary, the other three axes found three real defects that
the plain reflow sweep cannot see:**

- **An unstyled `<table>`** in two Prose variants: `table-layout: auto`, a 337 px
  box at a 320 px viewport, **17 px of document scroll**.
- **`<caption>` min-content widens the table**, so `table-layout: fixed` plus
  `width: 100%` does not contain it — `overflow-wrap: anywhere` on the caption is
  required too.
- **`overflow-wrap: break-word` cannot shrink a container.** Only `anywhere`
  reduces min-content. This is not widely understood and it is worth stating
  plainly.

Plus one more instance of a defect this project has now fixed twice: **`min-w-0`
does not constrain a grid *track*.** A wrapper measured a 238 px box against a
`grid-template-columns` of **340.281 px**, the same shape as the `Cell` fix
(F-024). Two independent occurrences make it a rule rather than an anecdote:
constrain the track with `minmax(0, 1fr)`, not the box with `min-width: 0`.

**Upstream, two items.** The canary should pin from `scrollHeight`. And the
suite's target-size check has **no WCAG 2.5.8 inline exception**, producing three
false positives on inline links — 2.5.8 explicitly exempts targets in a sentence
or block of text.

---

### F-072 · `next/image` cannot express art direction, and Next's own lint rule concedes it

**Surface:** `MediaHelper.cs` → `Picture`. The framework-specific decision this
port existed to make.

`next/image` does srcset generation, lazy loading, layout-shift prevention and
format negotiation — most of what `MediaHelper` implements by hand. The obvious
move is to adopt it. Measured, the answer is to decline, and three guarantees are
why:

- **Art direction over named crops.** The `hero` preset runs 4:5 → 3:4 → 16:9 →
  21:9 — four *different crops*, not one image at four sizes. `next/image`
  renders a bare `<img>`; there is no `<source>` to switch on.
- **Container-query source selection.**
- **Focal-point crops.**

Both escape hatches remove the reason to use it: `unoptimized` gives up the
optimisation, and a custom loader leaves you with less than the source already
has. And `images.remotePatterns` **cannot** be configured for a CMS host unknown
at port time — it throws at runtime rather than degrading.

**The corroboration is the good part, and it comes from inside Next.** The lint
rule `@next/next/no-img-element` — whose entire purpose is to steer you to
`next/image` — opens with `if (parent is <picture>) return`. The rule exempts the
case its own recommendation cannot serve. Measured, not read: a speculative
`eslint-disable` for it was flagged as **unused**.

`web/next.config.ts` needs no change.

---

### F-073 · `srcset` is a fact about the image; `sizes` is a promise about the consumer's layout

**Surface:** `mediaHelper.ts`. Measured in both directions.

A central preset table can own `srcset` correctly, because the candidate widths
are properties of the image. It structurally **cannot** own `sizes`, because
`sizes` describes the layout box the consumer will place the image in — and the
preset table has never seen that layout.

Both failure directions were measured in the source:

| `sizes` value | Problem | Cost |
|---|---|---|
| `sizes="100%"` | **invalid syntax** — the grammar is `<length> \| auto`, so it is dropped and silently falls back to `100vw` | over-fetches **3.3×** |
| `sizes="12rem"` | Teaser's `--_minMediaSize`, i.e. the *minimum* | under-fetches **7.4×** |

Neither fails loudly. One wastes bandwidth, the other ships a blurry image, and
both look like a working `<picture>`.

**The consequence for an API:** `sizes` belongs to the call site, not to the
preset. A preset that ships a `sizes` value is guessing about its consumer, and a
7.4× under-fetch is what a wrong guess costs.

---

### F-074 · Three CLS measurements read 0.000 because the stylesheet was shielding the page from its own shift

**Surface:** `Picture`, and **the measurement methodology this project has been
using.**

The port measured CLS under four conditions:

| Condition | step 1 | after fix |
|---|---|---|
| local / fast-4g / slow-4g | 0.000 | 0.000 |
| **image-lag** (900 ms, `/media/**` only) | **0.253 — POOR** | **0.000** |
| unreserved height across 23 pictures | **3998 px** | **0 px** |

The first three rows are the finding. **Uniform throttling slows the
render-blocking CSS and the images together, so the stylesheet arrives late
enough to shield the page from the shift it would otherwise cause.** A measurement
that throttles everything equally cannot see an image-driven layout shift at all.
Only selective throttling — the images and nothing else — exposes it.

That qualifies every CLS number in this document taken under uniform conditions,
including F-060's. Those were measuring document-height deltas across hydration,
which is a different mechanism and unaffected, but the general lesson stands and
is now the seventh instance of this project's recurring theme: **the apparatus
fails more quietly than the thing it measures.**

**And the fix is not the obvious one.** `width`/`height` go on each **`<source>`**,
not on the `<img>`: a single pair on the `<img>` declares 21:9 while the 320 px
breakpoint actually shows 4:5, so the naive fix trades one shift for a larger one.
Upstream this needs **no new CMS data** — `GetCropUrl` already resolves a crop
that carries its own dimensions.

Also recorded by the same port: **a computed-style diff that reported "0 diffs,
46 gone, 46 new"** — zero because the diff key contained the element's class list,
which is precisely the thing under test. Re-keyed and re-baselined for a real
result. Two false greens, documented as fully as the real findings, which is the
right instinct.

---

### F-075 · A selector whose match depends on a prop cannot become a utility

**Surface:** `Media.css`, step 3. **Broader than F-062.**

Both rules that survived into step 3 were contingent on a class name the **caller
chooses** — `TeaserTagHelper` passes `pictureClass: "Media"`, so `.Media` names
the *picture* on that path and the *figure* on others. A utility cannot express
that: it is attached at authoring time, and the condition is not known until the
prop arrives.

The two selectors became two string comparisons in JavaScript.

F-062 said the blank-property *gate* dies under conversion. This is the general
form: **any selector whose match depends on a prop becomes a pre-render
decision.** CSS can branch on the DOM it finds; utilities are decided before the
DOM exists. That is a category difference, not a cost, and it is the cleanest
statement of the Tailwind limit this project has produced.

---

### F-076 · `alt=""` cannot distinguish "decorative" from "forgotten", and axe cannot help

**Surface:** `mediaHelper.ts`, and the source's own production markup.

`Alt ?? ""` makes a **forgotten** alt byte-identical to a **deliberate** empty
one. axe reports green and cannot do otherwise — both
`docs/atomica11y/main/informative-image.md` and `decorative-image-icon.md` are
satisfied by the output, and neither criterion can separate the two cases because
the DOM is the same.

It is worse in the source's production markup than in the abstract:
`_CoverComposition.cshtml` puts the **page title** in the hero image's alt, and
renders the same string as the adjacent `<h1>`. A screen reader hears it twice.

**Decision needed from the project owner:** a TypeScript discriminated union
would make intent mandatory at **zero runtime cost** —
`{ alt: string } | { decorative: true }` — so a forgotten alt becomes a type
error rather than a silent empty attribute. That is the highest-value change
available in this component and it is an API decision, so it is recorded rather
than applied.

---

### F-077 · A third stale-server variant: `next start` reads the build manifest once

**Surface:** this project's own tooling. **Eighth instance of the theme, and the
one the playbook did not name.**

F-052 recorded that `pkill -f "next start"` does not match, leaving a stale
server answering 200 from an overwritten `.next`. This is a different failure with
the same signature: **`next start` reads the build manifest once at boot.** So
when a concurrent agent rebuilds, the running server keeps serving — and serves a
**totally unstyled page**, because the CSS chunk hashes in its cached manifest no
longer exist.

`curl` returning 200, the log reading `Ready in`, and a page that renders are
**all three consistent with zero CSS applied**. Every check this project added
after F-052 passes while the page is broken. It cost the Picture port two
measurement rounds and one wrong conclusion before a purpose-built guard caught
it.

**Decision:** the guard is the fix — assert that a known token actually computes,
not merely that the server responds. And the structural fix, recommended by the
port and accepted: **give each agent its own git worktree.** The same concurrency
also caused a second problem — one agent's commit swept another's staged step-1
files, so those files landed in an unrelated commit. Both are one cause: parallel
agents sharing one working tree and one build output.

That is an orchestration error of mine, not the agents'. The Agent tool supports
`isolation: "worktree"` and I did not use it for a phase where four agents wrote
concurrently.

---

### F-078 · F-064 fixed: `@import … layer(components)` puts component CSS below utilities without touching the verbatim copy

**Surface:** all 29 component and primitive stylesheets. **Acts on F-064, and the
mechanism was validated from outside before it was applied.**

F-064 recorded the defect and declined to fix it, because the two obvious routes
both had a real cost: wrapping each stylesheet in `@layer components { }` edits a
verbatim Phase A copy, and moving to a central layered `@import` list gives up the
per-component import that keeps each component deletable in one move.

There is a third route. **`@import "./X.css" layer(components)` assigns the layer
at the import site**, so the stylesheet stays byte-identical while sitting below
utilities. Each component gets a one-line `X.layered.css` sibling and imports
that instead. Deleting a component still means deleting its directory; nothing
central references it.

**Independent corroboration, found by looking rather than reasoning.** The user
raised `@tailwindcss/typography` — which exists precisely because utilities cannot
style content you do not control, and therefore corroborates F-070 rather than
contradicting it: inspected at v0.5.20, it generates **descendant selectors with
`:where()`** plus a `:not(:where([class~="not-prose"], …))` escape, i.e. the same
construction `Prose.css` already uses. But the useful part is *how it registers*:
**`addComponents`** — the components layer, deliberately below utilities so
utilities can override it. Tailwind's own maintainers put descendant-selector
component CSS exactly where F-064 said it belonged.

**Verified in Chromium, not assumed.** A `bg-surface-strong` utility applied to a
`.Notice` root: background went
`color(srgb 0.985 0.934 0.947)` → `rgb(230, 229, 224)`. Before the change the
component's own declaration won regardless of specificity; now the utility does.

Rolled out to 34 imports across 29 files, including the kernel's `Wheel.css`.
Verbatim integrity re-checked: every reference stylesheet still differs from
upstream only by its documented sanctioned edits, and `Wheel.css` is
byte-identical. Gates after: build clean, lint 0, **303 unit tests**.

**Two things deliberately left unlayered**, because unlayered-wins is the
behaviour wanted there: `tailwind-collisions.css` (it exists to beat a utility —
F-057) and `*.kitchensink.css` (demo chrome, not shipped).

**And a decision not taken:** adopting the typography plugin instead of the ported
`Prose.css`. Two frictions argue against it. It brings its own typographic scale,
which would need a third token mapping alongside `--ui-*` and
`primitive-tokens.css`. And its dark mode is `dark:prose-invert` — a class-toggled
variant — while F-020 deliberately left this project with **no `dark:` variant at
all**, every token being a `light-dark()` pair. That is a finding in its own right:
**a `light-dark()` strategy is incompatible with any Tailwind plugin whose dark
mode assumes a class toggle.** ADR-0021 anticipated a consumer mapping
`[data-appearance="dark"]` onto its `dark` variant in one line; we skipped that
step, and the bill arrives here.

---

### F-079 · A stylesheet with no class names is not a component, and reflow forces exactly one wrapper into its contract

**Surface:** `Tables.css`, the largest of the four orphan stylesheets.

**Verdict: element-level styling, not a component.** Zero class names in 224
lines; every selector rooted at a bare `table`. Two consumers confirm it: a
533-line partial of *arbitrary* tables, and — conclusively —
`DateField.css` and `DateTimeField.css`, which both carry
`background: none; /* override global Tables.css thead th band */`. **The author's
own components fighting their own global element stylesheet** is something that
only happens to a global element stylesheet.

**But it cannot survive 320 px without a markup addition.** Measured: **578 px**
of overflow verbatim, and **219 px** for a plain five-column table of names.
`Tables.css`'s own answer — `overflow-x: auto` on `table` — computes to `visible`,
because a table box is not a scroll container. So the "no component" verdict has
exactly one limit: reflow forces one wrapper into the contract.

And that wrapper's two accessibility requirements pull in opposite directions:
**axe wants the scroll region focusable; `docs/atomica11y/main/table.md` criterion
1 says the table itself must not be.** Only `tabindex` on the *wrapper* satisfies
both. Result: 0 px overflow at all six widths.

**Recommended discards, with reasons:** the idea of a `<Table>` component,
permanently; and `Tables.css` from any route rendering reference components — it
restyles **77 %** of elements inside every table it reaches, and five ported
components render a `<table>` (the ones inside closed popups make any static
measurement an under-count).

---

### F-080 · Deriving a contract from CSS plus Razor plus JS cost four defects that no single source showed

**Surface:** `CoverComposition.css`. The inverse of the reference-components
situation, where the contract *was* the deliverable.

Contract confidence was rated **HIGH** for `CircleDiagram` — a `.cshtml` that
*enumerates* its markup is as good a contract as C# — and **MEDIUM** for
`CoverComposition`, which had three disagreeing sources. The medium one cost four
real defects, each findable only by reading Razor, CSS and JS together and then
measuring:

- **Non-clickable CTAs in the image variant** — `pointer-events: none`, because
  only the *video* variant emits `class="content"`.
- **A 12-column grid whose tokens are undefined in the source app too.**
- **An overlay that never overlaid** — three stacked silent failures: no grid, a
  `1/-1` span degenerating on an implicit grid, and auto-placement refusing to
  share a cell.
- **No scrim at all on the image variant**, so display text sat on arbitrary CMS
  media with no knowable contrast.

The last is the one that matters: it is an accessibility defect that cannot be
measured in the source repo, because the media is whatever the editor uploads.

---

### F-081 · The design system has no categorical data-viz palette, which is why every porter reaches for the timeline pastels

**Surface:** `CircleDiagram.css`. **A refusal, argued.**

`CircleDiagram` was the one component in this port with a plausible claim on
`cursor-DESIGN.md`'s five timeline pastels. The claim was declined on three
measured grounds: **six slots against five pastels**; they are *stage identities*
the doc forbids off-timeline in four separate places (mint = *Grepping* read as
"C#" actively misinforms); and they are **light-only by design** while a CMS chart
must survive the appearance flip.

Replaced with a six-step monochromatic ramp in the brand hue — honest **only
because** the chart is `aria-hidden` and the legend carries label plus value as
text, so colour is not the information channel.

**The real finding is the gap:** `cursor-DESIGN.md` has no categorical data-viz
palette at all. That is why the timeline pastels are the first thing any porter
reaches for, and it will happen again. It needs a proper categorical set —
appearance-reactive, contrast-checked against both grounds, and explicitly *not*
the timeline identities.

---

### F-082 · The bridge and Tailwind share `xs…xl` with every step shifted by one

**Surface:** `primitive-tokens.css` versus Tailwind's spacing scale. **A latent
trap in every future conversion.**

Four utilities substituted during a step-3 conversion turned out **not** to be
equivalent to what they replaced, and the counts show the blast radius:

| Utility | What it actually differs by | Nodes affected |
|---|---|---|
| `text-caption` | carries a line-height the original did not | **440** |
| `rounded-full` | `9999px` ≠ `50%` | 52 |
| `gap-xs` | **8 px, while the bridge maps `--size-xs` to 4 px** | 52 |
| `text-title-md` | overrides heading metrics | 22 |

The third is the systemic one. The source's scale is `xs 3–4 · sm 6 · md 12 ·
lg 18 · xl 24`; Tailwind's is `xs 8 · sm 12 · md 16 · lg 24 · xl 32`. **They share
the suffixes and every step is shifted by one.** So a conversion that translates
`--size-md` to `gap-md` by suffix is silently wrong by one step, everywhere, and
looks plausible.

**Rule for any future conversion: translate through the bridge table, never by
suffix.** And the sharper lesson: a computed-style diff catches this only if the
diff runs over every instance — a spot check would have passed.

Also recorded from the same port: **one undefined token killed 190 of 224 lines**
of `Tables.css` — `--_border` inside a shorthand, invalid at computed-value time,
no error reported anywhere. That is F-066's shorthand mechanism again, at nine
times the scale.

---

### F-083 · The "compiler fix is always better" pattern does not repeat

**Surface:** `CircleDiagram.tsx`, `CoverCompositionVideo.tsx`. **A correction to
F-067's optimism, made by the agent that had every incentive to agree with me.**

F-067 observed that each React 19 compiler rule rejected an idiom a port arrives
at naturally, and that the fix had so far been *better* rather than merely
compliant — `useSyncExternalStore` was measurably faster, and hoisting a
ref-dereferencing helper removed a read that was silently degrading to a fallback.
I asked explicitly whether that held for the third rule and said not to assume the
flattering answer.

It half holds. The **ref-mirroring** fix is strictly better. The **render-loop
accumulator** fix is **pure compliance cost** — less readable and O(n²) where the
original was O(n).

So three rules, two improvements, one regression. The pattern is real but it is
not a law, and the accumulator case is the honest counterexample.

**And two measurement failures from the same port cost more time than any defect
it found**, which is now this project's most reliable regularity: a contrast probe
that regexed digits out of `lab()`/`oklch()` reported **1.36:1 for a 16.91:1
pair**; and a concurrent `npm run build` in the shared tree left the server
serving a 404'd CSS chunk, at which point the probe reported **21:1 ratios on a
page with no design at all**. Probes there now refuse to run unless every
stylesheet resolves — which is the guard F-077 arrived at independently, from a
different symptom, on the same day.

---

### F-084 · Optimising every page for a machine that arrives by URL produces a site with no way in

**Surface:** the whole app. Found by the project owner opening the deployed site
and reporting that the primitives were not there. They were there. All nine of
them, live, correct, and unreachable.

Playwright navigates by URL. It never clicks a link to get to a component, so
across 29 routes **not one link was ever needed, and not one was ever written** —
`grep -rn '<nav\|<Link' src/app` returned nothing at all. Three consequences,
all invisible to the suite that was green the whole time:

- `/` renders the aggregate kitchensink (F-019) and points at nothing, so the
  root is simultaneously the conformance target and a dead end.
- `/primitives` **404'd**, because App Router creates a route only where a `page`
  file exists and the port only ever needed the children. My own first probe of
  the deploy guessed `/primitives/circle-diagram` and `/primitives/cover-composition`
  and got 404s from those too — the directories are `circlediagram` and
  `covercomposition`, unhyphenated, because nothing human ever had to type them.
- Every route was verified reachable by `curl`, which is precisely the check that
  cannot notice this. A 200 from a URL you already know proves the route exists;
  it says nothing about whether anyone can find it.

This is the same class as F-052 and F-077 but pointed the other way. Those were
the *instrument* failing while the app was fine. This is the instrument
**succeeding completely** on the thing it measures, while the property it does not
measure — can a person get here — was never once asserted, in 405 tests.

**Decision: a `SiteNav` in the root layout, rendered after `children`.** After,
not before, because nine specs assert on the first heading and the first focusable
element of `/`, and a nav at the top of the document moves both. Hit areas are
44px (WCAG 2.5.5, well above the 24px 2.5.8 floor) so a page-wide target-size
sweep passes on it, and the link text is `text-body` and not `text-muted` for
exactly the reason F-017 exists. Route lists are written out rather than read with
`fs.readdirSync`: a stale link here is a 404 a human sees, whereas a filesystem
read that Vercel declines to trace is a build that works only locally.

Measured after: axe **0 violations** scoped to the footer on `/` and
`/primitives`, in **both appearances**; 29 links, none under 24px; and no
horizontal overflow at 320, 400, 768 or 1280px.

**The generalisable finding: "every component is tested" and "the site works" are
different claims, and a conformance suite establishes only the first.** A port
driven entirely by a machine-readable contract will satisfy the contract exactly
and leave out everything the contract never mentions. Navigation is the first such
thing, and it took a human opening a browser to find it — which is the same way
F-052 was found.

---


## Proposals written for upstream

Where a finding implies a change to the library rather than to this port, the
artifact lives in [`upstream/`](upstream/) — written in the library's own format,
outside the submodule, because PORTING.md requires the submodule to stay pristine.

- [`upstream/0026-part-identity-is-a-data-attribute-not-a-class.md`](upstream/0026-part-identity-is-a-data-attribute-not-a-class.md)
  — the one finding that rose to a direction decision. Part identity moves from
  `lowercase-kebab` class names to `data-part`; class names carry styling only.
  It completes ADR-0019's swap map (currently nearly-true), and it is what makes
  the library compatible with CSS Modules, scoped-style hashing and shadow DOM —
  the last of which the planned Web Components port needs regardless.
- [`upstream/README.md`](upstream/README.md) also ranks the seven bug-level
  upstream changes worth doing first. Per the library's own ADR rules those are
  commit messages, not ADRs.

---

## Final verified result

Measured on a **clean production build**, sequentially, on the aggregate page —
the only substrate that gives trustworthy numbers (F-049), with no concurrent
runner (F-049 again) and no stale server (the failure that shipped a visibly
broken page while the suite was green).

**397 passed / 8 failed** across all 18 components plus the two site-level suites,
on the submodule bumped to `c2d12c2` with every upstream fix applied. (Before the
bump, against `99ff470`, the figure was 365 / 7.)

| Fully green | | With classified failures | |
|---|---|---|---|
| TimeField | **39 / 39** | ThemeSwitch | 15 / 17 |
| RangeScale | **31 / 31** | DateField | 48 / 49 |
| Picklist | **27 / 27** | DateTimeField | 37 / 38 |
| FileUpload | **21 / 21** | WeekField | 36 / 37 |
| RangeField | **21 / 21** | MonthField | 33 / 34 |
| RangeGroup | **19 / 19** | AffixField | 15 / 16 |
| ToggleTip | **11 / 11** | text-spacing | 5 / 6 |
| ChoiceField | **8 / 8** |  |  |
| ChoiceGroup | **8 / 8** |  |  |
| appearance | **8 / 8** |  |  |
| Notice | **7 / 7** |  |  |
| MotionRegion | **5 / 5** |  |  |
| ScrollArea | **3 / 3** |  |  |

Twelve of the eighteen components are fully green, plus the site-level appearance
suite. All eight failures are classified and none is a defect in the port:

| Failures | Cause | Entry |
|---|---|---|
| `de-DE` ×4 — DateField, DateTimeField, MonthField, WeekField | the new upstream test rewrites `data-locale` in the served HTML, which only works if the component reads the DOM. This port takes locale as a prop. Pointed at a `de-DE` instance via `TARGET_ID`, all four pass | F-054 |
| ThemeSwitch ×2 | the spec hard-codes `localStorage`, which its own `.md` and ADR-0021 both say is the host's choice | F-038 |
| AffixField ×1 | a byte-identical `style` attribute, unreachable from React — and a *mechanism* assertion in a suite that declares itself end-state-only | F-011 |
| text-spacing ×1 | the suite's own canary cannot fire against a design system that already renders at `line-height: 1.5` | F-023 |

All four causes are the same shape: a **mechanism assumption inside a suite whose
own test 8 says it asserts the end state.** F-050 was the fifth member of that
family and is now fixed upstream, from a PR opened by this project.

Alongside: **206 kernel unit tests**, zero WCAG 2 AA violations across the whole
page in **both appearances** (bar one inherited Phase A defect with a measured
fix, F-027), zero horizontal overflow from 320 to 1280 px, and a functional smoke
test covering asset resolution, applied design tokens, hydration and live
interaction — the instrument whose absence let a green suite coexist with an
unstyled page.

### What the numbers do and do not say

They say the library ports. They do **not** say the port is verified, because
F-040 established that this suite has vacuous passes: two ports went looking and
each found one, and no port audited all of its own passes for vacuity. Read
"365 passed" as a lower bound on failures rather than a statement of conformance
— which is the same thing PORTING.md says about appearance, and which turned out
to be true of behaviour too.

---

## Per-component findings index

The entries above are the **project-level** findings: things that affect the port
as a whole, or that a future porter of this library would want warned about
regardless of which component they start with.

Each component's own detail — its measurements, its contract disagreements, its
Phase B candidates — lives in a fragment beside this file. They are deliberately
not merged: the fragments are long because the measurements are in them, and a
reader looking for "what did porting `X` teach us" should not have to read
everything else first.

| Fragment | Entries | Notes |
|---|---|---|
| [`findings/DateField.md`](findings/DateField.md) | 17 | The flagship: 43/43. The `[PORT FIX]` leap-day desync, the `<template>` rendering trap (F-050), axe measuring the wrong ground under the wheel band, why it is the one field immune to F-042 |
| [`findings/FileUpload.md`](findings/FileUpload.md) | 13 | JSX whitespace nodes (F-028), the stale ADR-0021 debt claim (F-034), the `.drop-label` defect its own suite cannot see (F-027), the native-input intrinsic width |
| [`findings/RangeScale.md`](findings/RangeScale.md) | 13 | The `<output>` live-region mapping (F-031), the static-`aria-valuetext` channel split, the vacuous pass (F-040), the `1ch` tabular-figure gap |
| [`findings/TimeField.md`](findings/TimeField.md) | 13 | The one-way roving tabindex measured across all four fields (F-042), the `aria-modal` popup that opens with focus outside itself (F-043), the fourth appearance tier (F-044), and a withdrawn finding corrected by an RTL measurement |
| [`findings/kernel.md`](findings/kernel.md) | 13 | The `WheelColumn.destroy()` defect (F-030), per-module test portability proved byte-for-byte (F-029), the Node-vs-Chromium ICU comparison (F-033), `resolveCssPx`'s promotion |
| [`findings/MonthField.md`](findings/MonthField.md) | 12 | The `Intl` collapsed-key defect that ADR-0011 claims to have fixed (F-041), seven contract points the suite never asserts, `data-initialized` gating (F-046) |
| [`findings/ToggleTip.md`](findings/ToggleTip.md) | 12 | The `<p>`-wrapper parser bug in the reference's own demo, the entrance fade contradicting the docs, the dev-vs-production CLS diagnosis (F-049), portal vs Popover API and the ADR-0012/0019 conflict |
| [`findings/MotionRegion.md`](findings/MotionRegion.md) | 11 | The SSR reduced-motion window and the latent WCAG 2.3.3 defect in the upstream contract; the reflow measurement that started F-024 |
| [`findings/Picklist.md`](findings/Picklist.md) | 11 | The chip mechanism ThemeSwitch reuses, the `.content` collision (F-025), the `CanvasText` selected-chip bypass, and an independent corroboration of F-049 from the geometry side |
| [`findings/RangeGroup.md`](findings/RangeGroup.md) | 11 | The `async`-chunk race and its bootstrap fix (F-035), the composition-seam argument (F-039), and the consolidated "one mechanism, four failure modes" entry |
| [`findings/WeekField.md`](findings/WeekField.md) | 10 | ISO-week verification in the browser (week 1 in the previous December, 53-week years, the Dec↔Jan wrap), and the paint-versus-behaviour attribute split (F-047) |
| [`findings/ThemeSwitch.md`](findings/ThemeSwitch.md) | 9 | The Router Cache disagreement and the 0-wrong-frames cold-load measurement (F-036), the `localStorage` assertions (F-038), ADR-0021's lock-in test |
| [`findings/ChoiceField.md`](findings/ChoiceField.md) | 7 | React's controlled-input trap, measured; the undocumented element-order constraint |
| [`findings/ChoiceGroup.md`](findings/ChoiceGroup.md) | 7 | The `.content` collision from the other side; what the two Choice components could and could not share |
| [`findings/Notice.md`](findings/Notice.md) | 7 | `data-icon` as the library's one inverted boolean; the derived-tint contrast result corroborating F-021 |
| [`findings/ScrollArea.md`](findings/ScrollArea.md) | 7 | The focus-ring contrast defect axe structurally cannot see, the enhancement-window measurements in frames, the three tiers of appearance-awareness |
| [`findings/RangeField.md`](findings/RangeField.md) | 5 | The px-scale defect that turned out to be ours (F-026); the anti-DRY result |

**178 fragment entries across 17 fragments, plus 84 project-level entries — 262 findings in total.**

### How to read a finding

Every entry names the **surface** it was found on, carries the **evidence** as a
measurement rather than an impression, and ends in either a **Decision** (settled,
with the reasoning) or an **Open question** (needs a call from the project owner).
Positive findings are included deliberately — "the `1.125ch` calibration survived
a typeface change" (F-013) and "Node and Chromium ICU agree exactly" (F-033) were
as much work to establish as any defect, and a report that only lists problems
misrepresents the library.

Entries are append-only. Where a later finding reverses an earlier one it says so
explicitly — F-020 supersedes F-002, F-021 supersedes half of F-005, F-037
reframes F-024, and F-040 qualifies every pass count in the document.

---
