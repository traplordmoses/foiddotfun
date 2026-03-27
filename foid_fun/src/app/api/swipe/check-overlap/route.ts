// GET /api/swipe/check-overlap?x=N&y=N&w=N&h=N
// Pre-flight check before proposeLoreboard() — rejects if the rect
// overlaps any existing voting or canonized placement.
import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http } from "viem";
import { SWIPE_ABI } from "@/lib/contracts/abis/swipe";
import { SWIPE_LOREBOARD_ABI } from "@/lib/contracts/abis/swipeLoreboard";
import { CONTRACTS, RPC_URL, CHAIN_CONFIG } from "@/lib/contracts/addresses";
import { overlap, type Rect } from "@/lib/grid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const x = Number(searchParams.get("x"));
  const y = Number(searchParams.get("y"));
  const w = Number(searchParams.get("w"));
  const h = Number(searchParams.get("h"));

  if ([x, y, w, h].some((v) => !Number.isFinite(v)) || w <= 0 || h <= 0) {
    return NextResponse.json({ error: "Invalid rect params" }, { status: 400 });
  }

  const candidate: Rect = { x, y, w, h };

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

    const swipeAddr = CONTRACTS.SWIPE as `0x${string}`;
    const loreboardAddr = CONTRACTS.SWIPE_LOREBOARD as `0x${string}`;

    // Check voting proposals from Swipe contract
    if (swipeAddr) {
      const count = await client.readContract({
        address: swipeAddr,
        abi: SWIPE_ABI,
        functionName: "proposalCount",
      }) as bigint;

      for (let i = 0; i < Number(count); i++) {
        try {
          const raw = await client.readContract({
            address: swipeAddr,
            abi: SWIPE_ABI,
            functionName: "getProposal",
            args: [BigInt(i)],
          });
          const p = Array.isArray(raw) ? raw : Object.values(raw);
          const finalized = p[5] as boolean;
          const gx = Number(p[9] ?? 0);
          const gy = Number(p[10] ?? 0);
          const gw = Number(p[11] ?? 0);
          const gh = Number(p[12] ?? 0);

          if (!finalized && gw > 0 && gh > 0) {
            const rect: Rect = { x: gx, y: gy, w: gw, h: gh };
            if (overlap(candidate, rect)) {
              return NextResponse.json({
                ok: false,
                conflict: { source: "swipe", proposalId: i, gridX: gx, gridY: gy, gridW: gw, gridH: gh },
              });
            }
          }
        } catch { /* skip unreadable proposals */ }
      }
    }

    // Check canonized placements from SwipeLoreboard
    if (loreboardAddr && loreboardAddr.length >= 42) {
      const count = await client.readContract({
        address: loreboardAddr,
        abi: SWIPE_LOREBOARD_ABI,
        functionName: "placementCount",
      }) as bigint;

      for (let i = 0; i < Number(count); i++) {
        try {
          const raw = await client.readContract({
            address: loreboardAddr,
            abi: SWIPE_LOREBOARD_ABI,
            functionName: "getPlacement",
            args: [BigInt(i)],
          });
          const p = raw as { x: number; y: number; w: number; h: number; removed: boolean };
          if (!p.removed && overlap(candidate, { x: Number(p.x), y: Number(p.y), w: Number(p.w), h: Number(p.h) })) {
            return NextResponse.json({
              ok: false,
              conflict: { source: "loreboard", placementId: i, gridX: Number(p.x), gridY: Number(p.y), gridW: Number(p.w), gridH: Number(p.h) },
            });
          }
        } catch { /* skip */ }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[check-overlap] Error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
