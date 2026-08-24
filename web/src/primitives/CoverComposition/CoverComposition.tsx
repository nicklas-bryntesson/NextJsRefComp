/* CoverComposition.tsx — port of `Views/Shared/Partials/_CoverComposition.cshtml`.
 *
 * THERE IS NO TAGHELPER, and unlike CircleDiagram the derivation was expensive.
 * The contract had to be assembled from three disagreeing sources:
 *
 *   1. `_CoverComposition.cshtml`   — two variants, image and video, with
 *                                     DIFFERENT inner structure (see below)
 *   2. `CoverComposition.css`       — selectors for parts the Razor never emits
 *   3. `CoverCompositionVideo.ts`   — a 7-state machine that INJECTS two of the
 *                                     parts the CSS styles
 *
 * and the file's own header comment names a third set of class names
 * (`.CoverComposition-videoControls`, `.CoverComposition-media`) that neither
 * the CSS nor the JS nor the Razor uses. Confidence: MEDIUM. Every derived
 * decision is marked `DERIVED:` below. See findings/primitives-orphans.md O-02.
 *
 * THE STRUCTURAL DISAGREEMENT, reproduced verbatim in step 1 and fixed in step 2:
 * the video variant's inner wrapper is `<div class="content">`; the IMAGE
 * variant's is a bare `<div>` with no class. `.content-container` sets
 * `pointer-events: none` and `.content` is the only rule that restores `auto`,
 * so in the source the image variant's CTA buttons are NOT CLICKABLE. Measured,
 * not inferred — O-03.
 */

import type { ReactNode } from "react";
import "./CoverComposition.css";

export type CoverCompositionProps = {
  title: string;
  preamble?: string;
  /** Source: `app-picture` output. We take the resolved `src`/`alt` directly —
   *  the Picture TagHelper is not in this port's scope. */
  imageSrc: string;
  imageAlt?: string;
  /** Source: `ViewData["headingLevel"]`, default `"h2"`, `"h1"` from Home/Site. */
  headingLevel?: "h1" | "h2" | "h3";
  /** Source: `ViewData["cta"]`, rendered inside `<div class="link-group">`. */
  actions?: ReactNode;
};

export function CoverComposition({
  title,
  preamble,
  imageSrc,
  imageAlt,
  headingLevel = "h2",
  actions,
}: CoverCompositionProps) {
  const Heading = headingLevel;

  return (
    /* DERIVED: the image variant in the source has NO `grid-container` class,
       while the video variant does. Since `.CoverComposition`'s base rule is
       only `position: relative`, the image variant is not a grid at all in the
       source, so `.content-container`'s `grid-template-columns` and every
       `grid-row` / `grid-column` in the media queries are inert on it. Kept as
       found in step 1 — this is one of the two reasons the image variant does
       not lay out (O-03). */
    <div className="CoverComposition">
      <div className="media-container" role="presentation">
        {/* STEP 2 ADDITION, and it is an accessibility fix rather than a restyle.
            The source emits `<span class="overlay">` in the VIDEO variant only, so
            the image variant overlays display-size content on an arbitrary CMS
            image with NO SCRIM. Nothing about the resulting contrast is knowable,
            let alone AA — an editor uploading a light photo produces near-white
            text on near-white ground, and neither the stylesheet nor axe (which
            sees only the CSS background, not the image pixels) can catch it.
            With the scrim, the on-media ink measures 5.09:1 over pure-white media
            and 16.91:1 over pure-black — so it clears AA over ANY image, which is
            the only claim worth making about media a component does not control.
            O-32. */}
        <span className="overlay" />
        {/* eslint-disable-next-line @next/next/no-img-element -- the source emits
            a plain <picture>/<img> from app-picture with pre-resolved Umbraco
            crops; routing it through next/image would change the markup contract
            this port exists to measure. */}
        <img src={imageSrc} alt={imageAlt ?? ""} loading="eager" />
      </div>

      <div className="content-container">
        {/* STEP 2 FIX. The source emits a bare `<div>` here while the video
            variant emits `<div class="content">`, so the image variant got none
            of `.content`'s flex layout, none of its `gap`, and — because
            `.content-container` sets `pointer-events: none` and `.content` is the
            only rule that restores it — NON-CLICKABLE CTA BUTTONS. Measured on
            the step-1 baseline: `pointer-events: none` on this element and every
            descendant. The class is added here AND `.content-container > *`
            restores pointer events in the stylesheet, so a host that copies the
            source's markup is also covered. O-03. */}
        <div className="content">
          <Heading className="CoverComposition-heading">{title}</Heading>
          {preamble ? (
            <div className="Prose">
              <p>{preamble}</p>
            </div>
          ) : null}
          {actions ? (
            <div className="link-group flex flex-wrap gap-sm">{actions}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
