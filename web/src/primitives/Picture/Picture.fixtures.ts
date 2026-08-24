/* Picture.fixtures.ts — the offline media set and the static crop resolver.
 *
 * The route has to work with no CMS and no network, so the kitchensink passes
 * `staticCropUrl` in place of `umbracoCropUrl`. The files it points at are real,
 * generated at the exact widths and aspect ratios the presets ask for by
 * `web/tasks/probes/gen-media.cjs`, in all three formats the source negotiates
 * over.
 *
 * REAL FILES AT REAL SIZES, not one placeholder repeated, and that is load-
 * bearing rather than tidiness: the whole CLS question is *when the browser
 * learns the aspect ratio*. Candidates that all shared one intrinsic size would
 * make the port measure better than the source behaves.
 *
 * The crop aspect ratios are recorded in gen-media.cjs. Only `horizontal` (1:1)
 * is evidenced by the source — Teaser.css declares it. The other five are
 * invented, because Umbraco crop definitions live in the CMS and no dimension
 * for any alias appears anywhere in the source repo.
 */

import type { CropUrlResolver, MediaImage } from "./mediaHelper";

/** `/media/<item>/<alias>-<width>.<ext>` — the shape gen-media.cjs writes.
 *  `format: null` (the source's untyped third `<source>`, and the fallback
 *  `<img src>`) resolves to the original format, which here is JPEG. */
export const staticCropUrl: CropUrlResolver = ({ image, cropAlias, width, format }) =>
  `${image.url}/${cropAlias}-${width}.${format ?? "jpg"}`;

export const ORCHARD: MediaImage = {
  url: "/media/orchard",
  focalPoint: { left: 0.42, top: 0.38 },
  altText: "A low sun through the rows of a walled orchard",
};

export const ATRIUM: MediaImage = {
  url: "/media/atrium",
  altText: "The glass atrium of a converted warehouse, seen from the mezzanine",
};

export const LATTICE: MediaImage = {
  url: "/media/lattice",
  altText: "Concrete lattice screening a stairwell",
};

/** A media item whose URL resolves to nothing — the `GetCropUrl(...) ?? ""`
 *  path, reproduced. Renders a broken image, which is the source's behaviour. */
export const MISSING: MediaImage = { url: "/media/does-not-exist" };
