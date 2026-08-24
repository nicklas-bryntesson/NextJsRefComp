/* MediaFigure.tsx — the JSX half of `MediaHelper.BuildFigureHtml`.
 *
 * Upstream this is one static that returns a string. Here it splits in two:
 * `mediaHelper.ts` holds the preset table and the srcset algebra (pure data,
 * testable without a DOM), and this file holds the tree. The split exists
 * because React does not build markup by concatenation, and that difference has
 * two consequences worth stating rather than glossing:
 *
 * 1. `HtmlEncoder.Default.Encode(altText)` disappears. React escapes every
 *    interpolated value, so the encode is not merely unnecessary, it would
 *    double-encode. More interesting is what the source encodes and what it
 *    does NOT: `altText` is encoded, and the crop URLs interpolated straight
 *    into `srcset="…"` are not. See findings.
 * 2. `SuppressOutput()` becomes `return null`, and the dev-only error box
 *    becomes a `process.env.NODE_ENV` branch. Same behaviour, and Next.js
 *    inlines the constant so the error markup is dead-code-eliminated from a
 *    production bundle — which the Razor version, being a runtime check, is not.
 *
 * WHY THE CLASS NAMES ARE PARAMETERS. `BuildFigureHtml` takes `figureClass`
 * (default `"Media"`) and `pictureClass` (default `"Media-picture"`), and both
 * upstream callers use them differently: `PictureTagHelper` takes the defaults,
 * `TeaserTagHelper` passes `figureClass: "MediaContainer", pictureClass:
 * "Media"`. So `.Media` names the FIGURE for one caller and the PICTURE for the
 * other, and `Media.css`'s `img` rules — scoped to `.Media-picture` — do not
 * apply to a Teaser at all. Reproduced faithfully; measured; recorded.
 */

import "./Media.layered.css";
import {
  joinClasses,
  resolveGroup,
  umbracoCropUrl,
  type CropUrlResolver,
  type Loading,
  type MediaImage,
  type PictureGroup,
  type PicturePreset,
} from "./mediaHelper";
import { cx, figureUtilities, pictureUtilities } from "./pictureUtilities";

export type MediaFigureProps = {
  image: MediaImage;
  preset: PicturePreset;
  /** Source parameter `altText`. Always a string upstream, because the
   *  TagHelper collapses a missing `alt` to `""`. */
  altText: string;
  /** Overrides `preset.loading` when provided. */
  loading?: Loading;
  /** Appended to the figure's class list. */
  extraClass?: string;
  /** Base class on the figure. Source default `"Media"`. */
  figureClass?: string;
  /** Base class on each picture. Source default `"Media-picture"`. */
  pictureClass?: string;
  /** The Umbraco `GetCropUrl` seam. See mediaHelper.ts. */
  cropUrl?: CropUrlResolver;
};

export function MediaFigure({
  image,
  preset,
  altText,
  loading,
  extraClass,
  figureClass = "Media",
  pictureClass = "Media-picture",
  cropUrl = umbracoCropUrl,
}: MediaFigureProps) {
  const resolvedLoading = loading ?? preset.loading;

  return (
    /* STEP 3. The structural class names stay first and unchanged — they are the
       part identity and the only thing a consumer's stylesheet can select on.
       The utilities that follow are what `:where(figure.Media)` used to be,
       resolved here because a utility cannot be contingent on the class name the
       caller chose. See pictureUtilities.ts. */
    <figure
      className={cx(
        joinClasses(figureClass, preset.figureCssClass, extraClass),
        figureUtilities(figureClass),
      )}
    >
      {preset.groups.map((group, i) => (
        <MediaPictureGroup
          /* Presets are a fixed table, so the index IS the stable identity —
             group 0 of `teaser` is always StackedSources. */
          key={group.cssClass ?? i}
          group={group}
          image={image}
          loading={resolvedLoading}
          altText={altText}
          pictureClass={pictureClass}
          cropUrl={cropUrl}
        />
      ))}
    </figure>
  );
}

/** Mirrors `MediaHelper.RenderPictureGroup`. */
function MediaPictureGroup({
  group,
  image,
  loading,
  altText,
  pictureClass,
  cropUrl,
}: {
  group: PictureGroup;
  image: MediaImage;
  loading: Loading;
  altText: string;
  pictureClass: string;
  cropUrl: CropUrlResolver;
}) {
  const { sources, imgSrc, imgSrcSet, imgSizes, imgWidth, imgHeight } = resolveGroup(
    group,
    image,
    cropUrl,
  );

  /* STEP 3. Same contingency as the figure: `:where(.Media-picture)` styled the
     picture AND its img, and neither applies when the caller renamed the class. */
  const utils = pictureUtilities(pictureClass);

  return (
    <picture className={cx(joinClasses(pictureClass, group.cssClass), utils.picture)}>
      {sources.map((s, i) => (
        /* The key is the (type, media, ordinal) triple, which is exactly what
           distinguishes one <source> from another in a group. */
        <source
          key={`${s.type ?? "original"}|${s.media ?? ""}|${i}`}
          type={s.type}
          media={s.media}
          srcSet={s.srcSet}
          sizes={s.sizes}
          /* STEP 2. Per-breakpoint reserved box. `hero` runs 4:5 → 3:4 → 16:9 →
             21:9, so a single ratio on the <img> would be wrong at three of four
             viewports; `width`/`height` on <source> is the only markup that can
             say "this breakpoint has this shape". Absent when the preset
             declares no aspectRatio, so the attribute is never a guess. */
          width={s.width}
          height={s.height}
        />
      ))}
      {/* Under art direction the source deliberately emits NO srcset/sizes on the
          <img>, so the media-scoped <source> rules are the only selector. Under
          resolution switching it emits both. `resolveGroup` decides; both
          branches are one JSX element because `undefined` props are omitted —
          which is the same "absent, not empty" contract CLAUDE.md requires of
          data-* booleans. */}
      {/* NO `eslint-disable` NEEDED HERE, AND THAT IS ITSELF EVIDENCE.
          `@next/next/no-img-element` — the rule whose whole purpose is to steer
          you to `next/image` — opens with an explicit exemption:

            if (node.parent?.parent?.openingElement?.name?.name === 'picture')
              return;

          Next's own tooling concedes the `<picture>` case, because `next/image`
          renders a bare `<img>` and cannot express art direction. Corroborates
          the port's verdict from the framework's side. See findings.

          Note the exemption is LEXICAL — it reads the immediate JSX parent — so
          extracting this `<img>` into its own component would make the rule fire
          on markup that is still inside a `<picture>` at runtime. Which is why
          it stays inlined here. */}
      <img
        className={utils.img || undefined}
        src={imgSrc}
        srcSet={imgSrcSet}
        sizes={imgSizes}
        /* STEP 2. The floor: the last source's crop, which is where `src` comes
           from. A matching <source> overrides it. */
        width={imgWidth}
        height={imgHeight}
        alt={altText}
        loading={loading}
        decoding="async"
      />
    </picture>
  );
}
