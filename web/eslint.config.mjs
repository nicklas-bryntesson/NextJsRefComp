import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Throwaway measurement probes (see CLAUDE.md "Throwaway probes"). They are
    // gitignored, run directly through node, and deliberately use CommonJS so
    // they can resolve playwright from the submodule's node_modules via NODE_PATH.
    "tasks/**",
  ]),
]);

export default eslintConfig;
