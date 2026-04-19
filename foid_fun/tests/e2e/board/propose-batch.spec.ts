// tests/e2e/board/propose-batch.spec.ts
// Batch with partial success: drop 3 images, confirm 1st, reject 2nd. The
// remaining two items should stay queued for retry (not fail).
//
// Requires ANVIL_FORK_URL.
import { test, expect } from "@playwright/test";
import path from "node:path";

const ANVIL = process.env.ANVIL_FORK_URL;

test.describe("/board — batch with mid-batch rejection", () => {
  test.skip(!ANVIL, "ANVIL_FORK_URL not set — skip chain-dependent spec");

  test("3 items, reject #2 → 1 confirmed, 2 queued", async ({ page }) => {
    await page.goto("/board");
    await page.waitForSelector(".board-canvas");

    // Track sign count — first sign succeeds, second rejects, rest never get called.
    await page.addInitScript((rpc) => {
      let signCount = 0;
      const originalFetch = window.fetch.bind(window);
      (window as unknown as { ethereum: unknown }).ethereum = {
        isMetaMask: true,
        request: async ({ method, params }: { method: string; params?: unknown[] }) => {
          if (method === "eth_requestAccounts") {
            return ["0x1234567890abcdef1234567890abcdef12345678"];
          }
          if (method === "eth_chainId") return "0x5208";
          if (method === "eth_sendTransaction") {
            signCount++;
            if (signCount === 2) {
              const err = new Error("User rejected the request.");
              (err as unknown as { code: number }).code = 4001;
              throw err;
            }
          }
          const res = await originalFetch(rpc, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jsonrpc: "2.0", id: signCount, method, params }),
          });
          const body = (await res.json()) as { result?: unknown };
          return body.result;
        },
        on: () => {},
        removeListener: () => {},
      };
    }, ANVIL);

    const fixture = path.resolve(__dirname, "../fixtures/tile.png");
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press("p");
      const chooser = await page.waitForEvent("filechooser");
      await chooser.setFiles(fixture);
      await page.waitForSelector('[role="dialog"][aria-label*="Paint editor"]');
      await page.keyboard.press("Enter");
      await page.waitForSelector(`.board-pending:nth-child(${i + 1})`);
    }

    await page.getByRole("button", { name: /submit proposal/i }).click();
    await page.waitForSelector(".brm-panel");
    await page.keyboard.press("Shift+Enter");

    // Wait for the batch to settle.
    await page.waitForTimeout(3000);
    // Item 1: ENGRAVED badge
    await expect(page.locator(".board-pending").nth(0)).toContainText(/ENGRAVED/i);
    // Items 2 + 3: QUEUED badges (retry-ready)
    await expect(page.locator(".board-pending").nth(1)).toContainText(/CANCELLED|QUEUED/i);
    await expect(page.locator(".board-pending").nth(2)).toContainText(/QUEUED/i);
  });
});
