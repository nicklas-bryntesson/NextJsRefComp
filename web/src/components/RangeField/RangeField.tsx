/* RangeField — React port of reference-components/src/partials/components/RangeField.
 *
 * NO 'use client'. This is a Server Component with zero client JavaScript, and
 * that is not an optimisation — it is the contract. RangeField.md:
 *
 *   "No JavaScript — not 'none yet'. There is nothing for JavaScript to do. The
 *    browser positions the thumb from `value`; the track is one flat colour;
 *    every state is a CSS custom property."
 *
 * ADR-0023 states the rule that prevents the relapse: *a tier with no script
 * draws only what the browser maintains*. So there is no fill, no tick marks, no
 * value bubble and — critically for React — no mirrored value state. The input is
 * UNCONTROLLED (`defaultValue`), because `value` without `onChange` freezes a
 * native range and fails as an apparent native-semantics defect: the arrow keys
 * appear not to work, and `role="slider"` is still perfectly reported. The suite
 * would say "arrow keys change the value by exactly one step" failed and point at
 * nothing.
 *
 * Two suite assertions pin the statelessness down harder than the prose does:
 *
 *   expect(await input.getAttribute('style')).toBeNull()   // both before and
 *                                                         // after pressing End
 *
 * — so the root must emit *no* style attribute at all unless a variant authors
 * one. React omits `style` entirely for `undefined`, which is what the
 * `styleOverrides` prop below exploits.
 *
 * Class name `.RangeField` is structural, not decorative: the suite selects
 * `#RangeField .RangeField` for its target-size sweep and the verbatim stylesheet
 * hangs everything off it. Preserved exactly; see Findings.md F-008.
 */

import type { CSSProperties } from "react";
import type { ReactNode } from "react";

import "./RangeField.layered.css";

export type RangeFieldProps = {
  /** Input id. The `<label for>` is wired from it — the accessible name comes
   *  from the label, never `aria-label` (which would duplicate the value
   *  properties and read as a mouthful on every focus). */
  id: string;
  label: ReactNode;
  name?: string;

  min?: number;
  max?: number;
  step?: number;
  /** Uncontrolled on purpose. See the header note. */
  defaultValue?: number;

  required?: boolean;
  disabled?: boolean;

  /** Sets `data-invalid="true"` AND `aria-invalid="true"` — the contract pairs
   *  them, and the suite asserts both. */
  invalid?: boolean;

  /** The spoken value when the number is not the meaning (a unit, a currency, a
   *  word). Omit it when the number *is* the meaning. Authored, static: this tier
   *  has no script to update it, and RangeScale is the tier that mirrors a
   *  visible word into it. */
  valueText?: string;

  /** `<datalist>` id. Renders nothing here — `appearance: none` removes the
   *  browser's marks — but it is correct markup and the suite checks it survives. */
  list?: string;

  /** `aria-describedby` — a hint paragraph rendered by the caller. */
  describedBy?: string;

  orientation?: "horizontal" | "vertical";
  /** Vertical only: puts min at the top. Default is min at the bottom. */
  minPosition?: "top";

  /** Kitchensink only — a statically projected pseudo-class. */
  testState?: "hover" | "focus" | "active";

  /** `data-id` anchor. Contractual per variant. */
  dataId?: string;

  /** The documented CSS Variable API (`--_rf-thumb`, `--_rf-track`, …) plus
   *  `font-size` for the text-scaling variant. Absent → NO style attribute is
   *  emitted, which the statelessness test requires of the live instance. */
  styleOverrides?: CSSProperties;
};

export function RangeField({
  id,
  label,
  name = id,
  min = 0,
  max = 100,
  step = 1,
  defaultValue = 0,
  required,
  disabled,
  invalid,
  valueText,
  list,
  describedBy,
  orientation,
  minPosition,
  testState,
  dataId,
  styleOverrides,
}: RangeFieldProps) {
  return (
    <>
      <label htmlFor={id}>{label}</label>
      <input
        className="RangeField"
        type="range"
        id={id}
        name={name}
        data-component="RangeField"
        data-id={dataId}
        min={min}
        max={max}
        step={step}
        defaultValue={defaultValue}
        required={required}
        disabled={disabled}
        list={list}
        /* Never authored: aria-valuemin / aria-valuemax / aria-valuenow are
           derived by the UA from min / max / value, and the suite asserts their
           ABSENCE. `aria-valuetext` is the one ARIA this tier adds. */
        aria-valuetext={valueText}
        aria-invalid={invalid ? "true" : undefined}
        aria-describedby={describedBy}
        data-invalid={invalid ? "true" : undefined}
        data-orientation={orientation}
        data-min={minPosition}
        data-test-state={testState}
        style={styleOverrides}
      />
    </>
  );
}

export default RangeField;
