import { NextRequest, NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { createPublicClient, http, hexToString } from "viem";
import { SWIPE_LOREBOARD_ABI } from "@/lib/contracts/abis/swipeLoreboard";
import { CONTRACTS, RPC_URL, CHAIN_CONFIG } from "@/lib/contracts/addresses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const IPFS_GATEWAY_BASE = (process.env.IPFS_GATEWAY_BASE ?? "https://ipfs.io/ipfs/").replace(/\/+$/, "");

function decodeCidFromBytes(bytesHex: string): string | null {
  if (!bytesHex || bytesHex === "0x") return null;

  try {
    // Try UTF-8 decode first (common case: bytes holds "ipfs://Qm..." or just "Qm...")
    const raw = hexToString(bytesHex as `0x${string}`);
    const trimmed = raw.replace(/\0/g, "").trim();
    if (trimmed.startsWith("ipfs://")) return trimmed.slice("ipfs://".length);
    if (/^Qm[1-9A-HJ-NP-Za-km-z]{44}$/.test(trimmed)) return trimmed;
    if (/^bafy[1-9A-HJ-NP-Za-km-z]+$/.test(trimmed)) return trimmed;
    // Return whatever we decoded if it looks like it might be content
    if (trimmed.length > 10) return trimmed;
  } catch {}

  return null;
}

function buildImageUrl(cid: string): string {
  const trimmedCid = cid.replace(/^\/+/, "");
  return `${IPFS_GATEWAY_BASE}/${trimmedCid}`;
}

export async function GET(request: NextRequest) {
  noStore();

  const { searchParams } = new URL(request.url);
  const owner = searchParams.get("owner")?.toLowerCase() ?? null;

  try {
    const swipeLoreboardAddr = CONTRACTS.SWIPE_LOREBOARD as `0x${string}`;
    if (!swipeLoreboardAddr) {
      return NextResponse.json({ proposals: [], error: "SwipeLoreboard not configured" });
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

    // Read placement count
    const count = await client.readContract({
      address: swipeLoreboardAddr,
      abi: SWIPE_LOREBOARD_ABI,
      functionName: "placementCount",
    }) as bigint;

    const placementCount = Number(count);
    if (placementCount === 0) {
      return NextResponse.json({ proposals: [], debug: { source: "swipeLoreboard", count: 0 } });
    }

    // Batch read placements via multicall
    const contracts = Array.from({ length: placementCount }, (_, i) => ({
      address: swipeLoreboardAddr,
      abi: SWIPE_LOREBOARD_ABI,
      functionName: "getPlacement" as const,
      args: [BigInt(i + 1)] as const,
    }));

    const results = await client.multicall({ contracts, allowFailure: true });

    const proposals = results
      .map((result) => {
        if (result.status !== "success" || !result.result) return null;
        const p = result.result as {
          id: bigint;
          placer: string;
          x: number;
          y: number;
          w: number;
          h: number;
          cells: number;
          cidBytes: string;
          placedAt: bigint;
          removed: boolean;
        };

        // Filter out removed placements
        if (p.removed) return null;

        // Filter by owner if specified
        if (owner && p.placer.toLowerCase() !== owner) return null;

        const cid = decodeCidFromBytes(p.cidBytes);

        return {
          id: String(Number(p.id)),
          placementId: String(Number(p.id)),
          owner: p.placer,
          bidder: p.placer,
          x: Number(p.x),
          y: Number(p.y),
          w: Number(p.w),
          h: Number(p.h),
          rect: { x: Number(p.x), y: Number(p.y), w: Number(p.w), h: Number(p.h) },
          cells: Number(p.cells),
          cid,
          imageUrl: cid ? buildImageUrl(cid) : null,
          placedAt: Number(p.placedAt),
          removed: p.removed,
          // Compatibility fields for board page
          epochSubmitted: 0,
          epoch: 0,
          bidPerCellWei: "0",
          cidHash: "0x",
          yesVotes: 0,
          noVotes: 0,
          status: "canonized",
          isVotable: false,
          registeredAt: Number(p.placedAt),
          voteEndsAt: null,
          boardVersion: "swipeLoreboard" as const,
        };
      })
      .filter(Boolean);

    console.log(`[api/proposals] SwipeLoreboard: ${placementCount} total, ${proposals.length} active`);

    return NextResponse.json(
      {
        proposals,
        debug: {
          source: "swipeLoreboard",
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
