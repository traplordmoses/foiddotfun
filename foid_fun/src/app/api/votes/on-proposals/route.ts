import { NextRequest, NextResponse } from "next/server";
import { IS_MAINNET } from "@/config/canonical";

const DEFAULT_LOREBOARD_URL = IS_MAINNET
  ? ""
  : "https://api.goldsky.com/api/public/project_cmkwd7dgh0bq501z7fog65iag/subgraphs/foid-loreboard-fluent-testnet/1.0.0/gn";
const LOREBOARD_URL =
  process.env.GOLDSKY_LOREBOARD_URL || DEFAULT_LOREBOARD_URL;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 30;

/**
 * GET /api/votes/on-proposals?ids=1,2,3[&since=1712345678]
 *
 * Fetches votes cast on the given proposal IDs.
 * Optional `since` (unix seconds) filters to votes after that timestamp.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const idsParam = searchParams.get("ids");
  const sinceParam = searchParams.get("since");

  if (!idsParam) {
    return NextResponse.json({ error: "ids required" }, { status: 400 });
  }

  const ids = idsParam.split(",").map((s) => s.trim()).filter(Boolean);
  if (ids.length === 0 || ids.length > 50) {
    return NextResponse.json({ error: "1-50 proposal IDs required" }, { status: 400 });
  }
  // Validate: proposal IDs should be numeric
  if (ids.some((id) => !/^\d+$/.test(id))) {
    return NextResponse.json({ error: "invalid proposal ID format" }, { status: 400 });
  }

  if (!LOREBOARD_URL) {
    return NextResponse.json({ votes: [] }, { headers: { "Cache-Control": "no-store" } });
  }

  try {
    const sinceFilter =
      sinceParam && /^\d+$/.test(sinceParam)
        ? `, blockTimestamp_gt: "${sinceParam}"`
        : "";

    const proposalIds = ids.map((id) => `"${id}"`).join(",");

    const query = `{
      votes(
        first: 200
        orderBy: blockTimestamp
        orderDirection: desc
        where: {
          proposal_in: [${proposalIds}]
          ${sinceFilter}
        }
      ) {
        id
        voter
        approve
        weight
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

    const data = await response.json();
    const rawVotes = Array.isArray(data.data?.votes) ? data.data.votes : [];

    const votes = rawVotes.map((v: Record<string, unknown>) => ({
      id: v.id as string,
      voter: v.voter as string,
      approve: v.approve as boolean,
      weight: String(v.weight),
      timestamp: Number(v.blockTimestamp),
      txHash: v.transactionHash as string,
      proposalId: (v.proposal as { proposalId: string }).proposalId,
    }));

    return NextResponse.json(
      { votes },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[api/votes/on-proposals] Error:", error);
    return NextResponse.json(
      { votes: [] },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
}
