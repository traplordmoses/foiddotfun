import { NextRequest, NextResponse } from "next/server";
import { rectCells, type Rect } from "@/lib/grid";
import {
  currentEpoch,
  nowUnix,
  EPOCH_SECONDS,
  EPOCH_ZERO_UNIX,
} from "@/lib/epoch";
import {
  addProposal,
  getStore,
  listProposals,
  type Proposal,
} from "../_store";
import { ProposalStore } from "@/lib/proposalStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const proposals = listProposals();
  const nowEpoch = currentEpoch();
  const secondsPerEpoch = Math.max(1, Number.isFinite(EPOCH_SECONDS) ? EPOCH_SECONDS : 3600);
  const nowSec = nowUnix();
  const delta = Math.max(0, nowSec - EPOCH_ZERO_UNIX);
  const secsIntoEpoch = secondsPerEpoch ? delta % secondsPerEpoch : 0;
  const secsRemainingCurrentEpoch = secondsPerEpoch - secsIntoEpoch;

  const withCountdown = proposals.map((p) => {
    const epochsDiff = p.voteEndsAtEpoch - nowEpoch;
    const secondsLeft =
      epochsDiff < 0
        ? 0
        : secsRemainingCurrentEpoch + epochsDiff * secondsPerEpoch;
    return {
      ...p,
      secondsLeft: Math.max(0, secondsLeft),
    };
  });

  return NextResponse.json({ proposals: withCountdown }, { status: 200 });
}

type ProposalPostBody = {
  id?: string;
  owner: string;
  cid: string;
  name?: string;
  mime?: "image/png" | "image/jpeg";
  rect: Rect;
  width?: number;
  height?: number;
  bidPerCellWei: string | number | bigint;
  cells?: number;
  filename?: string;
};

export async function POST(req: NextRequest) {
  let body: ProposalPostBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { owner, cid, rect, bidPerCellWei } = body ?? {};
  if (!owner || !cid || !rect || bidPerCellWei == null) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (body.mime && body.mime !== "image/png" && body.mime !== "image/jpeg") {
    return NextResponse.json({ error: "Unsupported mime type" }, { status: 400 });
  }

  const normalizedCid = cid.replace(/^ipfs:\/\//, "").trim();
  if (!normalizedCid) {
    return NextResponse.json({ error: "Invalid CID" }, { status: 400 });
  }

  const cells = Number.isFinite(body.cells) && body.cells && body.cells > 0 ? body.cells : rectCells(rect);
  if (cells <= 0) {
    return NextResponse.json({ error: "Cells must be positive" }, { status: 400 });
  }

  const S = getStore();
  const nowEpoch = currentEpoch();
  const window = Math.max(1, S.voteWindowEpochs);

  const proposal = addProposal({
    id: body.id ?? normalizedCid,
    owner,
    cid: normalizedCid,
    name: body.name ?? "",
    mime: (body.mime ?? "image/png") as "image/png" | "image/jpeg",
    rect,
    cells,
    bidPerCellWei: String(bidPerCellWei),
    width: body.width,
    height: body.height,
    epochSubmitted: nowEpoch,
    voteEndsAtEpoch: nowEpoch + window,
  } as Omit<Proposal, "yes" | "no" | "voters" | "status" | "createdAt">);

  ProposalStore.upsert({
    id: proposal.id,
    owner,
    cid: normalizedCid,
    name: proposal.name,
    mime: proposal.mime,
    width: proposal.width,
    height: proposal.height,
    filename: body.filename,
    rect,
    bidPerCellWei: proposal.bidPerCellWei,
  });

  return NextResponse.json({ ok: true, proposal }, { status: 200 });
}
