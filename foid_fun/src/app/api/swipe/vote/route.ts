import { NextRequest, NextResponse } from "next/server";
import { verifyTypedData } from "viem";
import { CONTRACTS, CHAIN_CONFIG } from "@/lib/contracts/addresses";
import { checkRateLimit, recordAction } from "../../agent/_lib/rateLimit";
import { getVoteCounts } from "@/lib/voteStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// EIP-712 domain matching Swipe.sol constructor: EIP712("FoidSwipe", "1")
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { proposalId, approve, deadline, signature, voter } = body;

    if (typeof proposalId !== "number" || typeof approve !== "boolean" || !signature || !voter) {
      return NextResponse.json({ error: "Invalid vote data" }, { status: 400 });
    }

    if (typeof deadline !== "number" || deadline <= 0) {
      return NextResponse.json({ error: "Invalid deadline" }, { status: 400 });
    }

    const voterLower = voter.toLowerCase() as `0x${string}`;

    // Rate limit
    const rl = checkRateLimit(voterLower, "swipe_vote");
    if (!rl.ok) {
      return NextResponse.json({ error: rl.error }, { status: 429 });
    }

    // Verify EIP-712 signature before storing
    let valid: boolean;
    try {
      valid = await verifyTypedData({
        address: voterLower,
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
      return NextResponse.json({ error: "Invalid signature format" }, { status: 400 });
    }

    if (!valid) {
      return NextResponse.json({ error: "Signature does not match voter" }, { status: 403 });
    }

    const vote = {
      proposalId,
      approve: approve as boolean,
      deadline: deadline as number,
      signature: signature as string,
      voter: voterLower,
      timestamp: Date.now(),
    };

    // Atomic insert — UNIQUE INDEX on (proposal_id, voter) prevents double-voting.
    // No read-then-write race condition: the DB constraint is the single source of truth.
    const { getDb } = await import("@/db/db");
    const db = getDb();
    try {
      db.prepare(`
        INSERT INTO swipe_votes (proposal_id, voter, approve, deadline, signature, timestamp)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(vote.proposalId, vote.voter, vote.approve ? 1 : 0, vote.deadline, vote.signature, vote.timestamp);
    } catch (err: unknown) {
      // UNIQUE constraint violation = already voted
      if (err instanceof Error && err.message.includes("UNIQUE")) {
        return NextResponse.json({ error: "Already voted on this proposal" }, { status: 409 });
      }
      throw err;
    }
    recordAction(voterLower, "swipe_vote");

    // Read counts from DB (authoritative)
    const counts = db.prepare(`
      SELECT
        SUM(CASE WHEN approve = 1 THEN 1 ELSE 0 END) as for_count,
        SUM(CASE WHEN approve = 0 THEN 1 ELSE 0 END) as against_count
      FROM swipe_votes WHERE proposal_id = ?
    `).get(proposalId) as { for_count: number | null; against_count: number | null };
    const forCount = counts.for_count ?? 0;
    const againstCount = counts.against_count ?? 0;

    return NextResponse.json({
      ok: true,
      voteCount: forCount + againstCount,
      forCount,
      againstCount,
    });
  } catch (error) {
    console.error("[api/swipe/vote] POST error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const proposalIdStr = searchParams.get("proposalId");

  if (!proposalIdStr) {
    return NextResponse.json({ error: "Missing proposalId" }, { status: 400 });
  }

  const proposalId = Number(proposalIdStr);
  const counts = getVoteCounts(proposalId);

  // Read individual votes for detail view
  const { getDb } = await import("@/db/db");
  const db = getDb();
  const rows = db
    .prepare("SELECT voter, approve, timestamp FROM swipe_votes WHERE proposal_id = ? ORDER BY timestamp ASC")
    .all(proposalId) as Array<{ voter: string; approve: number; timestamp: number }>;

  return NextResponse.json({
    proposalId,
    forCount: counts.forCount,
    againstCount: counts.againstCount,
    totalVotes: counts.totalVotes,
    votes: rows.map((v) => ({
      voter: v.voter,
      approve: v.approve === 1,
      timestamp: v.timestamp,
    })),
  });
}
