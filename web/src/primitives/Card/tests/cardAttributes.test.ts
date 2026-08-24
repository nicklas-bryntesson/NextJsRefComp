/* Pure-logic tests for `cardAttributes.ts`.
 *
 * The Razor primitive set ships no conformance suite, so this file is the only
 * thing pinning Card's ATTRIBUTE contract — and the attributes are the public
 * API. After step 3 the component's own stylesheet no longer reads them, but
 * `Teaser.css` does, a consumer's stylesheet does, and the computed-style probe
 * keys off them, which is precisely why they must not drift.
 *
 * The visual contract is guarded separately by tasks/probes/card-computed.cjs.
 *
 * Pure functions only, matching vitest's `environment: 'node'` — no DOM, no
 * render. The suppression rule and the dev error box are behaviour of `Card.tsx`
 * and are covered by the kitchensink route instead.
 */
import { describe, expect, it } from "vitest";
import {
  cardAttributes,
  cardClassName,
  FORBIDDEN_COMBINATIONS,
  resolveCardElement,
  validateCard,
} from "../cardAttributes";

describe("resolveCardElement", () => {
  it("passes the four permitted elements through, lower-cased", () => {
    for (const el of ["article", "section", "li", "div"]) {
      expect(resolveCardElement(el)).toBe(el);
    }
    expect(resolveCardElement("ARTICLE")).toBe("article");
    expect(resolveCardElement("Section")).toBe("section");
  });

  it("silently falls back to article for anything else", () => {
    /* No diagnostic, unlike padding and elevation. `aside` is the case that
       matters: it is what CTABlock's root is, so CTABlock cannot be a Card. */
    expect(resolveCardElement("aside")).toBe("article");
    expect(resolveCardElement("span")).toBe("article");
    expect(resolveCardElement("")).toBe("article");
  });
});

describe("validateCard", () => {
  it("accepts the four paddings, case-insensitively", () => {
    for (const p of ["none", "sm", "md", "lg", "MD"]) {
      expect(validateCard(p, undefined, false).ok).toBe(true);
    }
  });

  it("rejects an unknown padding with the source's message", () => {
    const r = validateCard("xl", undefined, false);
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.message).toBe(
      'invalid padding "xl" — expected none | sm | md | lg',
    );
  });

  it("reports padding before elevation when both are invalid", () => {
    /* Guard order is observable behaviour, not an implementation detail. */
    const r = validateCard("xl", "xxl", false);
    expect(r.ok === false && r.message).toContain("invalid padding");
  });

  it("rejects an unknown elevation with the source's message", () => {
    const r = validateCard("md", "xxl", false);
    expect(r.ok === false && r.message).toBe(
      'invalid elevation "xxl" — expected none | sm | md | lg',
    );
  });

  it("distinguishes an omitted elevation from elevation=none", () => {
    /* `Elevation?.ToLowerInvariant() ?? "none"` for the combination check, but
       the attribute is written only when the prop was supplied. Two notions of
       "no elevation" in four lines of C#, and both are load-bearing. */
    const omitted = validateCard("md", undefined, false);
    const explicit = validateCard("md", "none", false);
    expect(omitted.ok === true && omitted.elevation).toBe(null);
    expect(explicit.ok === true && explicit.elevation).toBe("none");
  });

  it("lower-cases a valid elevation", () => {
    const r = validateCard("md", "SM", false);
    expect(r.ok === true && r.elevation).toBe("sm");
  });

  it("permits every border × elevation pair, because the forbidden set ships empty", () => {
    expect(FORBIDDEN_COMBINATIONS.size).toBe(0);
    for (const border of [true, false]) {
      for (const elevation of [undefined, "none", "sm", "md", "lg"]) {
        expect(validateCard("md", elevation, border).ok).toBe(true);
      }
    }
  });
});

describe("cardAttributes", () => {
  it('writes data-border="false" explicitly rather than omitting it', () => {
    /* CLAUDE.md's rule is `="true"` or absent. The source writes both states, and
       `Card.css` styles only the `"true"` one — so this is a WEAKER claim on the
       exception than `data-pill` had. Reproduced because it is the documented
       API and `Teaser.css`-style consumer rules can select on it. */
    expect(cardAttributes({ border: false, padding: "md", elevation: null })).toEqual({
      "data-border": "false",
      "data-padding": "md",
    });
  });

  it("writes data-elevation only when an elevation was supplied", () => {
    expect(
      cardAttributes({ border: true, padding: "none", elevation: "sm" }),
    ).toEqual({
      "data-border": "true",
      "data-padding": "none",
      "data-elevation": "sm",
    });
  });

  it("writes data-elevation=none when none was supplied explicitly", () => {
    expect(
      cardAttributes({ border: false, padding: "md", elevation: "none" })["data-elevation"],
    ).toBe("none");
  });

  it("does NOT reflect the element axis into any attribute", () => {
    /* The only trace of `element` in the DOM is the tag name. That is why the
       computed-style probe keys on the tag as well as the data-* axes — a key
       built from attributes alone collapses four variants onto one. */
    const attrs = cardAttributes({ border: true, padding: "md", elevation: null });
    expect(Object.keys(attrs).some((k) => k.includes("element"))).toBe(false);
  });

  it("emits the Teaser frames exactly", () => {
    /* `TeaserTagHelper` writes these two by hand into `PreElement`. If this test
       fails, the Teaser port's frame no longer matches the source's. */
    expect(cardAttributes({ border: true, padding: "none", elevation: null })).toEqual({
      "data-border": "true",
      "data-padding": "none",
    });
    expect(cardAttributes({ border: false, padding: "none", elevation: "sm" })).toEqual({
      "data-border": "false",
      "data-padding": "none",
      "data-elevation": "sm",
    });
  });
});

describe("cardClassName", () => {
  it("merges the author class AFTER Card", () => {
    expect(cardClassName("Card", "Promo")).toBe("Card Promo");
  });

  it("ignores an empty or whitespace-only author class", () => {
    expect(cardClassName("Card", "")).toBe("Card");
    expect(cardClassName("Card", "   ")).toBe("Card");
    expect(cardClassName("Card", undefined)).toBe("Card");
  });
});
