/* proseAttributes.ts — the attribute half of `TagHelpers/ProseTagHelper.cs`.
 *
 * Much smaller than Heading's, and interestingly INCONSISTENT with it: where
 * `HeadingTagHelper` silently substitutes a valid value for an unknown variant
 * or size, `ProseTagHelper` renders a dev error for both — while still silently
 * substituting `div` for an unknown *element*. Two validation philosophies in
 * one file, and three across the pair. Reproduced exactly; recorded in
 * findings/primitives-Prose.md.
 */

export type ProseElement = "div" | "section" | "article" | "aside" | "footer";
export type ProseVariant = "basic" | "default" | "rich";
export type ProseSize = "sm" | "md" | "lg";

const VALID_ELEMENTS: readonly string[] = ["div", "section", "article", "aside", "footer"];
const VALID_VARIANTS: readonly string[] = ["basic", "default", "rich"];
const VALID_SIZES: readonly string[] = ["sm", "md", "lg"];

/** Unknown element → `div`, silently. */
export function resolveProseElement(element: string | undefined): string {
  const lower = (element ?? "div").toLowerCase();
  return VALID_ELEMENTS.includes(lower) ? lower : "div";
}

/** Unknown variant → `null`, which the component turns into a dev error. */
export function validateProseVariant(variant: string): string | null {
  return VALID_VARIANTS.includes(variant.toLowerCase()) ? variant.toLowerCase() : null;
}

/** Unknown size → `null`, likewise. */
export function validateProseSize(size: string): string | null {
  return VALID_SIZES.includes(size.toLowerCase()) ? size.toLowerCase() : null;
}

export function proseAttributes(variant: string, size: string): Record<string, string> {
  return { "data-variant": variant, "data-size": size };
}

export function proseClassName(extra?: string): string {
  return extra && extra.trim() ? `Prose ${extra}` : "Prose";
}
