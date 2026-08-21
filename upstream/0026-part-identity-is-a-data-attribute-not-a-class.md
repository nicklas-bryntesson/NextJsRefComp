# ADR 0026: Part identity is a `data-part` attribute; class names carry only styling

**Status:** Proposed
**Date:** 2026-08-21
**Decider:** Nicklas Bryntesson
**Supersedes in part:** ADR-0019 (its `lowercase-kebab` element-class half; the
case-carries-meaning rule and the `PascalCase` component half stand)

## Context

Four ports now exist against this library — Razor/Umbraco tag helpers, Vue 3,
Astro, and a Next.js/React 19 port that ran the full conformance suite. Across
all four, one gap between the documented contract and the real one keeps
surfacing: **a lowercase element class does two jobs at once.**

ADR-0002 states `data-*` attributes are the component's public API. ADR-0019's
"swap map" tells a consumer that `lowercase-kebab` is "our internal element
styling — replace with your utilities / CSS on the same DOM". Read together, those
promise class names are the consumer's to discard.

They are not. PORTING.md names the e2e + axe suite as *the portable contract*, and
that suite selects on element class names throughout. Measured in the React port:

| Surface | Count |
|---|---|
| Distinct class selectors in `*.e2e.test.js` | **197** |
| `lowercase-kebab` element classes in component CSS | **84** |
| `.trigger` occurrences in the suite | 142 |
| `.popup` occurrences | 118 |

So the real contract is `data-*` **plus** those class names — plus
`.kitchensink-section`, plus per-component `#Component` section ids, plus DOM
order (`.first()`/`.last()`), plus accessible-name uniqueness on a shared page.
None of that is written down. A port that takes the swap map at face value breaks
the suite on *missing elements*, which reads as a structural defect rather than a
renaming.

**Two forces make this urgent rather than cosmetic.**

First, the library already solves the problem, inconsistently. Part identity is
*already* expressed as an attribute in 31 CSS selectors — `data-panel` (8),
`data-picker` (5), `data-segment` (2), plus `data-segmented` and `data-variant`.
ADR-0019 even writes the mixed form in its own worked example:
`.DateField .popup [data-panel="picker"][data-active="true"]` — attribute for one
part, class for another, in a single rule.

Second, two stacks make class-based part identity structurally unavailable:

- **CSS Modules and equivalent** *hash* class names — `.popup` becomes
  `.Popup_popup__x7f2a`. Every class-based assertion in the suite dies. Vue SFC
  `<style scoped>` survives because it adds an attribute and keeps the class,
  which is probably why the Vue port never hit this. Any React or Svelte consumer
  using CSS Modules hits it immediately, and it is today an undocumented
  incompatibility.
- **Shadow DOM.** Class names inside a shadow root are invisible to
  `document.querySelector` at all. A Web Components port cannot address parts by
  class from outside, whatever this ADR decides.

## Decision

**Part identity moves to `data-part`. Class names carry styling only, and nothing
in a test or in JavaScript may ever select a lowercase class.**

Case still carries meaning; the lower half changes mechanism:

| Role | Today | Decided |
|---|---|---|
| Component boundary (has a `.md`) | `.DateField` | `.DateField` — unchanged |
| Internal part | `.popup` · `.trigger` · `.rail` | `[data-part="popup"]` … |
| State | `[data-open="true"]` | unchanged |
| Design values | `--ui-*` | unchanged |

- **`PascalCase` component classes stay.** They do two things an attribute does
  not: they are the stylesheet's entry point (`.DateField { tokens }`) and they are
  greppable as a set. ADR-0019's litmus — *it has its own `.md` contract* — remains
  the rule for what earns one.
- **`lowercase-kebab` element classes are removed**, not reduced. "Minimal
  styling in a class name" is a judgement that drifts; if CSS keys on `data-part`
  there is no remaining reason for the class to exist, and the consuming project
  brings its own.
- **CSS may read `data-part`.** The dependency is one-way: a stylesheet may select
  a part attribute, but nothing may select a lowercase class. That is what makes
  the swap map *true* rather than nearly true.
- **The shared lexicon is unchanged** — same word for the same kind of part, now
  as an attribute value: `content` · `options` · `popup` · `trigger` · `rail` ·
  `arrow` · `icon` · `title` · `hint` · `notice-region`.
- **Every rule stays fully qualified from the root**, exactly as ADR-0019
  requires: `.DateField [data-part="popup"]`, never a bare
  `[data-part="popup"]` at column 0. The scoping argument is identical, and the
  hazard is identical.
- **The detached-part exception is retired**, because it is no longer needed. A
  portaled part keeps its own `data-part` and is addressed through
  `[data-component="DateField"] [data-part="popup"]`, which works across a portal
  where a descendant selector does not.

## Considered alternatives

1. **Keep class names as part identity, and document that they are contractual.**
   Rejected. It is the cheapest change and it makes the library incompatible with
   CSS Modules, scoped-style hashing and shadow DOM by contract rather than by
   accident. It also leaves ADR-0019's swap map stating something untrue.
2. **`Component-`prefixed element classes** (`.DateField-popup`). Rejected here
   for the same reasons ADR-0019 rejected it — verbose, redundant under a nested
   root, reads as BEM without being BEM — and because it does not solve the
   hashing or shadow-DOM problem at all.
3. **`::part()` and shadow parts.** Rejected as the *general* mechanism: it only
   exists inside shadow DOM, so it cannot serve the four non-shadow stacks. Worth
   noting that a WC port's `part="popup"` and this ADR's `data-part="popup"` carry
   the same name, so the two are a rename apart rather than a redesign.
4. **`data-part` for identity, classes for styling only (chosen).** One mechanism
   for identity across every stack, the swap map becomes literally true, and it
   finishes a pattern already present in 31 selectors.

## Consequences

### Positive
- **The swap map becomes true.** A consumer replaces every class name with their
  own utilities and the suite still passes. That is what ADR-0019 promised.
- **CSS Modules, scoped styles and any class-hashing pipeline become supported**
  rather than silently broken.
- **Shadow DOM becomes addressable** from a conformance suite, which the planned
  Web Components port needs regardless.
- **Mechanically verifiable, which classes are not.** Every attribute selector in
  a component's stylesheet should be reachable from the DOM that component
  renders. The React port found dead CSS on exactly that check — DateTimeField's
  stylesheet styles `td[data-today="true"]` and `td[data-disabled="true"]`, and
  its `_renderMonth()` never sets either, so today is not bold and an
  out-of-range day looks normal. DateField's JS *does* set them. No test in the
  suite can see that divergence today.
- **Specificity is unchanged.** `[data-part="popup"]` is (0,1,0), identical to
  `.popup`. No cascade rewriting, no `:where()` gymnastics.
- One vocabulary for a porter to learn: `data-component` addresses the component,
  `data-id` the instance, `data-part` the part, `data-*` the state.

### Costs
- A repo-wide sweep across CSS selectors, authored HTML, the `*.generate.ts`
  emitters, JS `querySelector` calls and every test locator — the same migration
  ADR-0019 already paid once, and it must move together.
- More verbose in a stylesheet: `[data-part="popup"]` for `.popup`.
- One attribute per part in the payload. Negligible, but real.
- Every `.md` contract's markup examples change.

### Risks to manage
- **The `querySelector` coupling is the "green tests, broken UI" risk class**, in
  ADR-0019's own words, and it applies unchanged. Sweep component-by-component
  with the orphan-grep + computed-style + visual verification used for the token
  sweeps.
- **This does not fix unscoped queries, and must not be mistaken for doing so.**
  The React port found three tests per popup field asserting
  `document.querySelector('.popup')?.contains(document.activeElement)` — scoped
  click, unscoped assertion. `document.querySelector('[data-part="popup"]')` is
  exactly as broken: it returns the first match in the document, not the one under
  test. Those assertions need the root selector passed across the `page.evaluate`
  boundary. `DateTimeField.e2e.test.js` already does it correctly and is the model;
  the other four do not. **Fix the scoping separately, and preferably first**, so
  the two changes are not confounded.
- A partial migration is worse than none: while both mechanisms coexist, a porter
  has to learn both and cannot trust either.

### Non-goals
- **State attributes are unchanged.** ADR-0002 stands; `data-open="true"` and the
  explicit-`="true"` convention are not in scope.
- **Not a styling methodology.** This says nothing about utilities, nesting, or
  how a consumer writes CSS — only that class names stop being load-bearing.
- **Not the `PascalCase` half.** Component classes stay, and so does the `.md`
  litmus that decides what earns one.
- Parked legacy (Combobox, TabAccordion) excluded, as in ADR-0019.

## Reconsider when

- **`::part()` support becomes universal and the library ships shadow-DOM
  components.** Then `part` and `data-part` are redundant and one should go.
- **A fifth port reports that `data-part` is not enough** — the signal that part
  identity needs something structural rather than an attribute.
- **A part genuinely needs to be addressed without an attribute** (a UA-generated
  pseudo-element, a text node). Then this decision has a boundary it should name.

## References

- **ADR-0019** — the case-carries-meaning rule and the swap map this completes;
  its worked example already mixes both mechanisms
- **ADR-0002** — `data-*` is the public API; this extends the same reasoning from
  state to identity
- **ADR-0004** — clarity over DRY; a fully-qualified attribute selector is as
  deterministic to read as a fully-qualified class selector
- **ADR-0009** — the end-state contract specifies DOM, not the computation site;
  part identity is part of that end state
- **PORTING.md** — *"Restyle to your own convention"* and *"Keep every rule
  qualified from the root"*; both become enforceable rather than advisory
- Evidence: `Findings.md` F-008 (the class-name contract, 197 selectors), F-018
  (undocumented section ids), F-050 (the unscoped query, and why `<template>` made
  it work upstream), plus the dead-CSS finding in `findings/DateTimeField.md`

## The test this establishes

For `docs/adr/TESTS.md`:

> **Is this name identity or decoration?**
> If a test, a `querySelector`, or another component needs to *find* it, it is
> identity → `data-part`. If only a stylesheet needs it, it is decoration → a
> class, and the consuming project may delete it.
