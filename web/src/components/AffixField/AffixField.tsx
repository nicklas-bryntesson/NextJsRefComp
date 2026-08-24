/* AffixField — React port of reference-components/src/partials/components/AffixField.
 *
 * NO 'use client'. This is a Server Component with zero client JavaScript, and
 * that is the contract being honoured rather than a shortcut: AffixField.md's
 * "end-state contract" section says the component has no interactivity at all —
 * everything its reference JS does is *compute attributes* (ids, ARIA wiring,
 * presence attributes, character counts), and "a server-rendered implementation
 * with zero client JS passes the same Playwright suite".
 *
 * So the reference `attach()` steps map onto render-time computation one for one:
 *
 *   1. data-has-prefix / data-has-suffix   ← affix presence
 *   2. --_af-prefix-chars / -suffix-chars  ← affix string length
 *   3. --_af-input-chars                   ← the inputCharacters prop
 *   4. affix ids + aria-describedby        ← derived from the input id
 *   5. data-initialized="true"             ← rendered, not set
 *
 * Step 5 deserves a note: PORTING.md tells you to drop the init-gated CSS (it
 * clips the popup in a framework that renders formed markup) but the attribute
 * itself is a *test target* — e2e-helpers/target.js resolves FileUpload as
 * `[data-initialized]`, and the AffixField suite waits on
 * `[data-initialized="true"]` before every test. The rules go; the attribute
 * stays. See Findings.md F-010.
 *
 * Class names are structural, not decorative: `.AffixField`, `.prefix`,
 * `.suffix`, `.input` are all selected by the conformance suite and by the
 * verbatim stylesheet. They are preserved exactly; design utilities layer
 * alongside them in Phase B, never instead of them. See Findings.md F-008.
 */

import type { CSSProperties, ReactNode } from "react";

/* The component owns its stylesheet. Importing it here rather than from a shared
   registry keeps the component deletable in one move (philosophy.md), and lets
   parallel ports land without contending for a single import list. */
import "./AffixField.layered.css";

/** The documented allowlist from AffixField.md. `password` and the date/time
 *  family are non-goals, so the type system refuses them rather than relying on
 *  the author having read the table. */
export type AffixFieldType = "text" | "number" | "tel" | "url" | "email" | "search";

export type AffixFieldProps = {
  /** Input id. Affix ids derive from it (`<id>-prefix` / `<id>-suffix`). */
  id: string;
  /** A real `<label>` is required by the contract — a placeholder is not a name. */
  label: ReactNode;
  name?: string;
  type?: AffixFieldType;
  inputMode?: "text" | "decimal" | "numeric" | "tel" | "url" | "email" | "search";
  defaultValue?: string;
  required?: boolean;
  disabled?: boolean;
  /** Sets `data-invalid` on the root and `aria-invalid` on the input. */
  invalid?: boolean;

  prefix?: string;
  suffix?: string;
  /** Author `aria-hidden` on an affix when the unit is already in the visible
   *  label. The affix is then skipped entirely: no id, no describedby entry. */
  prefixHidden?: boolean;
  suffixHidden?: boolean;

  /** Fractional tuning ventil for atypical strings ("WWW" runs wide). Overrides
   *  the computed string length, mirroring the reference's "authored wins". */
  prefixChars?: number;
  suffixChars?: number;

  /** Renders a hint paragraph after the field. Its id is prepended to
   *  aria-describedby, so affix ids append AFTER it and the hint keeps order. */
  hint?: ReactNode;
  /** Width of the value area in character units. Absent → no width imposed. */
  inputCharacters?: number;
  /** End-alignment for amounts. There is no `center`. */
  align?: "end";

  /** `data-id` anchor. The conformance suite hard-codes these per variant. */
  dataId?: string;
  /** Renders an interaction state statically for the kitchensink. */
  testState?: "hover" | "focus" | "active";
};

export function AffixField({
  id,
  label,
  name = id,
  type = "text",
  inputMode,
  defaultValue,
  required,
  disabled,
  invalid,
  prefix,
  suffix,
  prefixHidden,
  suffixHidden,
  prefixChars,
  suffixChars,
  hint,
  inputCharacters,
  align,
  dataId,
  testState,
}: AffixFieldProps) {
  const hasPrefix = prefix !== undefined;
  const hasSuffix = suffix !== undefined;

  /* An aria-hidden affix is skipped entirely — no id, no describedby entry.
     Everything else gets `<input-id>-prefix` / `-suffix`. */
  const prefixId = hasPrefix && !prefixHidden ? `${id}-prefix` : undefined;
  const suffixId = hasSuffix && !suffixHidden ? `${id}-suffix` : undefined;
  const hintId = hint !== undefined ? `${id}-hint` : undefined;

  /* Order is contractual: authored hint ids first, affixes appended after, so a
     screen reader reads the hint before the unit. */
  const describedBy =
    [hintId, prefixId, suffixId].filter(Boolean).join(" ") || undefined;

  /* Counts are content facts — `textContent.trim().length` in the reference,
     `prefix.length` here. The same computation at a different time, which is
     what makes the end-state symmetric. */
  const style: CSSProperties = {};
  if (hasPrefix) {
    (style as Record<string, string | number>)["--_af-prefix-chars"] =
      prefixChars ?? prefix.trim().length;
  }
  if (hasSuffix) {
    (style as Record<string, string | number>)["--_af-suffix-chars"] =
      suffixChars ?? suffix.trim().length;
  }
  if (inputCharacters !== undefined) {
    (style as Record<string, string | number>)["--_af-input-chars"] = inputCharacters;
  }

  return (
    <>
      <label htmlFor={id}>{label}</label>
      <div
        className="AffixField"
        data-component="AffixField"
        data-id={dataId}
        data-initialized="true"
        data-has-prefix={hasPrefix ? "true" : undefined}
        data-has-suffix={hasSuffix ? "true" : undefined}
        data-input-characters={inputCharacters}
        data-align={align}
        data-disabled={disabled ? "true" : undefined}
        data-invalid={invalid ? "true" : undefined}
        data-test-state={testState}
        style={style}
      >
        {hasPrefix && (
          <span
            className="prefix"
            id={prefixId}
            aria-hidden={prefixHidden ? "true" : undefined}
          >
            {prefix}
          </span>
        )}
        <input
          className="input"
          id={id}
          name={name}
          type={type}
          inputMode={inputMode}
          defaultValue={defaultValue}
          required={required}
          disabled={disabled}
          aria-invalid={invalid ? "true" : undefined}
          aria-describedby={describedBy}
        />
        {hasSuffix && (
          <span
            className="suffix"
            id={suffixId}
            aria-hidden={suffixHidden ? "true" : undefined}
          >
            {suffix}
          </span>
        )}
      </div>
      {hint !== undefined && <p id={hintId}>{hint}</p>}
    </>
  );
}

export default AffixField;
