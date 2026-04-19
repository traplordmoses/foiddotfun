// tests/e2e/board/propose-happy.spec.ts
// Happy path: drop image → paint → submit → review modal → (mocked wallet
// via injected window.ethereum) → celebration shown.
//
// This spec REQUIRES an Anvil fork of Fluent on ANVIL_FORK_URL so the
// propose() transaction can be signed + mined locally. Without it, the
// submit would try to hit mainnet — we skip instead. CI runs this spec
// only when the anvil service is up.
import { test, expect } from "@playwright/test";
import path from "node:path";

const ANVIL = process.env.ANVIL_FORK_URL;

test.describe("/board — propose happy path", () => {
  test.skip(!ANVIL, "ANVIL_FORK_URL not set — skip chain-dependent spec");

  test("drop → paint → submit → celebration", async ({ page }) => {
    await page.goto("/board");
    await page.waitForSelector(".board-canvas");

    // Inject a minimal mock ethereum provider that auto-accepts everything
    // and forwards to the local Anvil node.
    await page.addInitScript((rpc) => {
      const originalFetch = window.fetch.bind(window);
      (window as unknown as { ethereum: unknown }).ethereum = {
        isMetaMask: true,
        request: async ({ method, params }: { method: string; params?: unknown[] }) => {
          if (method === "eth_requestAccounts") {
            return ["0x1234567890abcdef1234567890abcdef12345678"];
          }
          if (method === "eth_chainId") {
            return "0x5208"; // testnet
          }
          // Forward everything else to Anvil.
          const res = await originalFetch(rpc, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
          });
          const body = (await res.json()) as { result?: unknown };
          return body.result;
        },
        on: () => {},
        removeListener: () => {},
      };
    }, ANVIL);

    // Trigger file picker via the P-key shortcut — exercises the keyboard-
    // only flow the a11y PR introduced.
    await page.keyboard.press("p");

    // Uploads a 1×1 PNG fixture so the image-size helpers get valid bytes.
    const fixturePath = path.resolve(__dirname, "../fixtures/tile.png");
    const fileChooser = await page.waitForEvent("filechooser");
    await fileChooser.setFiles(fixturePath);

    // PaintEditor opens — hit Enter to confirm with no edits.
    await page.waitForSelector('[role="dialog"][aria-label*="Paint editor"]');
    await page.keyboard.press("Enter");

    // Pending card appears → click SUBMIT PROPOSAL.
    await page.getByRole("button", { name: /submit proposal/i }).click();

    // Review modal → Shift+Enter confirms.
    await page.waitForSelector(".brm-panel");
    await page.keyboard.press("Shift+Enter");

    // Celebration mounts once the tx lands.
    await expect(page.locator(".pc-fullscreen")).toBeVisible({ timeout: 30_000 });
    await expect(page.locator(".pc-headline")).toContainText(/ENGRAVED|FIRST ENGRAVING/);
  });
});
