/* Prose.tsx — port of `TagHelpers/ProseTagHelper.cs` (`app-prose`).
 *
 * The container for markup this component does not own: RTE output, markdown,
 * CMS fields. Every selector in `Prose.css` is wrapped in `:where()` so the
 * whole stylesheet has ZERO specificity — a block component dropped inside
 * Prose overrides it with a single class and no `!important`. That is the whole
 * design idea, and it is also why Prose is the interesting Tailwind case: it
 * styles elements it never renders. See findings/primitives-Prose.md.
 *
 * A Server Component, no client JS. The source's `Content` property is an
 * `IHtmlContent` alternative to child content — in React both are `children`,
 * so the two branches collapse into one (`rawHtml` is offered separately for the
 * genuine CMS-string case).
 */

import type { ReactNode } from "react";
import "./Prose.css";
import {
  proseAttributes,
  proseClassName,
  resolveProseElement,
  validateProseSize,
  validateProseVariant,
  type ProseElement,
  type ProseSize,
  type ProseVariant,
} from "./proseAttributes";
import { hasContent } from "../Button/hasContent";

export type ProseProps = {
  /** Source default `"div"`. Unknown values silently become `div`. */
  element?: ProseElement;
  /** Source default `"default"`. Unknown values render a dev error. */
  variant?: ProseVariant;
  /** Source default `"md"`. Unknown values render a dev error. */
  size?: ProseSize;
  /** The React analogue of the source's `IHtmlContent Content` property: a
   *  pre-rendered HTML string from a CMS. Mutually exclusive with `children`,
   *  as in the source (`hasContent` wins there). Trusted input only — this is
   *  `dangerouslySetInnerHTML`, and the source's `IHtmlContent` is exactly as
   *  unescaped. */
  rawHtml?: string;
  className?: string;
  children?: ReactNode;
};

export function Prose({
  element = "div",
  variant = "default",
  size = "md",
  rawHtml,
  className,
  children,
}: ProseProps) {
  const hasRaw = rawHtml != null;
  const hasChild = hasContent(children);

  /* `output.SuppressOutput()` when there is nothing to wrap. */
  if (!hasRaw && !hasChild) return null;

  const resolvedVariant = validateProseVariant(variant);
  if (resolvedVariant == null) {
    return (
      <ProseError message={`invalid variant "${variant}" — expected basic | default | rich`} />
    );
  }

  const resolvedSize = validateProseSize(size);
  if (resolvedSize == null) {
    return <ProseError message={`invalid size "${size}" — expected sm | md | lg`} />;
  }

  const Tag = resolveProseElement(element) as ProseElement;
  const attrs = proseAttributes(resolvedVariant, resolvedSize);

  /* `hasContent` wins over child content in the source, so `rawHtml` does here.
     The two cannot be merged: `dangerouslySetInnerHTML` and `children` are
     mutually exclusive in React by construction, which is a stricter contract
     than the source's (it would silently drop the children). */
  if (hasRaw) {
    return (
      <Tag
        className={proseClassName(className)}
        {...attrs}
        dangerouslySetInnerHTML={{ __html: rawHtml! }}
      />
    );
  }

  return (
    <Tag className={proseClassName(className)} {...attrs}>
      {children}
    </Tag>
  );
}

/* `RenderError`. Same shape as Heading's, and note that the source's Prose
 * version is louder — a red 2px border and the message rendered as visible text,
 * where Heading's shows only a `×`. Reproduced. */
function ProseError({ message }: { message: string }) {
  if (process.env.NODE_ENV === "production") return null;
  return (
    <div style={{ color: "red", border: "2px solid red", padding: "0.5rem" }}>
      <span>&times; app-prose: {message}</span>
    </div>
  );
}
