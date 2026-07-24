import { test, expect } from "@playwright/test";

test.describe("core navigation and FOID OS dock", () => {
  test.beforeEach(async ({ context, page }) => {
    await context.addCookies([
      {
        name: "foid_entered",
        value: "1",
        domain: "localhost",
        path: "/",
      },
      {
        name: "foid_onboarded",
        value: "1",
        domain: "localhost",
        path: "/",
      },
    ]);
    await page.addInitScript(() => {
      window.localStorage.removeItem("foid-os-windows-v2");
      window.sessionStorage.setItem("foid_os_booted", "1");
      window.sessionStorage.setItem("foid_dock_arrived", "1");
    });
  });

  test("desktop hides Home and toggles the focused app from its dock icon", async ({ page }) => {
    await page.goto("/");
    const home = page.locator('a[href="/"]').filter({ hasText: "Home" });
    await expect(home).toBeHidden();

    const prayDockIcon = page.locator('[data-dock-app="pray"]');
    await prayDockIcon.click();

    const prayWindow = page.locator('section[aria-label="FOID_MOMMY_TERMINAL.EXE"]');
    await expect(prayWindow).toBeVisible();
    await expect(prayDockIcon).toHaveAttribute("aria-label", "Minimize Pray");

    await prayDockIcon.click();
    await expect(prayWindow).toHaveClass(/foid-window--minimized/);
    await expect(prayDockIcon).toHaveAttribute("aria-label", "Restore Pray");

    await prayDockIcon.click();
    await expect(prayWindow).toHaveClass(/foid-window--restoring/);
    await expect(prayDockIcon).toHaveAttribute("aria-label", "Minimize Pray");
  });

  test("mobile keeps Home available and legacy Swipe redirects to Vote", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/vote?standalone=1");

    const home = page.locator('a[href="/"]').filter({ hasText: "Home" });
    await expect(home).toBeVisible();
    await expect(home).toHaveCSS("min-height", "44px");

    await page.goto("/swipe");
    await expect(page).toHaveURL(/\/vote$/);
  });

  test("core routes stay within compact and modern phone viewports", async ({ page }) => {
    const viewports = [
      { width: 375, height: 667 },
      { width: 430, height: 932 },
    ];
    const routes = ["/", "/pray?standalone=1", "/board?standalone=1", "/vote?standalone=1"];

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      for (const route of routes) {
        await test.step(`${route} at ${viewport.width}x${viewport.height}`, async () => {
          await page.goto(route);
          await expect(page.locator(".foid-dock")).toBeVisible();
          const overflow = await page.evaluate(() => ({
            document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
            body: document.body.scrollWidth - document.body.clientWidth,
          }));
          expect(overflow.document).toBeLessThanOrEqual(1);
          expect(overflow.body).toBeLessThanOrEqual(1);
        });
      }
    }
  });
});
