import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ head: vi.fn(), count: vi.fn(), multicall: vi.fn(), query: vi.fn(), metadata: vi.fn() }));
vi.mock("viem", () => ({ createPublicClient: () => ({ getBlockNumber: mocks.head, readContract: mocks.count, multicall: mocks.multicall }), http: vi.fn() }));
vi.mock("@/lib/contracts/addresses", () => ({ CONTRACTS: { SWIPE: "0x123" }, RPC_URL: "https://rpc.test", CHAIN_CONFIG: { id: 1, name: "test" } }));
vi.mock("@/lib/proposalStore", () => ({ ProposalStore: { forPage: mocks.metadata } }));
vi.mock("@/lib/goldsky", () => ({ goldskyEndpoint: () => "https://indexer.test", goldskyQuery: mocks.query }));
const row = (id: number) => ({ proposalId: String(id), proposer: "0xabc", ipfsCid: "", x: 0, y: 0, w: 1, h: 1, votingEndsAt: "10", finalized: true, approved: false, weightFor: "1", weightAgainst: "0", voteCount: 1, overlapRejected: false, placement: null });
const indexed = (closed = [row(0)], block = 1000) => ({ _meta: { block: { number: block }, hasIndexingErrors: false }, newest: [{ proposalId: String(closed.length - 1) }], active: [], closed });
beforeEach(() => { vi.resetModules(); vi.resetAllMocks(); mocks.head.mockResolvedValue(1000n); mocks.count.mockResolvedValue(1n); mocks.query.mockResolvedValue(indexed()); mocks.metadata.mockResolvedValue([]); });
afterEach(() => vi.useRealTimers());
const req = (query = "") => new NextRequest(`https://foid.fun/api/swipe/proposals${query}`);
describe("proposal snapshots", () => {
  it("uses a page-scoped metadata lookup", async () => { const { GET } = await import("@/app/api/swipe/proposals/route"); const response = await GET(req()); expect(response.status).toBe(200); expect(mocks.metadata).toHaveBeenCalledOnce(); expect(mocks.multicall).not.toHaveBeenCalled(); });
  it("returns 100 finalized rows and an explicit next cursor", async () => {
    const rows = Array.from({ length: 101 }, (_, i) => row(100 - i)); mocks.count.mockResolvedValue(101n); mocks.query.mockResolvedValue(indexed(rows));
    const { GET } = await import("@/app/api/swipe/proposals/route"); const data = await (await GET(req())).json();
    expect(data.proposals).toHaveLength(100); expect(data.nextCursor).toBe(1);
  });
  it("detects block lag even if the proposal count has not changed", async () => {
    mocks.query.mockResolvedValue(indexed([row(0)], 1)); mocks.multicall.mockResolvedValue([{ status: "failure" }]);
    const { GET } = await import("@/app/api/swipe/proposals/route"); expect((await GET(req())).status).toBe(503); expect(mocks.multicall).toHaveBeenCalled();
  });
  it("coalesces simultaneous refresh requests", async () => {
    const { GET } = await import("@/app/api/swipe/proposals/route"); const responses = await Promise.all([GET(req()), GET(req()), GET(req())]);
    expect(responses.every((r) => r.status === 200)).toBe(true); expect(mocks.query).toHaveBeenCalledOnce();
  });
  it("preserves a recent snapshot during an RPC outage and marks it stale", async () => {
    vi.useFakeTimers(); const { GET } = await import("@/app/api/swipe/proposals/route"); await GET(req()); vi.advanceTimersByTime(16_000); mocks.head.mockRejectedValue(new Error("down"));
    const data = await (await GET(req())).json(); expect(data.stale).toBe(true); expect(data.proposals).toHaveLength(1);
  });
  it("rejects invalid cursors without making upstream calls", async () => { const { GET } = await import("@/app/api/swipe/proposals/route"); expect((await GET(req("?cursor=-1"))).status).toBe(400); expect(mocks.head).not.toHaveBeenCalled(); });
  it("bounds cold fallback scans instead of silently truncating history", async () => {
    mocks.count.mockResolvedValue(1001n); mocks.query.mockRejectedValue(new Error("down")); const { GET } = await import("@/app/api/swipe/proposals/route"); expect((await GET(req())).status).toBe(503); expect(mocks.multicall).not.toHaveBeenCalled();
  });
  it("validates owner filters before including them in an indexer query", async () => {
    const { GET } = await import("@/app/api/swipe/proposals/route");
    expect((await GET(req("?owner=invalid"))).status).toBe(400);
    expect(mocks.query).not.toHaveBeenCalled();
    await GET(req("?owner=0x" + "a".repeat(40)));
    expect(mocks.query.mock.calls[0][1]).toContain('proposer: "0x' + "a".repeat(40) + '"');
  });

});
