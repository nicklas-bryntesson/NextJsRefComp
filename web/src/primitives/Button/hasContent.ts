/* hasContent.ts — the React answer to `TagHelperContent.IsEmptyOrWhiteSpace`.
 *
 * All three TagHelpers branch on it, so it has to mean the same thing in all
 * three. Razor has already rendered the child content to a string by the time it
 * asks, so whitespace-only content counts as empty. React children are a tree,
 * so the honest equivalent is: no children at all, or children that are only
 * whitespace strings / null / false. An ELEMENT child always counts as content
 * even if it would render nothing — we cannot render it early to find out, and
 * guessing the other way would suppress a legitimately labelled button.
 */

import type { ReactNode } from "react";
import { isValidElement } from "react";

export function hasContent(children: ReactNode): boolean {
  if (children === null || children === undefined || children === false) {
    return false;
  }
  if (typeof children === "string") return children.trim().length > 0;
  if (typeof children === "number" || typeof children === "bigint") return true;
  if (typeof children === "boolean") return false;
  if (Array.isArray(children)) return children.some((c) => hasContent(c));
  if (isValidElement(children)) return true;
  /* Iterables and promises: assume content rather than silently suppress. */
  return true;
}
