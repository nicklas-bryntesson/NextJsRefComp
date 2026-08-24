/* Picture.kitchensink.tsx — the inspection surface for the Razor Picture port.
 *
 * Everything here is Server Components. There is nothing to hydrate: the whole
 * component family is markup, and every choice the browser makes — format,
 * width, art-direction breakpoint — it makes from that markup with no script.
 *
 * HOW TO READ THE IMAGES. gen-media.cjs encodes the negotiation into the pixels,
 * so what the browser picked is visible rather than merely asserted:
 *   crop alias  → gradient hue and aspect ratio. Resize the hero and BOTH change
 *                 at 21.25rem / 48rem / 64rem. That is HTML art direction, and
 *                 it is the guarantee `next/image` cannot express.
 *   width step  → white marker boxes along the top edge. One box = the narrowest
 *                 candidate, two = the next, three = the widest.
 *   media item  → the colour of the bottom-left block.
 * The machine-readable version is `img.currentSrc`, which
 * tasks/probes/picture-negotiate.cjs reads.
 *
 * WIDTH CONSTRAINTS ON THE DEMOS ARE DEMO CHROME, NOT COMPONENT STYLING.
 * `Media.css` gives the img `width: 100%` and bounds nothing above it, so an
 * unconstrained figure fills whatever it is given and a `hero` inside a
 * shrink-to-fit ancestor reaches for its 1280 px max-content. Every demo below
 * sits in a `w-[…] max-w-full` box for that reason, which is the same thing the
 * consuming component does upstream (Teaser.css owns `.MediaContainer`).
 */

import { Block, Cell, Section } from "@/components/kitchensink-ui";
import { MediaFigure } from "./MediaFigure";
import { Picture } from "./Picture";
import { ATRIUM, LATTICE, MISSING, ORCHARD, staticCropUrl } from "./Picture.fixtures";
import { PRESETS } from "./mediaHelper";

/** Every demo passes the same resolver. Extracted so the noise stays in one
 *  place and the props under test are the ones that vary. */
const cropUrl = staticCropUrl;

export function PictureKitchensink() {
  return (
    <>
      {/* ── 1. Presets ─────────────────────────────────────────── */}
      <Section id="picture-presets" title="Presets">
        <Block title="preset=&quot;hero&quot; — one picture, HTML art direction, 4 crops, loading=eager">
          <Cell caption="four media-scoped source triplets; the img carries a bare src">
            <div data-id="picture-hero" className="w-[52rem] max-w-full min-w-0">
              <Picture
                image={ORCHARD}
                preset="hero"
                alt="A low sun through the rows of a walled orchard"
                cropUrl={cropUrl}
              />
            </div>
          </Cell>
        </Block>

        <Block title="preset=&quot;teaser&quot; — TWO pictures, container-query driven, loading=lazy">
          <Cell caption="StackedSources (3:2) and HorizontalSources (1:1) both render; the consuming component picks">
            <div data-id="picture-teaser" className="w-[26rem] max-w-full min-w-0">
              <Picture
                image={ATRIUM}
                preset="teaser"
                alt="The glass atrium of a converted warehouse, seen from the mezzanine"
                cropUrl={cropUrl}
              />
            </div>
          </Cell>
        </Block>
      </Section>

      {/* ── 2. The alt axis ───────────────────────────────────── */}
      <Section id="picture-alt" title="Alt handling — informative, decorative, and omitted">
        <Block title="The three cases, of which the source can only distinguish two">
          <Cell caption='alt="…" — informative. Announced, role graphic.'>
            <div data-id="picture-alt-informative" className="w-[16rem] max-w-full min-w-0">
              <Picture
                image={LATTICE}
                preset="teaser"
                alt="Concrete lattice screening a stairwell"
                cropUrl={cropUrl}
              />
            </div>
          </Cell>
          <Cell caption='alt="" — decorative on purpose. Skipped by AT.'>
            <div data-id="picture-alt-decorative" className="w-[16rem] max-w-full min-w-0">
              <Picture image={LATTICE} preset="teaser" alt="" cropUrl={cropUrl} />
            </div>
          </Cell>
          {/* This is the defect, rendered so it can be measured rather than
              described. `Alt` is `string?` and the helper receives `Alt ?? ""`,
              so an omitted alt is INDISTINGUISHABLE from a deliberate `alt=""`
              in the emitted markup. axe passes it; atomica11y's
              decorative-image-icon criteria pass it; a screen reader skips a
              content image. See findings. */}
          <Cell caption="alt omitted entirely — emits the SAME alt=&quot;&quot;. Indistinguishable.">
            <div data-id="picture-alt-omitted" className="w-[16rem] max-w-full min-w-0">
              <Picture image={LATTICE} preset="teaser" cropUrl={cropUrl} />
            </div>
          </Cell>
        </Block>
      </Section>

      {/* ── 3. The loading override ───────────────────────────── */}
      <Section id="picture-loading" title="Loading — the preset default and its override">
        <Block title="Each preset carries a default; the attribute overrides it">
          <Cell caption='teaser default = lazy'>
            <div data-id="picture-loading-default" className="w-[14rem] max-w-full min-w-0">
              <Picture image={ATRIUM} preset="teaser" alt="Atrium, lazily loaded" cropUrl={cropUrl} />
            </div>
          </Cell>
          <Cell caption='loading="eager" overriding a lazy preset'>
            <div data-id="picture-loading-eager" className="w-[14rem] max-w-full min-w-0">
              <Picture
                image={ATRIUM}
                preset="teaser"
                alt="Atrium, eagerly loaded"
                loading="eager"
                cropUrl={cropUrl}
              />
            </div>
          </Cell>
          <Cell caption='loading="lazy" overriding the eager hero preset'>
            <div data-id="picture-loading-lazy-hero" className="w-[14rem] max-w-full min-w-0">
              <Picture
                image={ORCHARD}
                preset="hero"
                alt="Orchard, hero preset forced lazy"
                loading="lazy"
                cropUrl={cropUrl}
              />
            </div>
          </Cell>
        </Block>
      </Section>

      {/* ── 4. The class parameterisation ─────────────────────── */}
      <Section
        id="picture-classes"
        title="Class parameterisation — what Media.css does and does not reach"
      >
        <Block title="BuildFigureHtml's figureClass / pictureClass, as its two upstream callers use them">
          <Cell caption="PictureTagHelper's defaults: figure .Media, picture .Media-picture">
            <div data-id="picture-classes-default" className="w-[15rem] max-w-full min-w-0">
              <MediaFigure
                image={LATTICE}
                preset={PRESETS.teaser}
                altText="Lattice, default class names"
                cropUrl={cropUrl}
              />
            </div>
          </Cell>
          {/* TeaserTagHelper's call. `.Media` now names the PICTURE, so
              `:where(.Media-picture) img { width: 100% }` matches nothing and
              the img falls back to its intrinsic width. Measured; see findings. */}
          <Cell caption="TeaserTagHelper's: figure .MediaContainer, picture .Media — the img rules stop applying">
            <div data-id="picture-classes-teaser" className="w-[15rem] max-w-full min-w-0 overflow-hidden">
              <MediaFigure
                image={LATTICE}
                preset={PRESETS.teaser}
                altText="Lattice, Teaser class names"
                figureClass="MediaContainer"
                pictureClass="Media"
                cropUrl={cropUrl}
              />
            </div>
          </Cell>
          <Cell caption="className on app-picture, appended to the figure">
            <div data-id="picture-classes-extra" className="w-[15rem] max-w-full min-w-0">
              <Picture
                image={LATTICE}
                preset="teaser"
                alt="Lattice with an extra figure class"
                className="demo-extra-class"
                cropUrl={cropUrl}
              />
            </div>
          </Cell>
        </Block>
      </Section>

      {/* ── 5. Validation ────────────────────────────────────── */}
      <Section id="picture-validation" title="Validation — the dev-only error box">
        <Block title="Both branches render a red box in development and nothing in production">
          <Cell caption="image absent (an editor deleted the media item)">
            <div data-id="picture-error-no-image" className="min-w-0">
              <Picture image={null} preset="hero" alt="never rendered" cropUrl={cropUrl} />
            </div>
          </Cell>
          <Cell caption='preset="banner" — not in the table'>
            <div data-id="picture-error-bad-preset" className="min-w-0">
              <Picture image={ORCHARD} preset="banner" alt="never rendered" cropUrl={cropUrl} />
            </div>
          </Cell>
          <Cell caption="preset omitted — source default is &quot;&quot;, which is an error, not a fallback">
            <div data-id="picture-error-no-preset" className="min-w-0">
              <Picture image={ORCHARD} alt="never rendered" cropUrl={cropUrl} />
            </div>
          </Cell>
          {/* Not a validation failure upstream: `GetCropUrl` returns null, the
              helper coalesces to "", and `src=""` re-requests the current page.
              Here the URL is well-formed and simply 404s, which is the same
              user-visible outcome (a broken image) by a different route. */}
          <Cell caption="image present, crops missing — no error box, just a broken image">
            <div data-id="picture-error-missing-files" className="w-[12rem] max-w-full min-w-0">
              <Picture
                image={MISSING}
                preset="teaser"
                alt="A media item whose crops do not resolve"
                cropUrl={cropUrl}
              />
            </div>
          </Cell>
        </Block>
      </Section>

      {/* ── 6. Live ──────────────────────────────────────────── */}
      <Section id="picture-live" title="Live — the CLS target">
        <Block title="The instance tasks/probes/picture-cls.cjs reports against">
          {/* NOT `w-full`. It was, and it made this the only cell in the route
              with a residual reserved-height delta (+170 px) after step 2 — which
              read exactly like a component defect and was not one. `Block` lays
              its children out with `flex flex-wrap`, so a child is a
              shrink-to-fit flex item whose width is decided by its CONTENT;
              `w-full` then resolves against a width its own content produced.
              With images blocked the alt text sized the track to 373 px, with
              them loaded the images sized it to 770 px, and the probe read the
              difference as unreserved height. A definite width breaks the
              circularity. See findings. */}
          <Cell caption="what tasks/probes/picture-cls.cjs measures">
            <div data-id="picture-live" className="w-[48rem] max-w-full min-w-0">
              <Picture
                image={ORCHARD}
                preset="hero"
                alt="A low sun through the rows of a walled orchard"
                cropUrl={cropUrl}
              />
            </div>
          </Cell>
        </Block>
      </Section>
    </>
  );
}
