import { NextRequest, NextResponse } from "next/server";
import { BodyTooLargeError, fetchBounded, isTimeout, readBoundedJson } from "@/lib/boundedHttp";
import { consumeBudget, requestIdentity } from "@/lib/requestBudget";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
const METHODS = new Set([
  "eth_chainId", "eth_blockNumber", "eth_call", "eth_estimateGas", "eth_gasPrice",
  "eth_maxPriorityFeePerGas", "eth_feeHistory", "eth_getBalance", "eth_getCode",
  "eth_getTransactionCount", "eth_getTransactionByHash", "eth_getTransactionReceipt",
  "eth_getBlockByNumber", "eth_getBlockByHash", "eth_getLogs", "eth_sendRawTransaction",
  "net_version", "web3_clientVersion",
]);
let active = 0;
const noStore = { "Cache-Control": "no-store" };
function fail(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: { ...noStore, ...(status === 429 ? { "Retry-After": "60" } : {}) } });
}

/** Hosts a browser may call this relay from: the host the request was
 *  addressed to, plus the configured public site. Compare hosts, not full
 *  origins. Behind Cloudflare and Render, req.nextUrl is the internal
 *  listener (http://localhost:<port>), so a full-origin comparison
 *  rejected every same-site call from https://foid.fun. */
function allowedHosts(req: NextRequest): Set<string> {
  const hosts = new Set<string>();
  const forwarded = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = req.headers.get("host")?.trim();
  for (const value of [forwarded, host]) if (value) hosts.add(value.toLowerCase());
  for (const configured of [process.env.NEXT_PUBLIC_SITE_URL, process.env.FOID_APP_URL]) {
    if (!configured) continue;
    try { hosts.add(new URL(configured).host.toLowerCase()); } catch { /* ignore malformed config */ }
  }
  hosts.add(req.nextUrl.host.toLowerCase());
  return hosts;
}
export async function POST(req: NextRequest) {
  const rpcUrl = process.env.FLUENT_RPC_URL?.trim() || process.env.FLUENT_RPC?.trim() || process.env.NEXT_PUBLIC_FLUENT_RPC?.trim() || process.env.NEXT_PUBLIC_RPC_URL?.trim();
  if (!rpcUrl) return fail("RPC service unavailable", 503);
  const hosts = allowedHosts(req);
  for (const value of [req.headers.get("origin"), req.headers.get("referer")]) {
    if (!value) continue;
    try { if (!hosts.has(new URL(value).host.toLowerCase())) return fail("Cross-origin requests not allowed", 403); }
    catch { return fail("Invalid origin", 403); }
  }
  let body: unknown;
  try { body = await readBoundedJson(req, 256 * 1024, AbortSignal.timeout(5_000)); }
  catch (err) { return fail("Invalid or oversized request", err instanceof BodyTooLargeError ? 413 : 400); }
  const calls = Array.isArray(body) ? body : [body];
  if (!calls.length || calls.length > 20) return fail("Batch size must be 1..20", 400);
  for (const value of calls) {
    if (!value || typeof value !== "object") return fail("Invalid JSON-RPC call", 400);
    const call = value as { method?: unknown; params?: unknown; jsonrpc?: unknown };
    if (typeof call.method !== "string" || !METHODS.has(call.method)) return fail("Method not allowed", 403);
    if (call.jsonrpc !== "2.0" || (call.params !== undefined && !Array.isArray(call.params))) return fail("Invalid JSON-RPC call", 400);
    if (call.method === "eth_getLogs") {
      const filter = (call.params as Array<Record<string, unknown>> | undefined)?.[0];
      if (!filter || typeof filter !== "object") return fail("Invalid log filter", 400);
      if (filter.blockHash) {
        if (typeof filter.blockHash !== "string" || !/^0x[\da-f]{64}$/i.test(filter.blockHash) || filter.fromBlock !== undefined || filter.toBlock !== undefined) return fail("Invalid block hash filter", 400);
      } else {
        const start = filter.fromBlock, end = filter.toBlock;
        if (typeof start !== "string" || typeof end !== "string" || !/^(0x[\da-fA-F]+|latest)$/.test(start) || !/^(0x[\da-fA-F]+|latest)$/.test(end)) return fail("Log queries require explicit block bounds", 400);
        if (start !== "latest" && end !== "latest" && (BigInt(end) < BigInt(start) || BigInt(end) - BigInt(start) >= 100_000n)) return fail("Log range exceeds 100000 blocks", 400);
      }
    }
  }
  if (active >= 16) return fail("RPC busy; retry shortly", 429);
  active++;
  try {
    if (!await consumeBudget("rpc:global", 6000, 60_000, calls.length) ||
        !await consumeBudget(`rpc:${requestIdentity(req)}`, 600, 60_000, calls.length)) return fail("Too many RPC requests", 429);
    // Resolve latest once, then forward an explicit, bounded range. This keeps
    // wallet/event consumers compatible without allowing a genesis-to-head scan.
    const filters = calls.filter((c) => c.method === "eth_getLogs" && !c.params[0].blockHash).map((c) => c.params[0]);
    if (filters.some((f) => f.fromBlock === "latest" || f.toBlock === "latest")) {
      const head = await fetchBounded(rpcUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_blockNumber", params: [] }), signal: req.signal }, 4096, 4000);
      const latest = JSON.parse(new TextDecoder().decode(head.bytes)).result;
      if (!head.response.ok || typeof latest !== "string" || !/^0x[\da-f]+$/i.test(latest)) return fail("Upstream RPC unavailable", 502);
      for (const filter of filters) {
        if (filter.fromBlock === "latest") filter.fromBlock = latest;
        if (filter.toBlock === "latest") filter.toBlock = latest;
        if (BigInt(filter.toBlock) < BigInt(filter.fromBlock) || BigInt(filter.toBlock) - BigInt(filter.fromBlock) >= 100_000n) return fail("Log range exceeds 100000 blocks", 400);
      }
    }
    const { response, bytes } = await fetchBounded(rpcUrl, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body), cache: "no-store", signal: req.signal,
    }, 4 * 1024 * 1024, 12_000);
    if (!response.ok) return fail("Upstream RPC unavailable", 502);
    return new NextResponse(bytes, { headers: { ...noStore, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("[rpc] request failed", err instanceof Error ? err.name : "unknown");
    return fail(isTimeout(err) ? "RPC request timed out" : "RPC service unavailable", isTimeout(err) ? 504 : 503);
  } finally { active--; }
}
