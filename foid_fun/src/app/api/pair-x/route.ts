import { NextRequest, NextResponse } from "next/server";
import { verifyMessage } from "viem";
import { deactivatePairing, getPairing, upsertPairing } from "@/lib/pairings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_HANDLE_LENGTH = 15; // X enforces 15 chars max
const HANDLE_PATTERN = /^[A-Za-z0-9_]{1,15}$/;
const WALLET_RE = /^0x[a-fA-F0-9]{40}$/;
const SIGNATURE_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes

// ─── POST /api/pair-x ───

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { wallet, handle, signature, timestamp } = body;

    if (!wallet || !handle || !signature || !timestamp) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }
    if (!WALLET_RE.test(String(wallet))) {
      return NextResponse.json({ error: "Invalid wallet" }, { status: 400 });
    }

    // Validate handle format
    const cleanHandle = String(handle).replace(/^@/, "");
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
    const walletLower = String(wallet).toLowerCase() as `0x${string}`;

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

    const saved = await upsertPairing(walletLower, cleanHandle, String(signature));
    if (!saved) {
      return NextResponse.json({ error: "Could not save pairing" }, { status: 502 });
    }
    return NextResponse.json({ success: true, handle: cleanHandle });
  } catch (error) {
    console.error("[api/pair-x] POST error:", error);
    return NextResponse.json({ error: "pairing failed" }, { status: 500 });
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
    if (!WALLET_RE.test(String(wallet))) {
      return NextResponse.json({ error: "Invalid wallet" }, { status: 400 });
    }

    const ts = Number(timestamp);
    if (Number.isNaN(ts) || Date.now() - ts > SIGNATURE_MAX_AGE_MS) {
      return NextResponse.json({ error: "Signature expired" }, { status: 400 });
    }

    const message = `Unpair X account from FOID. Timestamp: ${ts}`;
    const walletLower = String(wallet).toLowerCase() as `0x${string}`;

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

    await deactivatePairing(walletLower);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[api/pair-x] DELETE error:", error);
    return NextResponse.json({ error: "unpair failed" }, { status: 500 });
  }
}

// ─── GET /api/pair-x?wallet={address} ───

export async function GET(request: NextRequest) {
  const wallet = new URL(request.url).searchParams.get("wallet");
  if (!wallet || !WALLET_RE.test(wallet)) {
    return NextResponse.json({ error: "Missing or invalid wallet param" }, { status: 400 });
  }
  const row = await getPairing(wallet);
  if (!row) return NextResponse.json({ paired: false });
  return NextResponse.json({ paired: true, handle: row.handle });
}
