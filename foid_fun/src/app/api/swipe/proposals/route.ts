import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http } from "viem";
import { LOREBOARD_ABI } from "@/lib/contracts/abis/loreboard";
import { CONTRACTS, RPC_URL, CHAIN_CONFIG } from "@/lib/contracts/addresses";
import { cidToHttpUrl } from "@/lib/ipfsUrl";
import { ProposalStore } from "@/lib/proposalStore";
import { goldskyEndpoint, goldskyQuery } from "@/lib/goldsky";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MULTICALL = "0xcA11bde05977b3631167028862bE2a173976CA11" as const;
const PAGE_SIZE = 100;
const MAX_FALLBACK = 1000;
const MAX_LAG = 64;
type Proposal = {
  id: number; proposer: string; ipfsCid: string; createdAt: number; votingEndsAt: number;
  finalized: boolean; approved: boolean; placementId: number; forCount: number; againstCount: number;
  gridX: number; gridY: number; gridW: number; gridH: number;
  voteCount?: number; overlapRejected?: boolean; name?: string; imageUrl?: string | null;
};
type Payload = { proposals: Proposal[]; count: number; nextCursor: number | null; stale?: boolean; fetchedAt: number; debug: { source: string; indexedBlock?: number } };
type Indexed = { proposalId: string; proposer: string; ipfsCid: string; x: number; y: number; w: number; h: number; votingEndsAt: string; finalized: boolean; approved: boolean; weightFor: string; weightAgainst: string; voteCount: number; overlapRejected: boolean; blockTimestamp: string; placement: { placementId: string } | null };
const fields = "proposalId proposer ipfsCid x y w h votingEndsAt finalized approved weightFor weightAgainst voteCount overlapRejected blockTimestamp placement { placementId }";
const cache = new Map<string, { data: Payload; at: number }>();
const inflight = new Map<string, Promise<Payload>>();
const chainSnapshot = new Map<number, Proposal>();
let chainSnapshotAt = 0;

function client(signal: AbortSignal) {
  return createPublicClient({
    chain: { id: CHAIN_CONFIG.id, name: CHAIN_CONFIG.name, nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 }, rpcUrls: { default: { http: [RPC_URL] } } },
    transport: http(RPC_URL, { retryCount: 0, timeout: 4000, fetchOptions: { signal } }),
  });
}
function page(proposals: Proposal[], cursor: number | null, history: boolean, count: number, source: string, owner: string | null = null): Payload {
  if (owner) proposals = proposals.filter((p) => p.proposer.toLowerCase() === owner);
  const closed = proposals.filter((p) => p.finalized && (cursor === null || p.id < cursor)).sort((a, b) => b.id - a.id);
  const rows = closed.slice(0, PAGE_SIZE);
  return { proposals: history ? rows : [...proposals.filter((p) => !p.finalized), ...rows], count,
    nextCursor: closed.length > PAGE_SIZE ? rows[rows.length - 1].id : null, fetchedAt: Date.now(), debug: { source } };
}
async function indexed(cursor: number | null, history: boolean, head: bigint, count: number, owner: string | null): Promise<Payload> {
  if (!goldskyEndpoint("loreboard")) throw new Error("Indexer not configured");
  const query = `{
    _meta { block { number } hasIndexingErrors }
    newest: proposals(first: 1, orderBy: proposalId, orderDirection: desc) { proposalId }
    active: proposals(first: 1000, where: { finalized: false ${owner ? `, proposer: "${owner}"` : ""} }, orderBy: proposalId, orderDirection: desc) { ${fields} }
    closed: proposals(first: ${PAGE_SIZE + 1}, where: { finalized: true ${owner ? `, proposer: "${owner}"` : ""} ${cursor === null ? "" : `, proposalId_lt: "${cursor}"`} }, orderBy: proposalId, orderDirection: desc) { ${fields} }
  }`;
  const data = await goldskyQuery<{ _meta: { block: { number: number }; hasIndexingErrors: boolean }; newest: { proposalId: string }[]; active: Indexed[]; closed: Indexed[] }>("loreboard", query, undefined, { timeoutMs: 4000 });
  if (!data._meta || data._meta.hasIndexingErrors || Number(head) - data._meta.block.number > MAX_LAG ||
      Number(data.newest[0]?.proposalId ?? -1) + 1 < count || data.active.length >= 1000) throw new Error("Indexer behind chain");
  const map = (p: Indexed): Proposal => ({ id: Number(p.proposalId), proposer: p.proposer, ipfsCid: p.ipfsCid, createdAt: Number(p.blockTimestamp ?? 0),
    votingEndsAt: Number(p.votingEndsAt), finalized: p.finalized, approved: p.approved, placementId: Number(p.placement?.placementId ?? 0),
    forCount: Number(p.weightFor), againstCount: Number(p.weightAgainst), voteCount: p.voteCount, overlapRejected: p.overlapRejected,
    gridX: p.x, gridY: p.y, gridW: p.w, gridH: p.h });
  const result = page([...data.active, ...data.closed].map(map), cursor, history, count, "goldsky");
  result.debug.indexedBlock = data._meta.block.number;
  return result;
}
async function fromChain(cursor: number | null, history: boolean, count: number, rpc: ReturnType<typeof client>, owner: string | null): Promise<Payload> {
  const address = CONTRACTS.SWIPE as `0x${string}`;
  if (Date.now() - chainSnapshotAt > 300_000) chainSnapshot.clear();
  // Reuse finalized records, refresh only new/unfinalized IDs. Never perform an
  // unbounded cold scan in a request; larger histories require the indexer.
  const ids: number[] = [];
  for (let id = 0; id < count; id++) if (!chainSnapshot.get(id)?.finalized) {
    ids.push(id);
    if (ids.length > MAX_FALLBACK) throw new Error("Indexer unavailable; fallback scan budget exceeded");
  }
  const next = new Map(chainSnapshot);
  for (let start = 0; start < ids.length; start += 50) {
    const batch = ids.slice(start, start + 50);
    const results = await rpc.multicall({ multicallAddress: MULTICALL, allowFailure: true, contracts: batch.map((id) => ({ address, abi: LOREBOARD_ABI, functionName: "getProposal" as const, args: [BigInt(id)] as const })) });
    const tallies = await rpc.multicall({ multicallAddress: MULTICALL, allowFailure: true, contracts: batch.flatMap((id) => [
      { address, abi: LOREBOARD_ABI, functionName: "voteWeightFor" as const, args: [BigInt(id)] as const },
      { address, abi: LOREBOARD_ABI, functionName: "voteWeightAgainst" as const, args: [BigInt(id)] as const },
      { address, abi: LOREBOARD_ABI, functionName: "uniqueVoterCount" as const, args: [BigInt(id)] as const },
    ]) });
    for (let i = 0; i < batch.length; i++) {
      const row = results[i], yes = tallies[i * 3], no = tallies[i * 3 + 1], voters = tallies[i * 3 + 2];
      if (row.status !== "success" || yes.status !== "success" || no.status !== "success" || voters.status !== "success") throw new Error("Incomplete chain response");
      const value = row.result;
      const p = (Array.isArray(value) ? Object.fromEntries(["id", "proposer", "ipfsCid", "createdAt", "votingEndsAt", "finalized", "approved", "placementId", "gridX", "gridY", "gridW", "gridH"].map((k, j) => [k, value[j]])) : value) as Record<string, unknown>;
      next.set(batch[i], { id: batch[i], proposer: String(p.proposer), ipfsCid: String(p.ipfsCid), createdAt: Number(p.createdAt), votingEndsAt: Number(p.votingEndsAt), finalized: Boolean(p.finalized), approved: Boolean(p.approved), placementId: Number(p.placementId), gridX: Number(p.gridX), gridY: Number(p.gridY), gridW: Number(p.gridW), gridH: Number(p.gridH), forCount: Number(yes.result), againstCount: Number(no.result), voteCount: Number(voters.result) });
    }
  }
  chainSnapshot.clear();
  if (!chainSnapshotAt || Date.now() - chainSnapshotAt > 300_000) chainSnapshotAt = Date.now();
  for (const [id, p] of next) if (id < count) chainSnapshot.set(id, p);
  return page([...chainSnapshot.values()], cursor, history, count, "rpc", owner);
}
async function load(cursor: number | null, history: boolean, owner: string | null): Promise<Payload> {
  const rpc = client(AbortSignal.timeout(15_000));
  const [head, rawCount] = await Promise.all([rpc.getBlockNumber(), rpc.readContract({ address: CONTRACTS.SWIPE as `0x${string}`, abi: LOREBOARD_ABI, functionName: "proposalCount" })]);
  const count = Number(rawCount);
  let payload: Payload;
  try { payload = await indexed(cursor, history, head, count, owner); }
  catch { payload = await fromChain(cursor, history, count, rpc, owner); }
  // Fetch only this page’s metadata using indexed ID/CID lookups.
  const names = new Map<string, string>();
  try { for (const p of await ProposalStore.forPage(payload.proposals.map((p) => String(p.id)), payload.proposals.map((p) => p.ipfsCid).filter(Boolean))) if (p.name) { names.set(p.id, p.name); if (p.cid) names.set(p.cid, p.name); } } catch { /* optional metadata, chain data remains usable */ }
  payload.proposals = payload.proposals.map((p) => ({ ...p, imageUrl: p.ipfsCid ? cidToHttpUrl(p.ipfsCid) : null, name: names.get(String(p.id)) ?? names.get(p.ipfsCid) }));
  return payload;
}
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const owner = params.get("owner")?.toLowerCase() ?? null;
  if (owner && !/^0x[\da-f]{40}$/.test(owner)) return NextResponse.json({ error: "Invalid owner" }, { status: 400 });
  const raw = params.get("cursor");
  if (raw !== null && (!/^\d+$/.test(raw) || !Number.isSafeInteger(Number(raw)))) return NextResponse.json({ error: "Invalid cursor" }, { status: 400 });
  const cursor = raw === null ? null : Number(raw);
  const history = params.get("scope") === "history";
  const key = `${history}:${cursor}:${owner}`;
  const cached = cache.get(key);
  const age = cached ? Date.now() - cached.at : Infinity;
  // Even cache-busting callers share a 2s floor to prevent refresh stampedes.
  if (cached && age < (params.has("bust") ? 2000 : 15_000)) return NextResponse.json(cached.data, { headers: { "Cache-Control": "no-store", "X-Swipe-Proposals-Cache": "HIT" } });
  try {
    let pending = inflight.get(key);
    if (!pending) {
      if (inflight.size >= 4) throw new Error("Refresh capacity reached");
      pending = load(cursor, history, owner).then((data) => {
        cache.delete(key); cache.set(key, { data, at: Date.now() });
        while (cache.size > 32) cache.delete(cache.keys().next().value!);
        return data;
      }).finally(() => { inflight.delete(key); });
      inflight.set(key, pending);
    }
    return NextResponse.json(await pending, { headers: { "Cache-Control": "no-store", "X-Swipe-Proposals-Cache": "MISS" } });
  } catch {
    if (cached && age < 300_000) return NextResponse.json({ ...cached.data, stale: true }, { headers: { "Cache-Control": "no-store", "X-Swipe-Proposals-Cache": "STALE" } });
    return NextResponse.json({ error: "Proposal data is temporarily unavailable. Please retry." }, { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "15" } });
  }
}
