/* headingUtilities.ts — STEP 3. The design values from `Heading.css`, as Tailwind
 * utilities on the same DOM.
 *
 * WHAT SURVIVED, AND WHY THIS PORT READS DIFFERENTLY FROM THE BUTTON ONE.
 *
 * `buttonUtilities.ts` had to hardcode numbers, on the premise that Tailwind has
 * no utility for "a value from a custom property". It does — Tailwind v4's
 * `text-(length:--var)` / `leading-(--var)` / `tracking-(--var)` /
 * `font-(family-name:--var)` / `font-(--var)` forms take an arbitrary value
 * FROM a token. Verified on a throwaway route before any conversion:
 *
 *   text-(length:--fontSize-h1) leading-(--lineHeight-heading)
 *   tracking-(--text-display-lg--letter-spacing) font-(--fontWeight-heading)
 *     → 36px / 45px / -0.72px / 600   — identical to step 2
 *
 * So **the token seam survives the conversion for this component**, which
 * qualifies F-062: the blank-property GATE does not survive, but the TOKEN
 * indirection does — and it is the token indirection a design system actually
 * cares about. The component still reads `--fontSize-h1` and
 * `--lineHeight-heading` from `primitive-tokens.css`; only the gate that chose
 * between them moved from CSS into JS.
 *
 * WHAT DID NOT SURVIVE — the composite `text-*` utilities. `text-display-lg`
 * bundles four properties (size, line-height, letter-spacing, weight) because
 * `design-tokens.css` defines all four companions. That bundle is ROLE-shaped,
 * and the source's variant × size matrix CROSSES roles: `data-variant="heading"`
 * uses one line-height (`--lineHeight-heading`, 1.25) across all six sizes,
 * while the four roles those six sizes land on specify 1.2 / 1.25 / 1.3 / 1.4.
 * Measured: `text-display-lg` gives a 43.2px line-height where heading/1 needs
 * 45px. So the neat one-class form is unusable and every step is spelled out.
 * (For the record, `font-semibold` DOES beat the composite's bundled weight in
 * both class orders — measured — so the conflict was line-height, not weight.)
 *
 * THE BUTTON LESSON APPLIES UNCHANGED: a utility cannot override a utility, so
 * every axis that composed through specificity in step 2 is resolved here, in
 * JS, before rendering. Two places: variant × size (one enumerated row per
 * pair), and the variant's default colour vs an explicit `data-color`.
 *
 * And Tailwind's static extraction still forbids computed class names, so every
 * string below is a literal. Line breaks fall on space boundaries only; a break
 * inside a class name silently drops it and nothing errors.
 */

/** `Heading.css`'s reset. `break-words` is `overflow-wrap: break-word` — see the
 *  findings on why NOT `anywhere`. */
export const HEADING_ROOT = "my-0 break-words";

/** The text container. Everything it needs — font-size, line-height,
 *  letter-spacing, family, weight — is inherited from the root now that step 2
 *  moved the size there, so `block` is the whole conversion. Step 2 re-declared
 *  the size here idempotently; inheritance makes that redundant. */
export const HEADING_INNER = "block";

/** `& mark`. The component renders this element, so it can carry utilities —
 *  unlike the `:where(a, span, strong, em, b, i)` inherit rule, which styles
 *  arbitrary inline children the component never sees and therefore stays CSS. */
export const HEADING_MARK =
  "bg-[color-mix(in_oklab,var(--color-primary-brand)_22%,transparent)] " +
  "text-inherit rounded-xs px-[0.12em]";

/* ── Variant: voice ──────────────────────────────────────────────────────── */

export const VARIANT_VOICE = {
  heading:
    "font-(family-name:--fontFamily-heading) font-(--fontWeight-heading) " +
    "[font-feature-settings:var(--fontFeatureSettings-heading)]",
  display:
    "font-(family-name:--fontFamily-display) font-(--fontWeight-display) " +
    "[font-feature-settings:var(--fontFeatureSettings-display)]",
  body:
    "font-(family-name:--fontFamily-body) font-(--fontWeight-body) " +
    "[font-feature-settings:var(--fontFeatureSettings-body)]",
} as const;

/* ── Variant × size: the metric triple ───────────────────────────────────── */
/* Twelve enumerated rows. In step 2 this was three variant blocks containing
 * six / three / three one-line size gates — 12 short selectors that composed
 * with their variant block through specificity. Utilities cannot compose, so
 * each row carries its variant's line-height explicitly: declared 3 times in
 * CSS, repeated 12 times here. That is the entire cost of the conversion for
 * this component, and it is much smaller than Button's nine-row tone matrix. */

export const SIZE_METRICS = {
  heading: {
    "1": "text-(length:--fontSize-h1) leading-(--lineHeight-heading) tracking-(--text-display-lg--letter-spacing)",
    "2": "text-(length:--fontSize-h2) leading-(--lineHeight-heading) tracking-(--text-display-md--letter-spacing)",
    "3": "text-(length:--fontSize-h3) leading-(--lineHeight-heading) tracking-(--text-display-sm--letter-spacing)",
    "4": "text-(length:--fontSize-h4) leading-(--lineHeight-heading) tracking-normal",
    "5": "text-(length:--fontSize-h5) leading-(--lineHeight-heading) tracking-normal",
    /* h6 keeps `tracking-normal`, not the caption role's +0.08em. Taking a
       role's size is mapping; taking its treatment is inventing a step. */
    "6": "text-(length:--fontSize-h6) leading-(--lineHeight-heading) tracking-normal",
  },
  display: {
    "1": "text-(length:--fontSize-display-1) leading-(--text-display-mega--line-height) tracking-(--text-display-mega--letter-spacing)",
    "2": "text-(length:--fontSize-display-2) leading-(--text-display-lg--line-height) tracking-(--text-display-lg--letter-spacing)",
    "3": "text-(length:--fontSize-display-3) leading-(--text-display-md--line-height) tracking-(--text-display-md--letter-spacing)",
  },
  body: {
    sm: "text-(length:--fontSize-body-small) leading-(--lineHeight-body) tracking-normal",
    md: "text-(length:--fontSize-body) leading-(--lineHeight-body) tracking-normal",
    lg: "text-(length:--fontSize-body-large) leading-(--lineHeight-body) tracking-normal",
  },
} as const;

/* ── Colour ──────────────────────────────────────────────────────────────── */
/* Step 2 had two rules competing at EQUAL specificity, resolved by source order:
 * a variant default (`&[data-variant="heading"] { color: ink }`) and the optional
 * `&[data-color]` gate written after it. Two `color` utilities on one element is
 * exactly the Button trap — Tailwind's stylesheet order would decide, not the
 * component — so the choice is made here and only one is ever emitted. */

export const VARIANT_COLOR = {
  heading: "text-ink",
  display: "text-ink",
  body: "text-body",
} as const;

export const DATA_COLOR = {
  primary: "text-primary",
  dark: "text-ink",
  /* The source's `--text-inverse` role. A light-dark pair rather than a literal
     white, so it follows the appearance flip instead of vanishing in dark. */
  light: "text-on-primary",
  inherit: "text-inherit",
} as const;

/* ── Alignment and wrap ──────────────────────────────────────────────────── */

export const ALIGN = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
} as const;

export const WRAP = {
  balance: "text-balance",
  pretty: "text-pretty",
  /* No first-class utility for `text-wrap: stable`; the arbitrary property is
     the whole conversion. */
  stable: "[text-wrap:stable]",
  /* Added in step 2 — the helper validated `nowrap` and the source stylesheet
     had no rule. A WCAG 1.4.10 hazard by construction. */
  nowrap: "text-nowrap",
} as const;

/** Join, dropping empties. Same shape as `buttonUtilities.cx`. */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
