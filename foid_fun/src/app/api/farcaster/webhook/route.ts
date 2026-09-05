// Farcaster mini-app webhook receiver. Clients POST here when a user adds
// or removes the app or toggles notifications. We acknowledge and log the
// event type; storing notification tokens (for streak reminders) is the
// follow-up wired to the streak-forgiveness work.
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const event = (body as { event?: string } | null)?.event ?? "unknown";
  console.log(`[farcaster] webhook event=${event}`);
  return NextResponse.json({ ok: true });
}
