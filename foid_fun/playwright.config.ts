// playwright.config.ts
// E2E test config for the board flow. Intentionally minimal — we boot the
// existing `next dev` server and hit a few critical paths.
//
// Chain dependency: propose-*.spec.ts require an Anvil fork of Fluent to
// simulate wallet signatures without hitting mainnet. Those specs are
// gated behind `process.env.ANVIL_FORK_URL` (see each spec's beforeAll).
// a11y.spec.ts needs no chain — it's the gate that runs on every PR.
import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3000);
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;
const CHROME_EXECUTABLE = process.env.PLAYWRIGHT_CHROME_EXECUTABLE;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  fullyParallel: false, // canvas state can leak between tests; serialize
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [["github"], ["html"]] : [["list"], ["html", { open: "never" }]],
  // Snapshots for visual-regression tests land here. Keep the tolerance
  // tight but not zero — anti-aliasing drifts a few pixels across headless
  // Chromium versions.
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.02 },
    timeout: 10_000,
  },
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    viewport: { width: 1440, height: 900 },
    launchOptions: CHROME_EXECUTABLE
      ? { executablePath: CHROME_EXECUTABLE }
      : undefined,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "pnpm dev",
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        stderr: "pipe",
        stdout: "pipe",
      },
});
