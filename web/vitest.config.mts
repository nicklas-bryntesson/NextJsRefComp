/* Vitest, for the kernel's pure-logic conformance tests only.
 *
 * PORTING.md excludes the reference *.unit.test.* files from the portable
 * contract, and that exclusion holds for the components (those tests are
 * white-box). The kernel's pure modules are different: motion-policy is two
 * pure functions with a published API, so its conformance test re-points at our
 * port unchanged. `environment: 'node'` — no jsdom needed, by design.
 */
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/tests/**/*.test.ts"],
  },
});
