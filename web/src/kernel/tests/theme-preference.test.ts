/* Conformance tests for the `theme-preference` kernel port.
 *
 * Adapted from reference-components/src/kernel/js/tests/theme-preference.unit.test.ts.
 * PORTING.md excludes `*.unit.test.*` from the portable contract because the
 * component ones are white-box — they import the reference class and call
 * private methods. These are not: the kernel tests are already black-box against
 * two published pure functions, so re-pointing them at the port costs nothing
 * and is the only thing that actually proves the state machine survived.
 */

import { describe, expect, it } from "vitest";
import {
  resolveAppearance,
  resolvePreference,
  shouldProject,
  type Preference,
} from "../theme-preference";

describe("resolvePreference", () => {
  it("passes the three known values through", () => {
    expect(resolvePreference("system")).toBe("system");
    expect(resolvePreference("light")).toBe("light");
    expect(resolvePreference("dark")).toBe("dark");
  });

  it("resolves every unrecognised input to 'system' rather than throwing", () => {
    // An unnamed preference would render a radio group with nothing checked, so
    // there is no such thing as an unresolvable stored value.
    for (const input of [null, undefined, "", " ", "SYSTEM", "Dark", "auto", "light-contrast", "{}"]) {
      expect(resolvePreference(input), `input: ${JSON.stringify(input)}`).toBe("system");
    }
  });

  it("is case-sensitive on purpose", () => {
    // 'Dark' is not a value this library writes, so mapping it to 'dark' would
    // be guessing at another writer's intent.
    expect(resolvePreference("Dark")).toBe("system");
    expect(resolvePreference("dark")).toBe("dark");
  });
});

describe("resolveAppearance", () => {
  it("covers all six (preference × prefersDark) combinations", () => {
    const table: [Preference, boolean, string][] = [
      ["light", false, "light"],
      ["light", true, "light"],
      ["dark", false, "dark"],
      ["dark", true, "dark"],
      ["system", false, "light"],
      ["system", true, "dark"],
    ];
    for (const [pref, prefersDark, expected] of table) {
      expect(resolveAppearance(pref, prefersDark), `${pref} × ${prefersDark}`).toBe(expected);
    }
  });

  it("an OS change never revokes an explicit choice — stated in both directions", () => {
    // The headline rule. Same shape as motion-policy's step 3.
    expect(resolveAppearance("light", true)).toBe("light");
    expect(resolveAppearance("dark", false)).toBe("dark");
  });

  it("only the 'system' branch reads the signal at all", () => {
    // Invariant, expressed as: flipping the signal changes nothing except for
    // 'system'. If an implementation ever consulted it earlier, this fails.
    for (const pref of ["light", "dark"] as const) {
      expect(resolveAppearance(pref, false)).toBe(resolveAppearance(pref, true));
    }
    expect(resolveAppearance("system", false)).not.toBe(resolveAppearance("system", true));
  });
});

describe("shouldProject", () => {
  it("projects an explicit choice and nothing for 'system'", () => {
    expect(shouldProject("light")).toBe(true);
    expect(shouldProject("dark")).toBe(true);
    expect(shouldProject("system")).toBe(false);
  });
});

describe("the two compositions a host actually performs", () => {
  it("server render: cookie → attribute value, or nothing", () => {
    const project = (cookie: string | null) => {
      const pref = resolvePreference(cookie);
      return shouldProject(pref) ? pref : undefined;
    };
    expect(project("dark")).toBe("dark");
    expect(project("light")).toBe("light");
    expect(project("system")).toBeUndefined();
    expect(project(null)).toBeUndefined();
    expect(project("garbage")).toBeUndefined();
  });

  it("client render: preference + live signal → the appearance actually shown", () => {
    const shown = (stored: string | null, prefersDark: boolean) =>
      resolveAppearance(resolvePreference(stored), prefersDark);
    expect(shown(null, true)).toBe("dark");
    expect(shown(null, false)).toBe("light");
    expect(shown("light", true)).toBe("light");
    expect(shown("garbage", true)).toBe("dark");
  });
});
