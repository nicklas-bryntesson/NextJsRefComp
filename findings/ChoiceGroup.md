# Phase 1 — ChoiceGroup

Port status: **8 / 8 conformance tests green** (including the `#ChoiceGroup` axe
audit), `npm run build` and `npm run lint` clean, submodule untouched
(`git -C reference-components status --short` empty).

Green was measured against the **isolated route** via a root-rewriting proxy,
because `ChoiceGroup.e2e.test.js` hard-codes `page.goto('/')` (F-019) and `/`
serves `AggregateKitchensink`, which does not yet mount this section — that file
is off-limits to a component port. Against `/` today all 8 tests fail on missing
elements. **Blocked on the aggregate page**, not on the component.

```
# what was actually run (proxy: '/' -> /kitchen-sink/choicegroup)
node web/tasks/probes/choicegroup-proxy.mjs 3141 3000
cd reference-components && BASE_URL=http://localhost:3141 npx playwright test \
  src/partials/components/ChoiceGroup/tests/ChoiceGroup.e2e.test.js --reporter=line
  → 8 passed (1.6s)   ·  "No accessibility violations detected!"

# the command to re-run once AggregateKitchensink mounts <ChoiceGroupKitchensink />
cd reference-components && BASE_URL=http://localhost:3000 npx playwright test \
  src/partials/components/ChoiceGroup/tests/ChoiceGroup.e2e.test.js --reporter=line \
  --output=../web/tasks/tr-ChoiceGroup
```

Files created:

- `web/src/components/ChoiceGroup/ChoiceGroup.css` — verbatim copy, byte-identical
  (`shasum 2022b3f21f417aa3c054e2bfc53deb909531658b` on both sides; `diff` empty).
  The stylesheet contains **no init-gate rules**, so nothing was dropped.
- `web/src/components/ChoiceGroup/ChoiceGroup.tsx` — Server Component, **no `'use client'`**.
- `web/src/components/ChoiceGroup/ChoiceGroup.kitchensink.tsx` — all seven `data-id`s
  (`above`, `beside`, `hidden`, `horizontal`, `hint`, `invalid`, `live`) plus a
  native-fieldset reference block.
- `web/src/app/kitchen-sink/choicegroup/page.tsx`
- `web/tasks/probes/choicegroup-proxy.mjs`, `cg-appearance.cjs`, `cg-beside-reflow.cjs`.

---

### F-NEW · Two components' part classes collide on `.content`, and the winner is decided by *import order* — which the reference sets by hand and a bundler does not

**Surface:** `ChoiceGroup.css` + `Notice.css`, on the `data-id="invalid"` variant.

ChoiceGroup's own contract puts a Notice *inside* its `.content` wrapper. Both
components name a part `.content`, both select it as a descendant of their root,
and the two rules therefore have **identical specificity (0,2,0)**:

```css
.ChoiceGroup .content { display: flow-root; }                 /* ChoiceGroup.css */
.Notice .content { display: flex; flex-direction: column;
                   gap: var(--_nt-content-gap); min-inline-size: 0; }  /* Notice.css */
```

Nothing but source order separates them, and the nested Notice's `.content`
matches *both*. The reference resolves it by hand: `src/css/site/style.css`
imports `ChoiceGroup.css` on line 28 and `Notice.css` on line 29, so Notice wins
and the reference demo shows a flex Notice body. That ordering is invisible from
either component's directory.

In a React port there is no such list — the order is the module graph's. Measured,
same DOM, only the import order of `ChoiceGroup.kitchensink.tsx` changed
(`web/tasks/probes/cg-appearance.cjs`, computed style of
`.ChoiceGroup[data-id="invalid"] .Notice > .content`):

| Import order in the kitchensink | `.Notice .content` computed |
|---|---|
| `ChoiceField`, `Notice`, chrome, **`ChoiceGroup` last** | `display: flow-root` — Notice's `gap` and `min-inline-size: 0` **lost** |
| **`ChoiceGroup` first**, then `ChoiceField`, `Notice` | `display: flex`, `row-gap: 4px`, `min-inline-size: 0px` — matches the reference |

Next 16's own CSS guide confirms the mechanism and adds a second hazard:
*"The order of your CSS depends on the order you import styles in your code"* and
*"CSS ordering can behave differently in development, always ensure to check the
build (`next build`) to verify the final CSS order"*
(`web/node_modules/next/dist/docs/01-app/01-getting-started/11-css.md:402,458`).
Checked: `next start` on the production build reports `flex / gap=4px` too, so
dev and prod agree here.

The consequence is not cosmetic in general — the lost declarations are Notice's
title↔body gap and its overflow guard, so a *titled* group error, or one with a
long unbreakable word, would render differently depending on an import statement.

**Decision.** `ChoiceGroup.kitchensink.tsx` imports `./ChoiceGroup` **first**, with
a comment saying the order is load-bearing and why. No CSS was edited (Phase A).

**Warning for the aggregate page (and for whoever mounts this section):** the same
collision is decided by the import order in `AggregateKitchensink.tsx`, which a
component port cannot touch. Adding `import { ChoiceGroupKitchensink } …` after the
`Notice` import re-breaks it silently — nothing fails, the Notice body just loses
its gap. It must be imported **before** the Notice kitchensink, or the collision
must be fixed properly in Phase B.

**Upstream suggestion / Phase B fix:** scope the rule to the child it means —
`.ChoiceGroup > .content { display: flow-root }`. ChoiceGroup only ever styles its
*own* `.content` (the flow-root that clears the floated legend), and the reference
already uses `>` for its `legend` and `above`/`beside` rules — `.content` is the one
part rule that was left as a descendant selector. That one character removes the
collision entirely and makes the cascade order irrelevant. More broadly, ADR-0013's
"scoped sub-element class names — no bare, collision-prone class names" is satisfied
in *selector* form but not in *effect*: `.content`, `.icon` and `.hint` are generic
enough that any nesting of two library components can collide, and the library's
only defence is a hand-ordered import list.

---

### F-NEW · ChoiceGroup is the first ported component whose entire colour surface goes through the `--ui-*` bridge

**Surface:** `ChoiceGroup.css` token block; measured in both appearances with
`web/tasks/probes/cg-appearance.cjs`.

The brief asked whether ChoiceGroup has an equivalent of ChoiceField's
`--_cf-selected: CanvasText` bypass. **It does not.** ChoiceGroup declares exactly
one colour token, and it is properly bridged with a literal fallback:

```css
--_cg-hint-color: var(--ui-muted-foreground, #6e6e6e);
```

Everything else it paints is inherited (`legend` sets only `font-weight`), so it
follows `color` from the page. Measured on `/kitchen-sink/choicegroup` with
`data-appearance` pinned on `<html>`:

| Surface | light | dark |
|---|---|---|
| `.hint` (16px) | `rgb(90,88,82)` on `#ffffff` = **7.11:1** | `rgb(185,183,175)` on `rgb(35,35,32)` = **7.84:1** |
| `> legend` (16px, weight 600) | `rgb(90,88,82)` on `#ffffff` = **7.11:1** | `rgb(185,183,175)` on `rgb(35,35,32)` = **7.84:1** |
| `--_cg-hint-color` resolved | `#5a5852` (`--color-body`) | `#b9b7af` |
| axe (`#ChoiceGroup`, wcag2a+wcag2aa) | **0 violations** | **0 violations** |

So the appearance flip is free for this component, in both halves, with no `dark:`
variants and no duplicated blocks — the `light-dark()` bridge does all of it. That
is the outcome F-002/F-020 predicted, measured on a component that contributes
nothing of its own to it.

**Decision.** Nothing to change and nothing to record as a gap. Recorded as a
**positive finding** and as the counter-example that makes F-NEW(`--_cf-selected`)
in `findings/ChoiceField.md` clearly a *component-level lapse* rather than a
library-wide pattern: two sibling components, same family, same ADR — one bridges
every colour, the other hard-codes its most important one.

**Carried-over caveat, not a new defect:** the group's *error path* inherits
Notice's own bypass — the error paragraph resolves to `rgb(0,0,0)` in light and
`rgb(255,255,255)` in dark (`CanvasText`, already recorded against Notice), not the
design system's warm ink. ChoiceGroup contributes only the `margin-block-start`
around the region, so the fix belongs to Notice.

---

### F-NEW · `data-legend` as a three-value enum is the orthogonality test passing — and the `.md` describes a mechanism the CSS deliberately rejects

**Surface:** `ChoiceGroup.md` → *Legend placement recipes*; `ChoiceGroup.css`.

Two halves, one good and one a documentation bug.

**The good half.** `data-legend` is `above` · `beside` · `hidden`, not three
booleans (`data-legend-hidden`, `data-legend-beside`, …). The three states are
mutually exclusive placements of one thing, so they belong on one axis; booleans
would admit `hidden` + `beside` simultaneously, which has no meaning. In React the
enum lands as a plain union type (`legendPlacement?: "above" | "beside" | "hidden"`)
and the compiler enforces the exclusivity the library can only document. This is
also the one place ChoiceGroup escapes the "booleans are `="true"` or absent" rule
without ambiguity — `data-legend` is always authored, and `above` is emitted
explicitly rather than relying on the CSS's `:not([data-legend])` fallback, so the
DOM is never ambiguous about which recipe is active.

**The documentation bug.** The `.md` table says of `beside`:

> `beside` | fieldset becomes `display: grid` (`auto minmax(0,1fr)`); legend left,
> `.content` right | Legend `float: none` here

The stylesheet does the opposite, and says so in its header comment: *"legend
layout … is done with ONE mechanism — a floated legend — across all three
placements (avoiding the cross-browser quirks of `display:grid`/`flex` on a
fieldset)"*, and the rule is `float: left; inline-size: auto`. There is no `grid`
and no `float: none` anywhere in the file. A porter who implements the table gets a
different layout with different reflow behaviour: a grid column *reserves* space and
shrinks the options, a float does not — over-wide options wrap **under** the legend
instead.

Measured the documented risk case (`web/tasks/probes/cg-beside-reflow.cjs`, the
`.md`'s own manual-test item *"200% zoom / horizontal: … `beside` legend does not
overlap the options"*):

| viewport | zoom | legend x/width | options x/width | overlap | options pushed below legend | clipped |
|---|---|---|---|---|---|---|
| 1280 | 1× | 81 / 99 | 196 / 187 | no | no | no |
| 640 | 1× | 41 / 99 | 156 / 187 | no | no | no |
| 320 | 1× | 41 / 99 | 156 / 123 | no | no | no |
| 1280 | 2× | 82 / 198 | 312 / 374 | no | no | no |

The float recipe holds at 320 px and at 200 % zoom — the options shrink rather than
drop. So the *implementation* is fine; only the table is wrong.

**Decision.** Implement the CSS, not the table, and emit `data-legend` always.
**Upstream:** fix the `beside` row of the recipe table — it documents a rejected
alternative as if it were the mechanism.

---

### F-NEW · What ChoiceGroup and ChoiceField actually share — and why sharing code would have been wrong here

**Surface:** `ChoiceGroup.tsx` vs `ChoiceField.tsx`; ADR-0004 (clarity over DRY),
ADR-0013/0015 (the item/wrapper split).

The brief asked whether the two ports could have shared code without violating the
library's anti-DRY stance. Having written both, the honest inventory of what is
common is small and almost entirely *convention*, not logic:

| Shared thing | Kind | Shareable? |
|---|---|---|
| `data-x={cond ? "true" : undefined}` boolean convention | 6-token idiom | Not worth a helper; a helper would obscure it |
| `className={extra ? \`Root ${extra}\` : "Root"}` | one expression | Same |
| `dataId` / `style` / `className` prop shape | prop naming | A shared `type` alias, at most |
| Zero-JS Server Component shape | architecture | Nothing to share — it is the *absence* of code |
| `for`/`id` + `aria-describedby` id wiring | **real logic** | **Yes — and the library already says so** |

Everything else is disjoint: ChoiceField owns one input's `type` branch, ChoiceGroup
owns a legend recipe and two layout axes. There is no shared state machine to
extract because ADR-0013 removed the state machine on purpose. A React developer's
reflex — a `<ChoiceGroup>` that renders its options from an `options={[…]}` array,
distributing `name` and `id` to children it constructs — would be a *violation of the
contract*, not a DRY win: ADR-0013 is explicit that `name` is "an authored end-state,
not a JS-distributed prop … No parent→child coupling", and ADR-0009 makes the
finished DOM the contract. So `children` is the correct and only faithful API, and
the two components meet in the DOM exactly as the ADR says. My port imports neither
sibling: fields arrive as `children`, the error arrives as a `notice` node the host
composes from `<NoticeRegion>` + `<Notice>`.

The one genuinely shareable piece is the id/describedby wiring — which is precisely
the kernel candidate ADR-0013 itself names ("a shared label/`describedby`-wiring
helper", promoted *only if reuse earns it*). Three consumers now exist in our port
(AffixField joins the `aria-describedby` id-list ordering, ChoiceField the `for`/`id`
pairing, ChoiceGroup the hint+error id list), which is ADR-0004's stated promotion
trigger — "a third component needs a piece of shared behaviour currently
duplicated". Note it is also the one piece where React changes the *nature* of the
problem: the contract rule "every `aria-describedby` target must exist — a dangling
reference is a silent no-op" is enforced in the reference by a jsdom unit test,
whereas `ChoiceGroup.tsx` derives the id list *from the nodes it actually renders*
(the hint id is added only when a hint is rendered), so a dangling reference cannot
be constructed for the hint at all.

**Open question for the project owner:** promote a small `describedby` / id-wiring
helper into `web/src/kernel/` now that three ported components duplicate it, or hold
the line on clarity-over-DRY and keep the four-line expression in each component?
I have kept it local for Phase A, which matches ADR-0004's default. My inclination
is to leave it: the duplicated code is *ordering an array of ids*, and the kernel bar
in ADR-0004 is "correctness-critical maths that must not drift", which this is not
quite.

---

### F-NEW · Positive: two contract invariants the reference must unit-test become unbreakable by construction

**Surface:** `ChoiceGroup.tsx`; `ChoiceGroup.md` → *Testing strategy* (unit/jsdom).

The `.md` lists the wrapper-contract invariants its jsdom unit test enforces —
PORTING.md tells us not to port those tests, so it is worth recording which of them
the React port makes untestable-because-impossible:

| Reference unit-test invariant | In this port |
|---|---|
| `<legend>` is the first child of `<fieldset>` | Structural — `legend` is a required prop rendered in a fixed position; a caller cannot put anything before it |
| `<legend>` is non-empty | Required prop (`legend: ReactNode`, no default) |
| `.options` present | Always rendered; `children` cannot escape it |
| `data-legend` is a known value | TypeScript union — a wrong value is a compile error |
| every `aria-describedby` target resolves | Derived from rendered nodes for the hint (see above) |
| unique ids · one shared `name` per radio group | **Still the caller's job** — these live on the ChoiceField children, and nothing in either component can check them |

Five of six invariants move from "asserted at test time" to "unrepresentable", which
is the strongest argument this port has produced for a typed component boundary over
authored HTML. The two that remain — id uniqueness and one `name` per group — are
exactly the two that span *sibling children*, which is where the ADR deliberately
refuses to add coupling. That is a real, if narrow, cost of the no-parent→child-
coupling rule: the invariant that most often breaks in practice ("two groups
accidentally sharing a `name` are one radio group") is the one invariant no component
in the design is allowed to enforce.

---

### F-NEW · The suite's group *names* are contract — and on an aggregate page that is a cross-component hazard, not a local one

**Surface:** `ChoiceGroup.e2e.test.js` — `getByRole('group', { name: 'Shipping speed' })`,
`'Payment method'`, `'Account type'`, `'Terms'`.

Four of the eight tests locate their target by **accessible name**, not by `data-id`
or class. `toBeVisible()` and `toHaveCount(1)` run in strict mode, so a *second*
`role="group"` with the same accessible name anywhere in the document fails the
test — and it fails as a ChoiceGroup defect even though ChoiceGroup did not change.
This matters only because our `/` is an aggregate page: the reference's `/` renders
one component demo at a time, so the whole class of collision is invisible upstream.

Measured. The four names are currently unique — across the reference demos
(`grep -rn '<legend>Terms' */*.html` → only `ChoiceGroup.html:77`) and across every
ported kitchensink in `web/src/components/` (`grep -rl` for each of the four,
excluding `ChoiceGroup/` → no hits). So the suite is safe today.

But the hazard is not hypothetical, and the aggregate page already contains a live
example of the shape: `Picklist.kitchensink.tsx` and `ThemeSwitch.kitchensink.tsx`
each render fieldsets legended `Interaction state: default` / `hover` / `focus` /
`active` — eight groups, four duplicated names, in one document. Any spec that
queried one of those by accessible name would break the moment the other component
landed. `<legend>` is by design the group's *only* name (ADR-0013 chose it precisely
to avoid id plumbing), which means there is no id-uniqueness mechanism to lean on:
two components can legally give two groups the same accessible name, and only a
test notices.

**Decision.** Legends are reproduced verbatim from `ChoiceGroup.html` — they are
selectors, not copy — and the uniqueness is treated as a standing constraint on the
aggregate page rather than something to work around locally. A future port that
introduces a group named `Shipping speed`, `Payment method`, `Account type` or
`Terms` will break this suite; that is worth a line in the playbook alongside the
`goto('/')` note.

**Upstream:** anchor these four assertions the way the rest of the file already
anchors things — scope to `.ChoiceGroup[data-id="…"]`, then assert the accessible
name — so an accessible-name assertion cannot be broken by an unrelated component
sharing the page.

---

### F-NEW · Positive: the third zero-client-JS port in a row, and the `<fieldset>` costs the reference documents cost nothing here

**Surface:** `ChoiceGroup.tsx`, `next build`.

ADR-0013's "Costs" section lists two prices for choosing `<fieldset><legend>`: the
legend CSS recipe must travel with the component, and `float: left` in 2026 is
non-obvious. Both are paid in `ChoiceGroup.css`, which we copied verbatim — so the
React port pays **neither**. There is no `ChoiceGroup.ts` in the reference at all;
the component is markup plus CSS, and the port is 120 lines of JSX with no
`'use client'`, no state, no effects, and therefore none of the React-19 traps the
playbook warns about (`set-state-in-effect`, `useCallback` memoization, hydration
mismatch). `npm run build` and `npm run lint` are clean first time.

Also worth recording: the `<fieldset>` *benefits* the ADR claims are free really are
free through React — the disabled cascade and form grouping are DOM behaviour, and
nothing in the port re-implements or interferes with them. And the group's own
geometry survived our type scale unchanged: `--_cg-max-inline-size: 30rem` resolves
to **480 px** at our 16 px base, and `border-top-width` / `padding-top` compute to
`0px`, confirming the "legend hygiene" reset survives Tailwind Preflight (which also
zeroes fieldset borders — the two agree rather than fight).

The one thing the port loses is the same thing F-012 recorded for AffixField:
nothing in our tree distinguishes "authored end-state" from "JS-produced end-state",
because there is no JS. Here that is unambiguously the contract's intent.
