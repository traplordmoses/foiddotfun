import { NextResponse } from "next/server";
import { createPublicClient, http } from "viem";
import { LOREBOARD_ABI } from "@/lib/contracts/abis/loreboard";
import { CONTRACTS } from "@/lib/contracts/addresses";
import { RPC_URL, CHAIN_CONFIG } from "@/lib/contracts/addresses";
import { cidToHttpUrl } from "@/lib/ipfsUrl";
import { ProposalStore } from "@/lib/proposalStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ──────────────────────────────────────────────────────────────────────
// In-process cache (see /api/proposals/route.ts for the full rationale).
//
// This route is even heavier than /api/proposals — it reads each proposal
// individually in batches of 5 and issues two more RPC calls per proposal
// (voteWeightFor + voteWeightAgainst). Without caching, a 20-proposal
// board burns ~60 RPC round-trips on every visitor.
// ──────────────────────────────────────────────────────────────────────

type SwipePayload = { proposals: unknown[]; count: number };

const CACHE_TTL_MS = 15_000;
let cachedPayload: { data: SwipePayload; at: number } | null = null;
let inflightFetch: Promise<SwipePayload> | null = null;

function getCached(): SwipePayload | null {
  if (!cachedPayload) return null;
  if (Date.now() - cachedPayload.at > CACHE_TTL_MS) return null;
  return cachedPayload.data;
}

async function fetchSwipeProposalsFromChain(): Promise<SwipePayload> {
    const contractAddress = CONTRACTS.SWIPE as `0x${string}`;
    if (!contractAddress) {
      return { proposals: [], count: 0 };
    }

    const client = createPublicClient({
      chain: {
        id: CHAIN_CONFIG.id,
        name: CHAIN_CONFIG.name,
        nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
        rpcUrls: { default: { http: [RPC_URL] } },
      },
      transport: http(RPC_URL),
    });

    const count = await client.readContract({
      address: contractAddress,
      abi: LOREBOARD_ABI,
      functionName: "proposalCount",
    }) as bigint;

    const proposalCount = Number(count);
    if (proposalCount === 0) {
      return { proposals: [], count: 0 };
    }

    // New Loreboard Proposal struct:
    // id, proposer, ipfsCid, createdAt, votingEndsAt, finalized, approved, placementId, gridX, gridY, gridW, gridH
    type ProposalTuple = {
      id: bigint;
      proposer: string;
      ipfsCid: string;
      createdAt: bigint;
      votingEndsAt: bigint;
      finalized: boolean;
      approved: boolean;
      placementId: bigint;
      gridX: number;
      gridY: number;
      gridW: number;
      gridH: number;
    };

    function parseProposal(raw: unknown): ProposalTuple {
      if (Array.isArray(raw)) {
        return {
          id: raw[0] as bigint,
          proposer: raw[1] as string,
          ipfsCid: raw[2] as string,
          createdAt: raw[3] as bigint,
          votingEndsAt: raw[4] as bigint,
          finalized: raw[5] as boolean,
          approved: raw[6] as boolean,
          placementId: raw[7] as bigint,
          gridX: Number(raw[8] ?? 0),
          gridY: Number(raw[9] ?? 0),
          gridW: Number(raw[10] ?? 0),
          gridH: Number(raw[11] ?? 0),
        };
      }
      return raw as ProposalTuple;
    }

    const BATCH_SIZE = 5;
    const proposals = [];

    for (let batchStart = 0; batchStart < proposalCount; batchStart += BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE, proposalCount);
      const indices = Array.from({ length: batchEnd - batchStart }, (_, j) => batchStart + j);

      const batchResults = await Promise.allSettled(
        indices.map((i) =>
          client.readContract({
            address: contractAddress,
            abi: LOREBOARD_ABI,
            functionName: "getProposal",
            args: [BigInt(i)],
          })
        )
      );

      for (let j = 0; j < batchResults.length; j++) {
        const result = batchResults[j];
        const idx = indices[j];
        if (result.status === "rejected") {
          console.error(`[api/swipe/proposals] Failed to read proposal ${idx}:`, result.reason);
          continue;
        }

        const p = parseProposal(result.value);

        // Read on-chain vote tallies
        let forCount = 0;
        let againstCount = 0;
        try {
          const [rawFor, rawAgainst] = await Promise.all([
            client.readContract({
              address: contractAddress,
              abi: LOREBOARD_ABI,
              functionName: "voteWeightFor",
              args: [BigInt(p.id)],
            }) as Promise<bigint>,
            client.readContract({
              address: contractAddress,
              abi: LOREBOARD_ABI,
              functionName: "voteWeightAgainst",
              args: [BigInt(p.id)],
            }) as Promise<bigint>,
          ]);
          forCount = Number(rawFor);
          againstCount = Number(rawAgainst);
        } catch {
          // Non-fatal: vote count read failed
        }

        // Look up optional name from local proposal metadata store
        let name: string | undefined;
        try {
          const stored = ProposalStore.get(String(Number(p.id)));
          if (stored?.name) name = stored.name;
          if (!name && p.ipfsCid) {
            // Fall back to searching all proposals by CID
            const all = ProposalStore.all();
            const match = all.find((s) => s.cid === p.ipfsCid);
            if (match?.name) name = match.name;
          }
        } catch { /* non-fatal */ }

        proposals.push({
          id: Number(p.id),
          proposer: p.proposer,
          ipfsCid: p.ipfsCid,
          imageUrl: p.ipfsCid ? cidToHttpUrl(p.ipfsCid) : null,
          createdAt: Number(p.createdAt),
          votingEndsAt: Number(p.votingEndsAt),
          finalized: p.finalized,
          approved: p.approved,
          placementId: Number(p.placementId),
          forCount,
          againstCount,
          gridX: p.gridX,
          gridY: p.gridY,
          gridW: p.gridW,
          gridH: p.gridH,
          ...(name ? { name } : {}),
        });
      }
    }

    return { proposals, count: proposalCount };
}

async function getSwipeProposals(): Promise<{ data: SwipePayload; fromCache: boolean }> {
  const cached = getCached();
  if (cached) return { data: cached, fromCache: true };

  if (inflightFetch) return { data: await inflightFetch, fromCache: false };

  inflightFetch = (async () => {
    try {
      const data = await fetchSwipeProposalsFromChain();
      cachedPayload = { data, at: Date.now() };
      return data;
    } finally {
      inflightFetch = null;
    }
  })();

  return { data: await inflightFetch, fromCache: false };
}

export async function GET() {
  try {
    const { data, fromCache } = await getSwipeProposals();
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, max-age=5, s-maxage=5, stale-while-revalidate=20",
        "X-Swipe-Proposals-Cache": fromCache ? "HIT" : "MISS",
      },
    });
  } catch (error) {
    console.error("[api/swipe/proposals] Error:", error);
    return NextResponse.json({ proposals: [], error: String(error) }, { status: 500 });
  }
}
