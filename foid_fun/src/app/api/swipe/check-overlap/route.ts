// GET /api/swipe/check-overlap?x=N&y=N&w=N&h=N
// Pre-flight check before proposeLoreboard() — rejects if the rect
// overlaps any existing voting or canonized placement.
// Uses multicall for O(1) RPC calls instead of O(n).
import { NextRequest, NextResponse } from "next/server";
import { SWIPE_ABI } from "@/lib/contracts/abis/swipe";
import { SWIPE_LOREBOARD_ABI } from "@/lib/contracts/abis/swipeLoreboard";
import { CONTRACTS } from "@/lib/contracts/addresses";
import { overlap, type Rect } from "@/lib/grid";
import { rpcClient } from "@/lib/rpcClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_PROPOSALS_TO_CHECK = 500;

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
    const swipeAddr = CONTRACTS.SWIPE as `0x${string}`;
    const loreboardAddr = (CONTRACTS.SWIPE_LOREBOARD || "") as `0x${string}`;

    // Check voting proposals from Swipe contract (multicall batch)
    if (swipeAddr) {
      const count = await rpcClient.readContract({
        address: swipeAddr,
        abi: SWIPE_ABI,
        functionName: "proposalCount",
      }) as bigint;

      const n = Math.min(Number(count), MAX_PROPOSALS_TO_CHECK);
      if (n > 0) {
        const contracts = Array.from({ length: n }, (_, i) => ({
          address: swipeAddr,
          abi: SWIPE_ABI,
          functionName: "getProposal" as const,
          args: [BigInt(i)] as const,
        }));

        const results = await rpcClient.multicall({ contracts, allowFailure: true });

        for (let i = 0; i < results.length; i++) {
          if (results[i].status !== "success" || !results[i].result) continue;
          const raw = results[i].result;
          if (!raw) continue;
          const p = Array.isArray(raw) ? raw : Object.values(raw as Record<string, unknown>);
          const finalized = p[5] as boolean;
          const canonized = p[6] as boolean;
          const gw = Number(p[11] ?? 0);
          const gh = Number(p[12] ?? 0);

          // Skip finalized+rejected proposals (their spot is free)
          if (finalized && !canonized) continue;
          if (gw <= 0 || gh <= 0) continue;

          const rect: Rect = { x: Number(p[9] ?? 0), y: Number(p[10] ?? 0), w: gw, h: gh };
          if (overlap(candidate, rect)) {
            return NextResponse.json({
              ok: false,
              conflict: { source: "swipe", proposalId: i, ...rect },
            });
          }
        }
      }
    }

    // Check canonized placements from SwipeLoreboard (multicall batch)
    if (loreboardAddr && loreboardAddr.length >= 42) {
      const count = await rpcClient.readContract({
        address: loreboardAddr,
        abi: SWIPE_LOREBOARD_ABI,
        functionName: "placementCount",
      }) as bigint;

      const n = Math.min(Number(count), MAX_PROPOSALS_TO_CHECK);
      if (n > 0) {
        const contracts = Array.from({ length: n }, (_, i) => ({
          address: loreboardAddr,
          abi: SWIPE_LOREBOARD_ABI,
          functionName: "getPlacement" as const,
          args: [BigInt(i)] as const,
        }));

        const results = await rpcClient.multicall({ contracts, allowFailure: true });

        for (let i = 0; i < results.length; i++) {
          if (results[i].status !== "success" || !results[i].result) continue;
          const p = results[i].result as { x: number; y: number; w: number; h: number; removed: boolean };
          if (p.removed) continue;
          const rect: Rect = { x: Number(p.x), y: Number(p.y), w: Number(p.w), h: Number(p.h) };
          if (overlap(candidate, rect)) {
            return NextResponse.json({
              ok: false,
              conflict: { source: "loreboard", placementId: i, ...rect },
            });
          }
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[check-overlap] Error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
