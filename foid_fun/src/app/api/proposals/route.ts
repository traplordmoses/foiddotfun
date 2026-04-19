import { NextRequest, NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { createPublicClient, http } from "viem";
import { LOREBOARD_ABI } from "@/lib/contracts/abis/loreboard";
import { CONTRACTS, RPC_URL, CHAIN_CONFIG } from "@/lib/contracts/addresses";
import { cidToHttpUrl } from "@/lib/ipfsUrl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/proposals — Returns canonized (finalized + approved) placements from the Loreboard.
 *
 * Reads from the unified Loreboard contract's `getPlacement()` function.
 * Only returns non-removed placements with status "canonized".
 */
export async function GET(request: NextRequest) {
  noStore();

  const { searchParams } = new URL(request.url);
  const owner = searchParams.get("owner")?.toLowerCase() ?? null;

  try {
    const contractAddress = CONTRACTS.SWIPE as `0x${string}`;
    if (!contractAddress || contractAddress.length < 42) {
      return NextResponse.json({
        proposals: [],
        debug: { source: "loreboard", note: "Loreboard contract not configured" },
      });
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

    // Read placement count from the unified Loreboard
    const count = await client.readContract({
      address: contractAddress,
      abi: LOREBOARD_ABI,
      functionName: "placementCount",
    }) as bigint;

    const placementCount = Number(count);
    if (placementCount === 0) {
      return NextResponse.json({ proposals: [], debug: { source: "loreboard", count: 0 } });
    }

    // Read each placement
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

    // Batch all placement reads into a single multicall
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

    const proposals = [];

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status !== "success") {
        console.error(`[api/proposals] Failed to read placement ${i}:`, result.error);
        continue;
      }

      const p = parsePlacement(result.result);

      // Skip removed placements
      if (p.removed) continue;

      // Filter by owner if specified
      if (owner && p.placer.toLowerCase() !== owner) continue;

      const imageUrl = p.ipfsCid ? cidToHttpUrl(p.ipfsCid) : null;

      proposals.push({
        id: String(i),
        placementId: String(i),
        proposalId: Number(p.proposalId),
        owner: p.placer,
        bidder: p.placer,
        x: p.x,
        y: p.y,
        w: p.w,
        h: p.h,
        rect: { x: p.x, y: p.y, w: p.w, h: p.h },
        cells: Math.ceil(p.w / 32) * Math.ceil(p.h / 32),
        cid: p.ipfsCid?.replace("ipfs://", "") ?? null,
        imageUrl,
        placedAt: Number(p.placedAt),
        removed: p.removed,
        // Compatibility fields for board page
        epochSubmitted: 0,
        epoch: 0,
        bidPerCellWei: "0",
        cidHash: "0x",
        yesVotes: 0,
        noVotes: 0,
        status: "canonized" as const,
        isVotable: false,
        registeredAt: Number(p.placedAt),
        voteEndsAt: null,
        boardVersion: "loreboard" as const,
      });
    }

    console.log(`[api/proposals] Loreboard: ${placementCount} total, ${proposals.length} active`);

    return NextResponse.json(
      {
        proposals,
        debug: {
          source: "loreboard",
          placementsCount: placementCount,
          activeCount: proposals.length,
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
    console.error("[api/proposals] Error:", error);
    return NextResponse.json({ proposals: [], error: String(error) }, { status: 500 });
  }
}
