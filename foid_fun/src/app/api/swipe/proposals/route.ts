import { NextResponse } from "next/server";
import { createPublicClient, http } from "viem";
import { SWIPE_ABI } from "@/lib/contracts/abis/swipe";
import { CONTRACTS } from "@/lib/contracts/addresses";
import { RPC_URL, CHAIN_CONFIG } from "@/lib/contracts/addresses";
import { cidToHttpUrl } from "@/lib/ipfsUrl";
import { getVoteCounts } from "@/lib/voteStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

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

    // Read proposals in parallel batches of 5
    type ProposalTuple = {
      id: bigint;
      proposer: string;
      ipfsCid: string;
      createdAt: bigint;
      votingEndsAt: bigint;
      finalized: boolean;
      canonized: boolean;
      trestEntryId: bigint;
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
          canonized: raw[6] as boolean,
          trestEntryId: raw[7] as bigint,
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
            address: swipeAddress,
            abi: SWIPE_ABI,
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
        const counts = getVoteCounts(Number(p.id));
        proposals.push({
          id: Number(p.id),
          proposer: p.proposer,
          ipfsCid: p.ipfsCid,
          imageUrl: p.ipfsCid ? cidToHttpUrl(p.ipfsCid) : null,
          createdAt: Number(p.createdAt),
          votingEndsAt: Number(p.votingEndsAt),
          finalized: p.finalized,
          canonized: p.canonized,
          trestEntryId: Number(p.trestEntryId),
          forCount: counts.forCount,
          againstCount: counts.againstCount,
        });
      }
    }

    return NextResponse.json(
      { proposals, count: proposalCount },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error) {
    console.error("[api/swipe/proposals] Error:", error);
    return NextResponse.json({ proposals: [], error: String(error) }, { status: 500 });
  }
}
