/* AffixField kitchensink — every state in one place.
 *
 * The `data-id` values are TEST CONTRACT, not naming preference: the AffixField
 * suite hard-codes `affixfield-live` (its target, via e2e-helpers/target.js) plus
 * `affixfield-bare`, `-authored`, `-unit-in-label`, `-number`, `-describedby` and
 * `-sized` for the variant assertions. `#af-native-number` is likewise required —
 * the spinner test compares the component's computed `appearance` against it.
 */

import { AffixField } from "./AffixField";
import { Section, Block, Cell } from "../kitchensink-ui";

export function AffixFieldKitchensink() {
  return (
  <Section id="affixfield" title="AffixField">
    <Block title="Interaction states — empty">
      <Cell caption="default">
        <AffixField id="af-empty-default" label="Amount" inputMode="decimal" prefix="$" suffix="USD" />
      </Cell>
      <Cell caption="hover">
        <AffixField id="af-empty-hover" label="Amount" inputMode="decimal" prefix="$" suffix="USD" testState="hover" />
      </Cell>
      <Cell caption="focus">
        <AffixField id="af-empty-focus" label="Amount" inputMode="decimal" prefix="$" suffix="USD" testState="focus" />
      </Cell>
      <Cell caption="active">
        <AffixField id="af-empty-active" label="Amount" inputMode="decimal" prefix="$" suffix="USD" testState="active" />
      </Cell>
    </Block>

    <Block title="Interaction states — filled">
      <Cell caption="default">
        <AffixField id="af-filled-default" label="Amount" inputMode="decimal" defaultValue="100" prefix="$" suffix="USD" />
      </Cell>
      <Cell caption="hover">
        <AffixField id="af-filled-hover" label="Amount" inputMode="decimal" defaultValue="100" prefix="$" suffix="USD" testState="hover" />
      </Cell>
      <Cell caption="focus">
        <AffixField id="af-filled-focus" label="Amount" inputMode="decimal" defaultValue="100" prefix="$" suffix="USD" testState="focus" />
      </Cell>
      <Cell caption="active">
        <AffixField id="af-filled-active" label="Amount" inputMode="decimal" defaultValue="100" prefix="$" suffix="USD" testState="active" />
      </Cell>
    </Block>

    <Block title="Disabled">
      <Cell caption="empty">
        <AffixField id="af-disabled-empty" label="Amount" inputMode="decimal" prefix="$" suffix="USD" disabled />
      </Cell>
      <Cell caption="filled">
        <AffixField id="af-disabled-filled" label="Amount" inputMode="decimal" defaultValue="100" prefix="$" suffix="USD" disabled />
      </Cell>
    </Block>

    <Block title="Invalid">
      <Cell caption="empty / required">
        <AffixField
          id="af-invalid-empty"
          label={<>Amount <span aria-hidden="true">*</span></>}
          inputMode="decimal"
          prefix="$"
          suffix="USD"
          required
          invalid
        />
      </Cell>
      <Cell caption="filled">
        <AffixField id="af-invalid-filled" label="Amount" inputMode="decimal" defaultValue="-1" prefix="$" suffix="USD" invalid />
      </Cell>
    </Block>

    <Block title="Variants">
      {/* 1. Bare. In the reference this variant authors NO presence attributes
             and proves the JS gap-fill path. A zero-JS port renders the
             end-state directly, so bare and authored become the same DOM —
             the distinction is unobservable here. See Findings.md F-012. */}
      <Cell caption="bare (gap-fill path)">
        <AffixField id="af-variant-bare" dataId="affixfield-bare" label="Amount" inputMode="decimal" prefix="$" suffix="USD" />
      </Cell>

      {/* 2. Fully authored — the server end-state. */}
      <Cell caption="fully authored">
        <AffixField id="af-variant-authored" dataId="affixfield-authored" label="Amount" inputMode="decimal" prefix="$" suffix="USD" />
      </Cell>

      {/* 3. Unit already in the label → the affix is aria-hidden and skipped
             entirely: no id, no describedby entry. */}
      <Cell caption="unit in label">
        <AffixField
          id="af-variant-unit-in-label"
          dataId="affixfield-unit-in-label"
          label="Number of hours"
          inputMode="numeric"
          suffix="hours"
          suffixHidden
        />
      </Cell>

      {/* 4. type=number — the primary use case. Spinner hidden because it
             collides with the suffix; arrow-key stepping still works. */}
      <Cell caption="number (hidden spinner)">
        <AffixField id="af-variant-number" dataId="affixfield-number" label="Amount (number)" type="number" defaultValue="100" prefix="$" suffix="USD" />
      </Cell>

      {/* 5. describedby merge — the hint id comes first, affixes append. */}
      <Cell caption="describedby merge">
        <AffixField
          id="af-variant-describedby"
          dataId="affixfield-describedby"
          label="Price"
          inputMode="decimal"
          suffix="USD"
          hint="Excluding VAT."
        />
      </Cell>

      {/* 6. Sized — value area is exactly 4 character units, end-aligned. */}
      <Cell caption="sized (4ch, end-aligned)">
        <AffixField
          id="af-variant-sized"
          dataId="affixfield-sized"
          label="Number of hours"
          type="number"
          defaultValue="40"
          suffix="hours"
          inputCharacters={4}
          align="end"
        />
      </Cell>
    </Block>

    <Block title="Live demo — e2e target">
      <Cell caption="affixfield-live">
        <AffixField id="af-live" dataId="affixfield-live" label="Amount" inputMode="decimal" prefix="$" suffix="USD" />
      </Cell>
    </Block>

    <Block title="Native reference">
      {/* No AffixField wrapper: a bare number input with its spinner visible
          — the collision the component's hidden spinner avoids. The suite
          reads its computed `appearance` and expects 'auto'. */}
      <Cell caption="native number">
        <div className="grid gap-xxs">
          <label htmlFor="af-native-number">Amount</label>
          <input type="number" id="af-native-number" name="af-native-number" defaultValue="100" />
        </div>
      </Cell>
    </Block>
  </Section>
  );
}
