// tests/e2e/board/propose-cancel.spec.ts
// User rejects a signature mid-submit → the item stays in the tray with a
// "CANCELLED" toast. Exercises the state-machine branch we cover in
// useProposalSubmit's unit test, but end-to-end through the UI.
//
// Requires ANVIL_FORK_URL — see propose-happy.spec.ts header for why.
import { test, expect } from "@playwright/test";
import path from "node:path";

const ANVIL = process.env.ANVIL_FORK_URL;

test.describe("/board — user rejection stays in tray", () => {
  test.skip(!ANVIL, "ANVIL_FORK_URL not set — skip chain-dependent spec");

  test("signature reject → item keeps pending state", async ({ page }) => {
    await page.goto("/board");
    await page.waitForSelector(".board-canvas");

    // Mock wallet that rejects eth_sendTransaction with the user-rejection
    // error shape parseWeb3Error recognizes (code 4001 or message match).
    await page.addInitScript(() => {
      (window as unknown as { ethereum: unknown }).ethereum = {
        isMetaMask: true,
        request: async ({ method }: { method: string }) => {
          if (method === "eth_requestAccounts") {
            return ["0x1234567890abcdef1234567890abcdef12345678"];
          }
          if (method === "eth_chainId") return "0x5208";
          if (method === "eth_sendTransaction" || method === "personal_sign") {
            const err = new Error("User rejected the request.");
            (err as unknown as { code: number }).code = 4001;
            throw err;
          }
          return null;
        },
        on: () => {},
        removeListener: () => {},
      };
    });

    await page.keyboard.press("p");
    const fileChooser = await page.waitForEvent("filechooser");
    await fileChooser.setFiles(path.resolve(__dirname, "../fixtures/tile.png"));
    await page.waitForSelector('[role="dialog"][aria-label*="Paint editor"]');
    await page.keyboard.press("Enter");

    await page.getByRole("button", { name: /submit proposal/i }).click();
    await page.waitForSelector(".brm-panel");
    await page.keyboard.press("Shift+Enter");

    // Celebration must NOT mount.
    await expect(page.locator(".pc-fullscreen")).not.toBeVisible();
    // Pending card is still on the canvas.
    await expect(page.locator(".board-pending")).toBeVisible();
    // A "Transaction cancelled" toast / live-region message landed.
    await expect(page.locator("#board-sr-status")).toContainText(/cancelled/i);
  });
});
