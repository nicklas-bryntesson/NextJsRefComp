/* TimeField kitchensink — every state in TimeField.html, with the reference's
 * `data-id` values preserved verbatim.
 *
 * The ids are TEST CONTRACT. `e2e-helpers/target.js` resolves this component as
 *   [data-component="TimeField"][data-id="meeting-time"]
 * so the **live** instance must carry exactly that. `DateTimeField` uses the same
 * `data-id` with its own `data-component` — the two coexist on the aggregate page
 * by design, which is why the default target selector is qualified by
 * `data-component` and why the spec's own comment says so. Do not "fix" it.
 *
 * The suite also reaches outside its target for one assertion:
 *   `.TimeField[data-disabled="true"] .trigger` (first match) must be disabled
 * — an UNQUALIFIED class selector, so a disabled instance has to exist on the
 * page. Both disabled cells below satisfy it.
 *
 * Locale: every reference state authors `data-locale="en-GB"` (24h), and the
 * suite depends on that in two ways — `aria-valuemin/max` of `0`/`23` on the hour
 * segment AND wheel column, and `aria-label="Choose time"` on the popup. A
 * `sv-SE` live instance would fail both. Note TimeField.md contradicts its own
 * states here: it claims "`sv-SE` is the kitchensink's authored value". It is not;
 * see findings/TimeField.md.
 *
 * No `anchorId`: unlike ChoiceField / Notice / Picklist, this spec never scopes an
 * axe run to `#TimeField`, and the reference's own section carries no id.
 */

import { Block, Cell, Section } from "../kitchensink-ui";
import { TimeField } from "./TimeField";

export function TimeFieldKitchensink() {
  return (
    <Section id="timefield" title="TimeField">
      {/* 1 — Interaction states. `testState` renders `data-test-state`, which the
             verbatim stylesheet uses to pin :hover / :focus-within so a static
             screenshot can show them. `active` has no distinct skin in the
             reference stylesheet either — it is authored for symmetry. */}
      <Block title="Interaction states — empty">
        <Cell caption="default">
          <TimeField id="tf-empty-default" label="Time" locale="en-GB" />
        </Cell>
        <Cell caption="hover">
          <TimeField id="tf-empty-hover" label="Time" locale="en-GB" testState="hover" />
        </Cell>
        <Cell caption="focus">
          <TimeField id="tf-empty-focus" label="Time" locale="en-GB" testState="focus" />
        </Cell>
        <Cell caption="active">
          <TimeField id="tf-empty-active" label="Time" locale="en-GB" testState="active" />
        </Cell>
      </Block>

      <Block title="Interaction states — filled">
        <Cell caption="default">
          <TimeField id="tf-filled-default" label="Time" locale="en-GB" value="13:45" />
        </Cell>
        <Cell caption="hover">
          <TimeField
            id="tf-filled-hover"
            label="Time"
            locale="en-GB"
            value="13:45"
            testState="hover"
          />
        </Cell>
        <Cell caption="focus">
          <TimeField
            id="tf-filled-focus"
            label="Time"
            locale="en-GB"
            value="13:45"
            testState="focus"
          />
        </Cell>
        <Cell caption="active">
          <TimeField
            id="tf-filled-active"
            label="Time"
            locale="en-GB"
            value="13:45"
            testState="active"
          />
        </Cell>
      </Block>

      {/* 2 — Disabled. Its own block: `pointer-events: none` makes hover
             impossible, so a disabled field never gets interaction columns. */}
      <Block title="Disabled">
        <Cell caption="empty">
          <TimeField id="tf-disabled-empty" label="Time" locale="en-GB" disabled />
        </Cell>
        <Cell caption="filled">
          <TimeField
            id="tf-disabled-filled"
            label="Time"
            locale="en-GB"
            value="13:45"
            disabled
          />
        </Cell>
      </Block>

      {/* 3 — Invalid. `data-invalid` is a STYLING hook only; the contract requires
             the author to set `aria-invalid` on the native input as well, which is
             what `ariaInvalid` does. */}
      <Block title="Invalid">
        <Cell caption="required + empty">
          <TimeField
            id="tf-invalid-empty"
            label={
              <>
                Time <span aria-hidden="true">*</span>
              </>
            }
            locale="en-GB"
            invalid
            ariaInvalid
            required
          />
        </Cell>
        <Cell caption="out of range">
          <TimeField
            id="tf-invalid-filled"
            label="Time"
            locale="en-GB"
            value="07:00"
            invalid
            ariaInvalid
          />
        </Cell>
      </Block>

      {/* 4 — Variants. `step < 60` adds the seconds segment and a third wheel
             column. See TimeField.md "Platform gotchas": iOS's native picker has
             no seconds wheel, so this variant degrades to minute precision on iOS
             touch — a WebKit limitation, not a component defect. */}
      <Block title="Variants">
        <Cell caption="with seconds (step=1)">
          <TimeField
            id="tf-with-seconds"
            label="Time"
            locale="en-GB"
            value="13:45:30"
            step={1}
          />
        </Cell>
      </Block>

      {/* 5 — Live demo. THE e2e target. */}
      <Block title="Live demo">
        <Cell caption="interactive">
          <TimeField id="meeting-time" label="Meeting time" locale="en-GB" />
        </Cell>
      </Block>

      {/* 6 — Localization. The hour cycle is REGION-specific while the
             translation key collapses the region: en-GB is 24h, en-US is 12h, and
             both resolve their strings to `en`. */}
      <Block title="Localization">
        <Cell caption="en-GB (24h)">
          <TimeField id="tf-locale-en-gb" label="Time (en-GB — 24h)" locale="en-GB" value="13:45" />
        </Cell>
        <Cell caption="en-US (12h)">
          <TimeField id="tf-locale-en-us" label="Time (en-US — 12h)" locale="en-US" value="13:45" />
        </Cell>
      </Block>

      {/* 7 — Native reference, for comparison. */}
      <Block title="Native reference">
        <Cell caption="default">
          <label htmlFor="tf-native-default">Time</label>
          <input type="time" id="tf-native-default" name="tf-native-default" />
        </Cell>
        <Cell caption="disabled">
          <label htmlFor="tf-native-disabled">Time</label>
          <input
            type="time"
            id="tf-native-disabled"
            name="tf-native-disabled"
            defaultValue="13:45"
            disabled
          />
        </Cell>
      </Block>
    </Section>
  );
}
