/* CoverComposition.kitchensink.tsx — the inspection surface for both variants.
 *
 * SECTION TITLES ARE SHORT ON PURPOSE. The first draft used
 * `Video variant — data-component="CoverCompositionVideo"`, and
 * `data-component="CoverCompositionVideo"` is one unbreakable token rendered at
 * `text-display-md`: min-content 467px, which set the DOCUMENT width to 483px at
 * a 320px viewport — 163px of horizontal scroll, a WCAG 1.4.10 failure caused
 * entirely by the demo page's own prose while the component under test reflowed
 * perfectly. axe reported zero violations throughout. O-23.
 *
 * `Cell` and `Block` from the shared chrome are NOT used for the cover demos.
 * `Block` is a padded card with `flex-wrap` and `items-end`; `CoverComposition`
 * is a full-bleed hero whose whole contract is "fill the inline axis and put
 * content on top of media". Nesting it in a padded flex card measures the card,
 * not the component. `Section` is kept, because it carries `.kitchensink-section`
 * and the heading. Recorded in O-12 — the chrome is field-shaped and a
 * full-bleed component has to opt out of it, the same conclusion the Button port
 * reached for an intrinsically-sized one.
 */

import type { ReactNode } from "react";

import { Section } from "@/components/kitchensink-ui";
import { CoverComposition } from "./CoverComposition";
import { CoverCompositionVideo } from "./CoverCompositionVideo";

/* A local data: URI so the demo has no network dependency and the artifact CSP
 * has nothing to block: a 4:3 warm gradient standing in for an Umbraco crop. */
const IMAGE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900">
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#3a3730"/><stop offset="0.55" stop-color="#7a6a55"/>
        <stop offset="1" stop-color="#c9b79a"/></linearGradient></defs>
      <rect width="1600" height="900" fill="url(#g)"/>
      <g fill="none" stroke="#ffffff" stroke-opacity="0.14" stroke-width="2">
        ${Array.from({ length: 12 }, (_, i) => `<circle cx="${140 + i * 120}" cy="${300 + (i % 5) * 90}" r="${40 + (i % 4) * 26}"/>`).join("")}
      </g>
    </svg>`,
  );

function Frame({
  caption,
  children,
}: {
  caption: string;
  children: ReactNode;
}) {
  return (
    <div className="mb-xl grid min-w-0 gap-xxs">
      <span className="text-caption text-body">{caption}</span>
      <div className="min-w-0 overflow-hidden rounded-lg border border-hairline">
        {children}
      </div>
    </div>
  );
}

/* STEP 3. The demo CTA was the only rule set in `CoverComposition.css` with no
 * conditional behaviour and no override seam, and it converted cleanly — which is
 * the point. `--_on-media-ink` and `--_on-media-ground` are still read through
 * `var()` in arbitrary values, because there is no utility for "the appearance-
 * independent on-media pair"; the mechanism survives the conversion only because
 * a custom property can be referenced from an arbitrary value. Every structural
 * class name is kept. O-33. */
const CTA_BASE =
  "CoverComposition-demoCta inline-grid min-h-11 place-items-center rounded-md px-lg font-sans text-button font-medium no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--_on-media-ink)]";
const CTA_SOLID = "bg-primary text-on-primary";
const CTA_QUIET =
  "CoverComposition-demoCta--quiet border text-[var(--_on-media-ink)] bg-[color-mix(in_oklch,var(--_on-media-ground)_55%,transparent)] border-[color-mix(in_oklch,var(--_on-media-ink)_55%,transparent)]";

const ACTIONS = (
  <>
    <a className={`${CTA_BASE} ${CTA_SOLID}`} href="#cover-image">
      Get started
    </a>
    <a className={`${CTA_BASE} ${CTA_QUIET}`} href="#cover-image">
      Read the docs
    </a>
  </>
);

export function CoverCompositionKitchensink() {
  return (
    <>
      <Section id="cover-image" title="Image variant">
        <Frame caption="h1, preamble, two CTAs">
          <CoverComposition
            headingLevel="h1"
            title="Everything you need, on top of the picture"
            preamble="The overlay variant puts the content on a full-bleed media background once the container passes 21.25rem. Below that it stacks."
            imageSrc={IMAGE}
            imageAlt=""
            actions={ACTIONS}
          />
        </Frame>
        <Frame caption="title only — no preamble, no CTAs">
          <CoverComposition title="Title only" imageSrc={IMAGE} imageAlt="" />
        </Frame>
        <Frame caption="long preamble — the 50ch clamp on .Prose">
          <CoverComposition
            title="A considerably longer cover heading that has to wrap on narrow viewports"
            preamble="The stylesheet caps the prose at 50ch inside .content. This paragraph is long enough to prove the clamp is doing something, and long enough that at 320px it must still reflow without pushing the document sideways, which is the WCAG 1.4.10 question this whole route exists to answer."
            imageSrc={IMAGE}
            imageAlt=""
            actions={ACTIONS}
          />
        </Frame>
      </Section>

      <Section id="cover-video" title="Video variant">
        <Frame caption="autoplay=policy — plays when visible, unless reduced motion or a metered connection objects">
          <CoverCompositionVideo
            headingLevel="h2"
            title="The video variant arbitrates before it plays"
            preamble="Five policy blockers in the source: the autoplay attribute, prefers-reduced-motion, intersection visibility, Save-Data and effectiveType. data-video-state on the root reflects the result."
            videoSrc="/primitives-demo/cover.mp4"
            posterSrc={IMAGE}
            actions={ACTIONS}
          />
        </Frame>
        <Frame caption="autoplay=never — the toggle is the only way in">
          <CoverCompositionVideo
            title="Autoplay disabled"
            preamble="No policy arbitration runs at all; the state stays at ready until the user acts."
            videoSrc="/primitives-demo/cover.mp4"
            posterSrc={IMAGE}
            autoplay="never"
          />
        </Frame>
        <Frame caption="missing source — the error state (the 404 in the console is this cell, deliberately)">
          {/* The source's ERROR edge. A 404 on the <source> fires `error` on the
              <video>, and `data-video-state="error"` is the only signal; the
              poster stays up. Worth demonstrating because the state exists in the
              source's type union and nothing in the source app renders it. */}
          <CoverCompositionVideo
            title="Video that will not load"
            preamble="data-video-state settles on error and the poster carries the surface."
            videoSrc="/primitives-demo/does-not-exist.mp4"
            posterSrc={IMAGE}
          />
        </Frame>
      </Section>
    </>
  );
}
