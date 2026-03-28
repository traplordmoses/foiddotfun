import { NextRequest, NextResponse } from "next/server";
import { verifyTypedData, getAddress } from "viem";
import { addVote, hasVoted } from "@/lib/voteStore";
import { checkRateLimit, recordAction } from "@/lib/rateLimit";
import { EIP712_DOMAIN, EIP712_TYPES, EIP712_BATCH_TYPES } from "@/lib/swipeConstants";

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

type BatchVoteInput = {
  proposalId: number;
  approve: boolean;
};

type VoteResult = {
  proposalId: number;
  ok: boolean;
  error?: string;
};

/* ── Legacy path: per-vote individual signatures ── */
async function processLegacyBatch(
  votes: VoteInput[],
  checksummedVoter: string,
): Promise<{ results: VoteResult[]; accepted: number; rejected: number }> {
  const results: VoteResult[] = [];
  let accepted = 0;
  let rejected = 0;
  const now = Math.floor(Date.now() / 1000);

  for (const vote of votes) {
    const { proposalId, approve, deadline, signature, weight } = vote;

    if (
      typeof proposalId !== "number" ||
      typeof approve !== "boolean" ||
      !signature
    ) {
      results.push({ proposalId, ok: false, error: "Invalid vote data" });
      rejected++;
      continue;
    }

    if (typeof deadline === "number" && deadline < now) {
      results.push({ proposalId, ok: false, error: "Voting deadline passed" });
      rejected++;
      continue;
    }

    if (hasVoted(proposalId, checksummedVoter)) {
      results.push({ proposalId, ok: false, error: "Already voted" });
      rejected++;
      continue;
    }

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

  return { results, accepted, rejected };
}

/* ── New path: single batch signature covering all votes ── */
async function processBatchSigned(
  votes: BatchVoteInput[],
  batchSignature: string,
  deadline: number,
  checksummedVoter: string,
  weight: number,
): Promise<{ results: VoteResult[]; accepted: number; rejected: number }> {
  const now = Math.floor(Date.now() / 1000);

  // Verify the single batch signature
  try {
    const valid = await verifyTypedData({
      address: checksummedVoter as `0x${string}`,
      domain: EIP712_DOMAIN,
      types: EIP712_BATCH_TYPES,
      primaryType: "SwipeVoteBatch",
      message: {
        votes: votes.map((v) => ({
          proposalId: BigInt(v.proposalId),
          approve: v.approve,
        })),
        deadline: BigInt(deadline),
      },
      signature: batchSignature as `0x${string}`,
    });

    if (!valid) {
      return {
        results: votes.map((v) => ({ proposalId: v.proposalId, ok: false, error: "Invalid batch signature" })),
        accepted: 0,
        rejected: votes.length,
      };
    }
  } catch {
    return {
      results: votes.map((v) => ({ proposalId: v.proposalId, ok: false, error: "Batch signature verification failed" })),
      accepted: 0,
      rejected: votes.length,
    };
  }

  // Deadline check (shared across all votes)
  if (deadline < now) {
    return {
      results: votes.map((v) => ({ proposalId: v.proposalId, ok: false, error: "Voting deadline passed" })),
      accepted: 0,
      rejected: votes.length,
    };
  }

  // Store each vote individually
  const results: VoteResult[] = [];
  let accepted = 0;
  let rejected = 0;

  for (const vote of votes) {
    const { proposalId, approve } = vote;

    if (typeof proposalId !== "number" || typeof approve !== "boolean") {
      results.push({ proposalId, ok: false, error: "Invalid vote data" });
      rejected++;
      continue;
    }

    if (hasVoted(proposalId, checksummedVoter)) {
      results.push({ proposalId, ok: false, error: "Already voted" });
      rejected++;
      continue;
    }

    const inserted = addVote({
      proposalId,
      voter: checksummedVoter.toLowerCase(),
      approve,
      deadline,
      signature: batchSignature,
      weight,
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

  return { results, accepted, rejected };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const isBatchSigned = !!body.batchSignature;

    const votes = body.votes;
    if (!Array.isArray(votes) || votes.length === 0) {
      return NextResponse.json({ error: "votes must be a non-empty array" }, { status: 400 });
    }
    if (votes.length > 50) {
      return NextResponse.json({ error: "Maximum 50 votes per batch" }, { status: 400 });
    }

    // Resolve voter address
    let checksummedVoter: string;
    try {
      const voterRaw = isBatchSigned ? body.voter : votes[0]?.voter;
      checksummedVoter = getAddress(voterRaw);
    } catch {
      return NextResponse.json({ error: "Invalid voter address" }, { status: 400 });
    }

    // For legacy path, validate all voters are the same
    if (!isBatchSigned) {
      const voterAddresses = new Set(votes.map((v: VoteInput) => v.voter?.toLowerCase()));
      if (voterAddresses.size !== 1) {
        return NextResponse.json({ error: "All votes in a batch must be from the same voter" }, { status: 400 });
      }
    }

    // Pre-check rate limit
    const limit = checkRateLimit(checksummedVoter, "swipe-vote", votes.length);
    if (!limit.ok) {
      return NextResponse.json({ error: limit.error }, { status: 429 });
    }

    const result = isBatchSigned
      ? await processBatchSigned(
          votes as BatchVoteInput[],
          body.batchSignature,
          body.deadline,
          checksummedVoter,
          typeof body.weight === "number" ? body.weight : 100,
        )
      : await processLegacyBatch(votes as VoteInput[], checksummedVoter);

    return NextResponse.json(result);
  } catch (error) {
    console.error("[api/swipe/vote/batch] POST error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
