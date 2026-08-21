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

## Findings that want an upstream change but not an ADR

`Findings.md` carries about twenty "Upstream suggestion" notes that are bug fixes
or test changes rather than direction decisions, so per `docs/adr/README.md` they
belong in commit messages, not in ADRs. The ones worth doing first, in rough order
of value against effort:

1. **Assert the scope exists in `scopedCheckA11y`.** One line. An axe run scoped
   to a selector that matches nothing audits nothing and reports success — which
   is how two of ToggleTip's eleven tests pass with the component absent from the
   page (F-040).
2. **Scope the three `popup-interaction` assertions** in DateField, TimeField,
   MonthField and WeekField. `DateTimeField.e2e.test.js` already does it right and
   is the model; twelve occurrences, one line each (F-050).
3. **`WheelColumn.destroy()` must clear `_activeWheelCol`.** One line. Closing a
   popup inside the 100 ms snap window otherwise leaves every wheel column in the
   application deaf to trackpad scroll for the rest of the page's life (F-030).
4. **Restore a roving `0` in `_focusTrigger()`** for TimeField, MonthField and
   WeekField. After Tab-out the segments are keyboard-unreachable — WCAG 2.1.1.
   DateField is already correct, and structurally so: it has no `Tab` case at all
   (F-042).
5. **Pass the raw locale tag to `Intl`, not the collapsed translation key**, so
   `de-DE` stops rendering English month names. ADR-0011 claims this is already
   done; the month names were not included (F-041).
6. **Replace `goto('/')` with `goto(targetPath())`** in the nine specs that
   hard-code it, which makes the documented `TARGET_PATH` seam actually work
   (F-019).
7. **Add a reflow sweep beside `text-spacing.e2e.test.js`.** About twenty lines,
   and it currently fails on the library's own demo page — 737 px of horizontal
   overflow at 320 px, which is the value (F-024, F-037).
