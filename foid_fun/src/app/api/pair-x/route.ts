import { NextRequest, NextResponse } from "next/server";
import { verifyMessage } from "viem";
import { getDb } from "@/db/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_HANDLE_LENGTH = 15; // X enforces 15 chars max
const HANDLE_PATTERN = /^[A-Za-z0-9_]{1,15}$/;
const SIGNATURE_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes

// ─── POST /api/pair-x ───

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { wallet, handle, signature, timestamp } = body;

    if (!wallet || !handle || !signature || !timestamp) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // Validate handle format
    const cleanHandle = handle.replace(/^@/, "");
    if (!HANDLE_PATTERN.test(cleanHandle) || cleanHandle.length > MAX_HANDLE_LENGTH) {
      return NextResponse.json({ error: "Invalid X handle" }, { status: 400 });
    }

    // Validate timestamp (replay protection)
    const ts = Number(timestamp);
    if (Number.isNaN(ts) || Date.now() - ts > SIGNATURE_MAX_AGE_MS) {
      return NextResponse.json({ error: "Signature expired" }, { status: 400 });
    }

    // Verify signature
    const message = `I am @${cleanHandle} on X. Linking to FOID Foundation. Timestamp: ${ts}`;
    const walletLower = wallet.toLowerCase() as `0x${string}`;

    let valid: boolean;
    try {
      valid = await verifyMessage({
        address: walletLower,
        message,
        signature: signature as `0x${string}`,
      });
    } catch {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    if (!valid) {
      return NextResponse.json({ error: "Signature does not match wallet" }, { status: 403 });
    }

    // Upsert pairing
    const db = getDb();
    db.prepare(`
      INSERT INTO x_pairings (wallet, handle, signature, paired_at, active)
      VALUES (?, ?, ?, ?, 1)
      ON CONFLICT(wallet) DO UPDATE SET
        handle = excluded.handle,
        signature = excluded.signature,
        paired_at = excluded.paired_at,
        active = 1
    `).run(walletLower, cleanHandle, signature, Date.now());

    return NextResponse.json({ success: true, handle: cleanHandle });
  } catch (error) {
    console.error("[api/pair-x] POST error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

// ─── DELETE /api/pair-x ───

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { wallet, signature, timestamp } = body;

    if (!wallet || !signature || !timestamp) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const ts = Number(timestamp);
    if (Number.isNaN(ts) || Date.now() - ts > SIGNATURE_MAX_AGE_MS) {
      return NextResponse.json({ error: "Signature expired" }, { status: 400 });
    }

    const message = `Unpair X account from FOID. Timestamp: ${ts}`;
    const walletLower = wallet.toLowerCase() as `0x${string}`;

    let valid: boolean;
    try {
      valid = await verifyMessage({
        address: walletLower,
        message,
        signature: signature as `0x${string}`,
      });
    } catch {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    if (!valid) {
      return NextResponse.json({ error: "Signature does not match wallet" }, { status: 403 });
    }

    const db = getDb();
    db.prepare("UPDATE x_pairings SET active = 0 WHERE wallet = ?").run(walletLower);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[api/pair-x] DELETE error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

// ─── GET /api/pair-x?wallet={address} ───

export async function GET(request: NextRequest) {
  const wallet = new URL(request.url).searchParams.get("wallet");
  if (!wallet) {
    return NextResponse.json({ error: "Missing wallet param" }, { status: 400 });
  }

  const db = getDb();
  const row = db
    .prepare("SELECT handle FROM x_pairings WHERE wallet = ? AND active = 1")
    .get(wallet.toLowerCase()) as { handle: string } | undefined;

  if (!row) {
    return NextResponse.json({ paired: false });
  }

  return NextResponse.json({ paired: true, handle: row.handle });
}
