/* DateField kitchensink — every state in `DateField.html`, with the exact
 * `data-id` anchors the conformance suite needs.
 *
 * `birthdate` is the one that matters: `e2e-helpers/target.js` hard-codes
 * `DateField: '[data-id="birthdate"]'` and PORTING.md names it explicitly, so
 * the live instance MUST carry it. Every other id mirrors the reference's own
 * state partials verbatim (`state-empty-default`, `df-locale-en-us`, …) so a
 * future spec that reaches for one finds it.
 *
 * `<Section>` supplies `.kitchensink-section` (Findings F-014). No `anchorId` is
 * passed: `DateField.e2e.test.js` only ever runs `scopedCheckA11y(page, TARGET)`
 * against the component root, never an unscoped `checkA11y(page, '#DateField')`
 * like ChoiceField / Notice / Picklist do (F-018). The project's own
 * `verify:axe` audits the whole page in both appearances, which is the check
 * that covers this section's chrome.
 */

import { Block, Cell, Section } from "@/components/kitchensink-ui";
import { DateField } from "./DateField";

const RANGE = { min: "1900-01-01", max: "2100-12-31" };
const FILLED = "1990-06-15";

export function DateFieldKitchensink() {
  return (
    <Section id="datefield" title="DateField">
      {/* Disabled is deliberately its own block, never an interaction column:
          `pointer-events: none` makes hover unreachable by construction. */}
      <Block title="Interaction states — empty">
        <Cell caption="default">
          <DateField id="state-empty-default" label="Date" locale="en-GB" {...RANGE} />
        </Cell>
        <Cell caption="hover">
          <DateField id="state-empty-hover" label="Date" locale="en-GB" testState="hover" {...RANGE} />
        </Cell>
        <Cell caption="focus">
          <DateField id="state-empty-focus" label="Date" locale="en-GB" testState="focus" {...RANGE} />
        </Cell>
        <Cell caption="active">
          <DateField id="state-empty-active" label="Date" locale="en-GB" testState="active" {...RANGE} />
        </Cell>
      </Block>

      <Block title="Interaction states — filled">
        <Cell caption="default">
          <DateField id="state-filled-default" label="Date" locale="en-GB" defaultValue={FILLED} {...RANGE} />
        </Cell>
        <Cell caption="hover">
          <DateField id="state-filled-hover" label="Date" locale="en-GB" defaultValue={FILLED} testState="hover" {...RANGE} />
        </Cell>
        <Cell caption="focus">
          <DateField id="state-filled-focus" label="Date" locale="en-GB" defaultValue={FILLED} testState="focus" {...RANGE} />
        </Cell>
        <Cell caption="active">
          <DateField id="state-filled-active" label="Date" locale="en-GB" defaultValue={FILLED} testState="active" {...RANGE} />
        </Cell>
      </Block>

      <Block title="Disabled">
        <Cell caption="empty">
          <DateField id="state-disabled-empty" label="Date" locale="en-GB" disabled {...RANGE} />
        </Cell>
        <Cell caption="filled">
          <DateField id="state-disabled-filled" label="Date" locale="en-GB" defaultValue={FILLED} disabled {...RANGE} />
        </Cell>
      </Block>

      <Block title="Invalid">
        <Cell caption="required + empty">
          <DateField
            id="state-invalid-empty"
            label={
              <>
                Date <span aria-hidden="true">*</span>
              </>
            }
            locale="en-GB"
            invalid
            required
            {...RANGE}
          />
        </Cell>
        <Cell caption="out of range">
          {/* value 1800-01-01 sits below `min`, so the field is invalid but the
              segments still display it — `data-invalid` is server-rendered and
              JS never sets it. */}
          <DateField
            id="state-invalid-filled"
            label="Date"
            locale="en-GB"
            defaultValue="1800-01-01"
            invalid
            {...RANGE}
          />
        </Cell>
      </Block>

      <Block title="Live demo (e2e target)">
        <Cell caption='data-id="birthdate"'>
          <DateField id="birthdate" label="Date" locale="en-GB" {...RANGE} />
        </Cell>
      </Block>

      {/* Same date, three locales — proves segment ORDER comes from the raw BCP
          47 tag via Intl, not from a hardcoded table. */}
      <Block title="Localization">
        <Cell caption="en-GB">
          <DateField id="df-locale-en-gb" label="Date (en-GB — D/M/Y)" locale="en-GB" defaultValue={FILLED} {...RANGE} />
        </Cell>
        <Cell caption="en-US">
          <DateField id="df-locale-en-us" label="Date (en-US — M/D/Y)" locale="en-US" defaultValue={FILLED} {...RANGE} />
        </Cell>
        <Cell caption="sv-SE">
          <DateField id="df-locale-sv-se" label="Date (sv-SE — Y/M/D)" locale="sv-SE" defaultValue={FILLED} {...RANGE} />
        </Cell>
      </Block>

      <Block title="Native reference">
        <Cell caption="default">
          <label htmlFor="state-native-default">Date</label>
          <input
            type="date"
            id="state-native-default"
            name="state-native-default"
            min={RANGE.min}
            max={RANGE.max}
          />
        </Cell>
        <Cell caption="disabled">
          <label htmlFor="state-native-disabled">Date</label>
          <input
            type="date"
            id="state-native-disabled"
            name="state-native-disabled"
            min={RANGE.min}
            max={RANGE.max}
            defaultValue={FILLED}
            disabled
          />
        </Cell>
        <Cell caption="readonly">
          <label htmlFor="state-native-readonly">Date</label>
          <input
            type="date"
            id="state-native-readonly"
            name="state-native-readonly"
            min={RANGE.min}
            max={RANGE.max}
            defaultValue={FILLED}
            readOnly
          />
        </Cell>
      </Block>
    </Section>
  );
}

export default DateFieldKitchensink;
