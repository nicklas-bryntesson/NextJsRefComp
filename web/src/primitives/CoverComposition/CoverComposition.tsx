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
 * decision is marked `DERIVED:` below. See findings/primitives-orphans.md F-065.
 *
 * THE STRUCTURAL DISAGREEMENT, reproduced verbatim in step 1 and fixed in step 2:
 * the video variant's inner wrapper is `<div class="content">`; the IMAGE
 * variant's is a bare `<div>` with no class. `.content-container` sets
 * `pointer-events: none` and `.content` is the only rule that restores `auto`,
 * so in the source the image variant's CTA buttons are NOT CLICKABLE. Measured,
 * not inferred — F-066.
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
       not lay out (F-066). */
    <div className="CoverComposition">
      <div className="media-container" role="presentation">
        {/* eslint-disable-next-line @next/next/no-img-element -- the source emits
            a plain <picture>/<img> from app-picture with pre-resolved Umbraco
            crops; routing it through next/image would change the markup contract
            this port exists to measure. */}
        <img src={imageSrc} alt={imageAlt ?? ""} loading="eager" />
      </div>

      <div className="content-container">
        {/* DERIVED / VERBATIM DEFECT: no `content` class here, exactly as the
            source. See the header and F-066. */}
        <div>
          <Heading className="CoverComposition-heading">{title}</Heading>
          {preamble ? (
            <div className="Prose">
              <p>{preamble}</p>
            </div>
          ) : null}
          {actions ? <div className="link-group">{actions}</div> : null}
        </div>
      </div>
    </div>
  );
}
