/* Teaser.tsx — port of `TagHelpers/TeaserTagHelper.cs` (`app-teaser`).
 *
 * THE POINT OF THIS FILE. Teaser is the first component in the set that composes
 * other components rather than only computing attributes, so it is the test of
 * Findings.md F-039: "reference tiers compose by nesting *markup* — free at any
 * arity, with any attribute set — while React tiers can only compose by nesting
 * *components*, which forces each tier to fix its children's markup, arity and
 * attributes."
 *
 * The answer, stated here and measured in findings/primitives-Teaser.md:
 * **four of the five children are rendered as components, and the fifth is
 * inlined markup, and the difference between them is whether the child exposes a
 * `children` slot.**
 *
 *   Card        → <Card>          ✓ slot. The wrapper is a conditional element,
 *                                   which is EASIER in React than in Razor (the
 *                                   source has to use PreElement/PostElement).
 *   MediaFigure → <MediaFigure>   ✓ slot-free but fully parameterised: the source
 *                                   already passes `figureClass`/`pictureClass`,
 *                                   so the seam Teaser needs was already there.
 *   Prose       → <Prose>         ✓ slot. Teaser authors the <p>, exactly as the
 *                                   source does.
 *   LinkButton  → <LinkButton>    ✓ slot. The ScreenReaderText span goes inside
 *                                   `Button-text`, exactly as the source does.
 *   Heading     → <Heading> with  ✗ Teaser must HAND-AUTHOR `<a class="heading-link
 *                 INLINED markup    Teaser-link">`, because Heading's own `href`
 *                                   mode emits `class="heading-link"` and has no
 *                                   prop for a second class on that anchor. See
 *                                   the note at `TeaserHeading` below.
 *
 * So F-039's recommendation is confirmed from the other direction: a contract in
 * a component-owned-markup framework must specify SLOTS. Every child that had
 * one composed for free; the one that fixed its inner markup forced a copy.
 *
 * ── OTHER THINGS KEPT DELIBERATELY ─────────────────────────────────────────
 *
 * · THERE IS NO `className` PROP, AND THAT IS FAITHFUL. The source calls
 *   `output.Attributes.SetAttribute("class", "Teaser")`, which REPLACES an
 *   author's `class` rather than merging it — unlike `CardTagHelper`, which
 *   appends. Two conventions in one component set. Reproduced, and it matters
 *   for F-062: Teaser's root has no consumer override seam at all, before
 *   Tailwind is anywhere near it.
 * · A Server Component with zero client JS. Everything here is attribute
 *   computation and tree shape.
 * · `data-button` / `data-media` are written `"false"`, never omitted — see
 *   teaserAttributes.ts.
 */

import { createElement, type ReactNode } from "react";
import "./Teaser.layered.css";
import "./ScreenReaderText.layered.css";
import {
  CARD_FRAME,
  resolveTeaserElement,
  resolveTeaserFrame,
  teaserAttributes,
  validateTeaser,
  type TeaserElement,
  type TeaserFrame,
} from "./teaserAttributes";
import { Card } from "../Card/Card";
import { Heading } from "../Heading/Heading";
/* IMPORTED, NOT RE-TYPED — and the import is itself a finding.
 *
 * `HEADING_INNER` is the utility Heading's own step 3 puts on the `heading-link`
 * / `heading-text` element it renders (currently `"block"`, replacing the
 * `display: block` that `Heading.css` used to declare). Teaser hand-authors that
 * element, so without this it silently stopped being a block box — measured
 * 21.00px tall instead of 13.09px, with the design's cap-height text-box trim
 * inert on it. See the note at `TeaserHeading` and in Teaser.css.
 *
 * Importing it makes the coupling explicit and moves it into the type system's
 * line of sight: if Heading deletes the export, this file stops compiling
 * instead of quietly losing a declaration. That is the best available substitute
 * for the thing F-039 says is actually needed — a slot in Heading's contract. */
import { HEADING_INNER } from "../Heading/headingUtilities";
import { Prose } from "../Prose/Prose";
import { LinkButton } from "../Button/LinkButton";
import { MediaFigure } from "../Picture/MediaFigure";
import { PRESETS, type CropUrlResolver, type MediaImage } from "../Picture/mediaHelper";
import { hasContent } from "../Button/hasContent";
/* STEP 3 — the design values live here now. See teaserUtilities.ts for what
 * could NOT move and why: the two picture groups (MediaFigure applies one
 * `pictureClass` to both), the `<time>` in the body slot (markup Teaser never
 * sees), and the whole `@supports not (container-type: inline-size)` fallback
 * (half of it is the picture groups). */
import {
  CONTENT,
  CTA_PLACEMENT,
  cx,
  HEADING_PLACEMENT,
  LAYOUT,
  LINK_BASE,
  LINK_STRETCHED,
  MEDIA_FIGURE,
  TEASER_ROOT,
} from "./teaserUtilities";

export type TeaserProps = {
  /** Source `Image` (`IPublishedContent?`). Its presence is the `data-media`
   *  axis. */
  image?: MediaImage;
  /** Source `Alt`. Collapsed to `""` when absent, as the source does. */
  alt?: string;
  /** Source `Heading`. */
  heading?: string;
  /** Source `Href`. */
  href?: string;
  /** Source `Excerpt`. */
  excerpt?: string;
  /** Source default `false`. `true` requires `href` or the component renders the
   *  dev-only error box. */
  button?: boolean;
  /** Source default `"Read more"`. */
  buttonLabel?: string;
  /** Source default `"bordered"`. Allow-list; unknown values silently become
   *  `bordered`. */
  frame?: TeaserFrame;
  /** Source default `"article"`. Allow-list; unknown values silently become
   *  `article`. */
  element?: TeaserElement;
  /** The Umbraco `GetCropUrl` seam, threaded to `MediaFigure`. Not a source
   *  property — upstream it is a static call inside `MediaHelper`. */
  cropUrl?: CropUrlResolver;
  /** `output.GetChildContentAsync()` — rendered inside `.ContentContainer`,
   *  after the excerpt and before the CTA. */
  children?: ReactNode;
};

export function Teaser({
  image,
  alt,
  heading,
  href,
  excerpt,
  button = false,
  buttonLabel = "Read more",
  frame = "bordered",
  element = "article",
  cropUrl,
  children,
}: TeaserProps) {
  const hasChildContent = hasContent(children);
  const hasExcerpt = excerpt != null && excerpt.trim() !== "";
  const hasMedia = image != null;
  const hasHeading = heading != null && heading.trim() !== "";

  /* ── Guards ── the source's only hard guard, checked before either
     allow-list resolves. */
  const error = validateTeaser(button, href);
  if (error) {
    if (process.env.NODE_ENV === "production") return null;
    return <TeaserError message={error} />;
  }

  const resolvedFrame = resolveTeaserFrame(frame);
  const resolvedElement = resolveTeaserElement(element);

  /* `hasLink` is the source's own name for it. Note what it encodes: the heading
     is a stretched link ONLY when there is an href and NO CTA — because two
     links to the same place inside one card is a duplicated, and for the
     stretched-link overlay an unreachable, target. */
  const hasLink = href != null && href.trim() !== "" && !button;

  const teaser = createElement(
    /* `createElement`, not `const Tag = …; <Tag>`. React 19's compiler lint
       rejects a capitalised local used as a JSX tag with
       `react-hooks/static-components` — see the long note in `Card.tsx`. A
       TagHelper whose job includes choosing its own tag name has no JSX form. */
    resolvedElement,
    {
      /* `Teaser` stays on the element: it is the class `Teaser.css`'s residue
         still selects, the class a consumer's stylesheet selects, and the key
         the computed-style probe walks. */
      className: cx("Teaser", TEASER_ROOT),
      ...teaserAttributes({ button, hasMedia }),
    },
    <div className={cx("LayoutContainer", LAYOUT)}>
      {hasMedia && (
        /* The exact call the source makes. `MediaHelper.BuildFigureHtml` takes
           `figureClass` and `pictureClass` as parameters and Teaser is the
           caller that overrides both — so `.Media` names the PICTURE here and
           the FIGURE for `PictureTagHelper`. Reproduced; see MediaFigure.tsx. */
        <MediaFigure
          image={image}
          preset={PRESETS.teaser}
          altText={alt ?? ""}
          figureClass={cx("MediaContainer", MEDIA_FIGURE)}
          pictureClass="Media"
          cropUrl={cropUrl}
        />
      )}

      {hasHeading && (
        <TeaserHeading heading={heading} href={href} hasLink={hasLink} button={button} />
      )}

      {(hasExcerpt || hasChildContent || button) && (
        <div className={cx("ContentContainer", CONTENT)}>
          {hasExcerpt && (
            <Prose variant="basic" size="sm">
              <p>{excerpt}</p>
            </Prose>
          )}
          {children}
          {button && (
            <LinkButton
              href={href}
              emphasis="primary"
              size="sm"
              pill={false}
              className={CTA_PLACEMENT}
            >
              {buttonLabel}
              {/* The source appends the heading to the CTA's accessible name so
                  a screen-reader user hearing a list of "Read more" links can
                  tell them apart — WCAG 2.4.4. It goes INSIDE `Button-text`,
                  which is why it needs LinkButton's children slot rather than
                  its `ariaLabel` prop: `aria-label` would replace the visible
                  label instead of extending it, and would break 2.5.3
                  Label in Name. */}
              {hasHeading && (
                <span className="ScreenReaderText">{` about ${heading}`}</span>
              )}
            </LinkButton>
          )}
        </div>
      )}
    </div>,
  );

  /* ── The Card frame ──
   *
   * Upstream this is `output.PreElement.SetHtmlContent("<div class=\"Card\" …>")`
   * plus a matching `PostElement` — a raw open tag and a raw close tag, which
   * only works because Razor concatenates strings.
   *
   * In React it is an ordinary conditional wrapper, and this is the ONE place in
   * the port where the component model is strictly better: the source cannot
   * nest `<app-card>` here (a TagHelper cannot wrap its own output in another
   * TagHelper's output), so it hand-writes the Card's markup and its two
   * attributes, and the Card's real contract — validation, the forbidden-
   * combination set, the suppression rule, the error box — is bypassed
   * entirely. Composing the component gets all of it back for free. */
  const cardProps = CARD_FRAME[resolvedFrame];
  if (!cardProps) return teaser;

  return (
    <Card element="div" padding={cardProps.padding} border={cardProps.border ?? false} elevation={cardProps.elevation}>
      {teaser}
    </Card>
  );
}

/** THE ONE PLACE COMPOSITION FAILED, and the reason is precise.
 *
 *  The source emits, in `hasLink` mode:
 *
 *    <h2 class="Heading" data-variant="heading" data-size="4" …>
 *      <a class="heading-link Teaser-link" href="…">Title</a>
 *    </h2>
 *
 *  `<Heading href=… text=…>` renders that anchor with `class="heading-link"` and
 *  offers no way to add `Teaser-link` to it: `HeadingProps.className` lands on
 *  the ROOT, and there is no `linkClassName`. So Teaser cannot use Heading's
 *  own link mode — the second class is not decoration, it is the selector
 *  `Teaser.css` hangs the stretched-link `::after` off.
 *
 *  The escape is Heading's `children` slot, which accepts the anchor whole. It
 *  produces byte-identical DOM. What it costs:
 *
 *   1. **Teaser now authors `heading-link`, a class in Heading's lexicon.**
 *      `Heading.css` styles `.heading-link, .heading-text` (display, font-size,
 *      line-height, and the `:where(a, span, strong, em, b, i)` inheritance
 *      reset). If Heading ever renames that part — and upstream ADR-0026 is a
 *      live proposal to replace part *classes* with `data-part` — this heading
 *      silently loses its type size. Nothing in either component's types
 *      records the dependency.
 *   2. **Heading's `text` features become unreachable in this branch.** `text`
 *      and `children` are mutually exclusive by Heading's own guard, so the
 *      `highlight` prop (comma-separated terms wrapped in `<mark>`) cannot be
 *      used on a linked teaser heading. Upstream has the same limitation for a
 *      different reason, so this is faithful rather than a regression — but it
 *      is now enforced by a React guard rather than by a missing feature.
 *
 *  The non-linked branch has neither problem: it is `<Heading text=…>` and
 *  Heading emits its own `heading-text` span.
 *
 *  Reported, NOT fixed in Heading — a `linkClassName` prop there would solve it
 *  in one line and is exactly the kind of change the brief forbids a composing
 *  port from making. See findings for what a slot-shaped Heading contract would
 *  look like instead. */
function TeaserHeading({
  heading,
  href,
  hasLink,
  button,
}: {
  heading: string;
  href?: string;
  hasLink: boolean;
  /* STEP 3 — the stretched-link overlay was gated on the ROOT's
     `[data-button="false"]`, and a utility cannot be gated on an ancestor's
     attribute. So the gate becomes a decision made here, before rendering. */
  button: boolean;
}) {
  const axes = {
    element: "h2",
    variant: "heading",
    size: "4",
    align: "left",
    wrap: "balance",
    className: HEADING_PLACEMENT,
  } as const;

  if (hasLink) {
    return (
      <Heading {...axes}>
        <a
          className={cx(
            "heading-link",
            "Teaser-link",
            HEADING_INNER,
            LINK_BASE,
            !button && LINK_STRETCHED,
          )}
          href={href}
        >
          {heading}
        </a>
      </Heading>
    );
  }
  return <Heading {...axes} text={heading} />;
}

/* `RenderError`, reproduced including its inline styles: dev-only, and
 * `SuppressOutput()` in production. Next inlines `NODE_ENV`, so the box is
 * dead-code-eliminated from a production bundle — which means no gate this repo
 * runs can ever see it, the same note `Card.tsx` records. */
function TeaserError({ message }: { message: string }) {
  return (
    <div style={{ color: "red", border: "2px solid red", padding: "0.5rem" }}>
      {/* The source also emits an HTML comment carrying the same message. JSX has
          no comment node, so it becomes an attribute — greppable from a probe,
          which is strictly more useful. */}
      <span data-teaser-error={message}>{`× app-teaser: ${message}`}</span>
    </div>
  );
}
