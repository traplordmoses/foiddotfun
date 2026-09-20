import { test, expect } from "@playwright/test";

test("cold entry navigates once even when audio is unavailable", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "AudioContext", { configurable: true, value: class { constructor() { throw new Error("audio unavailable"); } } });
    Object.defineProperty(window, "webkitAudioContext", { configurable: true, value: window.AudioContext });
  });
  await page.goto("/");
  await expect(page).toHaveURL(/\/enter/);
  await page.getByRole("button", { name: "Enter FOID Foundation" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "The internet’s permanent memory" })).toBeVisible();
  await page.getByRole("button", { name: "Start a daily prayer" }).click();
  await expect(page.locator('section[aria-label="FOID_MOMMY_TERMINAL.EXE"]')).toBeVisible();
});

for (const size of [{ width: 375, height: 667 }, { width: 390, height: 844 }]) {
  test(`prayer composer clears the dock at ${size.width}x${size.height}`, async ({ page, context, baseURL }) => {
    await page.setViewportSize(size);
    await context.addCookies([{ name: "foid_entered", value: "1", url: baseURL! }]);
    await page.goto("/pray?standalone=1");
    await page.getByRole("button", { name: "START PRAYING" }).click();
    const field = page.getByRole("textbox", { name: "Message to Foid Mommy" });
    await expect(field).toBeEnabled({ timeout: 30_000 });
    await field.fill("a test feeling");
    const memory = page.getByRole("checkbox", { name: /Remember feeling labels/ });
    await expect(memory).not.toBeChecked();
    const dock = await page.locator(".foid-dock").boundingBox();
    const input = await field.boundingBox();
    const send = await page.getByRole("button", { name: "Send", exact: true }).boundingBox();
    expect(input!.y + input!.height).toBeLessThan(dock!.y);
    expect(send!.y + send!.height).toBeLessThan(dock!.y);
    // Simulate the visual viewport contraction rather than only changing CSS width.
    await page.evaluate(() => {
      Object.defineProperty(window.visualViewport, "height", { configurable: true, value: 330 });
      window.visualViewport!.dispatchEvent(new Event("resize"));
    });
    await expect(page.locator(".foid-dock")).toBeHidden();
    await expect.poll(async () => { const r = await field.boundingBox(); return r!.y + r!.height; }).toBeLessThan(330);
  });
}
