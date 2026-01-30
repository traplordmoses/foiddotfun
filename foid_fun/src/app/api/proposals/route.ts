import { NextRequest, NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { Buffer } from "buffer";
import bs58 from "bs58";
import { decodeFunctionData, hexToString, parseAbi } from "viem";
import { publicClient } from "@/lib/viem";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const VOTING_URL =
  process.env.GOLDSKY_VOTING_URL ||
  "https://api.goldsky.com/api/public/project_cmkwd7dgh0bq501z7fog65iag/subgraphs/foid-loreboard-fluent-testnet/2.0.1/gn";

const BOARD_V2_URL =
  process.env.GOLDSKY_BOARD_V2_URL ||
  process.env.GOLDSKY_BOARD_URL ||
  "https://api.goldsky.com/api/public/project_cmkwd7dgh0bq501z7fog65iag/subgraphs/foid-loreboard-fluent-testnet/2.0.0/gn";

const BOARD_V1_URL =
  process.env.GOLDSKY_BOARD_V1_URL ||
  "https://api.goldsky.com/api/public/project_cmkwd7dgh0bq501z7fog65iag/subgraphs/foid-loreboard-fluent-testnet/2.0.2/gn";

// contracts (optional)
const BOARD_V1_ADDRESS = process.env.BOARD_V1_ADDRESS as `0x${string}` | undefined;
const BOARD_V2_ADDRESS = process.env.BOARD_V2_ADDRESS as `0x${string}` | undefined;

// if your cidOf mapping actually lives in ManifestStore, set this env var (recommended)
const MANIFEST_STORE_ADDRESS = process.env.MANIFEST_STORE_ADDRESS as `0x${string}` | undefined;

const GETTER_NAME = "cidOf";
const cidGetterAbi = parseAbi([`function ${GETTER_NAME}(bytes32) view returns (bytes)`]);

const client = publicClient;

function extractCidFromString(s: string): string | null {
  const looksLikeCid = (x: string) =>
    /^Qm[1-9A-HJ-NP-Za-km-z]{44}$/.test(x) || /^bafy[1-9A-HJ-NP-Za-km-z]+$/.test(x);

  let v = (s ?? "").replace(/\0/g, "").trim();
  if (!v) return null;

  if (v.startsWith("ipfs://")) v = v.slice("ipfs://".length);

  const m = v.match(/\/ipfs\/([A-Za-z0-9]+)(?:$|\/)/);
  if (m?.[1]) v = m[1];

  const token = v.split(/[\s/]+/).find(looksLikeCid);
  return token ?? (looksLikeCid(v) ? v : null);
}

function decodeCidFromBytesHex(bytesHex: string | null | undefined): string | null {
  if (!bytesHex || typeof bytesHex !== "string") return null;

  // sometimes contracts return plain strings (not hex) in older codepaths
  if (!bytesHex.startsWith("0x")) return extractCidFromString(bytesHex);

  if (bytesHex === "0x") return null;

  const raw = Buffer.from(bytesHex.slice(2), "hex");
  if (!raw.length) return null;

  // try utf8 first (common case: bytes holds "Qm..." or "bafy...")
  try {
    const utf8 = raw.toString("utf8");
    const cid = extractCidFromString(utf8);
    if (cid) return cid;
  } catch {}

  // try "multihash bytes" case (sha2-256 => 0x12 0x20 + 32 bytes)
  if (raw.length === 34 && raw[0] === 0x12 && raw[1] === 0x20) {
    try {
      return bs58.encode(raw);
    } catch {}
  }

  return null;
}

const PROPOSE_PLACEMENT_ABI = parseAbi([
  "function proposePlacement(int32,int32,uint32,uint32,uint96,bytes)",
]);

const CID_CACHE_TTL_MS = 30 * 60 * 1000;
const cidCache = new Map<string, { cid: string | null; exp: number }>();

const IPFS_GATEWAY_BASE = (process.env.IPFS_GATEWAY_BASE ?? "https://ipfs.io/ipfs/").replace(/\/+$/, "");

function cidToGatewayUrl(cid: string) {
  const trimmedCid = cid.replace(/^\/+/, "");
  return `${IPFS_GATEWAY_BASE}/${trimmedCid}`;
}

function buildImageUrl(cid: string) {
  const gateway = cidToGatewayUrl(cid);
  return gateway || `ipfs://${cid}`;
}

async function resolveCidFromPlacementTx(txHash: string): Promise<string | null> {
  if (!txHash) return null;
  try {
    const tx = await client.getTransaction({ hash: txHash as `0x${string}` });
    if (!tx?.input) return null;

    const decoded = decodeFunctionData({
      abi: PROPOSE_PLACEMENT_ABI,
      data: tx.input,
    });

    const args = decoded.args as readonly unknown[];
    const cidArg = args[args.length - 1];

    if (!cidArg) return null;

    let cidBytesHex: string | null = null;
    if (typeof cidArg === "string" && cidArg.startsWith("0x")) {
      cidBytesHex = cidArg;
    } else if (cidArg instanceof Uint8Array) {
      cidBytesHex = `0x${Buffer.from(cidArg).toString("hex")}`;
    }

    let cid = cidBytesHex ? decodeCidFromBytesHex(cidBytesHex) : null;

    if (!cid) {
      const fallbackString =
        cidBytesHex && cidBytesHex.startsWith("0x")
          ? hexToString(cidBytesHex as `0x${string}`)
          : typeof cidArg === "string"
          ? cidArg
          : null;

      cid = extractCidFromString(fallbackString ?? "");
    }

    if (!cid) {
      const selector = tx.input.slice(0, 10);
      const cidBytesLen = cidBytesHex ? (cidBytesHex.length - 2) / 2 : 0;
      console.warn(
        `[api/proposals] missing cid for tx ${txHash}, selector ${selector}, cidBytesLen ${cidBytesLen}`
      );
    }

    return cid;
  } catch (error) {
    console.warn(`[api/proposals] failed to resolve cid from tx ${txHash}:`, error);
    return null;
  }
}

async function resolveCidCached(placementId: string): Promise<string | null> {
  const now = Date.now();
  const cached = cidCache.get(placementId);
  if (cached && cached.exp > now) return cached.cid;

  const txHash = placementId.split("-")[0] ?? "";
  const cid = txHash ? await resolveCidFromPlacementTx(txHash) : null;

  cidCache.set(placementId, { cid, exp: now + CID_CACHE_TTL_MS });
  return cid;
}

type PlacementRow = {
  id: string;
  idParam: string; // The actual placement ID (bytes32) used by contracts
  bidder: string;
  epoch: string | number;
  x: string | number;
  y: string | number;
  w: string | number;
  h: string | number;
  bidPerCellWei: string;
  cidHash: string;
};

type PlacementWithBoardVersion = PlacementRow & { boardVersion: "v1" | "v2" };

async function fetchMeta(url: string) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ query: `{ _meta { block { number hash } } }` }),
  });
  const j = await r.json();
  return j?.data?._meta ?? null;
}

async function fetchPlacements(url: string, owner?: string | null): Promise<PlacementRow[]> {
  const ownerAddress = owner?.toLowerCase() ?? null;
  const variables = ownerAddress ? { owner: ownerAddress } : {};

  // IMPORTANT: do NOT query `cid` — it doesn't exist on PlacementProposed in your subgraph schema.
  const boardQuery = `
    query GetAllPlacements${ownerAddress ? "($owner: Bytes!)" : ""} {
      placementProposeds(
        first: 1000
        orderBy: epoch
        orderDirection: asc
        ${ownerAddress ? "where: { bidder: $owner }" : ""}
      ) {
        id
        idParam
        bidder
        epoch
        x
        y
        w
        h
        bidPerCellWei
        cidHash
      }
    }
  `;

  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ query: boardQuery, variables }),
  });

  const j = await r.json();
  if (j?.errors?.length) {
    const msg = `[api/proposals] Board errors (${url}): ${JSON.stringify(j.errors)}`;
    console.error(msg);
    throw new Error(msg);
  }

  return (j?.data?.placementProposeds ?? []) as PlacementRow[];
}

function dedupePlacementsPreferV2(v2: PlacementWithBoardVersion[], v1: PlacementWithBoardVersion[]) {
  const map = new Map<string, { row: PlacementWithBoardVersion; source: "v1" | "v2" }>();
  for (const row of v1) map.set(row.id, { row, source: "v1" });
  for (const row of v2) map.set(row.id, { row, source: "v2" });

  const merged = Array.from(map.values());
  merged.sort((a, b) => Number(a.row.epoch) - Number(b.row.epoch));

  return {
    rows: merged.map((x) => ({ ...x.row, boardVersion: x.source })),
    counts: { v1: v1.length, v2: v2.length, merged: merged.length },
  };
}

function isBytes32Hex(x: string) {
  return typeof x === "string" && x.startsWith("0x") && x.length === 66;
}

// fast cid resolution: multicall only. if all empty, we skip (no slow per-item readContract loop)
async function resolveCidMapFromChain(
  items: Array<{ cidHash: string; boardVersion: "v1" | "v2" }>
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const key = (v: "v1" | "v2", h: string) => `${v}:${h.toLowerCase()}`;

  const uniq: Array<{ boardVersion: "v1" | "v2"; cidHash: `0x${string}` }> = [];
  const seen = new Set<string>();

  for (const it of items) {
    if (!isBytes32Hex(it.cidHash)) continue;
    const k = key(it.boardVersion, it.cidHash);
    if (seen.has(k)) continue;
    seen.add(k);
    uniq.push({ boardVersion: it.boardVersion, cidHash: it.cidHash as `0x${string}` });
  }

  if (!uniq.length) return out;

  const hasManifest = Boolean(MANIFEST_STORE_ADDRESS);
  const hasBoards = Boolean(BOARD_V1_ADDRESS && BOARD_V2_ADDRESS);

  if (!hasManifest && !hasBoards) {
    console.log("[api/proposals] no MANIFEST_STORE_ADDRESS or BOARD_*_ADDRESS set; skipping chain cidOf");
    return out;
  }

  const contracts = uniq.map((u) => {
    // prefer manifest store if set
    const address =
      (hasManifest
        ? MANIFEST_STORE_ADDRESS
        : u.boardVersion === "v1"
          ? BOARD_V1_ADDRESS
          : BOARD_V2_ADDRESS) as `0x${string}`;

    return {
      address,
      abi: cidGetterAbi,
      functionName: GETTER_NAME as any,
      args: [u.cidHash] as const,
    };
  });

  try {
    const results = await client.multicall({ contracts, allowFailure: true });

    let nonEmpty = 0;

    results.forEach((res, i) => {
      if (res.status !== "success") return;

      const u = uniq[i];
      const bytesHex = res.result as unknown as string;
      const cid = decodeCidFromBytesHex(bytesHex);

      if (cid) {
        nonEmpty++;
        out.set(key(u.boardVersion, u.cidHash), cid);
      }
    });

    console.log("[api/proposals] cidOf multicall:", {
      uniq: uniq.length,
      resolved: out.size,
      nonEmpty,
      used: hasManifest ? "manifest" : "board",
    });

    return out;
  } catch (e) {
    console.warn("[api/proposals] cidOf multicall failed; skipping cid resolution", e);
    return out;
  }
}

export async function GET(request: NextRequest) {
  noStore();

  const { searchParams } = new URL(request.url);
  const owner = searchParams.get("owner");

  console.log("[api/proposals] === Using Goldsky (BOARD v1 + v2) ===");
  console.log("[api/proposals] Owner filter:", owner);
  console.log("[api/proposals] URLs:", { BOARD_V1_URL, BOARD_V2_URL, VOTING_URL });

  try {
    // Fetch manifest to identify canonized placements
    let manifestIndex: Record<string, true> = {};
    try {
      const manifestRes = await fetch(
        new URL("/api/manifest/latest", request.url).toString(),
        { cache: "no-store" }
      );
      if (manifestRes.ok) {
        const manifestData = await manifestRes.json();
        manifestIndex = manifestData.placementsIndex || {};
        console.log("[api/proposals] 📋 Loaded manifest with", Object.keys(manifestIndex).length, "canonized placements");
      }
    } catch (err) {
      console.warn("[api/proposals] ⚠️ Failed to load manifest, assuming all non-voting proposals are votable");
    }

    const [v1Res, v2Res] = await Promise.allSettled([
      fetchPlacements(BOARD_V1_URL, owner),
      fetchPlacements(BOARD_V2_URL, owner),
    ]);

    const v1Placements =
      v1Res.status === "fulfilled" ? v1Res.value.map((p) => ({ ...p, boardVersion: "v1" as const })) : [];
    const v2Placements =
      v2Res.status === "fulfilled" ? v2Res.value.map((p) => ({ ...p, boardVersion: "v2" as const })) : [];

    if (v1Res.status === "rejected") {
      console.warn("[api/proposals] ⚠️ v1 board fetch failed, continuing with v2 only");
      console.warn(v1Res.reason);
    }
    if (v2Res.status === "rejected") {
      console.warn("[api/proposals] ⚠️ v2 board fetch failed, continuing with v1 only");
      console.warn(v2Res.reason);
    }

    const merged = dedupePlacementsPreferV2(v2Placements, v1Placements);
    const placements = merged.rows;

    console.log("[api/proposals] merged placements", placements.length);
    console.log("[api/proposals] ✅ Found placements:", merged.counts);

    const cidMap =
      placements.length > 0
        ? await resolveCidMapFromChain(placements.map((p) => ({ cidHash: p.cidHash, boardVersion: p.boardVersion })))
        : new Map<string, string>();

const votingQuery = `
  query GetAllVoting {
    pendingPlacementRegistereds(first: 1000, orderBy: epochId, orderDirection: asc) {
      id
      epochId
      placementId
      registeredAt
      voteEndsAt
    }
    voteCasts(first: 1000, orderBy: epochId, orderDirection: asc) {
      id
      epochId
      placementId
      voter
      support
      weight
    }
  }
`;

    const votingResponse = await fetch(VOTING_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ query: votingQuery }),
    });

    const votingData = await votingResponse.json();
    if (votingData.errors) console.error("[api/proposals] Voting errors:", votingData.errors);

    const pending = votingData.data?.pendingPlacementRegistereds || [];
    const votes = votingData.data?.voteCasts || [];
    const pendingByPlacement = new Map<string, typeof pending[0]>();
    pending.forEach((entry: any) => {
      if (entry?.placementId) {
        pendingByPlacement.set(entry.placementId, entry);
      }
    });

    console.log("[api/proposals] ✅ Found pending:", pending.length);
    console.log("[api/proposals] ✅ Found votes:", votes.length);

    // DEBUG: Log first few entries to see ID format
    if (pending.length > 0) {
      console.log("[api/proposals] 🔍 Sample pending IDs:", pending.slice(0, 3).map((p: any) => p.placementId));
    }
    if (placements.length > 0) {
      console.log("[api/proposals] 🔍 Sample placement IDs:", placements.slice(0, 3).map((p: any) => p.id));
    }

    let resolvedFromMulticall = 0;
    let resolvedFromCalldata = 0;
    let missingCid = 0;

    const proposals = await Promise.all(
      placements.map(async (p) => {
        const chainKey = `${p.boardVersion}:${p.cidHash.toLowerCase()}`;
        const chainCid = cidMap.get(chainKey) ?? null;

        let cid: string | null = chainCid;
        let debugSource: "chain" | "calldata" | "missing" = "missing";

        if (chainCid) {
          debugSource = "chain";
          resolvedFromMulticall++;
        } else {
          const calldataCid = await resolveCidCached(p.id);
          if (calldataCid) {
            cid = calldataCid;
            debugSource = "calldata";
            resolvedFromCalldata++;
          } else {
            missingCid++;
          }
        }

        // Join voting data using idParam (the contract placement ID), not id (subgraph ID)
        const placementId = p.idParam; // Use the contract's placement ID for joining
        const pendingRecord = pendingByPlacement.get(placementId);

        // DEBUG: Log join results for first placement
        if (placements.indexOf(p) === 0) {
          console.log("[api/proposals] 🔍 First placement join test:", {
            subgraphId: p.id,
            placementId: placementId,
            hasPendingRecord: Boolean(pendingRecord),
            pendingRecord: pendingRecord ? {
              registeredAt: pendingRecord.registeredAt,
              voteEndsAt: pendingRecord.voteEndsAt
            } : null,
            mapSize: pendingByPlacement.size
          });
        }

        const toFiniteNumber = (value: unknown): number | null => {
          if (value == null) return null;
          const parsed = Number(value);
          return Number.isFinite(parsed) ? parsed : null;
        };
        const registeredAt = toFiniteNumber(pendingRecord?.registeredAt);
        const voteEndsAt = toFiniteNumber(pendingRecord?.voteEndsAt);
        const isPending = Boolean(pendingRecord);
        const placementVotes = votes.filter((v: any) => v.placementId === placementId);

        const yesVotes = placementVotes
          .filter((v: any) => v.support)
          .reduce((sum: number, v: any) => sum + Number(v.weight), 0);

        const noVotes = placementVotes
          .filter((v: any) => !v.support)
          .reduce((sum: number, v: any) => sum + Number(v.weight), 0);

        // Determine status and votability based on manifest and voting window
        // Priority:
        // 1. If in manifest → canonized (passed voting, finalized)
        // 2. If registered AND within 72h voting window → voting (votable)
        // 3. If registered AND past 72h voting window → expired (failed)
        // 4. Otherwise → proposed (not yet registered for voting)

        // Check manifest using placementId (the contract ID), not subgraph ID
        const isInManifest = manifestIndex[placementId] === true;
        const currentTimestamp = Math.floor(Date.now() / 1000);

        let status: string;
        let isVotable: boolean;
        let effectiveRegisteredAt: number | null = registeredAt;
        let effectiveVoteEndsAt: number | null = voteEndsAt;

        if (isInManifest) {
          // Placement is in the canonical manifest - it passed voting and was finalized
          status = "canonized";
          isVotable = false;
        } else if (isPending && voteEndsAt !== null) {
          // Registered in voting contract - check if voting period is still active
          if (currentTimestamp < voteEndsAt) {
            // Within 72-hour voting window
            status = "voting";
            isVotable = true;
          } else {
            // Past 72-hour voting window - voting failed
            status = "expired";
            isVotable = false;
          }
        } else {
          // Not in manifest and not registered for voting yet
          // This is a recent proposal that needs voting registration via /api/voting/bootstrap
          status = "proposed";
          isVotable = false; // Can't vote until registered
          effectiveRegisteredAt = null;
          effectiveVoteEndsAt = null;
        }

        return {
          id: placementId,          // Use contract placement ID as primary ID
          placementId: placementId, // Contract placement ID (bytes32)
          subgraphId: p.id,         // Subgraph-generated ID (txHash-index)
          owner: p.bidder,
          bidder: p.bidder,
          epochSubmitted: Number(p.epoch),
          epoch: Number(p.epoch),
          x: Number(p.x),
          y: Number(p.y),
          w: Number(p.w),
          h: Number(p.h),
          rect: { x: Number(p.x), y: Number(p.y), w: Number(p.w), h: Number(p.h) },
          bidPerCellWei: p.bidPerCellWei,
          cidHash: p.cidHash,
          cid,
          imageUrl: cid ? buildImageUrl(cid) : null,
          yesVotes,
          noVotes,
          status,
          isVotable,
          registeredAt: effectiveRegisteredAt,
          voteEndsAt: effectiveVoteEndsAt,
          debugCid: { used: debugSource },
          boardVersion: p.boardVersion,
        };
      })
    );

    console.log("[api/proposals] cid resolution counts:", {
      resolvedFromMulticall,
      resolvedFromCalldata,
      missing: missingCid,
    });

    // DEBUG: Log status distribution
    const statusCounts = proposals.reduce((acc, p) => {
      acc[p.status] = (acc[p.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    console.log("[api/proposals] 📊 Status distribution:", statusCounts);
    console.log("[api/proposals] 📊 Votable count:", proposals.filter(p => p.isVotable).length);
    console.log("[api/proposals] 📊 With timestamps:", proposals.filter(p => p.registeredAt !== null).length);

    const [boardV1Meta, boardV2Meta, votingMeta] = await Promise.all([
      fetchMeta(BOARD_V1_URL),
      fetchMeta(BOARD_V2_URL),
      fetchMeta(VOTING_URL),
    ]);

    console.log("[api/proposals] 🎉 Returning", proposals.length, "proposals");

    return NextResponse.json(
      {
        proposals,
        debug: {
          source: "goldsky",
          placementsCount: merged.counts.merged,
          placementsCountV1: merged.counts.v1,
          placementsCountV2: merged.counts.v2,
          pendingCount: pending.length,
          votesCount: votes.length,
          epochRange:
            proposals.length > 0
              ? {
                  min: Math.min(...proposals.map((p: any) => Number(p.epoch))),
                  max: Math.max(...proposals.map((p: any) => Number(p.epoch))),
                }
              : null,
          urls: { BOARD_V1_URL, BOARD_V2_URL, VOTING_URL },
          meta: { boardV1: boardV1Meta, boardV2: boardV2Meta, voting: votingMeta },
          chainCidResolution: {
            manifestStore: MANIFEST_STORE_ADDRESS ?? null,
            boardV1: BOARD_V1_ADDRESS ?? null,
            boardV2: BOARD_V2_ADDRESS ?? null,
            resolved: cidMap.size,
            resolvedFromMulticall,
            resolvedFromCalldata,
          },
          boardFetch: {
            v1Ok: v1Res.status === "fulfilled",
            v2Ok: v2Res.status === "fulfilled",
            v1Error: v1Res.status === "rejected" ? String(v1Res.reason) : null,
            v2Error: v2Res.status === "rejected" ? String(v2Res.reason) : null,
          },
        },
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("[api/proposals] ❌ Error:", error);
    return NextResponse.json({ proposals: [], error: String(error) }, { status: 500 });
  }
}
