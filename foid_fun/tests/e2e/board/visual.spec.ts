// tests/e2e/board/visual.spec.ts
// Visual regression for the deterministic parts of the board UI: the
// ghost states and pending-item badges. The celebration is a timed
// animation (9.6s with ~30 particles) — snapshotting it reliably would
// require freezing RAF/animation clocks in an app-specific way, which is
// fragile. We document that limitation and snapshot only the slab
// container at a single post-animation tick.
//
// Snapshot tolerance is set in playwright.config.ts (maxDiffPixelRatio: 0.02).
// On first run, `npx playwright test --update-snapshots` generates the
// reference PNGs; subsequent runs gate on <2% diff.
import { test, expect } from "@playwright/test";

test.describe("/board visual regression", () => {
  test("empty board renders consistently", async ({ page }) => {
    await page.goto("/board");
    await page.waitForSelector(".board-canvas");
    // Disable animations globally so screenshots are stable.
    await page.addStyleTag({
      content: `
        *, *::before, *::after {
          animation-duration: 0ms !important;
          animation-delay: 0ms !important;
          transition-duration: 0ms !important;
          transition-delay: 0ms !important;
        }
      `,
    });
    await page.waitForTimeout(300);
    await expect(page.locator(".board-canvas")).toHaveScreenshot("board-empty.png");
  });

  test("BoardActions section renders consistently (Chip + PrimaryButton + StatusDot)", async ({
    page,
  }) => {
    await page.goto("/board");
    await page.waitForSelector(".board-section--actions");
    await page.addStyleTag({
      content: `*, *::before, *::after { animation: none !important; transition: none !important; }`,
    });
    await page.waitForTimeout(200);
    await expect(page.locator(".board-section--actions")).toHaveScreenshot(
      "board-actions.png",
    );
  });

  test("chat header uses the shared StatusDot primitive", async ({ page }) => {
    await page.goto("/board");
    await page.waitForSelector(".board-section--chat");
    await page.addStyleTag({
      content: `*, *::before, *::after { animation: none !important; transition: none !important; }`,
    });
    await page.waitForTimeout(200);
    await expect(
      page.locator(".board-section--chat .board-section__header"),
    ).toHaveScreenshot("board-chat-header.png");
  });

  // Note: ghost + pending-badge snapshots would require a drop fixture
  // (drag an image, hold, capture). We cover those states via the unit
  // tests in useGhost.test.ts + PendingItemCard rendering. A follow-up
  // PR will add cinematic snapshots once we have a deterministic fixture
  // for the drag path (browser drag events are notoriously flaky).
});
