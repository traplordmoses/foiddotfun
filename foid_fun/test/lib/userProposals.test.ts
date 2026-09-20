import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchUserProposals } from "@/lib/userProposals";
afterEach(() => vi.unstubAllGlobals());
describe("owner proposal pagination", () => {
  it("follows the owner cursor without losing older proposals", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ proposals: [{ id: 100 }], nextCursor: 100 })).mockResolvedValueOnce(Response.json({ proposals: [{ id: 3 }], nextCursor: null }));
    vi.stubGlobal("fetch", fetcher);
    const data = await fetchUserProposals("0xabc");
    expect(data.proposals).toEqual([{ id: 100 }, { id: 3 }]);
    expect(fetcher.mock.calls[1][0]).toContain("owner=0xabc&scope=history&cursor=100");
  });
  it("rejects an incomplete history instead of claiming it is complete", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(Response.json({ proposals: [{ id: 100 }], nextCursor: 100 })).mockResolvedValueOnce(new Response(null, { status: 503 })));
    await expect(fetchUserProposals("0xabc")).rejects.toThrow("temporarily unavailable");
  });
  it("rejects a repeated cursor rather than looping indefinitely", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ proposals: [], nextCursor: 5 })));
    await expect(fetchUserProposals("0xabc")).rejects.toThrow("Invalid history cursor");
  });
});
