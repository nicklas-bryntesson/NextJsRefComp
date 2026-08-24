/* ChoiceField — React port of reference-components/src/partials/components/ChoiceField.
 *
 * NO 'use client'. Per ADR-0013/0015 and ChoiceField.md there is *no JavaScript*
 * at all: "the native input is the single source of truth". Every behaviour the
 * suite asserts — Space to toggle, arrow-key roving, single selection via a
 * shared `name`, label-click, disabled-can't-toggle, form participation — is
 * native. So the port is a Server Component that renders formed markup and ships
 * zero client JS, which is not a shortcut but the contract's stated ideal.
 *
 * The one React-specific hazard is the controlled/uncontrolled input problem:
 * `<input type="checkbox" checked>` in HTML means "initial state", but in React
 * `checked={true}` means "controlled — I own this value forever", which freezes
 * the input and logs a warning. The faithful translation of the HTML `checked`
 * attribute is `defaultChecked`. See findings/ChoiceField.md.
 *
 * Class names are structural: `.ChoiceField` is selected by the conformance
 * suite (`page.locator('.ChoiceField')`) and by the verbatim stylesheet, whose
 * part rules are `.ChoiceField input` / `.ChoiceField label` — i.e. element
 * selectors, so the input and label carry no class of their own and must remain
 * direct children in that order (`input:disabled ~ label` is a sibling rule).
 */

import type { CSSProperties, ReactNode } from "react";

import "./ChoiceField.layered.css";

export type ChoiceFieldProps = {
  /** `for`/`id` integrity is a contract rule: the label's `for` equals this. */
  id: string;
  /** A real `<label>` is required — the box alone misses WCAG 2.5.8 target size. */
  label: ReactNode;
  /** The discriminator (ADR-0015). Drives behaviour *and* skin, via the one
   *  attribute native already owns — there is deliberately no `data-variant`. */
  type: "checkbox" | "radio";
  /** Radio: every option in one single-selection group shares exactly one
   *  `name`. Checkbox: independent. Defaults to `id` so a lone checkbox is
   *  never accidentally grouped with anything. */
  name?: string;
  /** HTML `checked` is an *initial* state, so it maps to `defaultChecked`.
   *  Naming it `checked` here would invite React's controlled-input trap. */
  defaultChecked?: boolean;
  required?: boolean;
  disabled?: boolean;
  /** Sets `data-invalid="true"` on the root and `aria-invalid="true"` on the
   *  input — the .md pairs them explicitly. */
  invalid?: boolean;
  /** Kitchensink only: renders a pseudo-class statically. */
  testState?: "hover" | "focus" | "active";
  /** `data-id` anchor for the conformance suite. */
  dataId?: string;
  /** Host accent: the CSS Variable API is overridden *on the root element*
   *  (an ancestor override is shadowed by the component's own defaults). */
  style?: CSSProperties;
};

export function ChoiceField({
  id,
  label,
  type,
  name = id,
  defaultChecked,
  required,
  disabled,
  invalid,
  testState,
  dataId,
  style,
}: ChoiceFieldProps) {
  return (
    <span
      className="ChoiceField"
      data-component="ChoiceField"
      data-id={dataId}
      /* Booleans are `"true"` or absent — `undefined` is the library's "absent". */
      data-invalid={invalid ? "true" : undefined}
      data-test-state={testState}
      style={style}
    >
      <input
        type={type}
        id={id}
        name={name}
        defaultChecked={defaultChecked}
        required={required}
        disabled={disabled}
        aria-invalid={invalid ? "true" : undefined}
      />
      <label htmlFor={id}>{label}</label>
    </span>
  );
}

export default ChoiceField;
