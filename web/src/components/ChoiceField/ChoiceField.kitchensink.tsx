/* ChoiceField kitchensink — every state from the reference kitchensink.
 *
 * TEST CONTRACT in here, not naming preference:
 *
 *  - `id="ChoiceField"` on the wrapper. The suite's axe run is
 *    `checkA11y(page, '#ChoiceField')`. In the reference that id sits on the
 *    <section class="kitchensink-section"> itself; our shared <Section> owns its
 *    own id scheme (it uses the prop for the heading id), so the anchor goes on
 *    a wrapper inside it. Both give axe the same subtree.
 *  - The live ids the spec hard-codes: `#cf-live-cb-1` (Space toggle, box size,
 *    focus outline), `#cf-live-cb-3` (label click), `#cf-live-rd-1..3` (arrow
 *    roving + single selection, all on ONE shared name `shipping`), and
 *    `#cf-dis-cb-e` (disabled can't toggle).
 *  - `.ChoiceField` must exist as a class — `page.locator('.ChoiceField')`.
 */

import type { CSSProperties } from "react";

import { ChoiceField } from "./ChoiceField";
import { Section, Block, Cell } from "../kitchensink-ui";

/* The documented host-accent override. It must land on the .ChoiceField element:
   ChoiceField.md — an ancestor or :root override is shadowed by the component's
   own defaults on the root. */
const accent = {
  "--_cf-selected": "#0066cc",
  "--_cf-mark-color": "#fff",
} as CSSProperties;

export function ChoiceFieldKitchensink() {
  return (
    <Section id="choicefield" title="ChoiceField">
      {/* The two overrides on the wrapper are ACCESSIBILITY REMEDIATION of the
          shared demo chrome, not decoration. ChoiceField's spec is the first to
          run axe over a whole kitchensink section (`checkA11y(page, '#ChoiceField')`
          — no per-component scoping), which exposed that <Block>'s `text-muted`
          h3 (#807d72 on #f7f7f4 = 3.84:1) and <Cell>'s `text-muted-soft` caption
          (#a09c92 on #ffffff = 2.73:1) both fail WCAG 1.4.3. kitchensink-ui.tsx
          is off-limits to a component port, so the roles are re-pointed to
          `text-body` (#5a5852, ≈6.3:1) inside this subtree via descendant
          selectors that outrank the single-class utilities. See
          findings/ChoiceField.md — the real fix belongs in the shared chrome. */}
      <div
        id="ChoiceField"
        className="[&_h3]:text-body [&_span.text-caption]:text-body"
      >
        <Block title="Interaction states — checkbox · empty">
          <Cell caption="default">
            <ChoiceField type="checkbox" id="cf-cb-def-e" label="Label" />
          </Cell>
          <Cell caption="hover">
            <ChoiceField type="checkbox" id="cf-cb-hov-e" label="Label" testState="hover" />
          </Cell>
          <Cell caption="focus">
            <ChoiceField type="checkbox" id="cf-cb-foc-e" label="Label" testState="focus" />
          </Cell>
          <Cell caption="active">
            <ChoiceField type="checkbox" id="cf-cb-act-e" label="Label" testState="active" />
          </Cell>
        </Block>

        <Block title="Interaction states — checkbox · checked">
          <Cell caption="default">
            <ChoiceField type="checkbox" id="cf-cb-def-f" label="Label" defaultChecked />
          </Cell>
          <Cell caption="hover">
            <ChoiceField type="checkbox" id="cf-cb-hov-f" label="Label" defaultChecked testState="hover" />
          </Cell>
          <Cell caption="focus">
            <ChoiceField type="checkbox" id="cf-cb-foc-f" label="Label" defaultChecked testState="focus" />
          </Cell>
          <Cell caption="active">
            <ChoiceField type="checkbox" id="cf-cb-act-f" label="Label" defaultChecked testState="active" />
          </Cell>
        </Block>

        <Block title="Interaction states — radio · unselected">
          <Cell caption="default">
            <ChoiceField type="radio" id="cf-rd-def-e" label="Label" />
          </Cell>
          <Cell caption="hover">
            <ChoiceField type="radio" id="cf-rd-hov-e" label="Label" testState="hover" />
          </Cell>
          <Cell caption="focus">
            <ChoiceField type="radio" id="cf-rd-foc-e" label="Label" testState="focus" />
          </Cell>
          <Cell caption="active">
            <ChoiceField type="radio" id="cf-rd-act-e" label="Label" testState="active" />
          </Cell>
        </Block>

        <Block title="Interaction states — radio · selected">
          <Cell caption="default">
            <ChoiceField type="radio" id="cf-rd-def-f" label="Label" defaultChecked />
          </Cell>
          <Cell caption="hover">
            <ChoiceField type="radio" id="cf-rd-hov-f" label="Label" defaultChecked testState="hover" />
          </Cell>
          <Cell caption="focus">
            <ChoiceField type="radio" id="cf-rd-foc-f" label="Label" defaultChecked testState="focus" />
          </Cell>
          <Cell caption="active">
            <ChoiceField type="radio" id="cf-rd-act-f" label="Label" defaultChecked testState="active" />
          </Cell>
        </Block>

        {/* Disabled is a FUNCTIONAL state: no interaction columns. */}
        <Block title="Disabled">
          <Cell caption="checkbox · empty">
            <ChoiceField type="checkbox" id="cf-dis-cb-e" label="Label" disabled />
          </Cell>
          <Cell caption="checkbox · checked">
            <ChoiceField type="checkbox" id="cf-dis-cb-f" label="Label" defaultChecked disabled />
          </Cell>
          <Cell caption="radio · selected">
            <ChoiceField type="radio" id="cf-dis-rd-f" label="Label" defaultChecked disabled />
          </Cell>
        </Block>

        <Block title="Invalid">
          <Cell caption="checkbox · required + empty">
            <ChoiceField type="checkbox" id="cf-inv-cb" label="Accept the terms" required invalid />
          </Cell>
          <Cell caption="radio · required + unselected">
            <ChoiceField type="radio" id="cf-inv-rd" label="Pick one" required invalid />
          </Cell>
        </Block>

        <Block title="Variants — accent-themed (host token)">
          <Cell caption="--_cf-selected override">
            <ChoiceField type="checkbox" id="cf-var-cb" label="Checkbox" defaultChecked style={accent} />
            <ChoiceField type="radio" id="cf-var-rd" label="Radio" defaultChecked style={accent} />
          </Cell>
        </Block>

        {/* Live demo — the instances the spec drives. Independent checkboxes
            (no shared name) and a real single-selection radio group whose three
            options share exactly one name. */}
        <Block title="Live demo">
          <Cell caption="Notifications (choose any)">
            <div
              id="cf-live-checkbox"
              data-id="choicefield-live"
              className="flex flex-col items-start gap-sm"
            >
              <ChoiceField type="checkbox" id="cf-live-cb-1" label="Email" />
              <ChoiceField type="checkbox" id="cf-live-cb-2" label="SMS" defaultChecked />
              <ChoiceField type="checkbox" id="cf-live-cb-3" label="Push" />
            </div>
          </Cell>
          <Cell caption="Shipping (choose one)">
            <div id="cf-live-radio" className="flex flex-col items-start gap-sm">
              <ChoiceField type="radio" id="cf-live-rd-1" name="shipping" label="Standard" defaultChecked />
              <ChoiceField type="radio" id="cf-live-rd-2" name="shipping" label="Express" />
              <ChoiceField type="radio" id="cf-live-rd-3" name="shipping" label="Overnight" />
            </div>
          </Cell>
        </Block>

        {/* Native reference — the browser's own controls, unstyled, for
            comparison. Deliberately NOT .ChoiceField. */}
        <Block title="Native reference">
          <Cell caption="native checkbox">
            <span>
              <input type="checkbox" id="cf-native-cb" /> <label htmlFor="cf-native-cb">Label</label>
            </span>
          </Cell>
          <Cell caption="native radio">
            <span>
              <input type="radio" id="cf-native-rd-1" name="cf-native-rd" defaultChecked />{" "}
              <label htmlFor="cf-native-rd-1">One</label>{" "}
              <input type="radio" id="cf-native-rd-2" name="cf-native-rd" />{" "}
              <label htmlFor="cf-native-rd-2">Two</label>
            </span>
          </Cell>
        </Block>
      </div>
    </Section>
  );
}

export default ChoiceFieldKitchensink;
