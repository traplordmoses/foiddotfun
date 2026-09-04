// GET /api/foid-mommy/session — hands the prayer terminal a short-lived
// token that /api/foid-mommy requires (see src/lib/mommySession.ts).
import { NextResponse } from "next/server";
import { issueSessionToken } from "@/lib/mommySession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { token, expiresAt } = issueSessionToken();
  return NextResponse.json(
    { token, expiresAt },
    { headers: { "Cache-Control": "no-store" } },
  );
}
