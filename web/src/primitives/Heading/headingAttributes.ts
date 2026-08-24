/* headingAttributes.ts — the attribute half of `TagHelpers/HeadingTagHelper.cs`.
 *
 * `HeadingTagHelper` is the largest file in the Razor set (8.7 KB) and almost
 * all of that size is validation: nine valid elements, three variants, a
 * per-variant element allowlist, a per-variant size allowlist, four colours,
 * three alignments, four wrap strategies, and a size-resolution cascade with
 * three fallback tiers. None of it touches the DOM, so all of it lives here and
 * is testable without a render — the same split `buttonAttributes.ts` uses.
 *
 * The one thing that is NOT pure is the highlight splitter, which produces
 * markup. The source builds an HTML string with `<mark>` and hand-encodes each
 * fragment; React produces nodes and encodes for free, so the splitter here
 * returns the *fragments* (a pure, testable list) and `Heading.tsx` maps them to
 * `<mark>`. See findings — this is the one place the port is strictly safer than
 * the source rather than merely equivalent.
 */

export type HeadingElement = "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "span" | "div" | "p";
export type HeadingVariant = "heading" | "display" | "body";
export type HeadingColor = "primary" | "dark" | "light" | "inherit";
export type HeadingAlign = "left" | "center" | "right";
export type HeadingWrap = "balance" | "pretty" | "stable" | "nowrap";

const VALID_ELEMENTS: readonly string[] = [
  "h1", "h2", "h3", "h4", "h5", "h6", "span", "div", "p",
];
const HEADING_ELEMENTS: readonly string[] = ["h1", "h2", "h3", "h4", "h5", "h6"];

/* `ValidElementsByVariant`. Note `body` is the only restricted variant: a body
 * -voice heading must still BE a heading element. `heading` and `display` accept
 * span/div/p as well, which is how the source lets a visual heading exist
 * without adding to the document outline. */
const VALID_ELEMENTS_BY_VARIANT: Record<string, readonly string[]> = {
  heading: VALID_ELEMENTS,
  display: VALID_ELEMENTS,
  body: HEADING_ELEMENTS,
};

const VALID_VARIANTS: readonly string[] = ["heading", "display", "body"];

const VALID_SIZES_BY_VARIANT: Record<string, readonly string[]> = {
  heading: ["1", "2", "3", "4", "5", "6"],
  display: ["1", "2", "3"],
  body: ["lg", "md", "sm"],
};

/* `heading` is deliberately absent — it derives its default from the element. */
const DEFAULT_SIZE_BY_VARIANT: Record<string, string> = {
  display: "2",
  body: "md",
};

const HEADING_ELEMENT_TO_SIZE: Record<string, string> = {
  h1: "1", h2: "2", h3: "3", h4: "4", h5: "5", h6: "6",
};

const VALID_COLORS: readonly string[] = ["primary", "dark", "light", "inherit"];
const VALID_ALIGNS: readonly string[] = ["left", "center", "right"];
const VALID_WRAPS: readonly string[] = ["balance", "pretty", "stable", "nowrap"];

/** Mirrors the `ValidElements.Contains(Element) ? … : "h2"` line: an unknown
 *  element is silently replaced, not an error. */
export function resolveElement(element: string | undefined): string {
  const lower = (element ?? "h2").toLowerCase();
  return VALID_ELEMENTS.includes(lower) ? lower : "h2";
}

/** Same silent-fallback shape for the variant. */
export function resolveVariant(variant: string | null | undefined): string {
  const lower = (variant ?? "").toLowerCase();
  return VALID_VARIANTS.includes(lower) ? lower : "heading";
}

/** `variant` and `element` must already be resolved. Mirrors
 *  `HeadingTagHelper.ResolveSize` exactly, including the three tiers and the
 *  `"h2"` fallback for a heading-variant span/div/p. */
export function resolveSize(
  variant: string,
  element: string,
  size: string | null | undefined,
): string | null {
  if (size != null) {
    const lower = size.toLowerCase();
    if (VALID_SIZES_BY_VARIANT[variant]?.includes(lower)) return lower;
  }
  if (variant in DEFAULT_SIZE_BY_VARIANT) return DEFAULT_SIZE_BY_VARIANT[variant];
  if (variant === "heading") return HEADING_ELEMENT_TO_SIZE[element] ?? "2";
  return null;
}

/** `ValidElementsByVariant` gate — true when the pair is legal. */
export function elementAllowedForVariant(variant: string, element: string): boolean {
  const allowed = VALID_ELEMENTS_BY_VARIANT[variant];
  return allowed ? allowed.includes(element) : true;
}

export type HeadingAxes = {
  variant: string;
  size: string | null;
  color?: string | null;
  align: string;
  wrap: string;
};

/** The `data-*` block, in the source's own order. `data-variant` is always
 *  written; the other three are gated on validity and simply absent when the
 *  value is unknown — the same silent-drop behaviour `ButtonHelper` has. */
export function headingAttributes({
  variant,
  size,
  color,
  align,
  wrap,
}: HeadingAxes): Record<string, string> {
  const attrs: Record<string, string> = { "data-variant": variant };
  if (size != null) attrs["data-size"] = size;
  if (color != null && VALID_COLORS.includes(color.toLowerCase())) {
    attrs["data-color"] = color.toLowerCase();
  }
  if (VALID_ALIGNS.includes(align.toLowerCase())) {
    attrs["data-align"] = align.toLowerCase();
  }
  if (VALID_WRAPS.includes(wrap.toLowerCase())) {
    attrs["data-wrap"] = wrap.toLowerCase();
  }
  return attrs;
}

/** Mirrors the class merge: `"Heading"`, or `"Heading <existing>"`. */
export function headingClassName(extra?: string): string {
  return extra && extra.trim() ? `Heading ${extra}` : "Heading";
}

/* ── Highlight ─────────────────────────────────────────────────────────────
 *
 * `ApplyHighlight` splits `text` on a capturing alternation of the comma-
 * separated `highlight` terms, longest first (so "code review" wins over
 * "code"), case-insensitively, and wraps each matching fragment in `<mark>`.
 *
 * Reproduced with one deliberate correction. The source tests each fragment
 * with `regex.IsMatch(part)`, which is a SUBSTRING test, not an equality test —
 * so a non-matching fragment that merely *contains* a term also gets marked.
 * With `.Split` on a capturing group that cannot normally happen, because the
 * separators are removed from the surrounding fragments; but it does happen for
 * overlapping terms. Here the capture groups are identified positionally (odd
 * indices are captures), which is exact. See findings.
 */
export type HighlightFragment = { text: string; marked: boolean };

export function splitHighlight(text: string, highlight: string | null | undefined): HighlightFragment[] {
  const words = (highlight ?? "")
    .split(",")
    .map((w) => w.trim())
    .filter((w) => w.length > 0);

  if (words.length === 0) return [{ text, marked: false }];

  const pattern = words
    .slice()
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp)
    .join("|");

  const regex = new RegExp(`(${pattern})`, "gi");
  const parts = text.split(regex);

  /* `String.prototype.split` with one capture group yields
     [before, capture, between, capture, …] — odd indices are the captures. */
  return parts
    .map((part, i) => ({ text: part, marked: i % 2 === 1 }))
    .filter((f) => f.text.length > 0);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
