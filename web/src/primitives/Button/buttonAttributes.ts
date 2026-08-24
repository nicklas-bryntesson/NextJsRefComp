/* buttonAttributes.ts — the React counterpart of `TagHelpers/ButtonHelper.cs`.
 *
 * The source is a static C# helper with two jobs: validate the axis values and
 * write them onto the element as `data-*`, and emit the sprite `<svg><use>`.
 * The second job is JSX, so it lives in `ButtonIcon.tsx`; this file is the
 * attribute half, which is pure data and therefore testable without a DOM.
 *
 * WHY THE `data-*` API SURVIVES THE PORT UNCHANGED. Every visual axis in
 * `Button.css` is a gate selector — `&[data-emphasis="primary"]`,
 * `&[data-size="lg"]`, `&[data-pill="true"]` — filling one of the blank custom
 * properties declared at the top of `.Button`. So the attributes are not a
 * stylistic choice we could swap for React props feeding `className`: they are
 * the stylesheet's only input. Port the props to React, keep the attributes.
 *
 * ONE DELIBERATE DIFFERENCE FROM THE REFERENCE-COMPONENTS CONVENTION.
 * CLAUDE.md's rule is "booleans are `="true"` or absent — never `="false"`".
 * `ButtonHelper.SetSharedAttributes` writes `data-pill="false"` explicitly, and
 * `Button.css` styles BOTH states (`[data-pill="false"] { --_borderRadius:
 * 0.375em }`). That is the documented exception — both states carry design, so
 * both have to be selectable. Reproduced verbatim; see findings.
 */

export type Emphasis = "primary" | "secondary" | "tertiary";
export type Intent = "neutral" | "destructive" | "success";
export type Size = "sm" | "md" | "lg";
export type IconPosition = "left" | "right";

/* The source keeps these as case-insensitive HashSets and silently DROPS the
 * attribute when a value is not a member — an unknown emphasis renders a
 * `.Button` with no emphasis gate, i.e. no colour at all. TypeScript unions
 * make most of that unreachable at compile time, but the runtime guard is kept
 * because these values routinely arrive from a CMS. */
const VALID_EMPHASIS: readonly string[] = ["primary", "secondary", "tertiary"];
const VALID_INTENTS: readonly string[] = ["neutral", "destructive", "success"];
const VALID_SIZES: readonly string[] = ["sm", "md", "lg"];
const VALID_ICON_POSITIONS: readonly string[] = ["left", "right"];

export type SharedButtonAxes = {
  emphasis: string;
  intent?: string | null;
  pill: boolean;
  size: string;
  icon?: string | null;
  iconPosition: string;
  ariaLabel?: string | null;
  /** `icon && !children` — the source computes it in each TagHelper, not in the
   *  shared helper. Kept as an input so both call sites stay identical. */
  iconOnly?: boolean;
};

/** Mirrors `ButtonHelper.SetSharedAttributes`, returning a spreadable object
 *  instead of mutating a `TagHelperOutput`. */
export function sharedButtonAttributes({
  emphasis,
  intent,
  pill,
  size,
  icon,
  iconPosition,
  ariaLabel,
  iconOnly,
}: SharedButtonAxes): Record<string, string> {
  const attrs: Record<string, string> = {};

  if (VALID_EMPHASIS.includes(emphasis.toLowerCase())) {
    attrs["data-emphasis"] = emphasis.toLowerCase();
  }

  if (intent && VALID_INTENTS.includes(intent.toLowerCase())) {
    attrs["data-intent"] = intent.toLowerCase();
  }

  if (VALID_SIZES.includes(size.toLowerCase())) {
    attrs["data-size"] = size.toLowerCase();
  }

  /* Explicitly "false", not omitted. See the header note. */
  attrs["data-pill"] = pill ? "true" : "false";

  if (icon) {
    attrs["data-icon"] = icon;
    if (VALID_ICON_POSITIONS.includes(iconPosition.toLowerCase())) {
      attrs["data-icon-position"] = iconPosition.toLowerCase();
    }
  }

  if (ariaLabel) {
    attrs["aria-label"] = ariaLabel;
  }

  if (iconOnly) {
    attrs["data-icon-only"] = "true";
  }

  return attrs;
}

/** Mirrors the class-merge every TagHelper does by hand: the structural class
 *  first, then whatever the caller put in `class`. */
export function buttonClassName(base: string, extra?: string): string {
  return extra && extra.trim() ? `${base} ${extra}` : base;
}

/** `target="_blank"` implies `rel="noopener noreferrer"` in all three source
 *  helpers. Factored out because two of them need it. */
export function linkTargetAttributes(target?: string | null): {
  target?: string;
  rel?: string;
} {
  if (!target) return {};
  return target === "_blank"
    ? { target, rel: "noopener noreferrer" }
    : { target };
}
