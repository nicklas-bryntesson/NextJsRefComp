/* Heading.tsx — port of `TagHelpers/HeadingTagHelper.cs` (`app-heading`).
 *
 * A Server Component with no client JS: the source only computes attributes and
 * chooses an element, which is exactly what a React Server Component does. Same
 * shape as the Button family — see findings/primitives-Button.md on why the
 * Razor helper model and the RSC model are the same model.
 *
 * THE ONE STRUCTURAL SUBTLETY, and it is a source bug rather than a porting
 * choice: `Heading.css` puts `font-size` and `line-height` on `.heading-link,
 * .heading-text` — the wrapper the helper emits ONLY in `text` mode. In child-
 * content mode the source emits the children raw, so nothing carries the size
 * the `data-size` gate resolved. Reproduced verbatim in step 1 and measured; see
 * findings/primitives-Heading.md.
 */

import { Fragment, type ReactNode } from "react";
import "./Heading.layered.css";
import {
  elementAllowedForVariant,
  headingAttributes,
  headingClassName,
  resolveElement,
  resolveSize,
  resolveVariant,
  splitHighlight,
  type HeadingAlign,
  type HeadingColor,
  type HeadingElement,
  type HeadingVariant,
  type HeadingWrap,
} from "./headingAttributes";
import { hasContent } from "../Button/hasContent";
import {
  ALIGN,
  cx,
  DATA_COLOR,
  HEADING_INNER,
  HEADING_MARK,
  HEADING_ROOT,
  SIZE_METRICS,
  VARIANT_COLOR,
  VARIANT_VOICE,
  WRAP,
} from "./headingUtilities";

export type HeadingProps = {
  /** Source `text`. Mutually exclusive with `children`. */
  text?: string;
  /** Source `highlight` — comma-separated terms wrapped in `<mark>`. Requires
   *  `text`; there is no way to highlight inside child content. */
  highlight?: string;
  /** Source `href`. Requires `text`, forbids `children`. */
  href?: string;
  /** Source default `"h2"`. An unknown value silently becomes `h2`. */
  element?: HeadingElement;
  /** `1`–`6` for `heading`, `1`–`3` for `display`, `sm|md|lg` for `body`.
   *  An out-of-range value falls through to the variant's default. */
  size?: string;
  /** Source default (via silent fallback) `"heading"`. */
  variant?: HeadingVariant;
  /** Emitted as `data-color`. NOTE: `Heading.css` has no `[data-color]` rule in
   *  the source — the axis is inert there. Step 2 gives it meaning. */
  color?: HeadingColor;
  /** Source default `"left"`. */
  align?: HeadingAlign;
  /** Source default `"balance"`. `"nowrap"` is accepted by the helper and
   *  matched by no rule in the source stylesheet. */
  wrap?: HeadingWrap;
  className?: string;
  children?: ReactNode;
};

export function Heading({
  text,
  highlight,
  href,
  element = "h2",
  size,
  variant,
  color,
  align = "left",
  wrap = "balance",
  className,
  children,
}: HeadingProps) {
  const hasChildContent = hasContent(children);
  const hasText = Boolean(text);
  const hasHref = Boolean(href);

  /* ── Guards ── the source's three, in order. */

  /* `output.SuppressOutput()` — nothing to say, say nothing. */
  if (!hasText && !hasChildContent) return null;

  if (
    (hasText && hasChildContent) ||
    (hasHref && hasChildContent) ||
    (hasHref && !hasText)
  ) {
    return <HeadingError message="invalid combination of text, href, and child content" />;
  }

  const resolvedElement = resolveElement(element);
  const resolvedVariant = resolveVariant(variant);

  if (!elementAllowedForVariant(resolvedVariant, resolvedElement)) {
    return (
      <HeadingError
        message={`variant "${resolvedVariant}" does not allow element "${resolvedElement}"`}
      />
    );
  }

  const Tag = resolvedElement as HeadingElement;
  const resolvedSize = resolveSize(resolvedVariant, resolvedElement, size);
  const attrs = headingAttributes({
    variant: resolvedVariant,
    size: resolvedSize,
    color,
    align,
    wrap,
  });

  /* STEP 3. Everything below the `Heading` class is what the `[data-variant]`,
     `[data-size]`, `[data-color]`, `[data-align]` and `[data-wrap]` gates used to
     do. The attributes are still emitted — they are the documented API and a
     consumer's stylesheet still reads them — they just no longer drive the paint.

     Resolved HERE rather than emitted together, because a utility cannot
     override a utility: `text-ink` (the variant default) and `text-primary` (an
     explicit data-color) are one class each and Tailwind's stylesheet order would
     pick the winner. See headingUtilities.ts. */
  const colorClass =
    (attrs["data-color"] && DATA_COLOR[attrs["data-color"] as keyof typeof DATA_COLOR]) ||
    VARIANT_COLOR[resolvedVariant as keyof typeof VARIANT_COLOR];

  const metrics =
    resolvedSize == null
      ? undefined
      : (SIZE_METRICS[resolvedVariant as keyof typeof SIZE_METRICS] as Record<string, string>)[
          resolvedSize
        ];

  const inner = <HighlightedText text={text!} highlight={highlight} />;

  return (
    <Tag
      /* `Heading` stays first and unchanged — it is the part identity, and the
         residual stylesheet plus any consumer override still select on it. */
      className={headingClassName(
        cx(
          HEADING_ROOT,
          VARIANT_VOICE[resolvedVariant as keyof typeof VARIANT_VOICE],
          metrics,
          colorClass,
          attrs["data-align"] && ALIGN[attrs["data-align"] as keyof typeof ALIGN],
          attrs["data-wrap"] && WRAP[attrs["data-wrap"] as keyof typeof WRAP],
          className,
        ),
      )}
      {...attrs}
    >
      {hasChildContent ? (
        children
      ) : href ? (
        <a href={href} className={cx("heading-link", HEADING_INNER)}>
          {inner}
        </a>
      ) : (
        <span className={cx("heading-text", HEADING_INNER)}>{inner}</span>
      )}
    </Tag>
  );
}

/** `ApplyHighlight` as nodes rather than as a hand-encoded HTML string. React
 *  escapes each fragment for us, so the port cannot have the injection shape the
 *  source has to hand-guard against. */
function HighlightedText({ text, highlight }: { text: string; highlight?: string }) {
  if (!highlight) return <>{text}</>;
  return (
    <>
      {/* A non-marked fragment is a bare text node, exactly as the source emits
          it — NOT wrapped in a <span>. A wrapper would be caught by
          `.heading-text :where(span) { font: inherit }` and be harmless, but it
          would also change the DOM the computed-style probe walks. */}
      {splitHighlight(text, highlight).map((f, i) =>
        f.marked ? (
          <mark key={i} className={HEADING_MARK}>
            {f.text}
          </mark>
        ) : (
          <Fragment key={i}>{f.text}</Fragment>
        ),
      )}
    </>
  );
}

/* `RenderError`: a dev-only red `×`, suppressed entirely in production.
 *
 * The source puts the reason in an HTML comment. React has no comment node, so
 * the message moves to `data-heading-error`, which is strictly better — it is
 * greppable from a computed-style probe and visible in devtools without View
 * Source. The visible output (`×`, red) is identical. */
function HeadingError({ message }: { message: string }) {
  if (process.env.NODE_ENV === "production") return null;
  return (
    <div style={{ color: "red" }} data-heading-error={message}>
      <span>&times;</span>
    </div>
  );
}
