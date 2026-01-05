import { NextRequest, NextResponse } from "next/server";
import { rectCells, type Rect } from "@/lib/grid";
import { currentEpoch, getEpochInfo, EPOCH_SECONDS, VOTE_WINDOW_SECONDS } from "@/lib/epoch";
import { addProposal, listProposals, type Proposal } from "../_store";
import { ProposalStore } from "@/lib/proposalStore";
import { keccak256, stringToHex } from "viem";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const proposals = listProposals();
  const nowEpoch = currentEpoch();
  const epochInfo = getEpochInfo(Date.now());
  const secondsPerEpoch = epochInfo.lengthSec;
  const secsRemainingCurrentEpoch = epochInfo.secondsLeft;

  const withCountdown = proposals.map((p) => {
    const rawId = String(p.id ?? "");
    const chainId =
      typeof p.chainId === "string" && p.chainId.startsWith("0x") && p.chainId.length === 66
        ? (p.chainId as `0x${string}`)
        : undefined;
    const placementId =
      chainId ??
      (rawId.startsWith("0x") && rawId.length === 66
        ? (rawId as `0x${string}`)
        : (keccak256(stringToHex(rawId)) as `0x${string}`));
    const epochsDiff = p.voteEndsAtEpoch - nowEpoch;
    const secondsLeft =
      epochsDiff < 0 || !epochInfo.enabled || secondsPerEpoch <= 0
        ? 0
        : secsRemainingCurrentEpoch + epochsDiff * secondsPerEpoch;
    return {
      ...p,
      chainId: chainId ?? placementId,
      placementId,
      voters: p.voters ? Object.keys(p.voters).length : 0,
      epochId: p.epochSubmitted,
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

  const nowEpoch = currentEpoch();
  const secondsPerEpoch = EPOCH_SECONDS > 0 ? EPOCH_SECONDS : 0;
  const voteWindowSeconds = VOTE_WINDOW_SECONDS > 0 ? VOTE_WINDOW_SECONDS : 259200;
  const windowEpochs =
    secondsPerEpoch > 0 ? Math.max(1, Math.ceil(voteWindowSeconds / secondsPerEpoch)) : 1;

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
    voteEndsAtEpoch: nowEpoch + windowEpochs,
    chainId:
      typeof body.id === "string" && body.id.startsWith("0x") && body.id.length === 66
        ? body.id
        : undefined,
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
