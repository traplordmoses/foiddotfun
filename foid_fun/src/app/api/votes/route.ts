import { NextRequest, NextResponse } from "next/server";
import { IS_MAINNET } from "@/config/canonical";

// Loreboard unified subgraph — onchain votes via castVote()
const DEFAULT_LOREBOARD_URL = IS_MAINNET
  ? "" // No mainnet subgraph deployed yet
  : "https://api.goldsky.com/api/public/project_cmkwd7dgh0bq501z7fog65iag/subgraphs/foid-loreboard-fluent-testnet/1.0.0/gn";
const LOREBOARD_URL =
  process.env.GOLDSKY_LOREBOARD_URL || DEFAULT_LOREBOARD_URL;

type SubgraphVote = {
  id: string;
  voter: string;
  approve: boolean;
  weight: string;
  blockNumber: string;
  blockTimestamp: string;
  transactionHash: string;
  proposal: { proposalId: string };
};

type GoldskyResponse = {
  data?: {
    votes?: SubgraphVote[];
  };
  errors?: unknown;
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 30;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address");
  const proposalId = searchParams.get("epoch") ?? searchParams.get("proposalId");

  if (!address) {
    return NextResponse.json({ error: "address required" }, { status: 400 });
  }

  // Phase 6: Validate inputs to prevent GraphQL injection
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json({ error: "invalid address format" }, { status: 400 });
  }
  if (proposalId && !/^\d+$/.test(proposalId)) {
    return NextResponse.json({ error: "invalid proposalId format" }, { status: 400 });
  }

  console.log("[api/votes] === Using Loreboard Subgraph ===");
  console.log("[api/votes] Address:", address);
  console.log("[api/votes] ProposalId:", proposalId);

  try {
    const proposalFilter = proposalId ? `, proposal: "${proposalId}"` : "";
    const query = `{
      votes(
        first: 1000
        orderBy: blockNumber
        orderDirection: desc
        where: {
          voter: "${address.toLowerCase()}"
          ${proposalFilter}
        }
      ) {
        id
        voter
        approve
        weight
        blockNumber
        blockTimestamp
        transactionHash
        proposal { proposalId }
      }
    }`;

    const response = await fetch(LOREBOARD_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });

    const data = (await response.json()) as GoldskyResponse;
    const errors = data.errors ?? null;

    const rawVotes = Array.isArray(data.data?.votes) ? data.data.votes : [];

    // Map to response format (backwards-compatible field names where possible)
    const votes = rawVotes.map((vote) => ({
      id: vote.id,
      epochId: vote.proposal.proposalId,
      placementId: vote.proposal.proposalId,
      voter: vote.voter,
      support: vote.approve,
      weight: vote.weight,
      blockNumber: vote.blockNumber,
      timestamp: vote.blockTimestamp,
      txHash: vote.transactionHash,
      contractId: null,
    }));

    const votesByEpoch: Record<string, number> = {};
    votes.forEach((vote) => {
      const key = String(vote.epochId);
      votesByEpoch[key] = (votesByEpoch[key] ?? 0) + 1;
    });

    const recentVotes = votes.slice(0, 15).map((vote) => ({
      id: vote.id,
      epochId: Number(vote.epochId),
      placementId: vote.placementId,
      support: vote.support,
      weight: vote.weight,
      blockNumber: vote.blockNumber != null ? Number(vote.blockNumber) : null,
      txHash: vote.txHash,
      contractId: vote.contractId,
      timestamp: vote.timestamp != null ? Number(vote.timestamp) : null,
    }));

    console.log("[api/votes] Found votes:", votes.length);

    return NextResponse.json(
      {
        votes,
        totalVotes: votes.length,
        count: votes.length,
        votesByEpoch,
        recentVotes,
        debug: {
          source: "loreboard-subgraph",
          address,
          proposalId,
          count: votes.length,
          errors,
        },
      },
      {
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (error) {
    console.error("[api/votes] Error:", error);
    return NextResponse.json(
      {
        votes: [],
        totalVotes: 0,
        votesByEpoch: {},
        recentVotes: [],
        debug: {
          source: "loreboard-subgraph",
          address,
          proposalId,
          count: 0,
          errors: [String(error)],
        },
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  }
}
