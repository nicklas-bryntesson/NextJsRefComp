# Proposals for the reference library

Artifacts written *for* `reference-components`, not for this project. They live
here rather than in the submodule because PORTING.md requires the submodule to
stay pristine and disposable — so a proposal to change it cannot be an edit to it.

Each is written in the library's own format so it can be moved across as-is.

| File | What it proposes |
|---|---|
| [`0026-part-identity-is-a-data-attribute-not-a-class.md`](0026-part-identity-is-a-data-attribute-not-a-class.md) | Part identity moves from `lowercase-kebab` class names to `data-part`; class names carry styling only. Completes ADR-0019's swap map, which is currently nearly-true, and makes the library compatible with CSS Modules, scoped-style hashing and shadow DOM. |

`0026` is the next free number as of the submodule commit this project pins.
Renumber if upstream has moved.

## Status upstream, as of 2026-08-22

Two PRs open, opened from this project:

| PR | What |
|---|---|
| [#54](https://github.com/nicklas-bryntesson/reference-components/pull/54) | `test(e2e)`: scope the twelve popup assertions, and make `scopedCheckA11y` fail when its scope matches nothing. Verified green against the library's own dev server. Should land **before** #55. |
| [#55](https://github.com/nicklas-bryntesson/reference-components/pull/55) | `docs(adr)`: ADR-0026 plus test 14 in `TESTS.md`. |

**Four of the six library defects this port found are already fixed upstream**, in
three commits landed after the submodule pin this project carries:

| Fix | Finding |
|---|---|
| `3c7df5b` — give `Intl` the locale tag, not the translation key (#53) | F-041 |
| `07bac06` — a roving tabindex has to rove back (#52) | F-042 |
| `52356b8` — three `WheelColumn` defects and a fade that named the wrong ground (#51) | F-030, F-045 |

So the remaining library-side findings are the two that need a decision rather
than a patch: the `<output>` live-region mapping (F-031) and the focus-indicator
contrast in `ScrollArea` (`--_sb-thumb` at 2.22:1, which axe structurally cannot
see because it has no focus-indicator rule).

## Findings that want an upstream change but not an ADR

`Findings.md` carries about twenty "Upstream suggestion" notes that are bug fixes
or test changes rather than direction decisions, so per `docs/adr/README.md` they
belong in commit messages, not in ADRs. The ones worth doing first, in rough order
of value against effort:

| | Change | Finding | Status |
|---|---|---|---|
| 1 | Assert the scope exists in `scopedCheckA11y` — an axe run scoped to a selector matching nothing audits nothing and reports success | F-040 | **in #54** |
| 2 | Scope the twelve `popup-interaction` assertions; `DateTimeField.e2e.test.js` is the model | F-050 | **in #54** |
| 3 | `WheelColumn.destroy()` must clear `_activeWheelCol` | F-030 | ✅ `52356b8` |
| 4 | Restore a roving `0` in `_focusTrigger()` | F-042 | ✅ `07bac06` |
| 5 | Pass the raw locale tag to `Intl` | F-041 | ✅ `3c7df5b` |
| 6 | Replace `goto('/')` with `goto(targetPath())` in the nine specs that hard-code it, so the documented `TARGET_PATH` seam works | F-019 | open |
| 7 | Add a reflow sweep beside `text-spacing.e2e.test.js` — about twenty lines, and it currently fails on the library's own demo page at 737 px of horizontal overflow at 320 px, which is the value | F-024, F-037 | open |

Worth noting on 7: the `text-spacing` suite scores **6/6 upstream** and 5/6 in
this port, and the difference is F-023 — its planted-violation canary cannot fire
against a design system that already renders at `line-height: 1.5`. So the suite
is healthy in its own repo and self-disabling in a more compliant consumer, which
is the shape the canary should be fixed for.
