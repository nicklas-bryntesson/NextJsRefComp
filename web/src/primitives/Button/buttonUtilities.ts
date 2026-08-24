/* buttonUtilities.ts — STEP 3: the design values as Tailwind utilities.
 *
 * Same DOM, same class names. `Button`, `Button-text`, `Button-icon`,
 * `CtaButton`, `CtaButton-text`, `CtaButton-icon`, `CtaButton-border` and
 * `CtaButton-glow` are all still on the elements they were on in step 2 — they
 * are the public identity of these parts and the only thing a consumer's
 * stylesheet or a future test suite can select. The utilities go ALONGSIDE them.
 *
 * ── WHAT THIS CONVERSION COST, in three specific ways ──────────────────────
 *
 * 1. THE CASCADE BECOMES A LOOKUP TABLE. Step 2's `.Button` was two independent
 *    axes: `[data-emphasis="primary"]` set the fill, and
 *    `[data-emphasis="primary"][data-intent="destructive"]` OVERRODE it, winning
 *    on specificity. Utilities have no such relationship — `bg-primary` and
 *    `bg-semantic-error` are the same specificity and the winner is decided by
 *    their order in Tailwind's generated stylesheet, which is a property of
 *    Tailwind, not of this component. So the override cannot be expressed; the
 *    conflicting utility must simply never be emitted. Two 3-value axes that
 *    composed in CSS become the nine explicit rows of `TONE` below. That is the
 *    single biggest structural change in the whole port.
 *
 * 2. EVERY STATE IS WRITTEN TWICE. `Button.css` styles each state with a
 *    two-selector list — `&:hover, &[data-test-state="hover"]` — so one block of
 *    declarations serves both the real pseudo-class and the demo pin. A variant
 *    prefix cannot be a list, so each declaration needs `hover:` AND
 *    `data-[test-state=hover]:`. Four states × three properties × two forms is
 *    24 utilities per tone where the stylesheet had 12 declarations.
 *
 * 3. RELATIONSHIPS BECOME CONSTANTS. `Button.css` sets the icon's vertical
 *    margin as `calc(var(--_iconSize) / 2 * -1)` — a rule ("half the icon,
 *    negative") that holds for any icon size a consumer installs. There is no
 *    utility for "half of another utility", so it becomes three hardcoded
 *    values: -0.5rem, -0.5625rem, -0.625rem. Same for `.Button-text`'s
 *    line-height compensation. This is precisely what ADR-0025 warns about —
 *    "express relationships, never a scale" — and the utility layer cannot hold
 *    a relationship at all.
 *
 * What DID survive intact: the `data-*` attributes themselves. They are still
 * written to the DOM by `sharedButtonAttributes`, unchanged, because they are
 * the component's public API and the probe keys off them. They are simply no
 * longer what selects the styling. See findings/primitives-Button.md.
 *
 * NOTE ON F-057. The reference library's `.grid` / `.ring` collision cannot
 * happen here. `Component-part` names (`Button-text`) contain no bare generic
 * word, so no Tailwind utility can ever share one — and `tailwind-collisions.css`
 * needs no entry for this component even though its root now literally carries
 * the `grid` utility.
 */

import type { Emphasis, IconPosition, Intent, Size } from "./buttonAttributes";

/* WHY EVERY CLASS NAME BELOW IS A LITERAL, and why that is a finding.
 *
 * The first version of this file built the intent rows with a helper —
 * `primaryIntent("semantic-error", ERROR_PRESS)` — which is the obvious way to
 * express "nine rows, three shapes". It generates nothing. Tailwind v4 finds
 * candidates by scanning the raw TEXT of source files, so a class name that only
 * exists after a template literal is evaluated is invisible to it: the utility is
 * never emitted and the component renders unstyled with no error anywhere.
 *
 * That constraint bites this component harder than most, because a `data-*`-driven
 * component is by definition one whose styling is chosen at runtime. The
 * stylesheet could enumerate the matrix in nine short selectors; the utility layer
 * has to enumerate it in nine long literals, and the deduplication a helper would
 * give is not available. What follows is therefore deliberately repetitive.
 *
 * The line breaks are placed on space boundaries only, so no class name is ever
 * split across a concatenation — a break inside one would silently drop it.
 */

/** Properties every `.Button` carries regardless of axis. */
export const BUTTON_ROOT =
  "relative grid items-center justify-items-center box-border cursor-pointer no-underline " +
  "transition-[background-color,color,border-color,box-shadow] duration-[250ms] ease-[ease] " +
  /* The focus ring, and ONLY under the focus variants. Declaring
     `outline-2 outline-offset-[3px]` unconditionally would change the RESTING
     computed `outline-width` from the UA's `medium` (3px) to 2px and
     `outline-offset` from 0 to 3px — a diff the snapshot catches immediately,
     and a precise illustration of the difference between a utility (always on)
     and a nested CSS rule (scoped by construction). */
  "focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-primary " +
  "focus-visible:outline-offset-[3px] " +
  "data-[test-state=focus]:outline-2 data-[test-state=focus]:outline-solid " +
  "data-[test-state=focus]:outline-primary data-[test-state=focus]:outline-offset-[3px] " +
  "focus:not-focus-visible:outline-0";

/* ── The nine tones: emphasis × intent, already resolved ─────────────────────
 * `neutral` is the emphasis's own appearance — the source has no
 * `[data-intent="neutral"]` rule at all, deliberately, and nor does this. */

export const TONE: Record<Emphasis, Record<Intent, string>> = {
  primary: {
    neutral:
      "border border-solid border-primary bg-primary text-on-primary hover:border-primary-active " +
      "hover:bg-primary-active hover:text-on-primary data-[test-state=hover]:border-primary-active " +
      "data-[test-state=hover]:bg-primary-active data-[test-state=hover]:text-on-primary " +
      "active:border-primary-active active:bg-primary-active active:text-on-primary " +
      "data-[test-state=active]:border-primary-active data-[test-state=active]:bg-primary-active " +
      "data-[test-state=active]:text-on-primary disabled:border-hairline-strong " +
      "disabled:bg-surface-strong disabled:text-body disabled:cursor-not-allowed " +
      "data-[test-state=disabled]:border-hairline-strong " +
      "data-[test-state=disabled]:bg-surface-strong data-[test-state=disabled]:text-body " +
      "data-[test-state=disabled]:cursor-not-allowed " +
      "disabled:bg-[repeating-linear-gradient(45deg,var(--color-surface-strong),var(--color-hairline-strong)_0.125rem,transparent_0.125rem,transparent_0.5rem)] " +
      "data-[test-state=disabled]:bg-[repeating-linear-gradient(45deg,var(--color-surface-strong),var(--color-hairline-strong)_0.125rem,transparent_0.125rem,transparent_0.5rem)]",
    destructive:
      "border border-solid border-semantic-error bg-semantic-error text-on-primary " +
      "hover:border-[color-mix(in_oklab,var(--color-semantic-error)_82%,var(--color-ink))] " +
      "hover:bg-[color-mix(in_oklab,var(--color-semantic-error)_82%,var(--color-ink))] " +
      "hover:text-on-primary " +
      "data-[test-state=hover]:border-[color-mix(in_oklab,var(--color-semantic-error)_82%,var(--color-ink))] " +
      "data-[test-state=hover]:bg-[color-mix(in_oklab,var(--color-semantic-error)_82%,var(--color-ink))] " +
      "data-[test-state=hover]:text-on-primary " +
      "active:border-[color-mix(in_oklab,var(--color-semantic-error)_82%,var(--color-ink))] " +
      "active:bg-[color-mix(in_oklab,var(--color-semantic-error)_82%,var(--color-ink))] " +
      "active:text-on-primary " +
      "data-[test-state=active]:border-[color-mix(in_oklab,var(--color-semantic-error)_82%,var(--color-ink))] " +
      "data-[test-state=active]:bg-[color-mix(in_oklab,var(--color-semantic-error)_82%,var(--color-ink))] " +
      "data-[test-state=active]:text-on-primary disabled:border-hairline-strong " +
      "disabled:bg-surface-strong disabled:text-body disabled:cursor-not-allowed " +
      "data-[test-state=disabled]:border-hairline-strong " +
      "data-[test-state=disabled]:bg-surface-strong data-[test-state=disabled]:text-body " +
      "data-[test-state=disabled]:cursor-not-allowed " +
      "disabled:bg-[repeating-linear-gradient(45deg,var(--color-surface-strong),var(--color-hairline-strong)_0.125rem,transparent_0.125rem,transparent_0.5rem)] " +
      "data-[test-state=disabled]:bg-[repeating-linear-gradient(45deg,var(--color-surface-strong),var(--color-hairline-strong)_0.125rem,transparent_0.125rem,transparent_0.5rem)]",
    success:
      "border border-solid border-semantic-success bg-semantic-success text-on-primary " +
      "hover:border-[color-mix(in_oklab,var(--color-semantic-success)_82%,var(--color-ink))] " +
      "hover:bg-[color-mix(in_oklab,var(--color-semantic-success)_82%,var(--color-ink))] " +
      "hover:text-on-primary " +
      "data-[test-state=hover]:border-[color-mix(in_oklab,var(--color-semantic-success)_82%,var(--color-ink))] " +
      "data-[test-state=hover]:bg-[color-mix(in_oklab,var(--color-semantic-success)_82%,var(--color-ink))] " +
      "data-[test-state=hover]:text-on-primary " +
      "active:border-[color-mix(in_oklab,var(--color-semantic-success)_82%,var(--color-ink))] " +
      "active:bg-[color-mix(in_oklab,var(--color-semantic-success)_82%,var(--color-ink))] " +
      "active:text-on-primary " +
      "data-[test-state=active]:border-[color-mix(in_oklab,var(--color-semantic-success)_82%,var(--color-ink))] " +
      "data-[test-state=active]:bg-[color-mix(in_oklab,var(--color-semantic-success)_82%,var(--color-ink))] " +
      "data-[test-state=active]:text-on-primary disabled:border-hairline-strong " +
      "disabled:bg-surface-strong disabled:text-body disabled:cursor-not-allowed " +
      "data-[test-state=disabled]:border-hairline-strong " +
      "data-[test-state=disabled]:bg-surface-strong data-[test-state=disabled]:text-body " +
      "data-[test-state=disabled]:cursor-not-allowed " +
      "disabled:bg-[repeating-linear-gradient(45deg,var(--color-surface-strong),var(--color-hairline-strong)_0.125rem,transparent_0.125rem,transparent_0.5rem)] " +
      "data-[test-state=disabled]:bg-[repeating-linear-gradient(45deg,var(--color-surface-strong),var(--color-hairline-strong)_0.125rem,transparent_0.125rem,transparent_0.5rem)]",
  },
  secondary: {
    neutral:
      "border border-solid border-hairline-strong bg-surface-card text-ink hover:border-ink " +
      "hover:bg-surface-card hover:text-ink data-[test-state=hover]:border-ink " +
      "data-[test-state=hover]:bg-surface-card data-[test-state=hover]:text-ink active:border-ink " +
      "active:bg-surface-strong active:text-ink data-[test-state=active]:border-ink " +
      "data-[test-state=active]:bg-surface-strong data-[test-state=active]:text-ink " +
      "disabled:border-hairline-strong disabled:bg-surface-strong disabled:text-body " +
      "disabled:cursor-not-allowed data-[test-state=disabled]:border-hairline-strong " +
      "data-[test-state=disabled]:bg-surface-strong data-[test-state=disabled]:text-body " +
      "data-[test-state=disabled]:cursor-not-allowed " +
      "disabled:bg-[repeating-linear-gradient(45deg,var(--color-surface-strong),var(--color-hairline-strong)_0.125rem,transparent_0.125rem,transparent_0.5rem)] " +
      "data-[test-state=disabled]:bg-[repeating-linear-gradient(45deg,var(--color-surface-strong),var(--color-hairline-strong)_0.125rem,transparent_0.125rem,transparent_0.5rem)]",
    destructive:
      "border border-solid border-semantic-error bg-surface-card " +
      "text-[color-mix(in_oklab,var(--color-semantic-error)_72%,var(--color-ink))] " +
      "hover:border-[color-mix(in_oklab,var(--color-semantic-error)_72%,var(--color-ink))] " +
      "hover:bg-surface-card " +
      "hover:text-[color-mix(in_oklab,var(--color-semantic-error)_72%,var(--color-ink))] " +
      "data-[test-state=hover]:border-[color-mix(in_oklab,var(--color-semantic-error)_72%,var(--color-ink))] " +
      "data-[test-state=hover]:bg-surface-card " +
      "data-[test-state=hover]:text-[color-mix(in_oklab,var(--color-semantic-error)_72%,var(--color-ink))] " +
      "active:border-[color-mix(in_oklab,var(--color-semantic-error)_72%,var(--color-ink))] " +
      "active:bg-surface-strong " +
      "active:text-[color-mix(in_oklab,var(--color-semantic-error)_72%,var(--color-ink))] " +
      "data-[test-state=active]:border-[color-mix(in_oklab,var(--color-semantic-error)_72%,var(--color-ink))] " +
      "data-[test-state=active]:bg-surface-strong " +
      "data-[test-state=active]:text-[color-mix(in_oklab,var(--color-semantic-error)_72%,var(--color-ink))] " +
      "disabled:border-hairline-strong disabled:bg-surface-strong disabled:text-body " +
      "disabled:cursor-not-allowed data-[test-state=disabled]:border-hairline-strong " +
      "data-[test-state=disabled]:bg-surface-strong data-[test-state=disabled]:text-body " +
      "data-[test-state=disabled]:cursor-not-allowed " +
      "disabled:bg-[repeating-linear-gradient(45deg,var(--color-surface-strong),var(--color-hairline-strong)_0.125rem,transparent_0.125rem,transparent_0.5rem)] " +
      "data-[test-state=disabled]:bg-[repeating-linear-gradient(45deg,var(--color-surface-strong),var(--color-hairline-strong)_0.125rem,transparent_0.125rem,transparent_0.5rem)]",
    success:
      "border border-solid border-semantic-success bg-surface-card " +
      "text-[color-mix(in_oklab,var(--color-semantic-success)_72%,var(--color-ink))] " +
      "hover:border-[color-mix(in_oklab,var(--color-semantic-success)_72%,var(--color-ink))] " +
      "hover:bg-surface-card " +
      "hover:text-[color-mix(in_oklab,var(--color-semantic-success)_72%,var(--color-ink))] " +
      "data-[test-state=hover]:border-[color-mix(in_oklab,var(--color-semantic-success)_72%,var(--color-ink))] " +
      "data-[test-state=hover]:bg-surface-card " +
      "data-[test-state=hover]:text-[color-mix(in_oklab,var(--color-semantic-success)_72%,var(--color-ink))] " +
      "active:border-[color-mix(in_oklab,var(--color-semantic-success)_72%,var(--color-ink))] " +
      "active:bg-surface-strong " +
      "active:text-[color-mix(in_oklab,var(--color-semantic-success)_72%,var(--color-ink))] " +
      "data-[test-state=active]:border-[color-mix(in_oklab,var(--color-semantic-success)_72%,var(--color-ink))] " +
      "data-[test-state=active]:bg-surface-strong " +
      "data-[test-state=active]:text-[color-mix(in_oklab,var(--color-semantic-success)_72%,var(--color-ink))] " +
      "disabled:border-hairline-strong disabled:bg-surface-strong disabled:text-body " +
      "disabled:cursor-not-allowed data-[test-state=disabled]:border-hairline-strong " +
      "data-[test-state=disabled]:bg-surface-strong data-[test-state=disabled]:text-body " +
      "data-[test-state=disabled]:cursor-not-allowed " +
      "disabled:bg-[repeating-linear-gradient(45deg,var(--color-surface-strong),var(--color-hairline-strong)_0.125rem,transparent_0.125rem,transparent_0.5rem)] " +
      "data-[test-state=disabled]:bg-[repeating-linear-gradient(45deg,var(--color-surface-strong),var(--color-hairline-strong)_0.125rem,transparent_0.125rem,transparent_0.5rem)]",
  },
  tertiary: {
    neutral:
      "border-0 border-solid border-transparent bg-transparent text-ink hover:text-primary " +
      "data-[test-state=hover]:text-primary active:text-primary-active " +
      "data-[test-state=active]:text-primary-active disabled:text-body disabled:cursor-not-allowed " +
      "data-[test-state=disabled]:text-body data-[test-state=disabled]:cursor-not-allowed",
    destructive:
      "border-0 border-solid border-transparent bg-transparent " +
      "text-[color-mix(in_oklab,var(--color-semantic-error)_72%,var(--color-ink))] " +
      "hover:text-[color-mix(in_oklab,var(--color-semantic-error)_72%,var(--color-ink))] " +
      "data-[test-state=hover]:text-[color-mix(in_oklab,var(--color-semantic-error)_72%,var(--color-ink))] " +
      "active:text-[color-mix(in_oklab,var(--color-semantic-error)_72%,var(--color-ink))] " +
      "data-[test-state=active]:text-[color-mix(in_oklab,var(--color-semantic-error)_72%,var(--color-ink))] " +
      "disabled:text-body disabled:cursor-not-allowed data-[test-state=disabled]:text-body " +
      "data-[test-state=disabled]:cursor-not-allowed",
    success:
      "border-0 border-solid border-transparent bg-transparent " +
      "text-[color-mix(in_oklab,var(--color-semantic-success)_72%,var(--color-ink))] " +
      "hover:text-[color-mix(in_oklab,var(--color-semantic-success)_72%,var(--color-ink))] " +
      "data-[test-state=hover]:text-[color-mix(in_oklab,var(--color-semantic-success)_72%,var(--color-ink))] " +
      "active:text-[color-mix(in_oklab,var(--color-semantic-success)_72%,var(--color-ink))] " +
      "data-[test-state=active]:text-[color-mix(in_oklab,var(--color-semantic-success)_72%,var(--color-ink))] " +
      "disabled:text-body disabled:cursor-not-allowed data-[test-state=disabled]:text-body " +
      "data-[test-state=disabled]:cursor-not-allowed",
  },
};

/* ── Size ──
 * cursor-DESIGN.md's own button padding (10/18 for md, 12/20 for lg) is NOT on
 * its own 4px spacing scale, so most of these are bracket values even though the
 * design system has a spacing scale. Worth naming: a design token scale and a
 * component's specified padding can disagree, and Tailwind makes the
 * disagreement visible as bracket syntax. */
export const SIZE_ROOT: Record<Size, string> = {
  sm: "min-h-[2rem] py-[0.375rem]",
  md: "min-h-[2.5rem] py-[0.625rem]",
  lg: "min-h-[2.75rem] py-[0.75rem]",
};

/* INLINE PADDING IS SEPARATE FROM THE REST OF THE SIZE, and the reason is the
 * second collision this conversion produced — caught by the snapshot, not by
 * reading the code.
 *
 * Step 2 expressed icon-only as an override: `&[data-icon-only="true"] {
 * padding-inline: var(--_paddingBlock) }` beat the size rule on specificity, so
 * a square button was guaranteed. Emitting `px-[1.125rem]` (size md) and
 * `px-[0.625rem]` (icon-only md) together is NOT an override — both are one
 * class, same specificity, and the winner is decided by their order in
 * Tailwind's generated stylesheet.
 *
 * Measured: md and lg icon-only buttons took the SIZE padding (18px / 20px
 * instead of 10px / 12px, and 64px / 74px wide instead of 48px / 58px) while sm
 * happened to take the icon-only one. The same authored intent produced
 * different outcomes at different sizes, because the sort key is the VALUE. A
 * bug that varies by size is exactly the kind that ships.
 *
 * So the two are mutually exclusive lookups and the component picks one. Third
 * time in this file that "resolve it in JS, never emit both" is the answer —
 * emphasis × intent, then icon-only × size. */
export const SIZE_PX: Record<Size, string> = {
  sm: "px-[0.75rem]",
  md: "px-[1.125rem]",
  lg: "px-[1.25rem]",
};

/** `[data-icon-only]` squares the box: inline padding matches block padding, and
 *  the min inline size matches the min block size. Replaces `SIZE_PX`; never
 *  combined with it. */
export const SIZE_ICON_ONLY: Record<Size, string> = {
  sm: "px-[0.375rem] min-w-[2rem]",
  md: "px-[0.625rem] min-w-[2.5rem]",
  lg: "px-[0.75rem] min-w-[2.75rem]",
};

/** The gap between label and icon, only meaningful when an icon is positioned. */
export const SIZE_ICON_GAP: Record<Size, string> = {
  sm: "gap-[0.5rem]",
  md: "gap-[0.5rem]",
  lg: "gap-[0.75rem]",
};

/* `grid-template-areas` has no utility vocabulary at all, so all three are
 * bracket values. Note the underscore-for-space rule makes the quoted area
 * string read oddly but resolves correctly. */
export const ICON_LAYOUT: Record<IconPosition | "none", string> = {
  none: "grid-cols-[auto] [grid-template-areas:'text']",
  left: "grid-cols-[auto_1fr] [grid-template-areas:'icon_text']",
  right: "grid-cols-[1fr_auto] [grid-template-areas:'text_icon']",
};

/** `data-pill` — the clearest surviving case of the source's gate idiom, now a
 *  two-entry lookup instead of two CSS rules writing one custom property. */
export const PILL: Record<"true" | "false", string> = {
  false: "rounded-md",
  true: "rounded-pill",
};

/* ── Parts ── */

/** `.Button-text`. `my-0` is where the line-height compensation calc landed:
 *  at `{typography.button}`'s line-height of 1 it evaluated to 0, so the utility
 *  is correct TODAY and silently wrong for any other line-height — the
 *  relationship is gone. */
export const BUTTON_TEXT =
  "relative [grid-area:text] text-inherit font-sans font-medium leading-none " +
  "tracking-normal my-0 [word-break:break-word] break-words hyphens-auto";

export const SIZE_TEXT: Record<Size, string> = {
  sm: "text-[0.8125rem]",
  md: "text-[0.875rem]",
  lg: "text-[0.875rem]",
};

/** `.Button-icon`. The negative margin is what keeps the icon from contributing
 *  height; three constants where the stylesheet had one calc. */
export const BUTTON_ICON =
  "relative [grid-area:icon] w-auto max-w-fit [aspect-ratio:auto_1/1]";

export const SIZE_ICON: Record<Size, string> = {
  sm: "h-[1rem] -my-[0.5rem]",
  md: "h-[1.125rem] -my-[0.5625rem]",
  lg: "h-[1.25rem] -my-[0.625rem]",
};

/* ── CtaButton ── */

/** `group` is load-bearing: `.CtaButton-glow`'s opacity responds to the ROOT's
 *  hover and active. In CSS that was `&:hover > .CtaButton-glow`; a utility
 *  cannot reach a child, so Tailwind's group mechanism is the only expression —
 *  and it means the parent has to carry a class that exists solely to be
 *  referenced by a descendant. */
export const CTA_ROOT =
  "group relative grid items-center justify-items-center box-border cursor-pointer no-underline " +
  "whitespace-nowrap min-h-[2.75rem] py-sm px-md rounded-md " +
  "text-[0.875rem] font-medium leading-none tracking-normal font-sans " +
  "focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-primary focus-visible:outline-offset-[3px] " +
  "data-[test-state=focus]:outline-2 data-[test-state=focus]:outline-solid data-[test-state=focus]:outline-primary data-[test-state=focus]:outline-offset-[3px] " +
  "focus:not-focus-visible:outline-0 " +
  "disabled:cursor-not-allowed disabled:opacity-50 " +
  "data-[test-state=disabled]:cursor-not-allowed data-[test-state=disabled]:opacity-50";

/** `button-download`: ink fill, canvas text. */
export const CTA_VARIANT: Record<"glow", string> = {
  glow: "bg-ink text-canvas",
};

export const CTA_LAYOUT: Record<"text" | "textIcon", string> = {
  text: "grid-cols-[1fr] [grid-template-areas:'text']",
  textIcon: "grid-cols-[auto_auto] [grid-template-areas:'text_icon'] gap-xs",
};

export const CTA_TEXT = "relative [grid-area:text] z-[1]";
export const CTA_ICON =
  "relative [grid-area:icon] z-[1] h-[1.25em] w-auto [aspect-ratio:auto_1/1]";
export const CTA_BORDER =
  "absolute inset-0 rounded-[inherit] border border-solid border-current opacity-30 pointer-events-none";

/** The glow. Both the gradient and the two response states are bracket values;
 *  the hover/active pair needs `group-hover:` AND `group-data-[…]:` for the same
 *  reason every other state is written twice. */
export const CTA_GLOW =
  "absolute -inset-2 rounded-[inherit] pointer-events-none " +
  "bg-[radial-gradient(ellipse_at_center,var(--color-primary-brand)_0%,transparent_70%)] " +
  "opacity-0 transition-opacity duration-300 ease-[ease] " +
  "group-hover:opacity-[0.35] group-data-[test-state=hover]:opacity-[0.35] " +
  "group-active:opacity-[0.5] group-data-[test-state=active]:opacity-[0.5]";

/** Join a list of utility groups, dropping empties. */
export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}
