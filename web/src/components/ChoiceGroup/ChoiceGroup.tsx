/* ChoiceGroup — React port of reference-components/src/partials/components/ChoiceGroup.
 *
 * NO 'use client'. ChoiceGroup.md: "No JavaScript: native <fieldset> gives the
 * disabled cascade and form grouping; native <legend> gives the intrinsic group
 * name; native radios/checkboxes give selection and keyboard behaviour.
 * ChoiceGroup is markup + CSS." There is no ChoiceGroup.ts in the reference at
 * all, so this is a Server Component shipping zero client bytes — the third in a
 * row (see F-015 / findings/ChoiceField.md).
 *
 * WRAPPER pattern (ADR-0013): this component owns the group label, the layout
 * and the hint/error slot, and knows nothing about how a field is drawn.
 * It deliberately does NOT import or wrap ChoiceField, and it does not import
 * Notice: the fields arrive as `children`, and the error arrives as a `notice`
 * node the host composes. ADR-0004's clarity-over-DRY stance and the .md's
 * "the host owns when to set them and what to swap into the live region" both
 * point the same way — they meet only in the DOM.
 *
 * Contract rules encoded structurally rather than left to the caller:
 *   - <legend> is the FIRST child of <fieldset> (spec requirement).
 *   - .content wraps hint + options + error and is the flow-root that clears the
 *     floated legend.
 *   - .options holds the fields; its layout follows data-orientation.
 * Those three class names are contract, not styling: the verbatim stylesheet
 * selects `.ChoiceGroup .content` / `.hint` / `.options` / `.notice-region`, and
 * the e2e suite selects `.ChoiceGroup[data-id="…"] .notice-region .Notice`.
 * F-008: keep them verbatim and layer utilities alongside, never instead.
 *
 * Cardinality is IMPLICIT in the children's `type` (ADR-0015): there is no
 * `single`/`multiple` prop, because radios sharing one `name` already are the
 * single-selection group. Children must use `defaultChecked`, never `checked`
 * without `onChange` — a controlled radio group cannot move its selection and
 * fails as an apparent native-semantics defect (findings/ChoiceField.md).
 */

import type { CSSProperties, ReactNode } from "react";

import "./ChoiceGroup.css";

export type ChoiceGroupProps = {
  /** The group's accessible name. Rendered as the intrinsic `<legend>` — no id
   *  plumbing, no heading dependency (ADR-0013). Required, and required to be
   *  non-empty by the contract, even when visually hidden. */
  legend: ReactNode;
  /** `.options` stacks (column) or flows and wraps (row). */
  orientation?: "vertical" | "horizontal";
  /** `data-legend` — an ENUM of three placement recipes, not three booleans.
   *  `hidden` clips the legend to 1px; it remains the accessible name. */
  legendPlacement?: "above" | "beside" | "hidden";
  /** Group-level invalid. Presentational only: pair it with `notice` and point
   *  `describedBy` at the error text id. */
  invalid?: boolean;
  /** Optional `.hint`. Needs `hintId` to become the accessible description. */
  hint?: ReactNode;
  /** The hint's id. Auto-prepended to `aria-describedby` when both are given —
   *  "every aria-describedby target must exist" is a contract rule, so the ids
   *  are derived from the rendered nodes rather than hand-listed twice. */
  hintId?: string;
  /** The error slot, rendered last inside `.content`. Expect a
   *  `<NoticeRegion role="alert">` containing a `<Notice variant="error">`; the
   *  region must be mounted from the start for the swap to be announced. */
  notice?: ReactNode;
  /** Extra `aria-describedby` ids (e.g. the error text id), in reading order. */
  describedBy?: string | string[];
  /** The fields — `<ChoiceField>` items. */
  children: ReactNode;
  /** `data-id` anchor for the conformance suite. */
  dataId?: string;
  /** Layered ALONGSIDE `.ChoiceGroup`, never replacing it. */
  className?: string;
  /** Host overrides of the CSS Variable API (`--_cg-*`). Like ChoiceField, the
   *  component's own defaults sit on the root, so an override must land here. */
  style?: CSSProperties;
};

export function ChoiceGroup({
  legend,
  orientation = "vertical",
  legendPlacement = "above",
  invalid,
  hint,
  hintId,
  notice,
  describedBy,
  children,
  dataId,
  className,
  style,
}: ChoiceGroupProps) {
  const extra =
    describedBy == null ? [] : Array.isArray(describedBy) ? describedBy : [describedBy];
  /* Only ids that correspond to something actually rendered here get listed. */
  const ids = [hint != null && hintId ? hintId : null, ...extra].filter(Boolean);

  return (
    <fieldset
      className={className ? `ChoiceGroup ${className}` : "ChoiceGroup"}
      data-component="ChoiceGroup"
      data-id={dataId}
      data-orientation={orientation}
      data-legend={legendPlacement}
      /* Booleans are `="true"` or ABSENT — `undefined` is the library's absent. */
      data-invalid={invalid ? "true" : undefined}
      aria-describedby={ids.length ? ids.join(" ") : undefined}
      style={style}
    >
      {/* First child. Not optional, not reorderable. */}
      <legend>{legend}</legend>
      <div className="content">
        {hint != null && (
          <p className="hint" id={hintId}>
            {hint}
          </p>
        )}
        <div className="options">{children}</div>
        {notice}
      </div>
    </fieldset>
  );
}

export default ChoiceGroup;
