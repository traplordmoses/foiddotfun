// /src/app/api/propose/route.ts
import { NextResponse } from "next/server";
import { rectCells, hasOverlap, type Rect } from "@/lib/grid";
import { currentEpoch } from "@/lib/epoch";
import {
  getStore,
  addProposal,
  listAccepted,
  type Proposal,
} from "../_store";

export const runtime = "nodejs";

const MAX_CELLS = Number(process.env.NEXT_PUBLIC_MAX_CELLS_PER_RECT ?? 400);

type ProposeReq = {
  id?: string;
  owner: string;
  cid: string;
  name?: string;
  mime?: "image/png" | "image/jpeg";
  rect: Rect;
  width?: number;
  height?: number;
  bidPerCellWei: string; // total bid per cell
};

function uid() {
  return Math.random().toString(36).slice(2);
}

export async function POST(req: Request) {
  let body: ProposeReq;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const { owner, cid, rect, bidPerCellWei, name, mime, width, height } = body ?? {};
  if (!owner || !cid || !rect || !bidPerCellWei) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

  const cells = rectCells(rect);
  if (cells <= 0 || cells > MAX_CELLS) {
    return NextResponse.json({ error: `cells out of bounds (<= ${MAX_CELLS})` }, { status: 400 });
  }
  if (mime && mime !== "image/png" && mime !== "image/jpeg") {
    return NextResponse.json({ error: "unsupported mime" }, { status: 400 });
  }

  // Optional pre-check: if overlapping accepted, require strictly higher bid.
  const accepted = listAccepted();
  const overlaps = accepted.filter((pl) => hasOverlap(rect, [pl.rect]));
  if (overlaps.length) {
    const myBid = BigInt(bidPerCellWei);
    const needsHigher = overlaps.some((pl) => myBid <= BigInt(pl.bidPerCellWei));
    if (needsHigher) {
      const minReq = overlaps.reduce(
        (mx, pl) => (BigInt(pl.bidPerCellWei) > mx ? BigInt(pl.bidPerCellWei) : mx),
        0n
      );
      return NextResponse.json(
        { error: "bid too low to displace accepted item(s)", requireGreaterThanWei: (minReq).toString() },
        { status: 409 }
      );
    }
  }

  const S = getStore();
  const nowEpoch = currentEpoch();
  const window = Math.max(1, S.voteWindowEpochs);
  const voteEndsAtEpoch = nowEpoch + window;

  const p = addProposal({
    id: body.id ?? uid(),
    owner,
    cid,
    name: name ?? "",
    mime: (mime ?? "image/png") as "image/png" | "image/jpeg",
    rect,
    cells,
    bidPerCellWei: String(bidPerCellWei),
    width,
    height,
    epochSubmitted: nowEpoch,
    voteEndsAtEpoch,
  } as Omit<Proposal, "yes" | "no" | "voters" | "status" | "createdAt">);

  return NextResponse.json({
    ok: true,
    id: p.id,
    epochSubmitted: p.epochSubmitted,
    voteEndsAtEpoch: p.voteEndsAtEpoch,
  });
}
