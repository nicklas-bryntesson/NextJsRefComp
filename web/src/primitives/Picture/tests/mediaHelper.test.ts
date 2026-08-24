/* mediaHelper.test.ts — pins the negotiation contract.
 *
 * There is no conformance suite for the Razor primitive set, so these assertions
 * ARE the contract for everything in `MediaHelper` that is not a rendered
 * property. They exist mostly to catch a step-2 or step-3 change that quietly
 * alters what URL the browser is offered — which no computed-style snapshot and
 * no axe run can see, because srcset is not style and not semantics.
 *
 * Deliberately not tested here: the DOM. `MediaFigure` renders and the probes
 * measure it in a real browser, because the question "which candidate did the
 * browser pick" has no answer in jsdom.
 */

import { describe, expect, it } from "vitest";
import {
  buildSrcset,
  dimensionsFor,
  joinClasses,
  PRESETS,
  PRESET_NAMES,
  resolveGroup,
  resolveSource,
  umbracoCropUrl,
  type MediaImage,
} from "../mediaHelper";

const IMG: MediaImage = { url: "/media/x", focalPoint: { left: 0.42, top: 0.38 } };
const stub = ({ cropAlias, width, format }: { cropAlias: string; width: number; format: string | null }) =>
  `${cropAlias}-${width}.${format ?? "orig"}`;

describe("PRESETS — verbatim from MediaHelper.Presets", () => {
  it("has exactly the two presets the source defines, in order", () => {
    expect(PRESET_NAMES).toEqual(["teaser", "hero"]);
  });

  it("teaser is two groups with the container-query class names", () => {
    expect(PRESETS.teaser.loading).toBe("lazy");
    expect(PRESETS.teaser.figureCssClass).toBeUndefined();
    expect(PRESETS.teaser.groups.map((g) => g.cssClass)).toEqual([
      "StackedSources",
      "HorizontalSources",
    ]);
    /* `aspectRatio` is the step-2 addition; every other field is verbatim. */
    expect(PRESETS.teaser.groups[0].sources).toEqual([
      { cropAlias: "stacked", widths: [400, 800], sizes: "100%", aspectRatio: [3, 2] },
    ]);
    expect(PRESETS.teaser.groups[1].sources).toEqual([
      { cropAlias: "horizontal", widths: [320, 640], sizes: "12rem", aspectRatio: [1, 1] },
    ]);
  });

  it("hero is one group of four media-scoped sources, eager, in the grid-container-full figure", () => {
    expect(PRESETS.hero.loading).toBe("eager");
    expect(PRESETS.hero.figureCssClass).toBe("grid-container-full");
    expect(PRESETS.hero.groups).toHaveLength(1);
    expect(PRESETS.hero.groups[0].sources.map((s) => s.cropAlias)).toEqual([
      "mobile",
      "portrait",
      "mid",
      "wide",
    ]);
  });

  /* `<source>` is first-match-wins, so three ascending `max-width` queries only
   * work in this order. Reordering them is a silent, total regression: every
   * viewport would take `mobile`. Pinned because a "tidy the table" edit is
   * exactly the change that would do it. */
  it("hero's max-width queries ascend, which is what makes first-match-wins correct", () => {
    const maxes = PRESETS.hero.groups[0].sources
      .map((s) => s.media)
      .filter((m): m is string => !!m && m.includes("max-width"))
      .map((m) => parseFloat(m.replace(/[^\d.]/g, "")));
    expect(maxes).toEqual([...maxes].sort((a, b) => a - b));
    expect(maxes).toEqual([21.24999, 48, 64]);
  });
});

describe("buildSrcset — MediaHelper.BuildSrcset", () => {
  it("emits one candidate per width with a w descriptor, in declaration order", () => {
    expect(buildSrcset(PRESETS.teaser.groups[0].sources[0], IMG, null, stub)).toBe(
      "stacked-400.orig 400w, stacked-800.orig 800w",
    );
  });

  it("threads the format through to every candidate", () => {
    expect(buildSrcset(PRESETS.teaser.groups[1].sources[0], IMG, "avif", stub)).toBe(
      "horizontal-320.avif 320w, horizontal-640.avif 640w",
    );
  });
});

describe("resolveSource — the format triplet", () => {
  const [avif, webp, original] = resolveSource(PRESETS.hero.groups[0].sources[3], IMG, stub);

  /* Declarative negotiation, in this order, with an untyped floor. This is the
   * guarantee `next/image` cannot express: it renders a bare <img> and negotiates
   * format server-side from the Accept header. */
  it("is avif, then webp, then an untyped fallback", () => {
    expect(avif.type).toBe("image/avif");
    expect(webp.type).toBe("image/webp");
    expect(original.type).toBeUndefined();
  });

  it("carries the source's media query and sizes onto all three", () => {
    for (const s of [avif, webp, original]) {
      expect(s.media).toBe("(min-width: 64rem)");
      expect(s.sizes).toBe("60vw");
    }
  });

  it("gives the untyped fallback the original format, not a transcode", () => {
    expect(original.srcSet).toBe("wide-1280.orig 1280w, wide-1512.orig 1512w, wide-1728.orig 1728w");
  });
});

describe("resolveGroup — the two negotiation modes", () => {
  /* ART DIRECTION. Any source with a media query switches the WHOLE group, and
   * the <img> then gets a bare src with no srcset/sizes — deliberately, so the
   * media-scoped <source> rules are the only selector. */
  it("art direction: the img gets src only, and it comes from the LAST source's NARROWEST width", () => {
    const r = resolveGroup(PRESETS.hero.groups[0], IMG, stub);
    expect(r.isArtDirection).toBe(true);
    expect(r.imgSrcSet).toBeUndefined();
    expect(r.imgSizes).toBeUndefined();
    /* `wide` is last, 1280 is its narrowest step. Not the narrowest crop, and
     * not the widest width — this pairing is easy to "fix" wrongly. */
    expect(r.imgSrc).toBe("wide-1280.orig");
    expect(r.sources).toHaveLength(12); // 4 sources x 3 formats
  });

  it("resolution switching: the img gets srcset and sizes from the last source", () => {
    const r = resolveGroup(PRESETS.teaser.groups[0], IMG, stub);
    expect(r.isArtDirection).toBe(false);
    expect(r.imgSrc).toBe("stacked-400.orig");
    expect(r.imgSrcSet).toBe("stacked-400.orig 400w, stacked-800.orig 800w");
    expect(r.imgSizes).toBe("100%");
    expect(r.sources).toHaveLength(3);
  });

  /* `group.Sources.Any(s => s.Media != null)` — one media query disables
   * resolution switching for the group's fallback img. No preset does this today;
   * pinned because it is a trap for whoever adds the third preset. */
  it("ONE media query in a mixed group disables the fallback img's srcset entirely", () => {
    const mixed = {
      sources: [
        { cropAlias: "a", widths: [100, 200], sizes: "100vw", media: "(max-width: 30rem)" },
        { cropAlias: "b", widths: [300, 600], sizes: "100vw" },
      ],
    };
    const r = resolveGroup(mixed, IMG, stub);
    expect(r.isArtDirection).toBe(true);
    expect(r.imgSrcSet).toBeUndefined();
    /* And source `b` has no media query, so it matches everywhere and wins over
     * `a` only by document order — the mode is now neither one thing nor the
     * other. */
    expect(r.sources.slice(3).every((s) => s.media === undefined)).toBe(true);
  });
});

/* ── STEP 2 — the reserved box ────────────────────────────────────────────────
 *
 * Step 1 measured CLS 0.253 (POOR) and 3998 px of unreserved height. These pin
 * the repair, and the FIRST test is the one that matters: the reservation has to
 * differ per art-direction breakpoint, because that is the thing a single
 * width/height pair on the <img> — and therefore `next/image` — cannot do. */
describe("dimensionsFor / step-2 reserved dimensions", () => {
  it("gives each hero source ITS OWN shape, not one shape for the picture", () => {
    const dims = PRESETS.hero.groups[0].sources.map((s) => dimensionsFor(s));
    expect(dims).toEqual([
      { width: 380, height: 475 },  // mobile   4:5
      { width: 440, height: 587 },  // portrait 3:4
      { width: 740, height: 416 },  // mid     16:9
      { width: 1280, height: 549 }, // wide    21:9
    ]);
    /* Four genuinely different ratios. If one <img> had to carry all four it
       would be wrong at three viewports, which is exactly the failure a naive
       "just add width and height" fix produces. */
    const ratios = dims.map((d) => +(d!.width / d!.height).toFixed(3));
    expect(new Set(ratios).size).toBe(4);
  });

  it("puts the dimensions on every <source> of a triplet, identically", () => {
    const [avif, webp, original] = resolveSource(PRESETS.hero.groups[0].sources[0], IMG, stub);
    for (const s of [avif, webp, original]) {
      expect(s.width).toBe(380);
      expect(s.height).toBe(475);
    }
  });

  it("gives the fallback img the LAST source's shape, matching where its src comes from", () => {
    const hero = resolveGroup(PRESETS.hero.groups[0], IMG, stub);
    expect(hero.imgSrc).toBe("wide-1280.orig");
    expect([hero.imgWidth, hero.imgHeight]).toEqual([1280, 549]); // wide, 21:9
    const teaser = resolveGroup(PRESETS.teaser.groups[1], IMG, stub);
    expect([teaser.imgWidth, teaser.imgHeight]).toEqual([320, 320]); // horizontal, 1:1
  });

  /* Absent, not guessed. A source with no known crop ratio emits no attributes
     at all, which is the step-1 behaviour — so the extension never invents a
     shape, it only declares one it was told. */
  it("emits nothing when the source declares no aspectRatio", () => {
    const bare = { cropAlias: "a", widths: [100, 200], sizes: "100vw" };
    expect(dimensionsFor(bare)).toBeUndefined();
    const r = resolveGroup({ sources: [bare] }, IMG, stub);
    expect(r.imgWidth).toBeUndefined();
    expect(r.imgHeight).toBeUndefined();
    expect(r.sources.every((s) => s.width === undefined && s.height === undefined)).toBe(true);
  });
});

describe("umbracoCropUrl — the default resolver's shape", () => {
  it("carries the alias, the width, the focal point and the format", () => {
    const u = umbracoCropUrl({ image: IMG, cropAlias: "wide", width: 1512, format: "avif" });
    expect(u).toBe("/media/x?cropalias=wide&width=1512&rxy=0.42%2C0.38&format=avif");
  });

  it("omits the format for the untyped source, and the focal point when absent", () => {
    expect(umbracoCropUrl({ image: { url: "/m/y" }, cropAlias: "mid", width: 740, format: null })).toBe(
      "/m/y?cropalias=mid&width=740",
    );
  });

  /* `GetCropUrl(...) ?? ""` upstream. An empty src is NOT a no-op — it
   * re-requests the current document. Reproduced rather than improved, because
   * improving it changes what the source guarantees. */
  it("returns the empty string when the media item has no url", () => {
    expect(umbracoCropUrl({ image: { url: "" }, cropAlias: "mid", width: 740, format: null })).toBe("");
  });
});

describe("joinClasses — BuildFigureHtml's class list", () => {
  it("drops null, undefined and whitespace-only entries", () => {
    expect(joinClasses("Media", undefined, "grid-container-full", null, "  ", "extra")).toBe(
      "Media grid-container-full extra",
    );
  });

  it("keeps the source's order: base, preset, then the caller's extra", () => {
    expect(joinClasses("Media", "grid-container-full", "hero-override")).toBe(
      "Media grid-container-full hero-override",
    );
  });
});
