/* RangeField kitchensink — every state in one place.
 *
 * The ids here are TEST CONTRACT, not naming preference. The suite hard-codes
 * `#rf-live`, `#rf-variant-stepped`, `#rf-variant-valuetext`, `#rf-invalid-mid`,
 * `#rf-disabled-mid`, `#rf-variant-vertical`, `#rf-variant-vertical-top`,
 * `#rf-variant-datalist` (+ its `list="rf-variant-datalist-ticks"`) and
 * `#rf-native` (+ `list="rf-native-ticks"`) — the last of which must be an
 * UNSTYLED native range, because the datalist test compares the two computed
 * `appearance` values against each other.
 *
 * `anchorId="RangeField"` is required twice over: the target-size sweep selects
 * `#RangeField .RangeField`, and the axe run is `checkA11y(page, '#RangeField')`.
 * Neither id is documented in the component contract. See Findings.md F-018.
 */

import { RangeField } from "./RangeField";
import { Section, Block, Cell } from "../kitchensink-ui";

/* The five tick values the reference authors on both datalist variants. Rendered
   as real <option> elements: `appearance: none` means the styled field draws none
   of them, which is the documented point of the pair, not a bug. */
const TICKS = [0, 25, 50, 75, 100];

function Ticks({ id }: { id: string }) {
  return (
    <datalist id={id}>
      {TICKS.map((v) => (
        <option key={v} value={v} />
      ))}
    </datalist>
  );
}

export function RangeFieldKitchensink() {
  return (
    <Section id="rangefield" title="RangeField" anchorId="RangeField">
      <p className="mb-lg max-w-[70ch] text-body-md">
        A range <strong>always carries a value</strong>, so the rows are{" "}
        <em>at minimum</em> and <em>partially filled</em> rather than the
        family&apos;s usual empty/filled pair. There is no fill and no JavaScript:
        anything whose position depends on the value belongs to RangeScale.
      </p>

      <Block title="Interaction states — at minimum">
        <Cell caption="default">
          <RangeField id="rf-min-default" label="Volume" defaultValue={0} valueText="0 %" />
        </Cell>
        <Cell caption="hover">
          <RangeField id="rf-min-hover" label="Volume" defaultValue={0} valueText="0 %" testState="hover" />
        </Cell>
        <Cell caption="focus">
          <RangeField id="rf-min-focus" label="Volume" defaultValue={0} valueText="0 %" testState="focus" />
        </Cell>
        <Cell caption="active">
          <RangeField id="rf-min-active" label="Volume" defaultValue={0} valueText="0 %" testState="active" />
        </Cell>
      </Block>

      <Block title="Interaction states — partially filled">
        <Cell caption="default">
          <RangeField id="rf-mid-default" label="Volume" defaultValue={50} valueText="50 %" />
        </Cell>
        <Cell caption="hover">
          <RangeField id="rf-mid-hover" label="Volume" defaultValue={50} valueText="50 %" testState="hover" />
        </Cell>
        <Cell caption="focus">
          <RangeField id="rf-mid-focus" label="Volume" defaultValue={50} valueText="50 %" testState="focus" />
        </Cell>
        <Cell caption="active">
          <RangeField id="rf-mid-active" label="Volume" defaultValue={50} valueText="50 %" testState="active" />
        </Cell>
      </Block>

      {/* Disabled is a FUNCTIONAL state — pointer-events make hover impossible,
          so it gets no interaction columns. */}
      <Block title="Disabled">
        <Cell caption="at minimum">
          <RangeField id="rf-disabled-min" label="Volume" defaultValue={0} valueText="0 %" disabled />
        </Cell>
        <Cell caption="partially filled">
          <RangeField id="rf-disabled-mid" label="Volume" defaultValue={50} valueText="50 %" disabled />
        </Cell>
      </Block>

      <Block title="Invalid">
        <Cell caption="out of policy, with a hint">
          <RangeField
            id="rf-invalid-min"
            label="Volume"
            defaultValue={0}
            valueText="0 %"
            invalid
            describedBy="rf-invalid-min-hint"
          />
          <p id="rf-invalid-min-hint" className="text-body-sm text-body">
            Pick at least 10 %.
          </p>
        </Cell>
        <Cell caption="out of policy">
          <RangeField id="rf-invalid-mid" label="Volume" defaultValue={50} valueText="50 %" invalid />
        </Cell>
      </Block>

      <Block title="Variants">
        <Cell caption="stepped (step matches tick values)">
          <RangeField
            id="rf-variant-stepped"
            label="Volume (steps of 25)"
            dataId="rangefield-stepped"
            step={25}
            defaultValue={75}
            valueText="75 %"
          />
        </Cell>
        <Cell caption="resized (thumb 2em, track 0.75em)">
          <RangeField
            id="rf-variant-resized"
            label="Volume (larger thumb)"
            dataId="rangefield-resized"
            defaultValue={50}
            valueText="50 %"
            styleOverrides={
              { "--_rf-thumb": "2em", "--_rf-track": "0.75em" } as React.CSSProperties
            }
          />
        </Cell>
        <Cell caption="scales with text (font-size only)">
          <RangeField
            id="rf-variant-text-scaled"
            label="Volume (font-size: 1.5rem)"
            dataId="rangefield-text-scaled"
            defaultValue={50}
            valueText="50 %"
            styleOverrides={{ fontSize: "1.5rem" }}
          />
        </Cell>
        <Cell caption="aria-valuetext carries the unit">
          <RangeField
            id="rf-variant-valuetext"
            label="Budget"
            dataId="rangefield-valuetext"
            min={0}
            max={1000}
            step={50}
            defaultValue={250}
            valueText="250 kr"
          />
        </Cell>
        <Cell caption="vertical, min at the bottom (default)">
          <RangeField
            id="rf-variant-vertical"
            label="Volume (vertical)"
            dataId="rangefield-vertical"
            defaultValue={50}
            valueText="50 %"
            orientation="vertical"
          />
        </Cell>
        <Cell caption="vertical, min at the top">
          <RangeField
            id="rf-variant-vertical-top"
            label="Depth (min at top)"
            dataId="rangefield-vertical-top"
            defaultValue={50}
            valueText="50 %"
            orientation="vertical"
            minPosition="top"
          />
        </Cell>
        <Cell caption="datalist present, no marks drawn">
          <RangeField
            id="rf-variant-datalist"
            label="Volume (datalist, no marks drawn)"
            dataId="rangefield-datalist"
            step={25}
            defaultValue={50}
            list="rf-variant-datalist-ticks"
          />
          <Ticks id="rf-variant-datalist-ticks" />
        </Cell>
      </Block>

      <Block title="Live demo">
        <Cell caption="the e2e target — no authored style attribute at all">
          <RangeField
            id="rf-live"
            label="Volume"
            dataId="rangefield-live"
            defaultValue={50}
            valueText="50 %"
          />
        </Cell>
      </Block>

      {/* The browser's own track, thumb and <datalist> tick marks. This one is
          deliberately NOT a RangeField: the datalist test asserts
          getComputedStyle(native).appearance === 'auto' against the styled
          variant's 'none'. */}
      <Block title="Native reference">
        <Cell caption="unstyled range with datalist">
          <label htmlFor="rf-native">Volume</label>
          <input
            type="range"
            id="rf-native"
            name="rf-native"
            min={0}
            max={100}
            step={25}
            defaultValue={50}
            list="rf-native-ticks"
          />
          <Ticks id="rf-native-ticks" />
        </Cell>
      </Block>
    </Section>
  );
}

export default RangeFieldKitchensink;
