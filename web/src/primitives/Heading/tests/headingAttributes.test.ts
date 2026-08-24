/* Pure-logic tests for the typographic pair's attribute modules.
 *
 * The Razor primitive set ships no conformance suite, so nothing but this file
 * pins the ATTRIBUTE contract — and after step 3 the attributes no longer drive
 * the paint, which makes them EASIER to break silently, not harder: a consumer's
 * stylesheet and any future e2e suite still read them, and `Teaser` builds its
 * markup entirely out of them. The visual contract is guarded separately by
 * `tasks/probes/typo-computed.cjs`.
 *
 * `HeadingTagHelper` is 8.7 KB and almost all of it is validation, so almost all
 * of it is testable here without a DOM. Matches the kernel's convention and
 * vitest's `environment: 'node'`.
 */
import { describe, expect, it } from "vitest";
import {
  elementAllowedForVariant,
  headingAttributes,
  headingClassName,
  resolveElement,
  resolveSize,
  resolveVariant,
  splitHighlight,
} from "../headingAttributes";
import {
  proseAttributes,
  proseClassName,
  resolveProseElement,
  validateProseSize,
  validateProseVariant,
} from "../../Prose/proseAttributes";

describe("resolveElement", () => {
  it("accepts all nine legal elements, lower-cased", () => {
    for (const e of ["h1", "h2", "h3", "h4", "h5", "h6", "span", "div", "p"]) {
      expect(resolveElement(e)).toBe(e);
      expect(resolveElement(e.toUpperCase())).toBe(e);
    }
  });

  /* The source substitutes SILENTLY rather than erroring — see the findings on
     the three validation philosophies in this primitive set. */
  it("silently substitutes h2 for anything else", () => {
    expect(resolveElement("section")).toBe("h2");
    expect(resolveElement("h7")).toBe("h2");
    expect(resolveElement(undefined)).toBe("h2");
  });
});

describe("resolveVariant", () => {
  it("accepts the three variants and silently falls back to heading", () => {
    expect(resolveVariant("display")).toBe("display");
    expect(resolveVariant("BODY")).toBe("body");
    expect(resolveVariant("fancy")).toBe("heading");
    expect(resolveVariant(null)).toBe("heading");
    expect(resolveVariant(undefined)).toBe("heading");
  });
});

describe("elementAllowedForVariant", () => {
  /* `body` is the only restricted variant: a body-VOICE heading must still BE a
     heading element. `heading` and `display` accept span/div/p, which is how the
     source lets a visual heading exist without joining the document outline. */
  it("restricts body to h1-h6 only", () => {
    expect(elementAllowedForVariant("body", "h3")).toBe(true);
    expect(elementAllowedForVariant("body", "span")).toBe(false);
    expect(elementAllowedForVariant("body", "div")).toBe(false);
    expect(elementAllowedForVariant("body", "p")).toBe(false);
  });

  it("lets heading and display use all nine", () => {
    for (const v of ["heading", "display"]) {
      for (const e of ["h1", "h6", "span", "div", "p"]) {
        expect(elementAllowedForVariant(v, e)).toBe(true);
      }
    }
  });
});

describe("resolveSize — the three fallback tiers", () => {
  it("tier 1: an in-range explicit size wins", () => {
    expect(resolveSize("heading", "h2", "5")).toBe("5");
    expect(resolveSize("display", "h2", "3")).toBe("3");
    expect(resolveSize("body", "h2", "lg")).toBe("lg");
    expect(resolveSize("body", "h2", "LG")).toBe("lg");
  });

  it("tier 2: an OUT-OF-RANGE size falls to the variant default, it does not error", () => {
    /* display accepts 1-3, so 5 becomes the default 2 — silently. */
    expect(resolveSize("display", "h2", "5")).toBe("2");
    expect(resolveSize("body", "h3", "9")).toBe("md");
  });

  it("tier 3: heading has no variant default and derives from the element", () => {
    for (const n of ["1", "2", "3", "4", "5", "6"]) {
      expect(resolveSize("heading", `h${n}`, undefined)).toBe(n);
    }
  });

  it("tier 3 fallback: heading on a non-heading element becomes 2", () => {
    for (const e of ["span", "div", "p"]) {
      expect(resolveSize("heading", e, undefined)).toBe("2");
    }
    /* And an out-of-range size on a heading variant falls THROUGH to the element,
       not to a fixed default — which is why h4 stays 4 rather than becoming 2. */
    expect(resolveSize("heading", "h4", "9")).toBe("4");
  });
});

describe("headingAttributes", () => {
  const base = { variant: "heading", size: "2", align: "left", wrap: "balance" };

  it("always writes data-variant, and data-size only when resolved", () => {
    expect(headingAttributes(base)).toEqual({
      "data-variant": "heading",
      "data-size": "2",
      "data-align": "left",
      "data-wrap": "balance",
    });
    expect(headingAttributes({ ...base, size: null })).not.toHaveProperty("data-size");
  });

  /* Silent drop, matching ButtonHelper: an unknown value produces NO attribute
     rather than an invalid one. Dangerous (it fails invisibly) but it is the
     API. */
  it("drops an unknown colour, align or wrap rather than emitting it", () => {
    const a = headingAttributes({ ...base, color: "chartreuse", align: "justify", wrap: "wibble" });
    expect(a).not.toHaveProperty("data-color");
    expect(a).not.toHaveProperty("data-align");
    expect(a).not.toHaveProperty("data-wrap");
  });

  it("lower-cases the four colours and all four wrap strategies", () => {
    for (const c of ["primary", "dark", "light", "inherit"]) {
      expect(headingAttributes({ ...base, color: c.toUpperCase() })["data-color"]).toBe(c);
    }
    for (const w of ["balance", "pretty", "stable", "nowrap"]) {
      expect(headingAttributes({ ...base, wrap: w })["data-wrap"]).toBe(w);
    }
  });

  /* `data-color` is optional, which is why `Heading.css` reads `--_color` only
     under `&[data-color]` and why step 3 resolves the colour in JS. */
  it("omits data-color when no colour is given", () => {
    expect(headingAttributes(base)).not.toHaveProperty("data-color");
  });
});

describe("headingClassName", () => {
  it("keeps Heading first, which is the part identity", () => {
    expect(headingClassName()).toBe("Heading");
    expect(headingClassName("   ")).toBe("Heading");
    expect(headingClassName("text-ink my-0")).toBe("Heading text-ink my-0");
  });
});

describe("splitHighlight", () => {
  it("returns one unmarked fragment when there is nothing to highlight", () => {
    expect(splitHighlight("plain", undefined)).toEqual([{ text: "plain", marked: false }]);
    expect(splitHighlight("plain", "")).toEqual([{ text: "plain", marked: false }]);
    expect(splitHighlight("plain", " , , ")).toEqual([{ text: "plain", marked: false }]);
  });

  it("marks a single term, case-insensitively", () => {
    expect(splitHighlight("Ship agentic review", "AGENTIC")).toEqual([
      { text: "Ship ", marked: false },
      { text: "agentic", marked: true },
      { text: " review", marked: false },
    ]);
  });

  it("orders terms longest-first so the longer match wins", () => {
    /* With "code" first in the list, a naive alternation would match "code" and
       leave " review" unmarked. Longest-first is why the whole phrase wins. */
    const f = splitHighlight("A code review of the code", "code,code review");
    expect(f.filter((x) => x.marked).map((x) => x.text)).toEqual(["code review", "code"]);
  });

  it("escapes regex metacharacters in a term", () => {
    const f = splitHighlight("costs $1.50 (net)", "$1.50");
    expect(f.filter((x) => x.marked).map((x) => x.text)).toEqual(["$1.50"]);
  });

  it("drops empty fragments so no zero-length node is rendered", () => {
    /* A term at the very start produces a leading "" from String.split. */
    const f = splitHighlight("agentic review", "agentic");
    expect(f).toEqual([
      { text: "agentic", marked: true },
      { text: " review", marked: false },
    ]);
  });

  it("marks every occurrence, not just the first", () => {
    const f = splitHighlight("a b a b a", "a");
    expect(f.filter((x) => x.marked)).toHaveLength(3);
  });
});

/* ── Prose ──────────────────────────────────────────────────────────────── */

describe("proseAttributes and validation", () => {
  it("silently substitutes div for an unknown element", () => {
    for (const e of ["div", "section", "article", "aside", "footer"]) {
      expect(resolveProseElement(e)).toBe(e);
      expect(resolveProseElement(e.toUpperCase())).toBe(e);
    }
    expect(resolveProseElement("span")).toBe("div");
    expect(resolveProseElement(undefined)).toBe("div");
  });

  /* THE INCONSISTENCY, pinned deliberately. Prose ERRORS on an unknown variant
     or size while silently substituting an unknown element — and Heading
     silently substitutes all three. Three philosophies across two files. */
  it("returns null for an unknown variant or size, which the component turns into an error", () => {
    expect(validateProseVariant("rich")).toBe("rich");
    expect(validateProseVariant("RICH")).toBe("rich");
    expect(validateProseVariant("fancy")).toBeNull();
    expect(validateProseSize("sm")).toBe("sm");
    expect(validateProseSize("xl")).toBeNull();
  });

  it("writes both axes, always", () => {
    expect(proseAttributes("basic", "sm")).toEqual({
      "data-variant": "basic",
      "data-size": "sm",
    });
  });

  it("keeps Prose first — Teaser's hand-written markup depends on it", () => {
    expect(proseClassName()).toBe("Prose");
    expect(proseClassName("Teaser-body")).toBe("Prose Teaser-body");
  });
});
