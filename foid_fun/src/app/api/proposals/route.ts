import { NextRequest, NextResponse } from "next/server";
import { safeErrorMessage } from "@/lib/apiError";
import { getPlacements } from "@/lib/server/placements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The loader, cache and inflight dedup live in src/lib/server/placements.ts
// so the server-rendered placement pages share them.

type PlacementWithPlacer = { owner: string };

/**
 * GET /api/proposals — Returns canonized (finalized + approved) placements from the Loreboard.
 *
 * Reads from the unified Loreboard contract's `getPlacement()` function.
 * Only returns non-removed placements with status "canonized".
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const owner = searchParams.get("owner")?.toLowerCase() ?? null;
  // Callers that need post-mutation freshness (e.g. board refetch after a
  // successful submit) pass `?bust=1` to skip the in-memory cache.
  const forceFresh = searchParams.has("bust");

  try {
    const { data: full, fromCache } = await getPlacements({ forceFresh });

    // Owner filter applied post-cache: the underlying list is shared, but
    // we re-scope per-request so each dashboard call only sees its own
    // placements without bypassing the cache.
    const proposals = owner
      ? full.proposals.filter(
          (p): p is typeof p => typeof p === "object" && p !== null &&
            (p as PlacementWithPlacer).owner?.toLowerCase() === owner,
        )
      : full.proposals;

    return NextResponse.json(
      { proposals, debug: full.debug },
      {
        headers: {
          "Content-Type": "application/json",
          // The bounded server-side cache is authoritative.
          "Cache-Control": "no-store",
          "X-Proposals-Cache": fromCache ? "HIT" : "MISS",
        },
      },
    );
  } catch (error) {
    console.error("[api/proposals] Error:", error);
    return NextResponse.json(
      { proposals: [], error: safeErrorMessage(error, "failed to load proposals") },
      { status: 500 },
    );
  }
}
