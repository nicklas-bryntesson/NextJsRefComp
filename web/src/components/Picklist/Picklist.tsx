/* Picklist — React port of reference-components/src/partials/components/Picklist.
 *
 * NO 'use client'. Picklist.md: "No JavaScript. Picklist is markup + CSS." There
 * is no reference `Picklist.ts` — the directory holds only .css, .html, .md and
 * tests. Native `<fieldset>` gives the disabled cascade and form grouping,
 * `<legend>` the intrinsic group name, native radios/checkboxes selection,
 * arrow-roving, Space and label association. So this is a pure Server Component
 * and ships zero client bytes (CLAUDE.md: "zero client JS where the contract
 * allows it").
 *
 * THE CHIP MECHANISM (reused as a recipe by ThemeSwitch): the input is
 * sr-clipped to 1px but STILL FOCUSABLE, and the label that IMMEDIATELY follows
 * it is the visible chip surface. Every state is then a plain adjacent-sibling
 * selector — `input:checked + label`, `input:focus-visible + label` — with no
 * `:has()` anywhere, because a focus ring is load-bearing. Consequences the port
 * must not break:
 *   - `input + label` adjacency. Anything between them (a wrapper, a stray
 *     `{' '}`, a comment node is fine but an element is not) silently kills the
 *     selected and focus styling.
 *   - The ring is drawn on the LABEL, inset (`outline-offset: -3px`), because a
 *     selected chip is `color: Canvas` on `background: CanvasText` and an
 *     outward `currentColor` ring would be white on a near-white page.
 *
 * Structural class names are contractual (Findings.md F-008). This spec has 24
 * class selectors: `.Picklist`, `.option`, `.options`, `.content`, `.hint`,
 * `.deselect`, `.notice-region`, `.Notice`. All preserved verbatim.
 *
 * SELECTION IS UNCONTROLLED ON PURPOSE. `defaultChecked`, never `checked`
 * without `onChange`: a controlled radio group cannot move its selection, and
 * that fails the arrow-roving test as an apparent NATIVE-semantics defect, which
 * is the most misleading failure available to a component whose whole thesis is
 * "native carries the behaviour". Picklist.md's API table says `checked` —
 * correct HTML, dangerous porting instruction.
 */

import type { CSSProperties, ReactNode } from "react";

import { Notice, NoticeRegion } from "../Notice/Notice";

/* The component owns its stylesheet — deletable in one move. Copied byte-for-byte
   from the submodule; Picklist.css has no init-gate rules to drop (its two
   `overflow: hidden` declarations are the sr-clip recipe for the input and the
   hidden legend, not a runtime gate), so it is 100% verbatim. */
import "./Picklist.css";

export type PicklistOption = {
  /** `id`, and therefore the label's `for`. Must be unique in the document. */
  id: string;
  /** The chip text. It IS the accessible name, so keep it plain. */
  label: string;
  /** Per-item `name`. Multi-select checkboxes each own theirs; radios inherit
   *  the group `name` and must not set this. */
  name?: string;
  defaultChecked?: boolean;
  disabled?: boolean;
  required?: boolean;
  /** `aria-invalid="true"` on the input, for the group-error recipe. */
  ariaInvalid?: boolean;
  /** Renders the decorative `×`. Checkbox core only — a native radio cannot be
   *  unchecked by the user, so an `×` there would promise what it cannot do. */
  removable?: boolean;
};

export type PicklistProps = {
  /** The group's accessible name. Always rendered as the first child of the
   *  `<fieldset>` — a spec requirement and the only *intrinsic* group label. */
  legend: string;
  /** Cardinality is implicit in the children's `type` (ADR-0015), never an
   *  attribute on the group: radios sharing a `name` are single-select,
   *  checkboxes are multi-select. */
  type: "radio" | "checkbox";
  /** The one shared `name` for a radio group. Ignored for checkboxes, which take
   *  independent names per option. */
  name?: string;
  options: PicklistOption[];
  /** `data-legend` — the placement recipe. `hidden` still names the group. */
  legendPlacement?: "above" | "beside" | "hidden";
  orientation?: "horizontal" | "vertical";
  /** `data-segmented="true"` — one control with N positions. Gaps collapse,
   *  borders join, the radius moves to the two ends, and the row stops wrapping.
   *  Independent of `orientation`; all four combinations are supported. */
  segmented?: boolean;
  /** `data-invalid="true"` — group level. Tints unselected chip borders. */
  invalid?: boolean;
  /** Kitchensink only: simulated pseudo-class, projected down to the chips. */
  testState?: "hover" | "focus" | "active";
  /** `<fieldset disabled>` — the native cascade to every chip. */
  disabled?: boolean;
  hint?: ReactNode;
  /** id of the `.hint`, so it can join `aria-describedby`. */
  hintId?: string;
  /** Group error text, rendered as a Notice inside a persistent live region. */
  error?: ReactNode;
  /** id of the error text element — the second `aria-describedby` target. */
  errorId?: string;
  /** Extra `aria-describedby` ids, appended after hint and error. */
  describedBy?: string;
  /** Conformance / demo anchor. `data-id` is the suite's addressing convention. */
  dataId?: string;
  /** Token overrides. Picklist.md: they must land on the `.Picklist` element —
   *  an ancestor or `:root` override is shadowed by the component's own defaults
   *  on the root. */
  style?: CSSProperties;
  /** Extra classes, layered ALONGSIDE `.Picklist`, never replacing it. */
  className?: string;
};

/** The decorative `×`. `aria-hidden` + `focusable="false"`, and it lives INSIDE
 *  the chip's single `<label>`, so activating it activates the label, which
 *  toggles the input — deselection with no JS, no second label and no extra
 *  keyboard model. It is NOT a button (see Picklist.md non-goals). */
function Deselect() {
  return (
    <svg
      width="12"
      height="12"
      className="deselect"
      viewBox="0 0 12 12"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M2 2 L10 10 M10 2 L2 10"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
      />
    </svg>
  );
}

export function Picklist({
  legend,
  type,
  name,
  options,
  legendPlacement = "above",
  orientation,
  segmented = false,
  invalid = false,
  testState,
  disabled = false,
  hint,
  hintId,
  error,
  errorId,
  describedBy,
  dataId,
  style,
  className,
}: PicklistProps) {
  /* The library's boolean convention is `="true"` or ABSENT — never `="false"`,
     never bare. `undefined` is exactly React's "absent", so the two conventions
     line up (F-015). `data-orientation` defaults to `horizontal` in CSS via
     `:not([data-orientation="vertical"])`, so we only author the non-default. */
  const described =
    [hintId, errorId, describedBy].filter(Boolean).join(" ") || undefined;

  return (
    <fieldset
      className={className ? `Picklist ${className}` : "Picklist"}
      data-id={dataId}
      data-legend={legendPlacement}
      data-orientation={orientation === "vertical" ? "vertical" : undefined}
      data-segmented={segmented ? "true" : undefined}
      data-invalid={invalid ? "true" : undefined}
      data-test-state={testState}
      disabled={disabled || undefined}
      aria-describedby={described}
      style={style}
    >
      {/* First child of the fieldset. Non-negotiable — a spec requirement. */}
      <legend>{legend}</legend>
      {/* `.content` is the body's own formatting context (flow-root): it holds
          hint + options + error and clears the full-width `above` legend float. */}
      <div className="content">
        {hint != null && (
          <p className="hint" id={hintId}>
            {hint}
          </p>
        )}
        <div className="options">
          {options.map((o) => (
            <span className="option" key={o.id}>
              {/* sr-clipped to 1px by the stylesheet, but focusable: never
                  display:none / visibility:hidden, or the chip loses its
                  keyboard and its semantics. */}
              <input
                type={type}
                id={o.id}
                name={type === "radio" ? name : (o.name ?? o.id)}
                defaultChecked={o.defaultChecked}
                disabled={o.disabled}
                required={o.required}
                aria-invalid={o.ariaInvalid ? "true" : undefined}
              />
              {/* Adjacent to the input, with NOTHING between them, and no
                  whitespace text node before the glyph — `"Thai "` would leave a
                  trailing space in the accessible name. JSX emits the string and
                  the <svg> as adjacent children with no separator. */}
              <label htmlFor={o.id}>
                {o.label}
                {o.removable && type === "checkbox" ? <Deselect /> : null}
              </label>
            </span>
          ))}
        </div>
        {/* The error is a Notice inside a PERSISTENT live region (ADR-0016):
            Picklist owns only the spacing. `role="alert"` announces on appear;
            `aria-describedby` → the Notice's text id describes on focus. */}
        {error != null && (
          <NoticeRegion politeness="assertive">
            <Notice variant="error">
              <p id={errorId}>{error}</p>
            </Notice>
          </NoticeRegion>
        )}
      </div>
    </fieldset>
  );
}

export default Picklist;
