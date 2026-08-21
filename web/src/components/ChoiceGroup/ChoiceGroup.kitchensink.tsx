/* ChoiceGroup kitchensink — every state from the reference kitchensink.
 *
 * TEST CONTRACT in here, not naming preference:
 *
 *  - `anchorId="ChoiceGroup"` puts `id="ChoiceGroup"` on the
 *    `.kitchensink-section` element, because the spec's last test is an
 *    UNSCOPED `checkA11y(page, '#ChoiceGroup')` against the id of the
 *    reference *demo section*. Nothing in ChoiceGroup.md mentions it (F-018).
 *  - The legends ARE test selectors: `getByRole('group', { name: … })` for
 *    'Shipping speed', 'Payment method', 'Account type' and 'Terms'. Renaming
 *    any of them fails the suite on a missing element. They must also stay
 *    unique across the aggregate page — `toBeVisible()` is strict-mode.
 *  - `data-id` anchors the spec locates by class+attribute: `above`, `hidden`,
 *    `horizontal`, `invalid`. `beside`, `hint` and `live` complete the set.
 *  - Hard-coded ids: `#cg-live-1` / `#cg-live-2` and `label[for="cg-live-2"]`
 *    (single-selection test), sharing the one `name="cg-live"`.
 */

/* IMPORT ORDER IS LOAD-BEARING, not style. `.ChoiceGroup .content` and
 * `.Notice .content` are the same specificity (0,2,0) and collide on the nested
 * error Notice, so source order decides. The reference's hand-ordered
 * `src/css/site/style.css` puts ChoiceGroup.css BEFORE Notice.css, which is why
 * the reference demo shows a flex Notice body; in a bundler the order is the
 * module graph's, so ChoiceGroup must be imported first here to reproduce it.
 * Measured both ways — see findings/ChoiceGroup.md. */
import { ChoiceGroup } from "./ChoiceGroup";
import { ChoiceField } from "../ChoiceField/ChoiceField";
import { Notice, NoticeRegion } from "../Notice/Notice";
import { Section, Block, Cell } from "../kitchensink-ui";

export function ChoiceGroupKitchensink() {
  return (
    <Section id="choicegroup" title="ChoiceGroup" anchorId="ChoiceGroup">
      <Block title="Legend above (default) · radios">
        <Cell caption='data-legend="above" · vertical'>
          <ChoiceGroup dataId="above" legend="Shipping speed" className="w-full">
            <ChoiceField type="radio" id="cg-a-1" name="cg-above" label="Standard" defaultChecked />
            <ChoiceField type="radio" id="cg-a-2" name="cg-above" label="Express" />
            <ChoiceField type="radio" id="cg-a-3" name="cg-above" label="Overnight" />
          </ChoiceGroup>
        </Cell>
      </Block>

      <Block title="Legend beside · checkboxes">
        <Cell caption='data-legend="beside" · independent checkboxes'>
          {/* Checkboxes are multi-select purely because they are checkboxes —
              ChoiceGroup encodes no cardinality (ADR-0015). Each gets its own
              `name`, so nothing is grouped by accident. */}
          <ChoiceGroup
            dataId="beside"
            legend="Notifications"
            legendPlacement="beside"
            className="w-full"
          >
            <ChoiceField type="checkbox" id="cg-b-1" label="Email" defaultChecked />
            <ChoiceField type="checkbox" id="cg-b-2" label="SMS" />
            <ChoiceField type="checkbox" id="cg-b-3" label="Push" />
          </ChoiceGroup>
        </Cell>
      </Block>

      <Block title="Legend hidden (SR-only name)">
        <Cell caption='data-legend="hidden" — clipped to 1px, still the group name'>
          <ChoiceGroup
            dataId="hidden"
            legend="Payment method"
            legendPlacement="hidden"
            className="w-full"
          >
            <ChoiceField type="radio" id="cg-h-1" name="cg-hidden" label="Card" defaultChecked />
            <ChoiceField type="radio" id="cg-h-2" name="cg-hidden" label="Invoice" />
          </ChoiceGroup>
        </Cell>
      </Block>

      <Block title="Orientation horizontal">
        <Cell caption='data-orientation="horizontal" — fields flow and wrap'>
          <ChoiceGroup
            dataId="horizontal"
            legend="Flavor profile (choose any)"
            orientation="horizontal"
            className="w-full"
          >
            <ChoiceField type="checkbox" id="cg-hz-1" label="Floral" />
            <ChoiceField type="checkbox" id="cg-hz-2" label="Peachy" defaultChecked />
            <ChoiceField type="checkbox" id="cg-hz-3" label="Citrus" />
            <ChoiceField type="checkbox" id="cg-hz-4" label="Piney" />
          </ChoiceGroup>
        </Cell>
      </Block>

      <Block title="With hint">
        <Cell caption="hint is the group's accessible description">
          <ChoiceGroup
            dataId="hint"
            legend="Account type"
            hint="Choose the plan that fits your team. You can change this later."
            hintId="cg-hint-text"
            className="w-full"
          >
            <ChoiceField type="radio" id="cg-hint-1" name="cg-hint" label="Personal" defaultChecked />
            <ChoiceField type="radio" id="cg-hint-2" name="cg-hint" label="Team" />
            <ChoiceField type="radio" id="cg-hint-3" name="cg-hint" label="Enterprise" />
          </ChoiceGroup>
        </Cell>
      </Block>

      <Block title="Invalid (group error)">
        <Cell caption="error = a Notice inside a persistent live region">
          {/* Composition, not containment: the announcer and its payload are the
              Notice component's contract (ADR-0016), ChoiceGroup only owns the
              slot and the spacing (`.ChoiceGroup .notice-region` margin). */}
          <ChoiceGroup
            dataId="invalid"
            legend="Terms"
            invalid
            describedBy="cg-err-text"
            className="w-full"
            notice={
              <NoticeRegion politeness="assertive">
                <Notice variant="error">
                  <p id="cg-err-text">You must accept the terms to continue.</p>
                </Notice>
              </NoticeRegion>
            }
          >
            <ChoiceField
              type="checkbox"
              id="cg-err-1"
              label="I accept the terms"
              required
              invalid
            />
          </ChoiceGroup>
        </Cell>
      </Block>

      {/* Live demo — the instance the spec drives (#cg-live-1 / #cg-live-2). */}
      <Block title="Live demo">
        <Cell caption="single selection holds across the shared name">
          <ChoiceGroup
            dataId="live"
            legend="Contact preference"
            hint="How should we reach you?"
            hintId="cg-live-hint"
            className="w-full"
          >
            <ChoiceField type="radio" id="cg-live-1" name="cg-live" label="Email" defaultChecked />
            <ChoiceField type="radio" id="cg-live-2" name="cg-live" label="Phone" />
            <ChoiceField type="radio" id="cg-live-3" name="cg-live" label="Post" />
          </ChoiceGroup>
        </Cell>
      </Block>

      {/* Native reference — an unstyled fieldset/legend, for comparison.
          Deliberately NOT .ChoiceGroup, and its legend name is deliberately
          unlike any the suite queries. */}
      <Block title="Native reference">
        <Cell caption="bare fieldset + legend">
          <fieldset>
            <legend>Native grouping</legend>
            <span>
              <input type="radio" id="cg-native-1" name="cg-native" defaultChecked />{" "}
              <label htmlFor="cg-native-1">One</label>{" "}
              <input type="radio" id="cg-native-2" name="cg-native" />{" "}
              <label htmlFor="cg-native-2">Two</label>
            </span>
          </fieldset>
        </Cell>
      </Block>
    </Section>
  );
}

export default ChoiceGroupKitchensink;
