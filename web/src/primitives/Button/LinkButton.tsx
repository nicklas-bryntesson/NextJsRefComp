/* LinkButton.tsx — port of `TagHelpers/LinkButtonTagHelper.cs` (`app-link-button`).
 *
 * Renders an <a> carrying the `.Button` lexicon. No client JS: every attribute
 * is computed from props, which is exactly the case CLAUDE.md wants left as a
 * Server Component ("any component whose JS only *computes attributes*").
 *
 * Two behaviours are easy to lose in translation and are kept deliberately:
 *
 *  1. THE SUPPRESSION RULE. `output.SuppressOutput()` when there is no child
 *     content, no icon AND no aria-label — an empty button is unlabelled, so the
 *     source refuses to render it rather than shipping a WCAG 4.1.2 failure.
 *     React's equivalent is `return null`.
 *  2. `output.TagName = "a"` runs unconditionally, so an `app-link-button` with
 *     no `href` still renders an <a>. An <a> without href is not focusable and
 *     has no link role — it is a styled span. Reproduced, and recorded as a
 *     finding rather than repaired, because repairing it would change the API.
 */

import type { ReactNode } from "react";
import "./Button.layered.css";
import {
  buttonClassName,
  linkTargetAttributes,
  sharedButtonAttributes,
  type Emphasis,
  type IconPosition,
  type Size,
} from "./buttonAttributes";
import { ButtonIcon } from "./ButtonIcon";
import {
  BUTTON_ICON,
  BUTTON_ROOT,
  BUTTON_TEXT,
  cx,
  ICON_LAYOUT,
  PILL,
  SIZE_ICON,
  SIZE_ICON_GAP,
  SIZE_ICON_ONLY,
  SIZE_PX,
  SIZE_ROOT,
  SIZE_TEXT,
  TONE,
} from "./buttonUtilities";
import { hasContent } from "./hasContent";

export type LinkButtonProps = {
  href?: string;
  target?: string;
  /** Source default: `"primary"`. */
  emphasis?: Emphasis;
  /** Source default: `false`. Note this reaches CSS as `data-pill="false"`. */
  pill?: boolean;
  /** Source default: `"md"`. */
  size?: Size;
  /** Sprite fragment id, rendered as `<use href="#icon">`. */
  icon?: string;
  /** Source attribute `icon-position`. Source default: `"right"`. */
  iconPosition?: IconPosition;
  /** Source attribute `aria-label`. */
  ariaLabel?: string;
  /** The source merges the author's `class` after `Button`; same order here. */
  className?: string;
  /** `Button.css`'s own state hook — `hover` / `active` / `focus` / `disabled` /
   *  `debug`. Not a TagHelper property: upstream the demo page writes the
   *  attribute directly onto the rendered element. Exposed as a prop because a
   *  React component owns its whole element. Demo/documentation use only. */
  testState?: "hover" | "active" | "focus" | "disabled" | "debug";
  children?: ReactNode;
};

export function LinkButton({
  href,
  target,
  emphasis = "primary",
  pill = false,
  size = "md",
  icon,
  iconPosition = "right",
  ariaLabel,
  className,
  testState,
  children,
}: LinkButtonProps) {
  const hasChildContent = hasContent(children);
  const hasIcon = Boolean(icon);

  if (!hasChildContent && !hasIcon && !ariaLabel) return null;

  const iconOnly = hasIcon && !hasChildContent;

  return (
    <a
      /* STEP 3 — see ActionButton and buttonUtilities.ts. This component has no
         intent axis (the source passes `intent: null`), so it always reads the
         `neutral` row. */
      className={buttonClassName(
        cx(
          "Button",
          BUTTON_ROOT,
          TONE[emphasis].neutral,
          SIZE_ROOT[size],
          /* Mutually exclusive — see the note on SIZE_PX. Emitting both lets
             Tailwind's stylesheet order decide, which it did wrongly. */
          iconOnly ? SIZE_ICON_ONLY[size] : SIZE_PX[size],
          PILL[pill ? "true" : "false"],
          hasIcon ? ICON_LAYOUT[iconPosition] : ICON_LAYOUT.none,
          hasIcon && SIZE_ICON_GAP[size],
        ),
        className,
      )}
      href={href}
      {...linkTargetAttributes(target)}
      {...sharedButtonAttributes({
        emphasis,
        intent: null,
        pill,
        size,
        icon,
        iconPosition,
        ariaLabel,
        iconOnly,
      })}
      data-test-state={testState}
    >
      {hasChildContent && (
        <span className={cx("Button-text", BUTTON_TEXT, SIZE_TEXT[size])}>{children}</span>
      )}
      {icon && <ButtonIcon icon={icon} className={cx(BUTTON_ICON, SIZE_ICON[size])} />}
    </a>
  );
}
