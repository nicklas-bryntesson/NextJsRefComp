/* RangeGroup kitchensink — every state in one place.
 *
 * The `data-id` values and the derived field ids are TEST CONTRACT. The suite
 * hard-codes `rangegroup-live` (with `#rg-live-lower` / `#rg-live-upper`),
 * `rangegroup-collided`, `rangegroup-rtl` and `rangegroup-flush`, and it needs
 * one group with `disabled` on the `<fieldset>`. `anchorId="RangeGroup"` carries
 * the unscoped `checkA11y(page, '#RangeGroup')` — see Findings.md F-018.
 *
 * `rangegroup-flush` is the group the digit-boundary test drives to 1000, so its
 * `max` must be 1000 for the reservation to come out as 4.
 */

import { RangeGroup, RangeGroupBootstrap } from "./RangeGroup";
import { Section, Block, Cell } from "../kitchensink-ui";

/* Shared across every group: one scale on one lane, because two different scales
   on one lane would make the drawn span meaningless. */
const SCALE = { min: 0, max: 1000, step: 10, suffix: "tkr" } as const;

const STOPS = [
  { p: 0, label: "0" },
  { p: 0.25, label: "250" },
  { p: 0.5, label: "500" },
  { p: 0.75, label: "750" },
  { p: 1, label: "1000" },
];

export function RangeGroupKitchensink() {
  return (
    <Section id="rangegroup" title="RangeGroup" anchorId="RangeGroup">
      {/* Once per page. Parser-blocking, so every group on the page is clamping
          and arbitrating before the load event — see RangeGroup.bootstrap.ts. */}
      <RangeGroupBootstrap />
      <p className="mb-lg max-w-[70ch] text-body-md">
        Two RangeFields on one shared RangeScale, bounding a span. Native range has
        no <code>multiple</code>, so a span is two inputs — each keeping its own
        role, its own keyboard and its own entry in the form data. Clamping is
        <strong> hard stop</strong>: nothing you did not touch ever moves.
      </p>

      {/* The group has no interaction states of its own; these rows verify it
          does not swallow the fields'. */}
      <Block title="Interaction states">
        <Cell caption="default">
          <RangeGroup
            id="rg-default"
            legend="Price"
            {...SCALE}
            defaultLower={200}
            defaultUpper={700}
          />
        </Cell>
        <Cell caption="hover">
          <RangeGroup
            id="rg-hover"
            legend="Price"
            {...SCALE}
            defaultLower={200}
            defaultUpper={700}
            testState="hover"
          />
        </Cell>
        <Cell caption="focus">
          <RangeGroup
            id="rg-focus"
            legend="Price"
            {...SCALE}
            defaultLower={200}
            defaultUpper={700}
            testState="focus"
          />
        </Cell>
        <Cell caption="active">
          <RangeGroup
            id="rg-active"
            legend="Price"
            {...SCALE}
            defaultLower={200}
            defaultUpper={700}
            testState="active"
          />
        </Cell>
      </Block>

      <Block title="Disabled">
        <Cell caption="group disabled — native cascades it to both fields">
          <RangeGroup
            id="rg-disabled"
            legend="Price"
            {...SCALE}
            defaultLower={200}
            defaultUpper={700}
            disabled
          />
        </Cell>
      </Block>

      <Block title="Invalid">
        <Cell caption="out of policy">
          <RangeGroup
            id="rg-invalid"
            legend="Price"
            {...SCALE}
            defaultLower={200}
            defaultUpper={700}
            invalid
          />
        </Cell>
      </Block>

      {/* Press near the left of the handle, then near the right — a different end
          moves each time. The keyboard never has this problem. */}
      <Block title="When the two ends meet">
        <Cell caption="both ends on the same value">
          <RangeGroup
            id="rg-collided"
            legend="Price"
            dataId="rangegroup-collided"
            {...SCALE}
            defaultLower={500}
            defaultUpper={500}
          />
        </Cell>
        <Cell caption="both at minimum">
          <RangeGroup
            id="rg-at-min"
            legend="Price"
            {...SCALE}
            defaultLower={0}
            defaultUpper={0}
          />
        </Cell>
        <Cell caption="both at maximum">
          <RangeGroup
            id="rg-at-max"
            legend="Price"
            {...SCALE}
            defaultLower={1000}
            defaultUpper={1000}
          />
        </Cell>
      </Block>

      <Block title="Variants">
        <Cell caption="flush lane">
          <RangeGroup
            id="rg-lane-flush"
            legend="Price"
            dataId="rangegroup-flush"
            {...SCALE}
            defaultLower={200}
            defaultUpper={700}
            lane="flush"
          />
        </Cell>
        <Cell caption="with tick labels — stops and both ends share one expression">
          <RangeGroup
            id="rg-with-ticks"
            legend="Price"
            dataId="rangegroup-ticks"
            {...SCALE}
            defaultLower={200}
            defaultUpper={700}
            lane="flush"
            ticks="labels"
            stops={STOPS}
          />
        </Cell>
        <Cell caption="RTL — the lane's ends and the role labels swap together">
          {/* `dir` on a wrapper, as the reference does it: the lane reads the
              side along its own inline axis, so the arbitration holds in RTL
              where the lower end sits on the RIGHT. */}
          <div dir="rtl">
            <RangeGroup
              id="rg-rtl"
              legend="السعر"
              lowerLabel="الأدنى"
              upperLabel="الأعلى"
              dataId="rangegroup-rtl"
              {...SCALE}
              defaultLower={200}
              defaultUpper={700}
            />
          </div>
        </Cell>
      </Block>

      <Block title="Live demo">
        <Cell caption="drag either end into the other — it stops rather than pushing">
          <RangeGroup
            id="rg-live"
            legend="Price"
            dataId="rangegroup-live"
            {...SCALE}
            defaultLower={200}
            defaultUpper={700}
          />
        </Cell>
      </Block>

      {/* Two plain <input type="number"> bounding the same span: zero
          JavaScript, no overlap, no clamping strategy, no aria-valuetext — and
          the value can be typed. When the span must be exact, or is mostly
          filled in by keyboard, THIS is the better answer. */}
      <Block title="Native reference">
        <Cell caption="two number inputs">
          <fieldset className="grid gap-xxs border-0 p-0">
            <legend className="text-body-sm text-body">Price</legend>
            <label htmlFor="rg-native-lower" className="text-body-sm text-body">
              Lowest price
            </label>
            <input
              type="number"
              id="rg-native-lower"
              name="rg-native-lower"
              min={0}
              max={1000}
              step={10}
              defaultValue={200}
              inputMode="numeric"
            />
            <label htmlFor="rg-native-upper" className="text-body-sm text-body">
              Highest price
            </label>
            <input
              type="number"
              id="rg-native-upper"
              name="rg-native-upper"
              min={0}
              max={1000}
              step={10}
              defaultValue={700}
              inputMode="numeric"
            />
          </fieldset>
        </Cell>
      </Block>
    </Section>
  );
}

export default RangeGroupKitchensink;
