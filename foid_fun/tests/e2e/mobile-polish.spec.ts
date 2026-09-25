import { test, expect, type BrowserContext, type Page } from "@playwright/test";

// Phone behaviour from the 2026-09-25 mobile pass: the home screen behind a
// closed window, one-tap open in the Finder apps, the collapsible sidebar,
// the MiFOID hero, and the pray window.

const PHONE = { width: 390, height: 844 };

async function skipBootAndTour(context: BrowserContext, page: Page) {
  await context.addCookies([
    { name: "foid_entered", value: "1", domain: "localhost", path: "/" },
    { name: "foid_onboarded", value: "1", domain: "localhost", path: "/" },
  ]);
  await page.addInitScript(() => {
    window.sessionStorage.setItem("foid_os_booted", "1");
    window.sessionStorage.setItem("foid_dock_arrived", "1");
  });
}

test.describe("phone polish", () => {
  test.use({ viewport: PHONE, hasTouch: true, isMobile: true });

  test.beforeEach(async ({ context, page }) => {
    await skipBootAndTour(context, page);
  });

  test("closing a window leaves the home screen, and the app's icon reopens it", async ({ page }) => {
    await page.goto("/files");
    const homeScreen = page.getByRole("region", { name: "Home screen" });
    await expect(homeScreen).toHaveCount(0);

    await page.getByRole("button", { name: "Close window to dock" }).tap();
    await expect(homeScreen).toBeVisible();
    await expect(homeScreen.getByRole("link", { name: "Pray" })).toBeVisible();

    await homeScreen.getByRole("button", { name: "Files" }).tap();
    await expect(homeScreen).toHaveCount(0);
    await expect(page.locator(".vista-window").first()).not.toHaveClass(/foid-window--minimized/);

    await page.getByRole("button", { name: "Close window to dock" }).tap();
    await homeScreen.getByRole("link", { name: "About" }).tap();
    await expect(page).toHaveURL(/\/about$/);
    await expect(homeScreen).toHaveCount(0);
  });

  test("one tap opens a file or a doc", async ({ page }) => {
    await page.goto("/files");
    await page.locator(".files-item").first().tap();
    await expect(page.locator(".files-player")).toBeVisible();

    await page.goto("/about");
    await page.locator(".files-item").first().tap();
    await expect(page.locator(".about-reader")).toBeVisible();
  });

  test("the sidebar is a drawer that closes once you pick a place", async ({ page }) => {
    await page.goto("/files");
    const sidebar = page.locator("#files-sidebar");
    await expect(sidebar).toBeHidden();

    await page.getByRole("button", { name: "Show sidebar" }).tap();
    await expect(sidebar).toBeVisible();

    const status = page.locator(".files-status__count");
    const before = await status.innerText();
    await sidebar.getByRole("button", { name: "Videos" }).tap();
    await expect(sidebar).toBeHidden();
    await expect(status).not.toHaveText(before);
  });

  test("MiFOID leads with the Game Boy", async ({ page }) => {
    await page.goto("/mifoid");
    const gameboy = await page.getByAltText("MiFOID Game Boy").boundingBox();
    const mint = await page.getByText("Mint status", { exact: false }).first().boundingBox();
    expect(gameboy).not.toBeNull();
    expect(mint).not.toBeNull();
    expect(gameboy!.y).toBeLessThan(mint!.y);
  });

  test("pray has a window and a working reminder link", async ({ page }) => {
    await page.goto("/pray");
    await expect(page.getByText("FOID_MOMMY.EXE")).toBeVisible();
    // Built after mount; the server can only render "#".
    await expect(page.locator(".pray-reminder-link").first()).toHaveAttribute("href", /^data:text\/calendar/);
  });
});

test.describe("desktop board and dock", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeEach(async ({ context, page }) => {
    await skipBootAndTour(context, page);
    await page.addInitScript(() => window.localStorage.setItem("foid_os_welcome_dismissed", "1"));
  });

  test("the board shows a loading state, not the empty invitation, while it loads", async ({ page }) => {
    // Hold the board data back so the loading window is long enough to see.
    await page.route("**/api/proposals*", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2500));
      await route.continue();
    });
    await page.goto("/?apps=board&focus=board");
    await expect(page.getByText("loading the loreboard", { exact: false })).toBeVisible();
    await expect(page.getByText("the canvas is open")).toHaveCount(0);
  });

  test("the dock carries the glass icons", async ({ page }) => {
    await page.goto("/?apps=mifoid&focus=mifoid");
    // Home is hidden on the desktop dock, so count the visible ones.
    const visible = page.locator(".foid-dock img.foid-glass-icon:visible");
    await expect(visible.first()).toBeVisible();
    expect(await visible.count()).toBeGreaterThanOrEqual(8);
    // Every glyph loads (a missing file would have naturalWidth 0).
    const broken = await page
      .locator(".foid-dock img.foid-glass-icon")
      .evaluateAll((els) => els.filter((el) => !(el as HTMLImageElement).naturalWidth).length);
    expect(broken).toBe(0);
  });
});

