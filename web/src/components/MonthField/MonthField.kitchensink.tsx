/* MonthField kitchensink — every state the reference demo ships, plus the
 * locale probe the port's findings measure.
 *
 * Mirrors reference-components/src/partials/components/MonthField/MonthField.html
 * block for block: Interaction states → Disabled → Invalid → Variants → Live
 * demo → Localization → Native reference.
 *
 * `data-id` values are copied EXACTLY from the reference `states/*.hbs`. The one
 * that matters most is `meeting-month`: `e2e-helpers/target.js` hard-codes
 * `[data-component="MonthField"][data-id="meeting-month"]` as MonthField's
 * default target, so the live instance must carry it verbatim.
 *
 * `<Section>` supplies the `.kitchensink-section` class the suite's section-scoped
 * axe runs need (F-014). No `anchorId` is passed: MonthField.e2e.test.js scopes
 * BOTH of its axe runs to the component root (`checkA11y(page, MF)` and
 * `scopedCheckA11y(page, MF)`), never to `#MonthField`, so there is no
 * demo-section id to owe here (F-018).
 *
 * Every instance renders its own `<label id="{dataId}-label" for="{dataId}">`.
 * The reference's `_initInteractiveMode` finds `label[for=fieldId]` at runtime,
 * assigns it an id and points `.segments`' `aria-labelledby` at it. ADR-0009's
 * principle — the contract specifies the finished DOM, not where it is computed
 * — makes rendering that id the correct React answer.
 */

import type { ComponentProps, ReactNode } from "react";

import { Block, Cell, Section } from "@/components/kitchensink-ui";
import { MonthField } from "./MonthField";

function Field({
  dataId,
  label = "Month",
  ...rest
}: { dataId: string; label?: ReactNode } & Omit<
  ComponentProps<typeof MonthField>,
  "dataId" | "labelId"
>) {
  return (
    <>
      <label id={`${dataId}-label`} htmlFor={dataId}>
        {label}
      </label>
      <MonthField dataId={dataId} labelId={`${dataId}-label`} {...rest} />
    </>
  );
}

export function MonthFieldKitchensink() {
  return (
    <Section id="monthfield" title="MonthField">
      <Block title="Interaction states — empty">
        <Cell caption="default">
          <Field dataId="mf-empty-default" locale="en-GB" />
        </Cell>
        <Cell caption="hover">
          <Field dataId="mf-empty-hover" locale="en-GB" testState="hover" />
        </Cell>
        <Cell caption="focus">
          <Field dataId="mf-empty-focus" locale="en-GB" testState="focus" />
        </Cell>
        <Cell caption="active">
          <Field dataId="mf-empty-active" locale="en-GB" testState="active" />
        </Cell>
      </Block>

      <Block title="Interaction states — filled">
        <Cell caption="default">
          <Field dataId="mf-filled-default" locale="en-GB" value="2026-06" />
        </Cell>
        <Cell caption="hover">
          <Field dataId="mf-filled-hover" locale="en-GB" value="2026-06" testState="hover" />
        </Cell>
        <Cell caption="focus">
          <Field dataId="mf-filled-focus" locale="en-GB" value="2026-06" testState="focus" />
        </Cell>
        <Cell caption="active">
          <Field dataId="mf-filled-active" locale="en-GB" value="2026-06" testState="active" />
        </Cell>
      </Block>

      {/* Disabled is a FUNCTIONAL state: `pointer-events: none` makes hover
          impossible, so it never gets interaction columns. */}
      <Block title="Disabled">
        <Cell caption="empty">
          <Field dataId="mf-disabled-empty" locale="en-GB" disabled />
        </Cell>
        <Cell caption="filled">
          <Field dataId="mf-disabled-filled" locale="en-GB" value="2026-06" disabled />
        </Cell>
      </Block>

      <Block title="Invalid">
        <Cell caption="required + empty">
          <Field
            dataId="mf-invalid-empty"
            /* The reference authors the asterisk as `<span aria-hidden="true">*`
               inside the label, so the required marker is decorative and the
               requirement is carried by the native `required` attribute. */
            label={
              <>
                Month <span aria-hidden="true">*</span>
              </>
            }
            locale="en-GB"
            invalid
            required
            ariaInvalid
          />
        </Cell>
        <Cell caption="out of range">
          <Field
            dataId="mf-invalid-filled"
            locale="en-GB"
            value="2020-01"
            invalid
            ariaInvalid
          />
        </Cell>
      </Block>

      <Block title="Variants">
        <Cell caption="with min/max (2026-03 … 2026-09)">
          <Field
            dataId="mf-with-range"
            locale="en-GB"
            min="2026-03"
            max="2026-09"
            value="2026-06"
          />
        </Cell>
      </Block>

      {/* The e2e target. `data-id="meeting-month"` is hard-coded in
          e2e-helpers/target.js — do not rename it. */}
      <Block title="Live demo">
        <Cell caption="meeting-month (e2e target)">
          <Field dataId="meeting-month" label="Meeting month" locale="en-GB" />
        </Cell>
      </Block>

      {/* ADR-0011: demos default to English and localization is shown
          DELIBERATELY. For MonthField the axis that differs is the language of
          the month names. `de-DE` is our addition, not the reference's — it is
          the probe for findings/MonthField.md: the reference feeds Intl the
          COLLAPSED translation key, so a locale with no bundled strings renders
          English month names. Open the picker on each to see it. */}
      <Block title="Localization — month-name language">
        <Cell caption="en-GB → en">
          <Field dataId="mf-locale-en-gb" label="Month (en-GB)" locale="en-GB" value="2026-06" />
        </Cell>
        <Cell caption="sv-SE → sv">
          <Field dataId="mf-locale-sv-se" label="Month (sv-SE)" locale="sv-SE" value="2026-06" />
        </Cell>
        <Cell caption="de-DE → en (measured divergence)">
          <Field dataId="mf-locale-de-de" label="Month (de-DE)" locale="de-DE" value="2026-06" />
        </Cell>
      </Block>

      <Block title="Native reference">
        <Cell caption="default">
          <label htmlFor="mf-native-default">Month</label>
          <input type="month" id="mf-native-default" name="mf-native-default" />
        </Cell>
        <Cell caption="disabled">
          <label htmlFor="mf-native-disabled">Month</label>
          <input
            type="month"
            id="mf-native-disabled"
            name="mf-native-disabled"
            defaultValue="2026-06"
            disabled
          />
        </Cell>
      </Block>
    </Section>
  );
}

export default MonthFieldKitchensink;
