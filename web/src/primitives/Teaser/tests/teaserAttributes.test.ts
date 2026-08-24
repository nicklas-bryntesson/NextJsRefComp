/* Pure-logic tests for `teaserAttributes.ts`.
 *
 * The Razor primitive set ships no conformance suite, so this file is the only
 * thing pinning Teaser's attribute contract and its frame→Card mapping. The
 * mapping matters more here than the attributes do: the source's comment says
 * "Teaser owns the permitted Card combinations — callers never set Card props
 * directly", which makes the table a contract rather than an implementation
 * detail.
 *
 * The visual contract is guarded by tasks/probes/teaser-computed.cjs; the tree
 * shape by the kitchensink route.
 */
import { describe, expect, it } from "vitest";
import {
  CARD_FRAME,
  resolveTeaserElement,
  resolveTeaserFrame,
  teaserAttributes,
  validateTeaser,
} from "../teaserAttributes";

describe("resolveTeaserElement", () => {
  it("passes the four permitted elements through", () => {
    for (const e of ["article", "div", "li", "section"]) {
      expect(resolveTeaserElement(e)).toBe(e);
    }
  });

  it("lower-cases, matching OrdinalIgnoreCase", () => {
    expect(resolveTeaserElement("SECTION")).toBe("section");
  });

  /* The silent fallback. No diagnostic, no error box — unlike an invalid
     padding on a Card, which is loud. */
  it("silently falls back to article for anything else", () => {
    expect(resolveTeaserElement("aside")).toBe("article");
    expect(resolveTeaserElement("")).toBe("article");
    expect(resolveTeaserElement(undefined)).toBe("article");
  });
});

describe("resolveTeaserFrame", () => {
  it("passes the three permitted frames through, case-insensitively", () => {
    expect(resolveTeaserFrame("bordered")).toBe("bordered");
    expect(resolveTeaserFrame("ELEVATED")).toBe("elevated");
    expect(resolveTeaserFrame("bare")).toBe("bare");
  });

  it("silently falls back to bordered", () => {
    expect(resolveTeaserFrame("flat")).toBe("bordered");
    expect(resolveTeaserFrame(undefined)).toBe("bordered");
  });
});

describe("validateTeaser", () => {
  it("is the only hard guard: button without href", () => {
    expect(validateTeaser(true, undefined)).toBe('button="true" requires href');
    expect(validateTeaser(true, "")).toBe('button="true" requires href');
    /* `string.IsNullOrWhiteSpace` — whitespace is not an href. */
    expect(validateTeaser(true, "   ")).toBe('button="true" requires href');
  });

  it("passes with an href, and passes with no button at all", () => {
    expect(validateTeaser(true, "/x")).toBeNull();
    expect(validateTeaser(false, undefined)).toBeNull();
  });
});

describe("teaserAttributes", () => {
  /* Both axes are written as "false", never omitted — the source's behaviour,
     and the CLAUDE.md exception only half applies. See teaserAttributes.ts. */
  it('writes data-button and data-media as "false" rather than omitting them', () => {
    expect(teaserAttributes({ button: false, hasMedia: false })).toEqual({
      "data-button": "false",
      "data-media": "false",
    });
  });

  it("writes both as true when both are on", () => {
    expect(teaserAttributes({ button: true, hasMedia: true })).toEqual({
      "data-button": "true",
      "data-media": "true",
    });
  });
});

describe("CARD_FRAME", () => {
  it("maps bordered to a bordered, unpadded Card", () => {
    expect(CARD_FRAME.bordered).toEqual({ padding: "none", border: true });
  });

  it("maps elevated to elevation sm with NO border", () => {
    expect(CARD_FRAME.elevated).toEqual({ padding: "none", elevation: "sm" });
  });

  /* `bare` is the only frame that changes the DOM's SHAPE rather than its
     attributes: no Card element at all. That is why the wrapper in Teaser.tsx
     is a conditional and not a prop. */
  it("maps bare to no Card at all", () => {
    expect(CARD_FRAME.bare).toBeNull();
  });

  it("never gives a frame both a border and an elevation", () => {
    for (const frame of Object.values(CARD_FRAME)) {
      if (frame == null) continue;
      expect(Boolean(frame.border) && Boolean(frame.elevation)).toBe(false);
    }
  });
});
