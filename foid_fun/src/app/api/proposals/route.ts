import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http } from "viem";
import { LOREBOARD_ABI } from "@/lib/contracts/abis/loreboard";
import { CONTRACTS, RPC_URL, CHAIN_CONFIG } from "@/lib/contracts/addresses";
import { cidToHttpUrl } from "@/lib/ipfsUrl";
import { goldskyEndpoint, goldskyQuery, GoldskyError } from "@/lib/goldsky";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ──────────────────────────────────────────────────────────────────────
// In-process cache for the proposal list.
//
// Why this exists: the `/board` first-paint is gated on this endpoint's
// response. Every hit previously re-read the Loreboard contract (1 +
// placementCount multicall reads) — which on a cold Render instance
// took ~23s to return 36KB of data, blocking the entire board render.
// On warm instances it's ~500ms, still paid by every visitor.
//
// A 15s TTL coalesces a traffic burst to one RPC round-trip — at our
// traffic that means the first visitor in any 15-second window warms
// the cache and everyone else gets a ~10ms in-memory response. The
// client already runs a block-number watcher (see useBoardData.ts)
// that forces a refetch when new blocks arrive, so visibly-stale data
// is bounded by block time, not this TTL.
//
// Inflight dedup: if two requests arrive with an empty cache, they
// share the same underlying RPC fetch rather than racing. Matters
// during cold-start when 5+ visitors can pile up before the first
// response lands.
//
// Owner-filtered requests bypass the cache — they're per-user views
// (dashboard) and the filter applies server-side, so reusing the
// full-list cache would leak other users' data.
// ──────────────────────────────────────────────────────────────────────

type ProposalsPayload = {
  proposals: unknown[];
  debug: {
    source: string;
    placementsCount?: number;
    activeCount?: number;
    count?: number;
    note?: string;
  };
};

const CACHE_TTL_MS = 15_000;
let cachedPayload: { data: ProposalsPayload; at: number } | null = null;
let inflightFetch: Promise<ProposalsPayload> | null = null;

function getCached(): ProposalsPayload | null {
  if (!cachedPayload) return null;
  if (Date.now() - cachedPayload.at > CACHE_TTL_MS) return null;
  return cachedPayload.data;
}

type PlacementTuple = {
  proposalId: bigint;
  placer: string;
  ipfsCid: string;
  x: number;
  y: number;
  w: number;
  h: number;
  placedAt: bigint;
  removed: boolean;
};

function parsePlacement(raw: unknown): PlacementTuple {
  if (Array.isArray(raw)) {
    return {
      proposalId: raw[0] as bigint,
      placer: raw[1] as string,
      ipfsCid: raw[2] as string,
      x: Number(raw[3] ?? 0),
      y: Number(raw[4] ?? 0),
      w: Number(raw[5] ?? 0),
      h: Number(raw[6] ?? 0),
      placedAt: raw[7] as bigint,
      removed: raw[8] as boolean,
    };
  }
  return raw as PlacementTuple;
}

// ──────────────────────────────────────────────────────────────────────
// Primary fetch path: Goldsky subgraph.
//
// The subgraph indexes `PlacementCreated` / `Placement*Removed` events
// into a Postgres-style read store. A single GraphQL request returns the
// full placement list in ~80–200ms — vs ~500ms–23s for the RPC multicall
// path that reads every placement slot one by one. On cold Render
// instances the subgraph hop doesn't need to boot a viem client or
// negotiate an RPC session, so the first-visitor penalty drops
// dramatically too.
//
// We still keep the RPC path (below) as a fallback for three cases:
//   1. Subgraph URL not configured (local dev, fresh mainnet deploy
//      before the subgraph URL is set).
//   2. Subgraph query errors out (transient, network, or Goldsky ops).
//   3. Subgraph is visibly behind — see `goldskyLookedAhead` below.
// ──────────────────────────────────────────────────────────────────────

type GoldskyCanonizedPlacement = {
  placementId: string;
  placer: string;
  ipfsCid: string;
  x: number;
  y: number;
  w: number;
  h: number;
  removed: boolean;
  blockTimestamp: string;
};

type GoldskyCanonizedProposal = {
  proposalId: string;
  weightFor: string;
  weightAgainst: string;
  placement: GoldskyCanonizedPlacement | null;
};

type GoldskyCanonizedProposalsResponse = {
  proposals: GoldskyCanonizedProposal[];
};

function formatPlacement(
  placementId: string | number,
  proposalId: string | number,
  placer: string,
  ipfsCid: string,
  x: number,
  y: number,
  w: number,
  h: number,
  placedAt: number,
  removed: boolean,
  yesVotes: number = 0,
  noVotes: number = 0,
): unknown {
  return {
    id: String(placementId),
    placementId: String(placementId),
    proposalId: Number(proposalId),
    owner: placer,
    bidder: placer,
    x,
    y,
    w,
    h,
    rect: { x, y, w, h },
    cells: Math.ceil(w / 32) * Math.ceil(h / 32),
    cid: ipfsCid?.replace("ipfs://", "") ?? null,
    imageUrl: ipfsCid ? cidToHttpUrl(ipfsCid) : null,
    placedAt,
    removed,
    epochSubmitted: 0,
    epoch: 0,
    bidPerCellWei: "0",
    cidHash: "0x",
    yesVotes,
    noVotes,
    status: "canonized" as const,
    isVotable: false,
    registeredAt: placedAt,
    voteEndsAt: null,
    boardVersion: "loreboard" as const,
  };
}

async function fetchFromGoldsky(): Promise<ProposalsPayload | null> {
  if (!goldskyEndpoint("loreboard")) return null;

  // Query proposals (not placements) so we can pull vote tallies in the
  // same hop. The subgraph links Proposal → Placement, and vote weights
  // (`weightFor`/`weightAgainst`) live on the Proposal entity — the
  // Placement entity doesn't carry them. Filter matches "canonized":
  // finalized + approved + not overlap-rejected. Non-null, non-removed
  // placement is enforced client-side below.
  const query = `{
    proposals(
      where: { finalized: true, approved: true, overlapRejected: false },
      first: 1000,
      orderBy: proposalId,
      orderDirection: asc
    ) {
      proposalId
      weightFor
      weightAgainst
      placement {
        placementId
        placer
        ipfsCid
        x
        y
        w
        h
        removed
        blockTimestamp
      }
    }
  }`;

  try {
    const data = await goldskyQuery<GoldskyCanonizedProposalsResponse>(
      "loreboard",
      query,
      undefined,
      { timeoutMs: 4_000 },
    );

    const proposals = data.proposals
      .filter((p): p is GoldskyCanonizedProposal & { placement: GoldskyCanonizedPlacement } =>
        p.placement != null && !p.placement.removed,
      )
      .map((p) =>
        formatPlacement(
          p.placement.placementId,
          p.proposalId,
          p.placement.placer,
          p.placement.ipfsCid,
          p.placement.x,
          p.placement.y,
          p.placement.w,
          p.placement.h,
          Number(p.placement.blockTimestamp),
          p.placement.removed,
          Number(p.weightFor),
          Number(p.weightAgainst),
        ),
      );

    return {
      proposals,
      debug: {
        source: "goldsky",
        placementsCount: proposals.length,
        activeCount: proposals.length,
      },
    };
  } catch (err) {
    if (err instanceof GoldskyError) {
      console.warn("[api/proposals] Goldsky fallback to RPC:", err.message);
    } else {
      console.warn("[api/proposals] Goldsky unknown error, falling back:", err);
    }
    return null;
  }
}

async function fetchFromRpc(): Promise<ProposalsPayload> {
  const contractAddress = CONTRACTS.SWIPE as `0x${string}`;
  if (!contractAddress || contractAddress.length < 42) {
    return {
      proposals: [],
      debug: { source: "loreboard", note: "Loreboard contract not configured" },
    };
  }

  const client = createPublicClient({
    chain: {
      id: CHAIN_CONFIG.id,
      name: CHAIN_CONFIG.name,
      nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
      rpcUrls: { default: { http: [RPC_URL] } },
      contracts: {
        multicall3: {
          address: "0xcA11bde05977b3631167028862bE2a173976CA11" as `0x${string}`,
          blockCreated: 0,
        },
      },
    },
    transport: http(RPC_URL),
  });

  const count = (await client.readContract({
    address: contractAddress,
    abi: LOREBOARD_ABI,
    functionName: "placementCount",
  })) as bigint;

  const placementCount = Number(count);
  if (placementCount === 0) {
    return { proposals: [], debug: { source: "loreboard", count: 0 } };
  }

  const calls = Array.from({ length: placementCount }, (_, i) => ({
    address: contractAddress,
    abi: LOREBOARD_ABI,
    functionName: "getPlacement" as const,
    args: [BigInt(i)] as const,
  }));

  const results = await client.multicall({
    contracts: calls,
    allowFailure: true,
  });

  const proposals: unknown[] = [];

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status !== "success") {
      console.error(`[api/proposals] Failed to read placement ${i}:`, result.error);
      continue;
    }

    const p = parsePlacement(result.result);

    if (p.removed) continue;

    proposals.push(
      formatPlacement(
        i,
        Number(p.proposalId),
        p.placer,
        p.ipfsCid,
        p.x,
        p.y,
        p.w,
        p.h,
        Number(p.placedAt),
        p.removed,
      ),
    );
  }

  return {
    proposals,
    debug: {
      source: "rpc",
      placementsCount: placementCount,
      activeCount: proposals.length,
    },
  };
}

// If the subgraph is behind the chain head by more than this many placements,
// fall back to RPC so a freshly-finalized proposal shows up right away instead
// of waiting for Goldsky to catch up (can be several minutes on busy days).
const SUBGRAPH_LAG_TOLERANCE = 0;

async function rpcPlacementCount(): Promise<number | null> {
  const contractAddress = CONTRACTS.SWIPE as `0x${string}`;
  if (!contractAddress || contractAddress.length < 42) return null;
  try {
    const client = createPublicClient({
      chain: {
        id: CHAIN_CONFIG.id,
        name: CHAIN_CONFIG.name,
        nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
        rpcUrls: { default: { http: [RPC_URL] } },
      },
      transport: http(RPC_URL),
    });
    const count = (await client.readContract({
      address: contractAddress,
      abi: LOREBOARD_ABI,
      functionName: "placementCount",
    })) as bigint;
    return Number(count);
  } catch {
    return null;
  }
}

async function fetchAllPlacements(): Promise<ProposalsPayload> {
  const [fromSubgraph, chainPlacementCount] = await Promise.all([
    fetchFromGoldsky(),
    rpcPlacementCount(),
  ]);

  // Subgraph lag detection: if the chain reports more placements than the
  // subgraph returned, the subgraph hasn't indexed the latest PlacementCreated
  // events yet. Fall back to RPC so the board doesn't hide just-finalized
  // placements for minutes.
  if (fromSubgraph && chainPlacementCount !== null) {
    const lag = chainPlacementCount - fromSubgraph.proposals.length;
    if (lag > SUBGRAPH_LAG_TOLERANCE) {
      console.warn(
        `[api/proposals] subgraph behind by ${lag} placements (${fromSubgraph.proposals.length} vs ${chainPlacementCount}); falling back to RPC`,
      );
      const rpcData = await fetchFromRpc();
      return {
        ...rpcData,
        debug: { ...rpcData.debug, note: `subgraph lag ${lag}, used rpc` },
      };
    }
  }

  if (fromSubgraph) return fromSubgraph;
  return fetchFromRpc();
}

async function getPlacements(
  opts: { forceFresh?: boolean } = {},
): Promise<{ data: ProposalsPayload; fromCache: boolean }> {
  if (!opts.forceFresh) {
    const cached = getCached();
    if (cached) return { data: cached, fromCache: true };
  }

  if (inflightFetch) return { data: await inflightFetch, fromCache: false };

  inflightFetch = (async () => {
    try {
      const data = await fetchAllPlacements();
      cachedPayload = { data, at: Date.now() };
      return data;
    } finally {
      inflightFetch = null;
    }
  })();

  return { data: await inflightFetch, fromCache: false };
}

type PlacementWithPlacer = { owner: string };

/**
 * GET /api/proposals — Returns canonized (finalized + approved) placements from the Loreboard.
 *
 * Reads from the unified Loreboard contract's `getPlacement()` function.
 * Only returns non-removed placements with status "canonized".
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const owner = searchParams.get("owner")?.toLowerCase() ?? null;
  // Callers that need post-mutation freshness (e.g. board refetch after a
  // successful submit) pass `?bust=1` to skip the in-memory cache.
  const forceFresh = searchParams.has("bust");

  try {
    const { data: full, fromCache } = await getPlacements({ forceFresh });

    // Owner filter applied post-cache: the underlying list is shared, but
    // we re-scope per-request so each dashboard call only sees its own
    // placements without bypassing the cache.
    const proposals = owner
      ? full.proposals.filter(
          (p): p is typeof p => typeof p === "object" && p !== null &&
            (p as PlacementWithPlacer).owner?.toLowerCase() === owner,
        )
      : full.proposals;

    return NextResponse.json(
      { proposals, debug: full.debug },
      {
        headers: {
          "Content-Type": "application/json",
          // Server-side cache (above) is authoritative. Tell the browser
          // to trust a fresh response for ~5s and allow stale-while-
          // revalidate for another 20s — matches the 15s TTL roughly.
          "Cache-Control": "public, max-age=5, s-maxage=5, stale-while-revalidate=20",
          "X-Proposals-Cache": fromCache ? "HIT" : "MISS",
        },
      },
    );
  } catch (error) {
    console.error("[api/proposals] Error:", error);
    return NextResponse.json({ proposals: [], error: String(error) }, { status: 500 });
  }
}
