import { NextResponse } from "next/server";
import { epochInfo, VOTE_WINDOW_SECONDS } from "@/lib/epoch";
import { fetchProposals, fetchVotingData, fetchEpochFinalizations } from "../_lib/goldsky";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TILE = 32;
const WORLD_RADIUS_TILES = 128;
const BOARD_WIDTH_TILES = WORLD_RADIUS_TILES * 2;
const BOARD_HEIGHT_TILES = WORLD_RADIUS_TILES * 2;

function json(success: boolean, data?: unknown, error?: string, status = 200) {
  return NextResponse.json({ success, ...(data ? { data } : {}), ...(error ? { error } : {}) }, { status });
}

export async function GET() {
  try {
    const [proposals, votingData, finalizations] = await Promise.all([
      fetchProposals(),
      fetchVotingData(),
      fetchEpochFinalizations(),
    ]);

    const epoch = epochInfo();
    const nowSec = Math.floor(Date.now() / 1000);

    // Build pending lookup
    const pendingMap = new Map(
      votingData.pending.map((p) => [p.placementId, p])
    );

    // Aggregate votes per placement
    const voteAgg = new Map<string, { yes: number; no: number }>();
    for (const v of votingData.votes) {
      const entry = voteAgg.get(v.placementId) ?? { yes: 0, no: 0 };
      if (v.support) entry.yes += Number(v.weight);
      else entry.no += Number(v.weight);
      voteAgg.set(v.placementId, entry);
    }

    // Classify proposals
    const active = proposals.map((p) => {
      const placementId = p.idParam;
      const pending = pendingMap.get(placementId);
      const votes = voteAgg.get(placementId) ?? { yes: 0, no: 0 };
      const voteEndsAt = pending ? Number(pending.voteEndsAt) : null;

      let status: string;
      if (pending && voteEndsAt && nowSec < voteEndsAt) {
        status = "voting";
      } else if (pending && voteEndsAt && nowSec >= voteEndsAt) {
        status = "expired";
      } else {
        status = "proposed";
      }

      return {
        id: placementId,
        bidder: p.bidder,
        epoch: Number(p.epoch),
        rect: { x: Number(p.x), y: Number(p.y), w: Number(p.w), h: Number(p.h) },
        cells: Math.ceil(Number(p.w) / TILE) * Math.ceil(Number(p.h) / TILE),
        bidPerCellWei: p.bidPerCellWei,
        cidHash: p.cidHash,
        status,
        isVotable: status === "voting",
        yesVotes: votes.yes,
        noVotes: votes.no,
        voteEndsAt,
      };
    });

    // Recently finalized epochs
    const recentFinalizations = finalizations.slice(0, 10).map((f) => ({
      epochId: Number(f.epochId),
      timestamp: Number(f.timestamp_),
    }));

    return json(true, {
      proposals: active,
      epoch: {
        current: epoch.index,
        secondsLeft: epoch.secondsLeft,
        endsAt: epoch.endsAtSec,
        lengthSeconds: epoch.lengthSec,
        voteWindowSeconds: VOTE_WINDOW_SECONDS,
      },
      recentFinalizations,
      grid: {
        tileSize: TILE,
        widthTiles: BOARD_WIDTH_TILES,
        heightTiles: BOARD_HEIGHT_TILES,
        widthPixels: BOARD_WIDTH_TILES * TILE,
        heightPixels: BOARD_HEIGHT_TILES * TILE,
      },
    });
  } catch (err) {
    console.error("[api/agent/board]", err);
    return json(false, undefined, "Failed to fetch board data", 500);
  }
}
