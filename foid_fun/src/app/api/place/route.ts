// /src/app/api/place/route.ts
import { NextResponse } from "next/server";
import store from "@/server/store";
import type { PlacementIntent } from "@/lib/types";
import { getEpochInfo } from "@/lib/epoch";

export const runtime = "nodejs";

const MAX_CELLS = Number(process.env.NEXT_PUBLIC_MAX_CELLS_PER_RECT ?? 400);

type PlaceReq = {
  id?: string;
  owner: string;
  cid: string;
  rect: { x: number; y: number; w: number; h: number };
  cells: number;
  feePerCellWei: string;
  tipPerCellWei: string;
  name?: string;
  mime?: "image/png" | "image/jpeg";
  fitMode?: "contain" | "cover";
};

function uid() { return Math.random().toString(36).slice(2); }

export async function POST(req: Request) {
  let body: PlaceReq;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const { owner, cid, rect, cells, feePerCellWei, tipPerCellWei, name, mime, fitMode } = body ?? {};
  if (!owner || !cid || !rect || typeof cells !== "number" || !feePerCellWei || !tipPerCellWei) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }
  if (cells <= 0 || cells > MAX_CELLS) {
    return NextResponse.json({ error: `cells out of bounds (<= ${MAX_CELLS})` }, { status: 400 });
  }

  const now = Date.now();
  const { index: epochId } = getEpochInfo(now);

  const intent: PlacementIntent = {
    id: body.id ?? uid(),
    owner,
    cid,
    rect,
    cells,
    feePerCellWei: String(feePerCellWei),
    tipPerCellWei: String(tipPerCellWei),
    timeMs: now,                 // <-- required by type & finalize
    name, mime, fitMode,
  };

  const list = store.pendingByEpoch.get(epochId) ?? [];
  list.push(intent);
  store.pendingByEpoch.set(epochId, list);

  return NextResponse.json({ ok: true, epoch: epochId, id: intent.id });
}
