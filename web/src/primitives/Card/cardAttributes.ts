/* cardAttributes.ts — the React counterpart of `TagHelpers/CardHelper.cs`.
 *
 * The Razor helper has four jobs and three of them are pure data: pick the
 * element from an allow-list, validate the two string axes, check the
 * (currently empty) forbidden-combination set, and write the axes onto the
 * element as `data-*`. Only the fourth — rendering — is JSX, so it lives in
 * `Card.tsx` and everything else lives here, testable without a DOM.
 *
 * THREE THINGS ABOUT THIS FILE THAT ARE THE SOURCE'S BEHAVIOUR, NOT OURS.
 *
 * 1. `data-border` IS WRITTEN AS `"false"`, NOT OMITTED. Same shape as
 *    `data-pill` in the Button port, and the same CLAUDE.md exception is
 *    claimed — except it is weaker here: `Button.css` styles BOTH pill states,
 *    while `Card.css` styles only `[data-border="true"]`. So `data-border="false"`
 *    selects nothing in the component's own stylesheet. Reproduced anyway,
 *    because it is the documented public API and a consumer's stylesheet can
 *    (and the Teaser composition does) select on it. See findings.
 *
 * 2. AN INVALID `element` FAILS SILENTLY; AN INVALID `padding` OR `elevation`
 *    FAILS LOUDLY. The source falls back to `article` for an unknown element
 *    with no diagnostic at all, but renders a red dev-only error box for an
 *    unknown padding. Two different failure policies for the same class of
 *    mistake, in one 130-line file. Both reproduced.
 *
 * 3. `ForbiddenCombinations` IS AN EMPTY SET WITH DOCUMENTED CONTENTS. The
 *    source ships it empty and puts two worked project examples in a comment,
 *    i.e. the mechanism is a per-project extension point rather than a rule.
 *    Ported as an empty set with the same examples, because deleting it would
 *    delete an API.
 */

export type CardElement = "article" | "section" | "li" | "div";
export type CardPadding = "none" | "sm" | "md" | "lg";
export type CardElevation = "none" | "sm" | "md" | "lg";

/* Case-insensitive membership, matching the source's
 * `HashSet<string>(StringComparer.OrdinalIgnoreCase)`. TypeScript unions make
 * most of this unreachable at compile time; it is kept because these values
 * arrive from a CMS in the real app, which is the same reasoning the Button
 * port recorded. */
const VALID_ELEMENTS: readonly string[] = ["article", "section", "li", "div"];
const VALID_PADDINGS: readonly string[] = ["none", "sm", "md", "lg"];
const VALID_ELEVATIONS: readonly string[] = ["none", "sm", "md", "lg"];

/** `CardTagHelper.ForbiddenCombinations`, ported empty exactly as it ships.
 *
 *  The source documents two project configurations in a comment:
 *    Project A — bordered cards may not have elevation:
 *      (true, "sm"), (true, "md"), (true, "lg")
 *    Project B — only bordered + elevated cards are permitted:
 *      (false, "none"), (false, "sm"), (false, "md"), (false, "lg"), (true, "none")
 *
 *  Keyed `"<border>|<elevation>"` because a JS `Set` has no tuple identity. */
export const FORBIDDEN_COMBINATIONS: ReadonlySet<string> = new Set<string>();

const combinationKey = (border: boolean, elevation: string) => `${border}|${elevation}`;

/** `output.TagName = ValidElements.Contains(Element) ? … : "article"` — an
 *  unknown element is silently replaced, with no diagnostic. */
export function resolveCardElement(element: string): CardElement {
  return (
    VALID_ELEMENTS.includes(element.toLowerCase()) ? element.toLowerCase() : "article"
  ) as CardElement;
}

export type CardValidation =
  | { ok: true; elevation: string | null }
  | { ok: false; message: string };

/** The three guards, in the source's order: padding, then elevation, then the
 *  combination set. The order is observable — an invalid padding AND an invalid
 *  elevation reports only the padding. */
export function validateCard(
  padding: string,
  elevation: string | null | undefined,
  border: boolean,
): CardValidation {
  if (!VALID_PADDINGS.includes(padding.toLowerCase())) {
    return {
      ok: false,
      message: `invalid padding "${padding}" — expected none | sm | md | lg`,
    };
  }

  /* `Elevation?.ToLowerInvariant() ?? "none"` — the *combination* check always
     sees a string, but the *attribute* is written only when the prop was
     supplied. Two different notions of "no elevation" in four lines of C#. */
  const resolvedElevation = elevation?.toLowerCase() ?? "none";

  if (
    elevation !== null &&
    elevation !== undefined &&
    !VALID_ELEVATIONS.includes(resolvedElevation)
  ) {
    return {
      ok: false,
      message: `invalid elevation "${elevation}" — expected none | sm | md | lg`,
    };
  }

  if (FORBIDDEN_COMBINATIONS.has(combinationKey(border, resolvedElevation))) {
    return {
      ok: false,
      message: `border="${border}" with elevation="${resolvedElevation}" is not a permitted combination`,
    };
  }

  return {
    ok: true,
    elevation: elevation === null || elevation === undefined ? null : resolvedElevation,
  };
}

/** Mirrors the attribute block of `ProcessAsync`. `data-border` and
 *  `data-padding` always; `data-elevation` only when the prop was supplied. */
export function cardAttributes({
  border,
  padding,
  elevation,
}: {
  border: boolean;
  padding: string;
  elevation: string | null;
}): Record<string, string> {
  const attrs: Record<string, string> = {
    "data-border": border ? "true" : "false",
    "data-padding": padding.toLowerCase(),
  };
  if (elevation !== null) attrs["data-elevation"] = elevation;
  return attrs;
}

/** `string.IsNullOrWhiteSpace(existingClass) ? "Card" : $"Card {existingClass}"`.
 *  Card MERGES the author's class — unlike `CtaLinkButtonTagHelper`, which
 *  overwrites it. Same helper shape as `buttonClassName`, kept local so the two
 *  primitive families stay independently deletable. */
export function cardClassName(base: string, extra?: string): string {
  return extra && extra.trim() ? `${base} ${extra}` : base;
}
