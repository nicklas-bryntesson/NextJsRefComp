/* Picklist kitchensink — every state and every `data-id` from the reference
 * kitchensink (`Picklist.html`).
 *
 * TEST CONTRACT in here, not naming preference:
 *
 *  - `anchorId="Picklist"` → `id="Picklist"` on the `.kitchensink-section`
 *    element itself, exactly where the reference puts it. Two suites run an
 *    UNSCOPED `checkA11y(page, '#Picklist')`: Picklist's own spec and — the
 *    reason this port was prioritised — the site-level
 *    `tests/appearance.e2e.test.js`, which also addresses
 *    `.Picklist[data-id="single"] label[for="pl-s-1"]` (initially selected) and
 *    `label[for="pl-s-2"]` (unselected) to prove the light/dark seam reaches
 *    component internals. Those two ids and that selected/unselected pairing are
 *    verified against `Picklist.html` and must not drift.
 *  - Every `data-id` the spec addresses: state-focus (pl-sf-1/2),
 *    state-seg-focus (pl-ssf-1/2), disabled-single (pl-d-2), disabled-group
 *    (pl-dg-2), invalid (pl-err-text), single (pl-s-1/2), multi (pl-m-1),
 *    removable (pl-r-1), beside, hidden, wrap, segmented (pl-sg-1), vertical,
 *    vertical-segmented, segmented-rect, live (pl-l-2/3).
 *  - `.Picklist`, `.option`, `.options`, `.content`, `.hint`, `.deselect`,
 *    `.notice-region`, `.Notice` are all selected by the suite. Structural, not
 *    styling (Findings.md F-008).
 *
 * The reference section ends with a `.ChoiceGroup` "reference" block comparing
 * the same options as a plain ChoiceGroup. ChoiceGroup is not ported yet, so
 * that block is omitted rather than shipped as unstyled markup — nothing in
 * `Picklist.e2e.test.js` touches it.
 */

import type { CSSProperties } from "react";

import { Picklist } from "./Picklist";
import { Section, Block, Cell } from "../kitchensink-ui";

/* The documented token override: pill vs rectangle is a design VALUE, not an
   attribute, and the same token rounds the two ends of a segmented bar. It must
   land on the `.Picklist` element — an ancestor override is shadowed by the
   component's own defaults on its root. */
const rectRadius = { "--_pl-chip-radius": "0.25rem" } as CSSProperties;

/** The three-segment set the simulated segmented states share. */
const segStates = (prefix: string) => [
  { id: `${prefix}-1`, label: "Selected", defaultChecked: true },
  { id: `${prefix}-2`, label: "Unselected" },
  { id: `${prefix}-3`, label: "Third" },
];

export function PicklistKitchensink() {
  return (
    <Section id="picklist" title="Picklist" anchorId="Picklist">
      {/* ── 1. Interaction states ──────────────────────────────────────────
          `data-test-state` sits on the ROOT; the stylesheet projects it down to
          the chips with descendant selectors that mirror the real pseudo-class
          pairs. Each cell is its own Picklist root so the simulated state is
          scoped to it. */}
      <Block title="Interaction states — gapped chips">
        <Cell caption="default">
          <Picklist
            dataId="state-default"
            legend="Interaction state: default"
            legendPlacement="hidden"
            type="checkbox"
            options={[
              { id: "pl-sd-1", label: "Unselected" },
              { id: "pl-sd-2", label: "Selected", defaultChecked: true },
            ]}
          />
        </Cell>
        <Cell caption="hover">
          <Picklist
            dataId="state-hover"
            legend="Interaction state: hover"
            legendPlacement="hidden"
            testState="hover"
            type="checkbox"
            options={[
              { id: "pl-sh-1", label: "Unselected" },
              { id: "pl-sh-2", label: "Selected", defaultChecked: true },
            ]}
          />
        </Cell>
        <Cell caption="focus">
          <Picklist
            dataId="state-focus"
            legend="Interaction state: focus"
            legendPlacement="hidden"
            testState="focus"
            type="checkbox"
            options={[
              { id: "pl-sf-1", label: "Unselected" },
              { id: "pl-sf-2", label: "Selected", defaultChecked: true },
            ]}
          />
        </Cell>
        <Cell caption="active">
          <Picklist
            dataId="state-active"
            legend="Interaction state: active"
            legendPlacement="hidden"
            testState="active"
            type="checkbox"
            options={[
              { id: "pl-sa-1", label: "Unselected" },
              { id: "pl-sa-2", label: "Selected", defaultChecked: true },
            ]}
          />
        </Cell>
      </Block>

      {/* Segmented shares the same simulated states, but needs its own rows:
          segments touch, so the focus treatment has to be checked where a
          neighbour could paint over it. (It cannot, because the ring is inset —
          which is precisely what the spec ties together.) */}
      <Block title="Interaction states — segmented">
        <Cell caption="default">
          <Picklist
            dataId="state-seg-default"
            legend="Segmented state: default"
            legendPlacement="hidden"
            segmented
            type="radio"
            name="pl-ssd"
            options={segStates("pl-ssd")}
          />
        </Cell>
        <Cell caption="hover">
          <Picklist
            dataId="state-seg-hover"
            legend="Segmented state: hover"
            legendPlacement="hidden"
            segmented
            testState="hover"
            type="radio"
            name="pl-ssh"
            options={segStates("pl-ssh")}
          />
        </Cell>
        <Cell caption="focus">
          <Picklist
            dataId="state-seg-focus"
            legend="Segmented state: focus"
            legendPlacement="hidden"
            segmented
            testState="focus"
            type="radio"
            name="pl-ssf"
            options={segStates("pl-ssf")}
          />
        </Cell>
        <Cell caption="active">
          <Picklist
            dataId="state-seg-active"
            legend="Segmented state: active"
            legendPlacement="hidden"
            segmented
            testState="active"
            type="radio"
            name="pl-ssa"
            options={segStates("pl-ssa")}
          />
        </Cell>
      </Block>

      {/* ── 2. Disabled — its own block. Disabled is a FUNCTIONAL state:
          `cursor: not-allowed` and no pointer target, so there is no
          hover/focus to simulate. Both a single disabled chip and the
          `<fieldset disabled>` cascade. */}
      <Block title="Disabled">
        <Cell caption="one chip disabled">
          <Picklist
            dataId="disabled-single"
            legend="One chip disabled"
            type="checkbox"
            options={[
              { id: "pl-d-1", label: "Available", defaultChecked: true },
              { id: "pl-d-2", label: "Sold out", disabled: true },
              {
                id: "pl-d-3",
                label: "Locked in",
                defaultChecked: true,
                disabled: true,
              },
            ]}
          />
        </Cell>
        <Cell caption="whole group disabled (fieldset cascade)">
          <Picklist
            dataId="disabled-group"
            legend="Whole group disabled (fieldset cascade)"
            disabled
            type="radio"
            name="pl-dg"
            options={[
              { id: "pl-dg-1", label: "Thai", defaultChecked: true },
              { id: "pl-dg-2", label: "Italian" },
            ]}
          />
        </Cell>
      </Block>

      {/* ── 3. Invalid — group level, with the error as a Notice inside a
          persistent live region. The fieldset's `aria-describedby` points at the
          Notice's text id, so the error also describes the group on focus. */}
      <Block title="Invalid (group error)">
        <Cell caption="data-invalid + error Notice in a live region">
          <Picklist
            dataId="invalid"
            legend="Dietary needs"
            invalid
            type="checkbox"
            errorId="pl-err-text"
            error="Pick at least one option to continue."
            options={[
              { id: "pl-e-1", label: "Vegetarian", required: true, ariaInvalid: true },
              { id: "pl-e-2", label: "Vegan", required: true, ariaInvalid: true },
              { id: "pl-e-3", label: "Gluten free", required: true, ariaInvalid: true },
            ]}
          />
        </Cell>
      </Block>

      {/* ── 4. Variants ─────────────────────────────────────────────────── */}
      <Block title="Single-select (radio core)">
        {/* The appearance suite's anchor. `pl-s-1` is the initially selected
            chip (CanvasText fill) and `pl-s-2` the unselected one (Canvas fill);
            the pair is what proves the system colours invert where the
            component inverts. */}
        <Picklist
          dataId="single"
          legend="Cuisine"
          type="radio"
          name="pl-cuisine"
          options={[
            { id: "pl-s-1", label: "Thai", defaultChecked: true },
            { id: "pl-s-2", label: "Italian" },
            { id: "pl-s-3", label: "Japanese" },
            { id: "pl-s-4", label: "Mexican" },
          ]}
        />
      </Block>

      <Block title="Multi-select (checkbox core)">
        <Picklist
          dataId="multi"
          legend="Amenities"
          type="checkbox"
          options={[
            { id: "pl-m-1", label: "Wi-Fi", defaultChecked: true },
            { id: "pl-m-2", label: "Parking" },
            { id: "pl-m-3", label: "Breakfast", defaultChecked: true },
            { id: "pl-m-4", label: "Pool" },
          ]}
        />
      </Block>

      {/* Removable — checkbox core only. A native radio cannot be unchecked by
          the user, so an `×` on a radio chip would promise what it cannot do. */}
      <Block title="Removable (checkbox core only)">
        <Picklist
          dataId="removable"
          legend="Applied filters"
          type="checkbox"
          hintId="pl-r-hint"
          hint="Selected chips show a × — activating it removes the selection."
          options={[
            { id: "pl-r-1", label: "Under 500 kr", defaultChecked: true, removable: true },
            { id: "pl-r-2", label: "In stock", defaultChecked: true, removable: true },
            { id: "pl-r-3", label: "Free delivery", removable: true },
          ]}
        />
      </Block>

      <Block title="Legend beside">
        <Picklist
          dataId="beside"
          legend="Size"
          legendPlacement="beside"
          type="radio"
          name="pl-size"
          options={[
            { id: "pl-b-1", label: "S" },
            { id: "pl-b-2", label: "M", defaultChecked: true },
            { id: "pl-b-3", label: "L" },
            { id: "pl-b-4", label: "XL" },
          ]}
        />
      </Block>

      {/* Legend hidden — clipped to 1px, still the group's accessible name.
          The spec asserts both halves: the name resolves, and the box is ≤2px. */}
      <Block title="Legend hidden (SR-only name)">
        <Picklist
          dataId="hidden"
          legend="Sort order"
          legendPlacement="hidden"
          type="radio"
          name="pl-sort"
          options={[
            { id: "pl-h-1", label: "Newest", defaultChecked: true },
            { id: "pl-h-2", label: "Price" },
            { id: "pl-h-3", label: "Rating" },
          ]}
        />
      </Block>

      <Block title="Long set (wraps to multiple rows)">
        <Picklist
          dataId="wrap"
          legend="Tags"
          type="checkbox"
          options={[
            { id: "pl-w-1", label: "Accessibility", defaultChecked: true },
            { id: "pl-w-2", label: "Design systems" },
            { id: "pl-w-3", label: "Typography" },
            { id: "pl-w-4", label: "Performance", defaultChecked: true },
            { id: "pl-w-5", label: "Testing" },
            { id: "pl-w-6", label: "Documentation" },
            { id: "pl-w-7", label: "Progressive enhancement" },
          ]}
        />
      </Block>

      <Block title="Segmented (horizontal)">
        <Picklist
          dataId="segmented"
          legend="Text alignment"
          segmented
          type="radio"
          name="pl-align"
          options={[
            { id: "pl-sg-1", label: "Left", defaultChecked: true },
            { id: "pl-sg-2", label: "Center" },
            { id: "pl-sg-3", label: "Right" },
            { id: "pl-sg-4", label: "Justify" },
          ]}
        />
      </Block>

      <Block title="Segmented with a rectangular radius (token override)">
        <Picklist
          dataId="segmented-rect"
          legend="Density"
          segmented
          style={rectRadius}
          type="radio"
          name="pl-density"
          options={[
            { id: "pl-sr-1", label: "Comfortable" },
            { id: "pl-sr-2", label: "Cozy", defaultChecked: true },
            { id: "pl-sr-3", label: "Compact" },
          ]}
        />
      </Block>

      {/* Vertical + gapped — the chips hug their own text. This is NOT a
          ChoiceGroup: what separates the two is the item SKIN (a pill vs a box
          with a mark), not the direction the items run in. */}
      <Block title="Vertical (gapped — chips hug their text)">
        <Picklist
          dataId="vertical"
          legend="Delivery window"
          orientation="vertical"
          type="checkbox"
          options={[
            { id: "pl-v-1", label: "Morning", defaultChecked: true },
            { id: "pl-v-2", label: "Afternoon" },
            { id: "pl-v-3", label: "Evening" },
          ]}
        />
      </Block>

      {/* Vertical + segmented — the two axes compose. Here the labels must
          stretch (`flex: 1`), not hug: stretching only the `.option` wrapper
          renders the bar ragged, which the spec measures on the LABELS. */}
      <Block title="Vertical + segmented">
        <Picklist
          dataId="vertical-segmented"
          legend="Sort direction"
          orientation="vertical"
          segmented
          type="radio"
          name="pl-sortdir"
          options={[
            { id: "pl-vs-1", label: "Newest first", defaultChecked: true },
            { id: "pl-vs-2", label: "Oldest first" },
            { id: "pl-vs-3", label: "Recently updated" },
          ]}
        />
      </Block>

      {/* ── 5. Live demo ────────────────────────────────────────────────── */}
      <Block title="Live demo">
        <Picklist
          dataId="live"
          legend="Toppings"
          type="checkbox"
          hintId="pl-live-hint"
          hint="Pick as many as you like — Tab into the set, then Space to toggle."
          options={[
            { id: "pl-l-1", label: "Mozzarella" },
            { id: "pl-l-2", label: "Basil", defaultChecked: true },
            { id: "pl-l-3", label: "Olives" },
            { id: "pl-l-4", label: "Chili" },
          ]}
        />
      </Block>
    </Section>
  );
}

export default PicklistKitchensink;
