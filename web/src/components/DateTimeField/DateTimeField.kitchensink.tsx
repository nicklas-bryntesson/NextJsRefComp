/* DateTimeField kitchensink — every state in `DateTimeField.html`, with the
 * exact `data-id` anchors the conformance suite needs.
 *
 * TWO ids are contractual, not decorative:
 *   - `meeting-time` — `e2e-helpers/target.js` hard-codes
 *     `DateTimeField: '[data-component="DateTimeField"][data-id="meeting-time"]'`.
 *     `TimeField` uses the SAME `data-id` with its own `data-component`; the two
 *     coexist deliberately and the selector disambiguates them. Do not "fix" it.
 *     It must start EMPTY — the spec asserts `native` has value `''`.
 *   - `dtf-12h` — the spec navigates to it by hand for the AM/PM tests and
 *     asserts the seeded value `2026-05-27T14:35`.
 * Every other id mirrors the reference's own generated state partials verbatim.
 *
 * `<Section>` supplies `.kitchensink-section` (F-014). No `anchorId`:
 * `DateTimeField.e2e.test.js` runs `checkA11y(page, ROOT)` scoped to the
 * component root and never an unscoped `checkA11y(page, '#DateTimeField')` like
 * ChoiceField / Notice / Picklist do (F-018). The project's own `verify:axe`
 * covers this section's chrome in both appearances.
 */

import { Block, Cell, Section } from "@/components/kitchensink-ui";
import { DateTimeField } from "./DateTimeField";

const RANGE = { min: "1900-01-01T00:00", max: "2100-12-31T23:59" };
const FILLED = "2026-05-27T14:35";

/* The live demo authors a REAL range, which the reference's own demo does not:
   its `data-min` is 1900, so nothing is ever out of range and the disabled path
   was never rendered anywhere. Upstream's #56 test therefore injects
   `data-min="<current-year>-<current-month>-15T00:00"` by rewriting the served
   HTML — a technique that is inert against this port, because `min`/`max` are
   PROPS here (the documented prop → `data-*` direction), so an attribute written
   into the HTML after the fact is never read. Authoring the prop is the exact
   equivalent of upstream's consumer-authored attribute, so the state is demoed
   instead of injected.

   The 15th is upstream's own choice and the reason is worth keeping: it always
   has in-month days both before and after it, so any displayed month contains
   both a disabled and an enabled day. Evaluated on the server; every route in
   this app is server-rendered on demand, so it tracks the request date rather
   than freezing at build time. */
function fifteenthOfThisMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-15T00:00`;
}

export function DateTimeFieldKitchensink() {
  return (
    <Section id="datetimefield" title="DateTimeField">
      <Block title="Interaction states — empty">
        <Cell caption="default">
          <DateTimeField id="dtf-default" label="Date and time" locale="en-GB" />
        </Cell>
        <Cell caption="hover">
          <DateTimeField id="dtf-default-hover" label="Date and time" locale="en-GB" testState="hover" />
        </Cell>
        <Cell caption="focus">
          <DateTimeField id="dtf-default-focus" label="Date and time" locale="en-GB" testState="focus" />
        </Cell>
        <Cell caption="active">
          <DateTimeField id="dtf-default-active" label="Date and time" locale="en-GB" testState="active" />
        </Cell>
      </Block>

      <Block title="Interaction states — filled">
        <Cell caption="default">
          <DateTimeField id="dtf-filled" label="Date and time" locale="en-GB" defaultValue={FILLED} />
        </Cell>
        <Cell caption="hover">
          <DateTimeField id="dtf-filled-hover" label="Date and time" locale="en-GB" defaultValue={FILLED} testState="hover" />
        </Cell>
        <Cell caption="focus">
          <DateTimeField id="dtf-filled-focus" label="Date and time" locale="en-GB" defaultValue={FILLED} testState="focus" />
        </Cell>
        <Cell caption="active">
          <DateTimeField id="dtf-filled-active" label="Date and time" locale="en-GB" defaultValue={FILLED} testState="active" />
        </Cell>
      </Block>

      {/* Disabled is its own block, never an interaction column:
          `pointer-events: none` makes hover unreachable by construction. */}
      <Block title="Disabled">
        <Cell caption="empty">
          <DateTimeField id="dtf-disabled-empty" label="Date and time" locale="en-GB" disabled />
        </Cell>
        <Cell caption="filled">
          <DateTimeField id="dtf-disabled-filled" label="Date and time" locale="en-GB" defaultValue={FILLED} disabled />
        </Cell>
      </Block>

      <Block title="Invalid">
        <Cell caption="required + empty">
          <DateTimeField
            id="dtf-invalid-empty"
            label={
              <>
                Date and time <span aria-hidden="true">*</span>
              </>
            }
            locale="en-GB"
            invalid
            required
          />
        </Cell>
        <Cell caption="out of range">
          <DateTimeField id="dtf-invalid-filled" label="Date and time" locale="en-GB" defaultValue={FILLED} invalid />
        </Cell>
      </Block>

      {/* `data-step="30"` < 60 → the second segment and the second wheel appear. */}
      <Block title="With seconds (step=30)">
        <Cell caption="step=30">
          <DateTimeField
            id="dtf-with-seconds"
            label="Date and time (seconds)"
            locale="en-GB"
            step={30}
            defaultValue="2026-05-27T14:35:00"
          />
        </Cell>
      </Block>

      {/* Both localization axes at once: hour cycle (12h/24h) AND segment order. */}
      <Block title="Localization">
        <Cell caption="en-GB (24h, D/M/Y)">
          <DateTimeField id="dtf-en-gb" label="Date and time (en-GB)" locale="en-GB" defaultValue={FILLED} />
        </Cell>
        <Cell caption="en (12h, M/D/Y + AM/PM)">
          <DateTimeField id="dtf-12h" label="Date and time (en — 12h)" locale="en" defaultValue={FILLED} />
        </Cell>
        <Cell caption="sv-SE (24h, Y/M/D)">
          <DateTimeField id="dtf-sv" label="Datum och tid (sv-SE)" locale="sv-SE" defaultValue={FILLED} />
        </Cell>
        {/* F-041 regression cell, fixed upstream in 3c7df5b. `de-DE` collapses
            to the `en` translation key, so it is the only demo locale where a raw
            tag reaching `Intl` is distinguishable from the collapsed key reaching
            it. The month wheel and calendar header now read German; the UI
            strings stay English because no `de` bundle is registered. */}
        <Cell caption="de-DE — German month names, English UI strings">
          <DateTimeField id="dtf-de" label="Datum und Uhrzeit (de-DE)" locale="de-DE" defaultValue={FILLED} />
        </Cell>
      </Block>

      <Block title="Live demo (e2e target)">
        <Cell caption='data-id="meeting-time"'>
          <DateTimeField
            id="meeting-time"
            label="Meeting time"
            locale="en-GB"
            min={fifteenthOfThisMonth()}
            max={RANGE.max}
          />
        </Cell>
      </Block>

      <Block title="Native reference">
        <Cell caption="default">
          <label htmlFor="dtf-native-default">Date and time</label>
          <input
            type="datetime-local"
            id="dtf-native-default"
            name="dtf-native-default"
            min={RANGE.min}
            max={RANGE.max}
            defaultValue={FILLED}
          />
        </Cell>
        <Cell caption="with seconds">
          <label htmlFor="dtf-native-seconds">Date and time (seconds)</label>
          <input
            type="datetime-local"
            id="dtf-native-seconds"
            name="dtf-native-seconds"
            step={1}
            defaultValue="2026-05-27T14:35:30"
          />
        </Cell>
        <Cell caption="15-min step">
          <label htmlFor="dtf-native-step">Date and time (15-min step)</label>
          <input
            type="datetime-local"
            id="dtf-native-step"
            name="dtf-native-step"
            step={900}
            defaultValue="2026-05-27T14:30"
          />
        </Cell>
        <Cell caption="disabled">
          <label htmlFor="dtf-native-disabled">Date and time</label>
          <input
            type="datetime-local"
            id="dtf-native-disabled"
            name="dtf-native-disabled"
            defaultValue={FILLED}
            disabled
          />
        </Cell>
      </Block>
    </Section>
  );
}

export default DateTimeFieldKitchensink;
