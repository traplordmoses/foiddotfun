// GET /api/swipe/check-overlap?x=N&y=N&w=N&h=N
// Pre-flight check before propose() — rejects if the rect
// overlaps any existing voting or approved placement.
// The contract also enforces this onchain, but this saves gas on revert.
import { NextRequest, NextResponse } from "next/server";
import { LOREBOARD_ABI } from "@/lib/contracts/abis/loreboard";
import { CONTRACTS } from "@/lib/contracts/addresses";
import { overlap, type Rect } from "@/lib/grid";
import { rpcClient } from "@/lib/rpcClient";
import { safeErrorMessage } from "@/lib/apiError";

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
    const contractAddr = CONTRACTS.SWIPE as `0x${string}`;

    if (contractAddr) {
      // Check proposals (voting or approved — skip finalized+rejected)
      const proposalCount = await rpcClient.readContract({
        address: contractAddr,
        abi: LOREBOARD_ABI,
        functionName: "proposalCount",
      }) as bigint;

      const nowSec = Math.floor(Date.now() / 1000);
      const n = Math.min(Number(proposalCount), MAX_PROPOSALS_TO_CHECK);
      if (n > 0) {
        const contracts = Array.from({ length: n }, (_, i) => ({
          address: contractAddr,
          abi: LOREBOARD_ABI,
          functionName: "getProposal" as const,
          args: [BigInt(i)] as const,
        }));

        const results = await rpcClient.multicall({ contracts, allowFailure: true });

        for (let i = 0; i < results.length; i++) {
          if (results[i].status !== "success" || !results[i].result) continue;
          const raw = results[i].result;
          if (!raw) continue;
          const p = Array.isArray(raw) ? raw : Object.values(raw as Record<string, unknown>);

          // Loreboard Proposal struct field order:
          // [0] id, [1] proposer, [2] ipfsCid, [3] createdAt, [4] votingEndsAt,
          // [5] finalized, [6] approved, [7] placementId,
          // [8] gridX, [9] gridY, [10] gridW, [11] gridH
          const finalized = p[5] as boolean;
          const approved = p[6] as boolean;
          const votingEndsAt = Number(p[4] ?? 0);
          const gw = Number(p[10] ?? 0);
          const gh = Number(p[11] ?? 0);

          // Skip finalized+rejected proposals (their spot is free)
          if (finalized && !approved) continue;

          // Skip expired-but-unfinalized proposals — voting ended but
          // finalize() was never called (stale). The contract's propose()
          // enforces overlap via _hasOccupiedCells which only covers
          // finalized+approved placements, so these don't actually block.
          if (!finalized && votingEndsAt > 0 && votingEndsAt < nowSec) continue;
          if (gw <= 0 || gh <= 0) continue;

          const rect: Rect = { x: Number(p[8] ?? 0), y: Number(p[9] ?? 0), w: gw, h: gh };
          if (overlap(candidate, rect)) {
            return NextResponse.json({
              ok: false,
              conflict: { source: "swipe", proposalId: i, gridX: rect.x, gridY: rect.y },
            });
          }
        }
      }

      // Also check finalized placements (in case a proposal is still voting
      // but a placement already occupies the spot)
      const placementCount = await rpcClient.readContract({
        address: contractAddr,
        abi: LOREBOARD_ABI,
        functionName: "placementCount",
      }) as bigint;

      const pn = Math.min(Number(placementCount), MAX_PROPOSALS_TO_CHECK);
      if (pn > 0) {
        const placementContracts = Array.from({ length: pn }, (_, i) => ({
          address: contractAddr,
          abi: LOREBOARD_ABI,
          functionName: "getPlacement" as const,
          args: [BigInt(i)] as const,
        }));

        const placementResults = await rpcClient.multicall({ contracts: placementContracts, allowFailure: true });

        for (let i = 0; i < placementResults.length; i++) {
          if (placementResults[i].status !== "success" || !placementResults[i].result) continue;
          const pl = placementResults[i].result as { x: number; y: number; w: number; h: number; removed: boolean };
          if (pl.removed) continue;
          const rect: Rect = { x: Number(pl.x), y: Number(pl.y), w: Number(pl.w), h: Number(pl.h) };
          if (overlap(candidate, rect)) {
            return NextResponse.json({
              ok: false,
              conflict: { source: "loreboard", placementId: i, gridX: rect.x, gridY: rect.y },
            });
          }
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[check-overlap] Error:", error);
    return NextResponse.json(
      { error: safeErrorMessage(error, "overlap check failed") },
      { status: 500 },
    );
  }
}
