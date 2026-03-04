import { NextResponse } from "next/server";
import { createPublicClient, http } from "viem";
import { SWIPE_ABI } from "@/lib/contracts/abis/swipe";
import { CONTRACTS } from "@/lib/contracts/addresses";
import { RPC_URL, CHAIN_CONFIG } from "@/lib/contracts/addresses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const IPFS_GATEWAY = "https://ipfs.io/ipfs/";

function cidToUrl(cid: string): string {
  if (!cid) return "";
  if (cid.startsWith("http")) return cid;
  return `${IPFS_GATEWAY}${cid}`;
}

export async function GET() {
  try {
    const swipeAddress = CONTRACTS.SWIPE as `0x${string}`;
    if (!swipeAddress) {
      return NextResponse.json({ proposals: [], error: "Swipe contract not configured" });
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

    // Read proposal count
    const count = await client.readContract({
      address: swipeAddress,
      abi: SWIPE_ABI,
      functionName: "proposalCount",
    }) as bigint;

    const proposalCount = Number(count);
    if (proposalCount === 0) {
      return NextResponse.json({ proposals: [], count: 0 });
    }

    // Batch read proposals via multicall
    const contracts = Array.from({ length: proposalCount }, (_, i) => ({
      address: swipeAddress,
      abi: SWIPE_ABI,
      functionName: "getProposal" as const,
      args: [BigInt(i)] as const,
    }));

    const results = await client.multicall({ contracts, allowFailure: true });

    // Fetch vote counts for each proposal
    const voteCounts: Record<number, { forCount: number; againstCount: number }> = {};
    // Vote counts are fetched separately by the frontend via /api/swipe/vote

    const proposals = results
      .map((result, i) => {
        if (result.status !== "success" || !result.result) return null;
        const p = result.result as {
          id: bigint;
          proposer: string;
          ipfsCid: string;
          createdAt: bigint;
          votingEndsAt: bigint;
          finalized: boolean;
          canonized: boolean;
          trestEntryId: bigint;
        };
        return {
          id: Number(p.id),
          proposer: p.proposer,
          ipfsCid: p.ipfsCid,
          imageUrl: p.ipfsCid ? cidToUrl(p.ipfsCid) : null,
          createdAt: Number(p.createdAt),
          votingEndsAt: Number(p.votingEndsAt),
          finalized: p.finalized,
          canonized: p.canonized,
          trestEntryId: Number(p.trestEntryId),
          forCount: voteCounts[i + 1]?.forCount ?? 0,
          againstCount: voteCounts[i + 1]?.againstCount ?? 0,
        };
      })
      .filter(Boolean);

    return NextResponse.json(
      { proposals, count: proposalCount },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error) {
    console.error("[api/swipe/proposals] Error:", error);
    return NextResponse.json({ proposals: [], error: String(error) }, { status: 500 });
  }
}
