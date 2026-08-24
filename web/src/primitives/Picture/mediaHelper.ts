/* mediaHelper.ts — the React counterpart of `TagHelpers/MediaHelper.cs`.
 *
 * A shared static with no target element upstream, and the substantial half of
 * this port: the TagHelper is 60 lines of validation, this is the whole
 * negotiation contract. Two consumers upstream — `PictureTagHelper` and
 * `TeaserTagHelper` — which is why the class names are parameters (see below).
 *
 * WHAT THIS FILE PORTS AND WHAT `Picture.tsx` PORTS. `BuildFigureHtml` builds an
 * HTML **string** with a `StringBuilder`. React builds elements, so the tree
 * construction moves to `Picture.tsx` and this file keeps the parts that are
 * pure data: the preset table, the srcset algebra, and the crop-URL seam. That
 * split is not cosmetic — it deletes the source's manual `HtmlEncoder` call
 * (React escapes by default) and with it a real escaping asymmetry. See findings.
 *
 * THE CROP-URL SEAM. Upstream every URL comes from
 * `image.GetCropUrl(cropAlias, width, preferFocalPoint: true, furtherOptions:
 * "&format=…")` — an Umbraco extension method that needs a CMS. There is no CMS
 * here and no way to know the media host, so the resolver is a parameter with an
 * Umbraco-shaped default. `umbracoCropUrl` reproduces the query string Umbraco's
 * ImageSharp middleware answers; the kitchensink passes `staticCropUrl` instead
 * so the route works offline. This is the ONE place the port cannot be faithful,
 * and making it an argument is what keeps the rest of the file faithful.
 */

/* ── Records ──────────────────────────────────────────────────────────────── */

/** One source group within a picture element — one format triplet
 *  (avif/webp/original) at one breakpoint. Mirrors `record SourceDefinition`. */
export type SourceDefinition = {
  /** Umbraco crop alias. */
  cropAlias: string;
  /** srcset widths, e.g. `[400, 800]`. */
  widths: number[];
  /** `sizes` attribute, e.g. `"100%"` or `"100vw"`. */
  sizes: string;
  /** Media query for art direction; absent = resolution switching. */
  media?: string;
  /* ── STEP 2 ADDITION. Not in `record SourceDefinition`. ──────────────────
   *
   * The crop's aspect ratio, as `[w, h]`. It exists to fix the port's single
   * worst measured defect: with no dimensions anywhere, step 1 measured CLS
   * 0.253 (POOR) and 3998 px of unreserved height across 23 pictures.
   *
   * IT BELONGS ON THE SOURCE, NOT ON THE IMG, AND THAT IS THE WHOLE POINT.
   * Under art direction the crop CHANGES per breakpoint — `hero` runs 4:5 →
   * 3:4 → 16:9 → 21:9 — so one ratio on the `<img>` is right at one viewport and
   * wrong at the other three. HTML's answer is `width`/`height` on each
   * `<source>`, which is what this feeds. It is also the guarantee `next/image`
   * has no way to express at all: it renders one `<img>` and takes one
   * width/height pair.
   *
   * UPSTREAM THIS NEEDS NO NEW CMS DATA. `GetCropUrl(cropAlias, width, …)`
   * resolves the named crop, and an Umbraco crop definition carries its own
   * width and height. `MediaHelper` already knows the ratio implicitly — it
   * passes a width and lets the height follow — and simply does not emit it.
   * See findings: this is the port's principal upstream recommendation.
   *
   * Optional, and absent means "no reservation", so the extension is opt-in and
   * honest about the cases where the ratio genuinely is not known. */
  aspectRatio?: [number, number];
};

/** One picture element — one or more source definitions.
 *  Mirrors `record PictureGroup`. */
export type PictureGroup = {
  sources: SourceDefinition[];
  /** CSS class on the picture element, in addition to the base picture class. */
  cssClass?: string;
};

/** Full preset — what a single `<Picture>` call resolves to.
 *  Mirrors `record PicturePreset`. */
export type PicturePreset = {
  groups: PictureGroup[];
  /** Extra class on the figure. */
  figureCssClass?: string;
  loading: Loading;
};

export type Loading = "lazy" | "eager";

/** The media item. Upstream this is `IPublishedContent`, whose only relevant
 *  surface is what `GetCropUrl` reads: the media URL and (for
 *  `preferFocalPoint: true`) the focal point. Nothing in `MediaHelper` touches
 *  any other property, so the port models exactly that much. */
export type MediaImage = {
  /** `IPublishedContent.Url()` — the un-cropped media URL. */
  url: string;
  /** Umbraco's normalised focal point, both components 0–1. `GetCropUrl` is
   *  called with `preferFocalPoint: true`, so when the media item has one it
   *  wins over the crop's stored anchor. */
  focalPoint?: { left: number; top: number };
  /** The media item's own alt text, if the CMS stores one. NOT read by
   *  `MediaHelper` — `altText` is always passed in by the caller. Present so a
   *  consumer can default to it, which is the a11y improvement the source's
   *  `Alt ?? ""` makes impossible. See findings. */
  altText?: string;
};

/* ── Presets ──────────────────────────────────────────────────────────────── */

/** Mirrors `MediaHelper.Presets`. Verbatim in every field the source has: same
 *  aliases, same width ladders, same `sizes`, same media queries, same order.
 *  The order of `sources` inside a group is load-bearing — `<source>` is
 *  first-match-wins, so `mobile` must precede `portrait` or the wider
 *  `max-width` swallows the narrower.
 *
 *  `aspectRatio` is the one field the source does not have; see its declaration
 *  on `SourceDefinition`. Only `horizontal` (1:1) is evidenced by the source —
 *  Teaser.css declares it. The other five are the ratios the port's fixture set
 *  is generated at, and upstream they must come from the Umbraco crop
 *  definitions rather than from here. */
export const PRESETS: Readonly<Record<string, PicturePreset>> = {
  /* Two pictures, CSS/container-query driven visibility (Teaser responsive). */
  teaser: {
    loading: "lazy",
    groups: [
      {
        cssClass: "StackedSources",
        sources: [{ cropAlias: "stacked", widths: [400, 800], sizes: "100%", aspectRatio: [3, 2] }],
      },
      {
        cssClass: "HorizontalSources",
        /* 1:1 on the authority of Teaser.css: `.Media.HorizontalSources
           { aspect-ratio: 1 / 1 }`. The only ratio the source states. */
        sources: [{ cropAlias: "horizontal", widths: [320, 640], sizes: "12rem", aspectRatio: [1, 1] }],
      },
    ],
  },

  /* Single picture, HTML art direction via media queries. */
  hero: {
    loading: "eager",
    figureCssClass: "grid-container-full",
    groups: [
      {
        sources: [
          { cropAlias: "mobile", widths: [380, 760], sizes: "100vw", media: "(max-width: 21.24999rem)", aspectRatio: [4, 5] },
          { cropAlias: "portrait", widths: [440, 880], sizes: "100vw", media: "(max-width: 48rem)", aspectRatio: [3, 4] },
          { cropAlias: "mid", widths: [740, 1480], sizes: "100vw", media: "(max-width: 64rem)", aspectRatio: [16, 9] },
          { cropAlias: "wide", widths: [1280, 1512, 1728], sizes: "60vw", media: "(min-width: 64rem)", aspectRatio: [21, 9] },
        ],
      },
    ],
  },
};

/** The `width`/`height` pair to declare for one source, expressed at its
 *  narrowest candidate. Any consistent pair conveys the ratio — the browser uses
 *  it to reserve a box, not to size the image, because CSS then overrides both. */
export function dimensionsFor(
  source: SourceDefinition,
  width = source.widths[0],
): { width: number; height: number } | undefined {
  if (!source.aspectRatio) return undefined;
  const [rw, rh] = source.aspectRatio;
  return { width, height: Math.round((width * rh) / rw) };
}

/** `MediaHelper.Presets.Keys`, for the TagHelper's error message. */
export const PRESET_NAMES = Object.keys(PRESETS);

/* ── The crop-URL seam ────────────────────────────────────────────────────── */

export type CropFormat = "avif" | "webp" | null;

export type CropUrlResolver = (args: {
  image: MediaImage;
  cropAlias: string;
  width: number;
  format: CropFormat;
}) => string;

/** Mirrors `MediaHelper.CropUrl` — the default resolver, shaped like the URL
 *  Umbraco's `GetCropUrl(..., preferFocalPoint: true, furtherOptions:
 *  "&format=…")` produces for the ImageSharp middleware.
 *
 *  Reproduced rather than invented, because the shape is the contract a CDN
 *  answers: crop by alias, scale to `width`, anchor on the focal point. The
 *  source returns `?? ""` when Umbraco cannot resolve a crop, which yields
 *  `src=""` — a same-page re-request, not a no-op. Reproduced; recorded. */
export const umbracoCropUrl: CropUrlResolver = ({ image, cropAlias, width, format }) => {
  if (!image.url) return "";
  const params = new URLSearchParams({ cropalias: cropAlias, width: String(width) });
  if (image.focalPoint) {
    params.set("rxy", `${image.focalPoint.left},${image.focalPoint.top}`);
  }
  if (format) params.set("format", format);
  return `${image.url}?${params.toString()}`;
};

/** Mirrors `MediaHelper.BuildSrcset`. One `"<url> <w>w"` candidate per width,
 *  comma-joined, in declaration order. */
export function buildSrcset(
  source: SourceDefinition,
  image: MediaImage,
  format: CropFormat,
  cropUrl: CropUrlResolver = umbracoCropUrl,
): string {
  return source.widths
    .map((width) => `${cropUrl({ image, cropAlias: source.cropAlias, width, format })} ${width}w`)
    .join(", ");
}

/* ── Group resolution ─────────────────────────────────────────────────────── */

/** The three `<source>` elements one `SourceDefinition` expands to, in the
 *  source's order: avif, webp, then the original format with no `type`.
 *
 *  This is DECLARATIVE format negotiation — the browser picks the first `type`
 *  it can decode, and the untyped third is the floor. It is the guarantee
 *  `next/image` cannot express, because `next/image` renders a bare `<img>` and
 *  negotiates format server-side from the `Accept` header instead. See findings. */
export type ResolvedSource = {
  type?: "image/avif" | "image/webp";
  media?: string;
  srcSet: string;
  sizes: string;
  /** STEP 2. `width`/`height` on a `<source>` inside `<picture>` — the HTML
   *  mechanism for reserving a box per art-direction breakpoint. Absent when the
   *  source declares no `aspectRatio`. */
  width?: number;
  height?: number;
};

export function resolveSource(
  source: SourceDefinition,
  image: MediaImage,
  cropUrl: CropUrlResolver = umbracoCropUrl,
): ResolvedSource[] {
  const formats: { type?: ResolvedSource["type"]; format: CropFormat }[] = [
    { type: "image/avif", format: "avif" },
    { type: "image/webp", format: "webp" },
    { format: null },
  ];
  const dims = dimensionsFor(source);
  return formats.map(({ type, format }) => ({
    type,
    media: source.media,
    srcSet: buildSrcset(source, image, format, cropUrl),
    sizes: source.sizes,
    width: dims?.width,
    height: dims?.height,
  }));
}

/** `RenderPictureGroup`'s two decisions, extracted so both are testable without
 *  a DOM and so `Picture.tsx` stays a pure tree.
 *
 *  ART DIRECTION IS A PROPERTY OF THE GROUP, NOT THE SOURCE. The source computes
 *  `isArtDirection = group.Sources.Any(s => s.Media != null)` — ANY source
 *  carrying a media query switches the whole group's `<img>` from
 *  srcset+sizes to a bare `src`. Faithfully reproduced, including the
 *  consequence: a group that mixes one media-scoped source with unscoped ones
 *  silently loses resolution switching on the fallback `<img>`.
 *
 *  THE FALLBACK IMG COMES FROM THE LAST SOURCE. `lastSource.Widths[0]` — the
 *  NARROWEST width of the LAST source definition. For `hero` that is
 *  `wide` @1280, the widest crop's smallest step; for `teaser` it is
 *  `stacked`/`horizontal` @400/@320. Reproduced. Note the fallback `src` is
 *  requested with NO format override, i.e. the original format. */
export function resolveGroup(
  group: PictureGroup,
  image: MediaImage,
  cropUrl: CropUrlResolver = umbracoCropUrl,
): {
  isArtDirection: boolean;
  sources: ResolvedSource[];
  imgSrc: string;
  /** Present only for resolution switching — absent under art direction. */
  imgSrcSet?: string;
  imgSizes?: string;
  /** STEP 2. The fallback `<img>`'s own reserved box, from the LAST source's
   *  crop — because that is where its `src` comes from. Under art direction a
   *  matching `<source>` overrides this; these are the floor, for the case where
   *  no `<source>` matches and for a UA that ignores `<source>` dimensions. */
  imgWidth?: number;
  imgHeight?: number;
} {
  const isArtDirection = group.sources.some((s) => s.media != null);
  const lastSource = group.sources[group.sources.length - 1];
  const sources = group.sources.flatMap((s) => resolveSource(s, image, cropUrl));
  const imgSrc = cropUrl({
    image,
    cropAlias: lastSource.cropAlias,
    width: lastSource.widths[0],
    format: null,
  });
  const imgDims = dimensionsFor(lastSource);

  const base = {
    isArtDirection,
    sources,
    imgSrc,
    imgWidth: imgDims?.width,
    imgHeight: imgDims?.height,
  };

  return isArtDirection
    ? base
    : { ...base, imgSrcSet: buildSrcset(lastSource, image, null, cropUrl), imgSizes: lastSource.sizes };
}

/** `string.Join(" ", classes.Where(not blank))` — the figure's class list.
 *  Mirrors `BuildFigureHtml`'s tail exactly, including the parameterised base:
 *  `PictureTagHelper` takes the `"Media"` default, `TeaserTagHelper` passes
 *  `"MediaContainer"`. */
export function joinClasses(...parts: (string | null | undefined)[]): string {
  return parts.filter((c) => c != null && c.trim() !== "").join(" ");
}
