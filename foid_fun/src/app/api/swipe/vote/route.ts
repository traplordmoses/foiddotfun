import { NextRequest, NextResponse } from "next/server";
import { voteStore, type StoredVote } from "@/lib/voteStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { proposalId, approve, deadline, signature, voter } = body;

    if (typeof proposalId !== "number" || typeof approve !== "boolean" || !signature || !voter) {
      return NextResponse.json({ error: "Invalid vote data" }, { status: 400 });
    }

    const vote: StoredVote = {
      proposalId,
      approve,
      deadline,
      signature,
      voter: voter.toLowerCase(),
      timestamp: Date.now(),
    };

    const existing = voteStore.get(proposalId) ?? [];

    // Check if voter already voted on this proposal
    const alreadyVoted = existing.some((v) => v.voter === vote.voter);
    if (alreadyVoted) {
      return NextResponse.json({ error: "Already voted on this proposal" }, { status: 409 });
    }

    existing.push(vote);
    voteStore.set(proposalId, existing);

    const forCount = existing.filter((v) => v.approve).length;
    const againstCount = existing.filter((v) => !v.approve).length;

    return NextResponse.json({
      ok: true,
      voteCount: existing.length,
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
  const votes = voteStore.get(proposalId) ?? [];
  const forCount = votes.filter((v) => v.approve).length;
  const againstCount = votes.filter((v) => !v.approve).length;

  return NextResponse.json({
    proposalId,
    forCount,
    againstCount,
    totalVotes: votes.length,
    votes: votes.map((v) => ({
      voter: v.voter,
      approve: v.approve,
      timestamp: v.timestamp,
    })),
  });
}
