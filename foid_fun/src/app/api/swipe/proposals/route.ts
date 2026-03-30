import { NextResponse } from "next/server";
import { createPublicClient, http } from "viem";
import { LOREBOARD_ABI } from "@/lib/contracts/abis/loreboard";
import { CONTRACTS } from "@/lib/contracts/addresses";
import { RPC_URL, CHAIN_CONFIG } from "@/lib/contracts/addresses";
import { cidToHttpUrl } from "@/lib/ipfsUrl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const contractAddress = CONTRACTS.SWIPE as `0x${string}`;
    if (!contractAddress) {
      return NextResponse.json({ proposals: [], error: "Loreboard contract not configured" });
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
      return NextResponse.json({ proposals: [], count: 0 });
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
