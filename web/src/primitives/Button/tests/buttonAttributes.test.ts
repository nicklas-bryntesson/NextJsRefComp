/* Pure-logic tests for the two shared helper modules.
 *
 * The Razor primitive set ships no conformance suite, so nothing but this file
 * pins the ATTRIBUTE contract — and the attributes are the component's public
 * API (the stylesheet no longer reads them after step 3, but a consumer's
 * stylesheet and any future e2e suite still will, which is exactly why they must
 * not drift). The visual contract is guarded separately by
 * tasks/probes/button-computed.cjs.
 *
 * Kept to pure functions, matching the kernel's convention and vitest's
 * `environment: 'node'` — no DOM, no render.
 */
import { describe, expect, it } from "vitest";
import {
  buttonClassName,
  linkTargetAttributes,
  sharedButtonAttributes,
} from "../buttonAttributes";
import { ctaButtonAttributes, ctaEffectClassName } from "../ctaButtonAttributes";
import { hasContent } from "../hasContent";

const base = {
  emphasis: "primary",
  pill: false,
  size: "md",
  iconPosition: "right",
} as const;

describe("sharedButtonAttributes", () => {
  it("writes the three axis attributes lower-cased", () => {
    expect(sharedButtonAttributes({ ...base, emphasis: "PRIMARY", intent: "Destructive" })).toMatchObject({
      "data-emphasis": "primary",
      "data-intent": "destructive",
      "data-size": "md",
    });
  });

  /* The documented exception to "booleans are `true` or absent". `Button.css`
     styled BOTH pill states, so both had to be selectable; the source writes
     "false" explicitly and the port reproduces it. */
  it('writes data-pill="false" explicitly rather than omitting it', () => {
    expect(sharedButtonAttributes({ ...base, pill: false })["data-pill"]).toBe("false");
    expect(sharedButtonAttributes({ ...base, pill: true })["data-pill"]).toBe("true");
  });

  it("drops an invalid axis value entirely, as the source's HashSet guard does", () => {
    const a = sharedButtonAttributes({ ...base, emphasis: "quaternary", size: "xl", intent: "urgent" });
    expect(a).not.toHaveProperty("data-emphasis");
    expect(a).not.toHaveProperty("data-size");
    expect(a).not.toHaveProperty("data-intent");
  });

  it("omits data-intent when intent is absent (LinkButton passes null)", () => {
    expect(sharedButtonAttributes({ ...base, intent: null })).not.toHaveProperty("data-intent");
  });

  it("only writes icon-position when there is an icon", () => {
    expect(sharedButtonAttributes(base)).not.toHaveProperty("data-icon-position");
    expect(sharedButtonAttributes({ ...base, icon: "x" })).toMatchObject({
      "data-icon": "x",
      "data-icon-position": "right",
    });
  });

  it("writes data-icon-only only when true, never as \"false\"", () => {
    expect(sharedButtonAttributes({ ...base, icon: "x", iconOnly: true })["data-icon-only"]).toBe("true");
    expect(sharedButtonAttributes({ ...base, icon: "x", iconOnly: false })).not.toHaveProperty("data-icon-only");
  });

  it("passes aria-label through and omits it when empty", () => {
    expect(sharedButtonAttributes({ ...base, ariaLabel: "Add" })["aria-label"]).toBe("Add");
    expect(sharedButtonAttributes({ ...base, ariaLabel: "" })).not.toHaveProperty("aria-label");
  });
});

describe("linkTargetAttributes", () => {
  it("adds rel=noopener noreferrer for _blank only", () => {
    expect(linkTargetAttributes("_blank")).toEqual({ target: "_blank", rel: "noopener noreferrer" });
    expect(linkTargetAttributes("_self")).toEqual({ target: "_self" });
    expect(linkTargetAttributes(undefined)).toEqual({});
  });
});

describe("buttonClassName", () => {
  it("puts the structural class first, then the author's", () => {
    expect(buttonClassName("Button", "mt-4")).toBe("Button mt-4");
    expect(buttonClassName("Button", "   ")).toBe("Button");
    expect(buttonClassName("Button")).toBe("Button");
  });
});

describe("ctaButtonAttributes", () => {
  it("accepts only the glow variant", () => {
    expect(ctaButtonAttributes({ variant: "glow" })["data-variant"]).toBe("glow");
    expect(ctaButtonAttributes({ variant: "pulse" })).not.toHaveProperty("data-variant");
  });

  /* The effect span's class is BUILT from the variant name, so a new variant in
     the allow-list silently needs a matching `.CtaButton-<name>` rule or it
     renders an unstyled empty span. Pinned so the coupling is visible. */
  it("names the effect span after the variant", () => {
    expect(ctaEffectClassName("glow")).toBe("CtaButton-glow");
    expect(ctaEffectClassName("Pulse")).toBe("CtaButton-pulse");
  });
});

describe("hasContent — the React answer to IsEmptyOrWhiteSpace", () => {
  it("treats whitespace-only strings as empty", () => {
    expect(hasContent("   ")).toBe(false);
    expect(hasContent("")).toBe(false);
    expect(hasContent("Go")).toBe(true);
  });

  it("treats null, undefined and false as empty", () => {
    expect(hasContent(null)).toBe(false);
    expect(hasContent(undefined)).toBe(false);
    expect(hasContent(false)).toBe(false);
  });

  it("counts 0 as content, because it renders", () => {
    expect(hasContent(0)).toBe(true);
  });

  it("recurses into arrays", () => {
    expect(hasContent([null, "  ", false])).toBe(false);
    expect(hasContent([null, "x"])).toBe(true);
  });
});
