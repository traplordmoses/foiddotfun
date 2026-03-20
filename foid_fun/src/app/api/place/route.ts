// /src/app/api/place/route.ts
import { NextResponse } from "next/server";
import { getDb } from "@/db/db";
import type { PlacementIntent } from "@/lib/types";
import { getEpochInfo } from "@/lib/epoch";

export const runtime = "nodejs";

const MAX_CELLS = Number(process.env.NEXT_PUBLIC_MAX_CELLS_PER_RECT ?? 400);
const ETH_ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;
const MAX_CID_LENGTH = 100;
const MAX_NAME_LENGTH = 256;
const PLACEMENT_COOLDOWN_MS = 10_000; // 10 seconds per owner

// Short-lived cooldown — fine in-memory (resets on restart = harmless)
const ownerLastPlacement = new Map<string, number>();

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

  if (!ETH_ADDRESS_PATTERN.test(owner)) {
    return NextResponse.json({ error: "invalid owner address" }, { status: 400 });
  }

  if (cid.length > MAX_CID_LENGTH) {
    return NextResponse.json({ error: `cid too long (max ${MAX_CID_LENGTH} chars)` }, { status: 400 });
  }

  if (name && name.length > MAX_NAME_LENGTH) {
    return NextResponse.json({ error: `name too long (max ${MAX_NAME_LENGTH} chars)` }, { status: 400 });
  }

  // Validate rect structure
  if (typeof rect.x !== "number" || typeof rect.y !== "number" ||
      typeof rect.w !== "number" || typeof rect.h !== "number" ||
      rect.w <= 0 || rect.h <= 0) {
    return NextResponse.json({ error: "invalid rect: need x, y, w (>0), h (>0)" }, { status: 400 });
  }

  const ownerLower = owner.toLowerCase();
  const lastPlacement = ownerLastPlacement.get(ownerLower);
  if (lastPlacement && Date.now() - lastPlacement < PLACEMENT_COOLDOWN_MS) {
    const waitSec = Math.ceil((PLACEMENT_COOLDOWN_MS - (Date.now() - lastPlacement)) / 1000);
    return NextResponse.json(
      { error: `Too fast. Please wait ${waitSec}s before placing again.` },
      { status: 429 },
    );
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
    timeMs: now,
    name, mime, fitMode,
  };

  // Persist intent to SQLite
  const db = getDb();
  db.prepare(`
    INSERT INTO placement_intents
      (id, epoch, owner, cid, rect_x, rect_y, rect_w, rect_h, cells,
       fee_per_cell_wei, tip_per_cell_wei, time_ms, name, mime, fit_mode)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    intent.id, epochId, intent.owner, intent.cid,
    intent.rect.x, intent.rect.y, intent.rect.w, intent.rect.h,
    intent.cells, intent.feePerCellWei, intent.tipPerCellWei, intent.timeMs,
    intent.name ?? null, intent.mime ?? null, intent.fitMode ?? null,
  );

  ownerLastPlacement.set(ownerLower, Date.now());

  return NextResponse.json({ ok: true, epoch: epochId, id: intent.id });
}
