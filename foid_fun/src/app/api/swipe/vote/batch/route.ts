import { NextRequest, NextResponse } from "next/server";
import { verifyTypedData, getAddress } from "viem";
import { addVote, getVoteCounts, hasVoted } from "@/lib/voteStore";
import { checkRateLimit, recordAction } from "@/lib/rateLimit";
import { EIP712_DOMAIN, EIP712_TYPES } from "@/lib/swipeConstants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type VoteInput = {
  proposalId: number;
  approve: boolean;
  deadline: number;
  signature: string;
  voter: string;
  weight?: number;
};

type VoteResult = {
  proposalId: number;
  ok: boolean;
  error?: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { votes } = body as { votes: VoteInput[] };

    if (!Array.isArray(votes) || votes.length === 0) {
      return NextResponse.json(
        { error: "votes must be a non-empty array" },
        { status: 400 }
      );
    }

    if (votes.length > 50) {
      return NextResponse.json(
        { error: "Maximum 50 votes per batch" },
        { status: 400 }
      );
    }

    /* ── Validate all voters are the same address (batch = one user's decisions) ── */
    const voterAddresses = new Set(votes.map((v) => v.voter?.toLowerCase()));
    if (voterAddresses.size !== 1) {
      return NextResponse.json(
        { error: "All votes in a batch must be from the same voter" },
        { status: 400 }
      );
    }

    let checksummedVoter: string;
    try {
      checksummedVoter = getAddress(votes[0].voter);
    } catch {
      return NextResponse.json({ error: "Invalid voter address" }, { status: 400 });
    }

    /* ── Pre-check rate limit for entire batch ── */
    const limit = checkRateLimit(checksummedVoter, "swipe-vote", votes.length);
    if (!limit.ok) {
      return NextResponse.json({ error: limit.error }, { status: 429 });
    }

    /* ── Process each vote ── */
    const results: VoteResult[] = [];
    let accepted = 0;
    let rejected = 0;
    const now = Math.floor(Date.now() / 1000);

    for (const vote of votes) {
      const { proposalId, approve, deadline, signature, weight } = vote;

      // Input validation
      if (
        typeof proposalId !== "number" ||
        typeof approve !== "boolean" ||
        !signature
      ) {
        results.push({ proposalId, ok: false, error: "Invalid vote data" });
        rejected++;
        continue;
      }

      // Deadline check
      if (typeof deadline === "number" && deadline < now) {
        results.push({ proposalId, ok: false, error: "Voting deadline passed" });
        rejected++;
        continue;
      }

      // Duplicate check
      if (hasVoted(proposalId, checksummedVoter)) {
        results.push({ proposalId, ok: false, error: "Already voted" });
        rejected++;
        continue;
      }

      // Signature verification
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
          results.push({ proposalId, ok: false, error: "Invalid signature" });
          rejected++;
          continue;
        }
      } catch {
        results.push({ proposalId, ok: false, error: "Signature verification failed" });
        rejected++;
        continue;
      }

      // Store in SQLite
      const inserted = addVote({
        proposalId,
        voter: checksummedVoter.toLowerCase(),
        approve,
        deadline,
        signature,
        weight: typeof weight === "number" ? weight : 100,
      });

      if (inserted) {
        recordAction(checksummedVoter, "swipe-vote");
        results.push({ proposalId, ok: true });
        accepted++;
      } else {
        results.push({ proposalId, ok: false, error: "Already voted (constraint)" });
        rejected++;
      }
    }

    return NextResponse.json({ results, accepted, rejected });
  } catch (error) {
    console.error("[api/swipe/vote/batch] POST error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
