/* CtaLinkButton.tsx — port of `TagHelpers/CtaLinkButtonTagHelper.cs` (`app-cta-link-button`).
 *
 * A separate lexicon (`.CtaButton`), a separate stylesheet, and a separate
 * helper. It shares nothing with `.Button` except the shape of the TagHelper.
 *
 * The child order is fixed by `CtaButtonHelper.RenderInnerContent` and is
 * load-bearing, because `CtaButton.css` selects the effect and border spans as
 * direct children and stacks them with z-index:
 *
 *   1. `.CtaButton-<variant>`  the effect layer  (aria-hidden, empty)
 *   2. `.CtaButton-border`     the 1px inset ring (aria-hidden, empty)
 *   3. `.CtaButton-text`       the label
 *   4. `.CtaButton-icon`       optional, ALWAYS right — there is no
 *                              icon-position axis on this component
 *
 * Note the suppression rule differs from the other two: an icon alone is NOT
 * enough here (`if (!hasChildContent && !hasAriaLabel)`), because the icon on a
 * CTA is decorative garnish rather than the label.
 */

import type { ReactNode } from "react";
import "./CtaButton.css";
import {
  ctaButtonAttributes,
  ctaEffectClassName,
  type CtaVariant,
} from "./ctaButtonAttributes";
import { CtaButtonIcon } from "./ButtonIcon";
import {
  CTA_BORDER,
  CTA_GLOW,
  CTA_ICON,
  CTA_LAYOUT,
  CTA_ROOT,
  CTA_TEXT,
  CTA_VARIANT,
  cx,
} from "./buttonUtilities";
import { hasContent } from "./hasContent";
import { linkTargetAttributes } from "./buttonAttributes";

export type CtaLinkButtonProps = {
  /** Source default: `"glow"`. The only value the helper accepts. */
  variant?: CtaVariant;
  icon?: string;
  href?: string;
  target?: string;
  /** Source attribute `aria-label`. */
  ariaLabel?: string;
  /** `CtaButton.css`'s demo state hook. */
  testState?: "hover" | "active" | "focus" | "disabled";
  children?: ReactNode;
};

export function CtaLinkButton({
  variant = "glow",
  icon,
  href,
  target,
  ariaLabel,
  testState,
  children,
}: CtaLinkButtonProps) {
  const hasChildContent = hasContent(children);

  if (!hasChildContent && !ariaLabel) return null;

  return (
    <a
      /* The source assigns `class="CtaButton"` with SetAttribute, which
         overwrites rather than merges — unlike the other two helpers, an author
         `class` on `app-cta-link-button` is silently discarded. Reproduced: no
         `className` prop exists.
         STEP 3: the step-2 stylesheet chose the icon layout with
         `&:has(> .CtaButton-icon)`. `:has()` has no utility form, so the
         decision moves into the component — which is strictly less capable,
         because the CSS version worked for ANY consumer who put an icon in the
         slot, and this version only works for icons this component renders. */
      className={cx(
        "CtaButton",
        CTA_ROOT,
        CTA_VARIANT[variant],
        icon ? CTA_LAYOUT.textIcon : CTA_LAYOUT.text,
      )}
      href={href}
      {...linkTargetAttributes(target)}
      {...ctaButtonAttributes({ variant, ariaLabel })}
      data-test-state={testState}
    >
      <span className={cx(ctaEffectClassName(variant), CTA_GLOW)} aria-hidden="true" />
      <span className={cx("CtaButton-border", CTA_BORDER)} aria-hidden="true" />
      <span className={cx("CtaButton-text", CTA_TEXT)}>{children}</span>
      {icon && <CtaButtonIcon icon={icon} className={CTA_ICON} />}
    </a>
  );
}
