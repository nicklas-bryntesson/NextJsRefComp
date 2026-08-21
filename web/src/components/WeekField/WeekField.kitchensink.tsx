/* WeekField kitchensink — every state from the reference's own demo page.
 *
 * The `data-id` values are TEST CONTRACT, not naming preference. `meeting-week`
 * is hard-coded in `e2e-helpers/target.js` and named in PORTING.md, so the live
 * instance must carry exactly that. The rest mirror the reference's
 * `states/*.hbs` partials one-for-one so a reviewer can diff the two pages.
 *
 * `anchorId` is NOT passed: the WeekField spec runs `checkA11y(page, WF)` and
 * `scopedCheckA11y(page, WF)` where `WF = targetId('WeekField')` — both scoped to
 * the component root. Nothing in this spec scopes to `#WeekField`, so adding the
 * id would be inventing a hook (contrast ChoiceField / Notice / Picklist, which
 * do — Findings F-018). `.kitchensink-section` still comes from <Section> because
 * the sitewide text-spacing suite asserts every component sits inside one.
 *
 * The reference demo authors `data-locale="en-GB"` on every instance except the
 * sv-SE one. That is load-bearing for one assertion: the popup's `aria-label`
 * must be exactly "Choose week", i.e. the English strings, and `resolveLocale`
 * degrades `en-GB` → `en`. Do not "simplify" it away.
 */

import { WeekField } from "./WeekField";
import { Section, Block, Cell } from "../kitchensink-ui";

export function WeekFieldKitchensink() {
  return (
    <Section id="weekfield" title="WeekField">
      <Block title="Interaction states — empty">
        <Cell caption="default">
          <WeekField id="wf-empty-default" label="Week" locale="en-GB" />
        </Cell>
        <Cell caption="hover">
          <WeekField id="wf-empty-hover" label="Week" locale="en-GB" testState="hover" />
        </Cell>
        <Cell caption="focus">
          <WeekField id="wf-empty-focus" label="Week" locale="en-GB" testState="focus" />
        </Cell>
        <Cell caption="active">
          <WeekField id="wf-empty-active" label="Week" locale="en-GB" testState="active" />
        </Cell>
      </Block>

      <Block title="Interaction states — filled">
        <Cell caption="default">
          <WeekField
            id="wf-filled-default"
            label="Week"
            locale="en-GB"
            defaultValue="2026-W27"
          />
        </Cell>
        <Cell caption="hover">
          <WeekField
            id="wf-filled-hover"
            label="Week"
            locale="en-GB"
            defaultValue="2026-W27"
            testState="hover"
          />
        </Cell>
        <Cell caption="focus">
          <WeekField
            id="wf-filled-focus"
            label="Week"
            locale="en-GB"
            defaultValue="2026-W27"
            testState="focus"
          />
        </Cell>
        <Cell caption="active">
          <WeekField
            id="wf-filled-active"
            label="Week"
            locale="en-GB"
            defaultValue="2026-W27"
            testState="active"
          />
        </Cell>
      </Block>

      {/* Disabled is a FUNCTIONAL state: `pointer-events: none` makes hover
          impossible, so it never gets interaction columns. */}
      <Block title="Disabled">
        <Cell caption="empty">
          <WeekField id="wf-disabled-empty" label="Week" locale="en-GB" disabled />
        </Cell>
        <Cell caption="filled">
          <WeekField
            id="wf-disabled-filled"
            label="Week"
            locale="en-GB"
            defaultValue="2026-W27"
            disabled
          />
        </Cell>
      </Block>

      <Block title="Invalid">
        <Cell caption="required + empty">
          {/* `data-invalid` is a styling hook only — the author must ALSO set
              `aria-invalid` on the native input, exactly as the reference state
              partial does. */}
          <WeekField
            id="wf-invalid-empty"
            label={
              <>
                Week <span aria-hidden="true">*</span>
              </>
            }
            locale="en-GB"
            invalid
            invalidInput
            required
          />
        </Cell>
        <Cell caption="out of range">
          <WeekField
            id="wf-invalid-filled"
            label="Week"
            locale="en-GB"
            defaultValue="2020-W01"
            invalid
            invalidInput
          />
        </Cell>
      </Block>

      <Block title="Variants">
        <Cell caption="with min/max">
          <WeekField
            id="wf-with-range"
            label="Week"
            locale="en-GB"
            min="2026-W10"
            max="2026-W40"
            defaultValue="2026-W27"
          />
        </Cell>
      </Block>

      {/* The e2e target. `data-id="meeting-week"` is resolved by
          e2e-helpers/target.js — nothing else in this file may claim it. */}
      <Block title="Live demo">
        <Cell caption="meeting-week">
          <WeekField id="meeting-week" label="Meeting week" locale="en-GB" />
        </Cell>
      </Block>

      <Block title="Localization">
        <Cell caption="en-GB">
          <WeekField
            id="wf-locale-en-gb"
            label="Week (en-GB)"
            locale="en-GB"
            defaultValue="2026-W27"
          />
        </Cell>
        <Cell caption="sv-SE">
          <WeekField
            id="wf-locale-sv-se"
            label="Week (sv-SE)"
            locale="sv-SE"
            defaultValue="2026-W27"
          />
        </Cell>
      </Block>

      {/* The browser's built-in control, for comparison. Firefox and desktop
          Safari render these as plain text fields — which is exactly why
          ADR-0006 keeps `data-input-mode="custom"` even on touch there. */}
      <Block title="Native reference">
        <Cell caption="default">
          <label htmlFor="wf-native-default">Week</label>
          <input type="week" id="wf-native-default" name="wf-native-default" />
        </Cell>
        <Cell caption="disabled">
          <label htmlFor="wf-native-disabled">Week</label>
          <input
            type="week"
            id="wf-native-disabled"
            name="wf-native-disabled"
            defaultValue="2026-W27"
            disabled
          />
        </Cell>
      </Block>
    </Section>
  );
}
