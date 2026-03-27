// POST /api/swipe/vote/batch
// Accepts array of EIP-712 signed votes in one request. Uses SQLite storage.
import { NextRequest, NextResponse } from "next/server";
import { verifyTypedData } from "viem";
import { CONTRACTS, CHAIN_CONFIG } from "@/lib/contracts/addresses";
import { emitBoardEvent } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SWIPE_DOMAIN = {
  name: "FoidSwipe",
  version: "1",
  chainId: CHAIN_CONFIG.id,
  verifyingContract: CONTRACTS.SWIPE as `0x${string}`,
} as const;

const SWIPE_VOTE_TYPES = {
  SwipeVote: [
    { name: "proposalId", type: "uint256" },
    { name: "approve", type: "bool" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

type VoteInput = {
  proposalId: number;
  approve: boolean;
  deadline: number;
  signature: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { votes, voter } = body as { votes: VoteInput[]; voter: string };

    if (!voter || typeof voter !== "string") {
      return NextResponse.json({ error: "Missing voter" }, { status: 400 });
    }
    if (!Array.isArray(votes) || votes.length === 0) {
      return NextResponse.json({ error: "Empty votes array" }, { status: 400 });
    }
    if (votes.length > 50) {
      return NextResponse.json({ error: "Too many votes (max 50)" }, { status: 400 });
    }

    const voterLower = voter.toLowerCase();
    const { getDb } = await import("@/db/db");
    const db = getDb();

    let accepted = 0;
    let rejected = 0;
    const errors: Array<{ proposalId: number; error: string }> = [];
    const results: Array<{ proposalId: number; forCount: number; againstCount: number }> = [];

    for (const v of votes) {
      const { proposalId, approve, deadline, signature } = v;

      if (typeof proposalId !== "number" || typeof approve !== "boolean" || typeof deadline !== "number" || !signature) {
        rejected++;
        errors.push({ proposalId: proposalId ?? -1, error: "Invalid fields" });
        continue;
      }

      // Verify EIP-712 signature
      let valid: boolean;
      try {
        valid = await verifyTypedData({
          address: voterLower as `0x${string}`,
          domain: SWIPE_DOMAIN,
          types: SWIPE_VOTE_TYPES,
          primaryType: "SwipeVote",
          message: {
            proposalId: BigInt(proposalId),
            approve,
            deadline: BigInt(deadline),
          },
          signature: signature as `0x${string}`,
        });
      } catch {
        rejected++;
        errors.push({ proposalId, error: "Invalid signature format" });
        continue;
      }

      if (!valid) {
        rejected++;
        errors.push({ proposalId, error: "Signature does not match voter" });
        continue;
      }

      // Insert into SQLite (UNIQUE constraint prevents duplicates)
      try {
        db.prepare(`
          INSERT INTO swipe_votes (proposal_id, voter, approve, deadline, signature, timestamp)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(proposalId, voterLower, approve ? 1 : 0, deadline, signature, Date.now());

        accepted++;
        emitBoardEvent({ event_type: "vote_cast", proposal_id: proposalId, data: { voter: voterLower, approve } });

        const counts = db.prepare(`
          SELECT
            SUM(CASE WHEN approve = 1 THEN 1 ELSE 0 END) as for_count,
            SUM(CASE WHEN approve = 0 THEN 1 ELSE 0 END) as against_count
          FROM swipe_votes WHERE proposal_id = ?
        `).get(proposalId) as { for_count: number | null; against_count: number | null };

        results.push({
          proposalId,
          forCount: counts.for_count ?? 0,
          againstCount: counts.against_count ?? 0,
        });
      } catch (err: unknown) {
        if (err instanceof Error && err.message.includes("UNIQUE")) {
          rejected++;
          errors.push({ proposalId, error: "Already voted" });
        } else {
          rejected++;
          errors.push({ proposalId, error: String(err) });
        }
      }
    }

    return NextResponse.json({
      ok: true,
      accepted,
      rejected,
      results,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("[api/swipe/vote/batch] Error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
