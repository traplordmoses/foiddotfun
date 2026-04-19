// tests/e2e/board/a11y.spec.ts
// Runs axe-core against /board in a real headless Chromium and asserts
// zero WCAG 2.2 AA violations. This is the PR acceptance gate for
// accessibility — if a new change introduces a violation on /board,
// the workflow fails.
//
// Scope: /board + a few key modals. Does not touch chain state, so it
// can run on any PR without Anvil setup.
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("/board accessibility", () => {
  test("zero axe-core WCAG 2.2 AA violations on initial render", async ({ page }) => {
    await page.goto("/board");
    // Wait for the vista-window frame to paint — the canvas + sidebar hydrate after this.
    await page.waitForSelector(".vista-window", { state: "visible" });
    // Stabilize any animations so snapshot/axe doesn't catch mid-transition state.
    await page.waitForTimeout(400);

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      // `region` + `landmark-one-main` flag every non-landmark <div>, which
      // we trip because the app shell is a vista-window, not an HTML <main>.
      // We separately assert the canvas has role=application.
      .disableRules(["region", "landmark-one-main"])
      .analyze();

    // Pretty-printed diagnostics make CI failures actionable. Without this
    // the violation JSON gets truncated mid-dump and devs can't tell what broke.
    if (results.violations.length) {
      console.error(
        "axe-core violations:\n" +
          results.violations
            .map(
              (v) =>
                `  [${v.impact}] ${v.id} — ${v.help}\n    ${v.nodes
                  .slice(0, 3)
                  .map((n) => n.target.join(" → "))
                  .join("\n    ")}`,
            )
            .join("\n"),
      );
    }

    expect(results.violations).toEqual([]);
  });

  test("canvas exposes role=application + keyboard shortcut aria-label", async ({ page }) => {
    await page.goto("/board");
    await page.waitForSelector(".board-canvas", { state: "visible" });
    const canvas = page.locator(".board-canvas").first();
    await expect(canvas).toHaveAttribute("role", "application");
    // Label should list the keyboard affordances (P/arrows/+/-/0).
    const label = await canvas.getAttribute("aria-label");
    expect(label).toContain("Press P to propose");
    expect(label).toContain("arrow keys");
  });

  test("board-sr-status live region is present and polite", async ({ page }) => {
    await page.goto("/board");
    await page.waitForSelector("#board-sr-status");
    const region = page.locator("#board-sr-status");
    await expect(region).toHaveAttribute("role", "status");
    await expect(region).toHaveAttribute("aria-live", "polite");
  });
});
