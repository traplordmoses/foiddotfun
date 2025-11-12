// /src/app/api/vote/route.ts
import { NextResponse } from "next/server";
import { currentEpoch } from "@/lib/epoch";
import { proposalById, vote as voteOn } from "../_store";

export const runtime = "nodejs";

type VoteReq = {
  proposalId: string;
  voter: string;               // wallet/address (demo)
  vote: boolean | "yes" | "no";
};

export async function POST(req: Request) {
  let body: VoteReq;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const { proposalId, voter, vote } = body ?? {};
  if (!proposalId || !voter || vote == null) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

  const p = proposalById(proposalId);
  if (!p) return NextResponse.json({ error: "not found" }, { status: 404 });

  const voterKey = voter.toLowerCase();
  const nextVote = vote === true || vote === "yes";
  const prevVote = p.voters?.[voterKey];

  if (prevVote === nextVote) {
    const total = p.yes + p.no;
    const percentYes = total === 0 ? 0 : p.yes / total;
    return NextResponse.json({
      ok: true,
      id: p.id,
      yes: p.yes,
      no: p.no,
      voters: Object.keys(p.voters ?? {}).length,
      percentYes,
      unchanged: true,
    });
  }

  // block new votes after window end or if not in proposed state
  if (p.status !== "proposed" || currentEpoch() > p.voteEndsAtEpoch) {
    return NextResponse.json({ error: "voting closed" }, { status: 409 });
  }

  const yes = vote === true || vote === "yes";
  const updated = voteOn(proposalId, voter, yes);
  if (!updated) {
    return NextResponse.json({ error: "vote failed" }, { status: 500 });
  }

  const total = updated.yes + updated.no;
  const percentYes = total === 0 ? 0 : updated.yes / total;

  return NextResponse.json({
    ok: true,
    id: updated.id,
    yes: updated.yes,
    no: updated.no,
    voters: Object.keys(updated.voters).length,
    percentYes,
  });
}
