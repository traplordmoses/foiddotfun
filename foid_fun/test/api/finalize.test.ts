import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ read: vi.fn(), multicall: vi.fn(), write: vi.fn() }));
vi.mock("viem", async () => ({ ...await vi.importActual("viem"), createPublicClient: () => ({ readContract: mocks.read, multicall: mocks.multicall }), createWalletClient: () => ({ writeContract: mocks.write }) }));
vi.mock("@/lib/contracts/addresses", () => ({ CONTRACTS: { SWIPE: "0x123" }, RPC_URL: "https://rpc.test", CHAIN_CONFIG: { id: 1, name: "test" } }));
vi.mock("@/lib/ipfs", () => ({ uploadJSON: vi.fn() }));
vi.mock("@/lib/proposalStore", () => ({ ProposalStore: { all: vi.fn() } }));
import { POST } from "@/app/api/swipe/finalize/route";
const request = (secret = "test-secret") => new NextRequest("https://foid.fun/api/swipe/finalize", { method: "POST", headers: { "x-cron-secret": secret } });
beforeEach(() => { vi.stubEnv("CRON_SECRET", "test-secret"); vi.stubEnv("OPERATOR_PK", "0x" + "01".repeat(32)); mocks.read.mockResolvedValue(1n); });
afterEach(() => { vi.unstubAllEnvs(); vi.resetAllMocks(); });
describe("finalization scan failures", () => {
  it("rejects unauthenticated callers", async () => { expect((await POST(request("wrong"))).status).toBe(401); expect(mocks.write).not.toHaveBeenCalled(); });
  it("fails the job on an incomplete proposal read before sending a transaction", async () => {
    mocks.multicall.mockResolvedValue([{ status: "failure" }]);
    expect((await POST(request())).status).toBe(500); expect(mocks.write).not.toHaveBeenCalled();
  });
  it("does not substitute zero votes for failed weight reads", async () => {
    mocks.multicall.mockResolvedValueOnce([{ status: "success", result: { finalized: false, votingEndsAt: 1n } }]).mockResolvedValueOnce([{ status: "failure" }, { status: "success", result: 1n }]);
    expect((await POST(request())).status).toBe(500); expect(mocks.write).not.toHaveBeenCalled();
  });
});
