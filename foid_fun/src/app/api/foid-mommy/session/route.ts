// GET /api/foid-mommy/session — hands the prayer terminal a short-lived
// token that /api/foid-mommy requires (see src/lib/mommySession.ts).
import { NextResponse } from "next/server";
import { consumeBudget, requestIdentity } from "@/lib/requestBudget";
import { issueSessionToken } from "@/lib/mommySession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    if (!await consumeBudget("mommy-issue:global", 120, 60_000) || !await consumeBudget(`mommy-issue:${requestIdentity(req)}`, 10, 60_000)) {
      return NextResponse.json({ error: "Too many sessions" }, { status: 429, headers: { "Retry-After": "60", "Cache-Control": "no-store" } });
    }
    return NextResponse.json(issueSessionToken(), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Prayer service unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
