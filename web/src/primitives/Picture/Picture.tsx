/* Picture.tsx — port of `TagHelpers/PictureTagHelper.cs` (`app-picture`).
 *
 * The thin half of the port: validate, then delegate. Everything interesting is
 * in `mediaHelper.ts` and `MediaFigure.tsx`.
 *
 * A SERVER COMPONENT with zero client JS, which is the ideal CLAUDE.md asks for
 * and here it is unconditional: the source has no script at all. Every choice —
 * format, width, art-direction breakpoint — is made by the BROWSER from
 * declarative markup, not by JavaScript. That is the property this port is
 * measuring `next/image` against, and it is why the answer came out the way it
 * did (see findings): `next/image` is also markup-only in its output, but it can
 * only express the resolution-switching half.
 *
 * WHAT `output.TagName = null` MEANS. The TagHelper erases its own element and
 * emits the figure as raw content, so `<app-picture class="x">` puts `x` on the
 * FIGURE, not on a wrapper. `extraClass` carries that; there is no wrapper here
 * either, so `className` behaves identically.
 */

import {
  PRESETS,
  PRESET_NAMES,
  type CropUrlResolver,
  type Loading,
  type MediaImage,
} from "./mediaHelper";
import { MediaFigure } from "./MediaFigure";

export type PictureProps = {
  /** Source attribute `image` (`IPublishedContent? Image`). Required in effect —
   *  the source's first validation branch is `if (Image == null)`. Typed as
   *  possibly-absent so that branch stays reachable, because upstream this comes
   *  from `Umbraco.Media(guid)` and is genuinely null when an editor deletes a
   *  media item. */
  image?: MediaImage | null;
  /** Source attribute `preset`. Source default `""`, which matches no preset and
   *  therefore renders the error box — i.e. the source has no default preset and
   *  omitting it is an error, not a fallback. Reproduced. */
  preset?: string;
  /** Source attribute `alt`. Source type is `string?` and the helper receives
   *  `Alt ?? ""`, so OMITTING IT SILENTLY PRODUCES A DECORATIVE IMAGE. Kept
   *  optional to stay faithful; see findings for why that is the source's most
   *  consequential accessibility defect and what the alternative would cost. */
  alt?: string;
  /** Source attribute `loading` — "overrides preset default". */
  loading?: Loading;
  /** `<app-picture class="…">`, which lands on the figure. */
  className?: string;
  /** The Umbraco `GetCropUrl` seam. Not an upstream attribute: upstream the
   *  resolver IS `IPublishedContent.GetCropUrl`, available because the CMS is in
   *  process. Here it has to be injected. See mediaHelper.ts. */
  cropUrl?: CropUrlResolver;
};

export function Picture({ image, preset = "", alt, loading, className, cropUrl }: PictureProps) {
  /* ── Validate ─────────────────────────────────────────────── */

  if (image == null) return <PictureError message="image is required" />;

  const resolved = PRESETS[preset];
  if (!resolved) {
    return (
      <PictureError
        message={`unknown preset "${preset}" — expected: ${PRESET_NAMES.join(" | ")}`}
      />
    );
  }

  /* ── Build figure ─────────────────────────────────────────── */

  return (
    <MediaFigure
      image={image}
      preset={resolved}
      altText={alt ?? ""}
      loading={loading}
      extraClass={className}
      cropUrl={cropUrl}
    />
  );
}

/** Mirrors `PictureTagHelper.RenderError`: a red box in Development, nothing at
 *  all in production. The `_isDev` field is `env.IsDevelopment()`, resolved once
 *  per instance from DI; `process.env.NODE_ENV` is the same switch, and Next
 *  inlines it so this whole branch is eliminated from a production bundle.
 *
 *  The inline `style` is verbatim from the source. It is dev-only markup and the
 *  step-2 restyle deliberately left it alone — a debug affordance that looked
 *  like the design system would be worse at its job. */
function PictureError({ message }: { message: string }) {
  if (process.env.NODE_ENV === "production") return null;
  return (
    <div style={{ color: "red", border: "2px solid red", padding: "0.5rem" }}>
      {/* The source emits an HTML comment alongside the visible span so the
          message survives in `view-source` even when CSS hides the box. JSX
          cannot emit a comment node, and `dangerouslySetInnerHTML` for a debug
          string is a bad trade, so it is dropped. Recorded. */}
      <span>{`× app-picture: ${message}`}</span>
    </div>
  );
}
