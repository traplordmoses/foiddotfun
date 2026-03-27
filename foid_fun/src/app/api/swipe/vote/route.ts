import { NextRequest, NextResponse } from "next/server";
import { verifyTypedData, getAddress } from "viem";
import { addVote, getVoteCounts, getVotes, hasVoted } from "@/lib/voteStore";
import { checkRateLimit, recordAction } from "@/lib/rateLimit";
import { EIP712_DOMAIN, EIP712_TYPES } from "@/lib/swipeConstants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { proposalId, approve, deadline, signature, voter, weight } = body;

    /* ── Input validation ── */
    if (
      typeof proposalId !== "number" ||
      typeof approve !== "boolean" ||
      !signature ||
      !voter
    ) {
      return NextResponse.json({ error: "Invalid vote data" }, { status: 400 });
    }

    /* ── Normalize voter address ── */
    let checksummedVoter: string;
    try {
      checksummedVoter = getAddress(voter);
    } catch {
      return NextResponse.json({ error: "Invalid voter address" }, { status: 400 });
    }

    /* ── Deadline check ── */
    const now = Math.floor(Date.now() / 1000);
    if (typeof deadline === "number" && deadline < now) {
      return NextResponse.json(
        { error: "Voting deadline has passed" },
        { status: 400 }
      );
    }

    /* ── EIP-712 signature verification ── */
    try {
      const valid = await verifyTypedData({
        address: checksummedVoter as `0x${string}`,
        domain: EIP712_DOMAIN,
        types: EIP712_TYPES,
        primaryType: "SwipeVote",
        message: {
          proposalId: BigInt(proposalId),
          approve,
          deadline: BigInt(deadline),
        },
        signature: signature as `0x${string}`,
      });

      if (!valid) {
        return NextResponse.json(
          { error: "Invalid signature — signer does not match voter" },
          { status: 401 }
        );
      }
    } catch (err) {
      console.error("[api/swipe/vote] Signature verification error:", err);
      return NextResponse.json(
        { error: "Signature verification failed" },
        { status: 401 }
      );
    }

    /* ── Rate limit check ── */
    const limit = checkRateLimit(checksummedVoter, "swipe-vote");
    if (!limit.ok) {
      return NextResponse.json({ error: limit.error }, { status: 429 });
    }

    /* ── Check duplicate (belt + suspenders with UNIQUE constraint) ── */
    if (hasVoted(proposalId, checksummedVoter)) {
      return NextResponse.json(
        { error: "Already voted on this proposal" },
        { status: 409 }
      );
    }

    /* ── Store vote in SQLite ── */
    const inserted = addVote({
      proposalId,
      voter: checksummedVoter.toLowerCase(),
      approve,
      deadline,
      signature,
      weight: typeof weight === "number" ? weight : 100,
    });

    if (!inserted) {
      return NextResponse.json(
        { error: "Already voted on this proposal" },
        { status: 409 }
      );
    }

    /* ── Record rate limit action ── */
    recordAction(checksummedVoter, "swipe-vote");

    /* ── Return updated counts ── */
    const counts = getVoteCounts(proposalId);
    return NextResponse.json({
      ok: true,
      ...counts,
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
  const votes = getVotes(proposalId);

  return NextResponse.json({
    proposalId,
    ...counts,
    votes: votes.map((v) => ({
      voter: v.voter,
      approve: v.approve,
      timestamp: v.timestamp,
      weight: v.weight,
    })),
  });
}
