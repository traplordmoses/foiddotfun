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

    const count = await client.readContract({
      address: swipeAddress,
      abi: SWIPE_ABI,
      functionName: "proposalCount",
    }) as bigint;

    const proposalCount = Number(count);
    if (proposalCount === 0) {
      return NextResponse.json({ proposals: [], count: 0 });
    }

    const nowSec = Math.floor(Date.now() / 1000);
    const proposals = [];

    for (let i = 0; i < proposalCount; i++) {
      try {
        const raw = await client.readContract({
          address: swipeAddress,
          abi: SWIPE_ABI,
          functionName: "getProposal",
          args: [BigInt(i)],
        });

        // Handle both array and named-struct return formats
        let p: {
          id: bigint;
          proposer: string;
          ipfsCid: string;
          createdAt: bigint;
          votingEndsAt: bigint;
          finalized: boolean;
          canonized: boolean;
          trestEntryId: bigint;
          proposalType: number;
          gridX: number;
          gridY: number;
          gridW: number;
          gridH: number;
        };

        if (Array.isArray(raw)) {
          p = {
            id: raw[0] as bigint,
            proposer: raw[1] as string,
            ipfsCid: raw[2] as string,
            createdAt: raw[3] as bigint,
            votingEndsAt: raw[4] as bigint,
            finalized: raw[5] as boolean,
            canonized: raw[6] as boolean,
            trestEntryId: raw[7] as bigint,
            proposalType: Number(raw[8] ?? 0),
            gridX: Number(raw[9] ?? 0),
            gridY: Number(raw[10] ?? 0),
            gridW: Number(raw[11] ?? 0),
            gridH: Number(raw[12] ?? 0),
          };
        } else {
          p = raw as typeof p;
        }

        const counts = getVoteCounts(Number(p.id));

        const status = p.finalized
          ? p.canonized
            ? "canonized"
            : "rejected"
          : nowSec < Number(p.votingEndsAt)
            ? "voting"
            : "expired";

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
          proposalType: p.proposalType,
          gridX: p.gridX,
          gridY: p.gridY,
          gridW: p.gridW,
          gridH: p.gridH,
          status,
          forCount: counts.forCount,
          againstCount: counts.againstCount,
        });
      } catch (err) {
        console.error(`[api/swipe/proposals] Failed to read proposal ${i}:`, err);
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
