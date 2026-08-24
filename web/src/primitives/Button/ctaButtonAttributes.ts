/* ctaButtonAttributes.ts — the React counterpart of `TagHelpers/CtaButtonHelper.cs`.
 *
 * It IS a second variant helper, and a much thinner one: a single valid variant
 * (`glow`), one attribute (`data-variant`), plus `aria-label`. Its interesting
 * half is `RenderInnerContent`, which composes FOUR children in a fixed order —
 * an effect span NAMED AFTER THE VARIANT (`.CtaButton-glow`), a border span, the
 * text span, and an optional icon that is always on the right. That naming is a
 * string-built class (`$"CtaButton-{variant.ToLowerInvariant()}"`), so adding a
 * variant to the C# HashSet silently requires a matching `.CtaButton-<name>`
 * rule in the stylesheet or the effect span renders as an unstyled empty div.
 * The port keeps the mechanism (see CtaLinkButton.tsx) and records the hazard.
 */

export type CtaVariant = "glow";

const VALID_VARIANTS: readonly string[] = ["glow"];

export function ctaButtonAttributes({
  variant,
  ariaLabel,
}: {
  variant: string;
  ariaLabel?: string | null;
}): Record<string, string> {
  const attrs: Record<string, string> = {};
  if (VALID_VARIANTS.includes(variant.toLowerCase())) {
    attrs["data-variant"] = variant.toLowerCase();
  }
  if (ariaLabel) attrs["aria-label"] = ariaLabel;
  return attrs;
}

/** The effect span's class name, built from the variant exactly as the source
 *  does. Exported so the hazard above is greppable. */
export function ctaEffectClassName(variant: string): string {
  return `CtaButton-${variant.toLowerCase()}`;
}
