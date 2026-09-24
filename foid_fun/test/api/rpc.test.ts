import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const budget = vi.hoisted(() => vi.fn());
vi.mock("@/lib/requestBudget", () => ({ consumeBudget: budget, requestIdentity: () => "test" }));
import { POST } from "@/app/api/rpc/route";
const request = (body: unknown, headers = {}) => new NextRequest("https://foid.fun/api/rpc", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
const call = (method: string, params: unknown[] = []) => ({ jsonrpc: "2.0", id: 1, method, params });
beforeEach(() => { vi.stubEnv("FLUENT_RPC_URL", "https://rpc.test"); budget.mockResolvedValue(true); vi.stubGlobal("fetch", vi.fn(async () => Response.json({ jsonrpc: "2.0", id: 1, result: "0x100" }))); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); budget.mockReset(); });
describe("RPC proxy boundaries", () => {
  it("forwards wallet calls", async () => { expect((await POST(request(call("eth_call", [{ to: "0x123" }, "latest"])))).status).toBe(200); });
  it("does not expose debug or administrative methods", async () => { expect((await POST(request(call("debug_traceTransaction")))).status).toBe(403); expect(fetch).not.toHaveBeenCalled(); });
  it("rejects oversized batches", async () => { expect((await POST(request(Array.from({ length: 21 }, () => call("eth_chainId"))))).status).toBe(400); });
  it("rejects cross-origin browsers", async () => { expect((await POST(request(call("eth_chainId"), { origin: "https://other.test" }))).status).toBe(403); });
  it("accepts same-site browsers when the server sees an internal URL", async () => {
    // Production shape: Cloudflare -> Render -> next start. The route sees
    // http://localhost:10000 while the browser addressed https://foid.fun.
    const internal = new NextRequest("http://localhost:10000/api/rpc", {
      method: "POST",
      headers: { "content-type": "application/json", host: "foid.fun", origin: "https://foid.fun", referer: "https://foid.fun/board" },
      body: JSON.stringify(call("eth_chainId")),
    });
    expect((await POST(internal)).status).toBe(200);
  });
  it("still rejects other sites behind the same proxy", async () => {
    const internal = new NextRequest("http://localhost:10000/api/rpc", {
      method: "POST",
      headers: { "content-type": "application/json", host: "foid.fun", origin: "https://evil.test" },
      body: JSON.stringify(call("eth_chainId")),
    });
    expect((await POST(internal)).status).toBe(403);
  });
  it("enforces global budgets before contacting upstream", async () => { budget.mockResolvedValue(false); expect((await POST(request(call("eth_chainId")))).status).toBe(429); expect(fetch).not.toHaveBeenCalled(); });
  it("fails closed when shared budget storage is down", async () => { budget.mockRejectedValue(new Error("down")); expect((await POST(request(call("eth_chainId")))).status).toBe(503); expect(fetch).not.toHaveBeenCalled(); });
  it("rejects unbounded log queries", async () => { expect((await POST(request(call("eth_getLogs", [{ fromBlock: "0x0", toBlock: "0x20000" }])))).status).toBe(400); });
  it("resolves latest for bounded log queries", async () => {
    expect((await POST(request(call("eth_getLogs", [{ fromBlock: "0xff", toBlock: "latest" }])))).status).toBe(200);
    const second = vi.mocked(fetch).mock.calls[1][1];
    expect(JSON.parse(second!.body as string).params[0].toBlock).toBe("0x100");
  });
  it("hides private upstream errors", async () => { vi.mocked(fetch).mockResolvedValue(new Response("secret provider diagnostics", { status: 500 })); const res = await POST(request(call("eth_chainId"))); expect(res.status).toBe(502); expect(await res.text()).not.toContain("secret"); });
});
