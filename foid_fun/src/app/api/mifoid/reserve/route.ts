// MiFOID mint reservations (audit U6).
//   POST { wallet, signature, timestamp, handle? } — EIP-191 proof of the
//        wallet, upserts a reservation (service role; RLS denies anon).
//   GET  — reservation count for the page.
import { NextRequest, NextResponse } from "next/server";
import { verifyMessage } from "viem";
import { supabaseRest, supabaseServerConfigured } from "@/lib/supabaseRest";
import { reserveMessage } from "@/lib/mifoidReserve";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WALLET_RE = /^0x[a-fA-F0-9]{40}$/;
const SIG_RE = /^0x[a-fA-F0-9]+$/;
const HANDLE_RE = /^[A-Za-z0-9_]{1,15}$/;
const MAX_AGE_MS = 5 * 60 * 1000;

export async function POST(req: NextRequest) {
  if (!supabaseServerConfigured()) {
    return NextResponse.json({ error: "reservations not open yet" }, { status: 503 });
  }
  let body: { wallet?: string; signature?: string; timestamp?: number; handle?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const { wallet, signature, timestamp, handle } = body;
  if (!wallet || !WALLET_RE.test(wallet)) return NextResponse.json({ error: "invalid wallet" }, { status: 400 });
  if (!signature || !SIG_RE.test(signature)) return NextResponse.json({ error: "missing signature" }, { status: 401 });
  const ts = Number(timestamp);
  if (!Number.isInteger(ts) || Math.abs(Date.now() - ts) > MAX_AGE_MS) {
    return NextResponse.json({ error: "signature expired" }, { status: 401 });
  }
  const cleanHandle = handle ? String(handle).replace(/^@/, "") : null;
  if (cleanHandle && !HANDLE_RE.test(cleanHandle)) {
    return NextResponse.json({ error: "invalid handle" }, { status: 400 });
  }
  let valid = false;
  try {
    valid = await verifyMessage({
      address: wallet as `0x${string}`,
      message: reserveMessage(wallet, ts),
      signature: signature as `0x${string}`,
    });
  } catch {
    valid = false;
  }
  if (!valid) return NextResponse.json({ error: "signature does not match wallet" }, { status: 401 });

  const res = await supabaseRest("mifoid_reservations?on_conflict=wallet", {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=minimal",
    body: JSON.stringify({ wallet: wallet.toLowerCase(), handle: cleanHandle, signature }),
  });
  if (!res || !res.ok) return NextResponse.json({ error: "could not save reservation" }, { status: 502 });
  return NextResponse.json({ ok: true });
}

export async function GET() {
  if (!supabaseServerConfigured()) return NextResponse.json({ open: false, count: 0 });
  const res = await supabaseRest("mifoid_reservations?select=wallet", {
    method: "HEAD",
    prefer: "count=exact",
  });
  const total = res?.headers.get("content-range")?.split("/")[1];
  const count = total ? Number(total) : 0;
  return NextResponse.json(
    { open: true, count: Number.isFinite(count) ? count : 0 },
    { headers: { "Cache-Control": "public, max-age=60" } },
  );
}
