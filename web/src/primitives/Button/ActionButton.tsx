/* ActionButton.tsx — port of `TagHelpers/ActionButtonTagHelper.cs` (`app-action-button`).
 *
 * Same body as LinkButton on a <button>, plus the two axes only a button has:
 * `button-type` (→ `type`) and `disabled`. It is also the only one of the three
 * that passes an `intent`, defaulting to `"neutral"` — and `Button.css` has no
 * `[data-intent="neutral"]` rule at all, so the default renders an attribute
 * that matches nothing. That is intentional in the source (neutral IS the base
 * appearance) and is reproduced.
 *
 * Still a Server Component. The source has no click handler to port — a Razor
 * button submits or is wired by page script — so `onClick` is deliberately NOT
 * part of the API. Adding it would force `'use client'` on every consumer of a
 * primitive whose entire job is to compute attributes. A consumer that needs a
 * handler wraps this in its own client component, or uses `form`/`formAction`.
 */

import type { ReactNode } from "react";
import "./Button.css";
import {
  buttonClassName,
  sharedButtonAttributes,
  type Emphasis,
  type IconPosition,
  type Intent,
  type Size,
} from "./buttonAttributes";
import { ButtonIcon } from "./ButtonIcon";
import { hasContent } from "./hasContent";

export type ActionButtonProps = {
  /** Source attribute `button-type`. Source default: `"button"`. */
  buttonType?: "button" | "submit" | "reset";
  disabled?: boolean;
  /** Source default: `"primary"`. */
  emphasis?: Emphasis;
  /** Source default: `"neutral"` — which no CSS rule matches. See header. */
  intent?: Intent;
  /** Source default: `false`. Reaches CSS as `data-pill="false"`. */
  pill?: boolean;
  /** Source default: `"md"`. */
  size?: Size;
  icon?: string;
  /** Source attribute `icon-position`. Source default: `"right"`. */
  iconPosition?: IconPosition;
  /** Source attribute `aria-label`. */
  ariaLabel?: string;
  className?: string;
  /** `Button.css`'s demo state hook. See LinkButton for why it is a prop. */
  testState?: "hover" | "active" | "focus" | "disabled" | "debug";
  children?: ReactNode;
};

export function ActionButton({
  buttonType = "button",
  disabled = false,
  emphasis = "primary",
  intent = "neutral",
  pill = false,
  size = "md",
  icon,
  iconPosition = "right",
  ariaLabel,
  className,
  testState,
  children,
}: ActionButtonProps) {
  const hasChildContent = hasContent(children);
  const hasIcon = Boolean(icon);

  if (!hasChildContent && !hasIcon && !ariaLabel) return null;

  return (
    <button
      type={buttonType}
      disabled={disabled || undefined}
      className={buttonClassName("Button", className)}
      {...sharedButtonAttributes({
        emphasis,
        intent,
        pill,
        size,
        icon,
        iconPosition,
        ariaLabel,
        iconOnly: hasIcon && !hasChildContent,
      })}
      data-test-state={testState}
    >
      {hasChildContent && <span className="Button-text">{children}</span>}
      {icon && <ButtonIcon icon={icon} />}
    </button>
  );
}
