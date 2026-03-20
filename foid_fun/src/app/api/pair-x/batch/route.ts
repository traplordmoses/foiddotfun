import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_WALLETS = 100;

// ─── GET /api/pair-x/batch?wallets={comma-separated} ───

export async function GET(request: NextRequest) {
  const walletsParam = new URL(request.url).searchParams.get("wallets");
  if (!walletsParam) {
    return NextResponse.json({ error: "Missing wallets param" }, { status: 400 });
  }

  // Validate: only accept valid-looking Ethereum addresses (0x + 40 hex chars)
  const ETH_ADDR = /^0x[0-9a-f]{40}$/;
  const wallets = walletsParam
    .split(",")
    .map((w) => w.trim().toLowerCase())
    .filter((w) => ETH_ADDR.test(w));
  if (wallets.length === 0) {
    return NextResponse.json({});
  }
  if (wallets.length > MAX_WALLETS) {
    return NextResponse.json(
      { error: `Max ${MAX_WALLETS} wallets per request` },
      { status: 400 }
    );
  }

  const db = getDb();
  const placeholders = wallets.map(() => "?").join(",");
  const rows = db
    .prepare(`SELECT wallet, handle FROM x_pairings WHERE wallet IN (${placeholders}) AND active = 1`)
    .all(...wallets) as Array<{ wallet: string; handle: string }>;

  const result: Record<string, string> = {};
  for (const row of rows) {
    result[row.wallet] = row.handle;
  }

  return NextResponse.json(result);
}
