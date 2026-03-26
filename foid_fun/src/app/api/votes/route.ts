import { NextRequest, NextResponse } from "next/server";

// Legacy voting subgraph — no longer deployed. EIP-712 votes are now in SQLite via /api/swipe/vote.
// This route is kept for backwards compatibility but will return empty results if subgraph is down.
const VOTING_URL =
  process.env.GOLDSKY_VOTING_URL ||
  "https://api.goldsky.com/api/public/project_cmkwd7dgh0bq501z7fog65iag/subgraphs/foid-swipe-fluent-testnet-fluent-testnet/1.2.0/gn";

type GoldskyVoteCast = {
  id: string;
  epochId: string | number | null;
  placementId: string | null;
  voter: string | null;
  support: boolean | string | null;
  weight: string | number | null;
  block_number?: string | number | null;
  timestamp_?: string | number | null;
  transactionHash_?: string | null;
  contractId_?: string | null;
};

type GoldskyResponse = {
  data?: {
    voteCasts?: GoldskyVoteCast[];
  };
  errors?: unknown;
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 30;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address");
  const epoch = searchParams.get("epoch");

  if (!address) {
    return NextResponse.json({ error: "address required" }, { status: 400 });
  }

  console.log("[api/votes] === Using Goldsky ===");
  console.log("[api/votes] Address:", address);
  console.log("[api/votes] Epoch:", epoch);

  const variables: { voter: string; epochId?: string } = {
    voter: address.toLowerCase(),
  };
  let epochClause = "";
  if (epoch) {
    epochClause = "epochId: $epochId";
    variables.epochId = epoch;
  }

  try {
    const query = `
      query GetVotes($voter: String!${epoch ? ", $epochId: BigInt!" : ""}) {
        voteCasts(
          first: 1000
          orderBy: block_number
          orderDirection: desc
          where: {
            voter: $voter
            ${epochClause}
          }
        ) {
          id
          epochId
          placementId
          voter
          support
          weight
          block_number
          timestamp_
          transactionHash_
          contractId_
        }
      }
    `;

    const response = await fetch(VOTING_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
    });

    const data = (await response.json()) as GoldskyResponse;
    const errors = data.errors ?? null;

    const voteCasts = Array.isArray(data.data?.voteCasts)
      ? (data.data.voteCasts as GoldskyVoteCast[])
      : [];

    const votes = voteCasts.map((vote) => ({
      id: vote.id,
      epochId: String(vote.epochId ?? "0"),
      placementId: vote.placementId ?? "",
      voter: vote.voter ?? "",
      support: Boolean(vote.support),
      weight: String(vote.weight ?? "0"),
      blockNumber: vote.block_number != null ? String(vote.block_number) : null,
      timestamp: vote.timestamp_ != null ? String(vote.timestamp_) : null,
      txHash: vote.transactionHash_ ?? null,
      contractId: vote.contractId_ ?? null,
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

    console.log("[api/votes] ✅ Found votes:", votes.length);

    return NextResponse.json(
      {
        votes,
        totalVotes: votes.length,
        count: votes.length,
        votesByEpoch,
        recentVotes,
        debug: {
          source: "goldsky",
          address,
          epoch,
          count: votes.length,
          errors,
        },
      },
      {
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (error) {
    console.error("[api/votes] ❌ Error:", error);
    return NextResponse.json(
      {
        votes: [],
        totalVotes: 0,
        votesByEpoch: {},
        recentVotes: [],
        debug: {
          source: "goldsky",
          address,
          epoch,
          count: 0,
          errors: [String(error)],
        },
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  }
}
