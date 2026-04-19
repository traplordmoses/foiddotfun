import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Keep vitest scoped to the `test/` tree. Playwright E2E lives under
    // `tests/e2e/` and has its own runner (playwright.config.ts); picking
    // it up here would spuriously fail on Playwright-only imports.
    include: ["test/**/*.test.ts"],
    exclude: ["node_modules/**", "tests/e2e/**"],
    environmentMatchGlobs: [
      // Wallet tests need Web Crypto API + localStorage (happy-dom)
      ["test/wallet/**", "happy-dom"],
      // Hook tests render React trees, which need a DOM
      ["test/hooks/**", "happy-dom"],
      // Coverage targets for the primitives + effects
      ["test/effects/**", "happy-dom"],
      ["test/ui/**", "happy-dom"],
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      include: [
        "src/hooks/**/*.ts",
        "src/lib/concurrency.ts",
        "src/effects/placementPersonalization.ts",
        "src/components/ui/**/*.tsx",
      ],
      // Per the PR acceptance criteria:
      //   hooks ≥ 85%, primitives ≥ 75%.
      // These are the minimum bars for this commit; the CI gate enforces them.
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70,
        // Per-path overrides — the acceptance criteria are per-layer, not global.
        "src/hooks/**": {
          lines: 85,
          functions: 85,
          branches: 80,
          statements: 85,
        },
        "src/components/ui/**": {
          lines: 75,
          functions: 75,
          branches: 70,
          statements: 75,
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
