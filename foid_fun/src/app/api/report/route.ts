// POST /api/report — the weekly narrator cron publishes a rendered report
// (CRON_SECRET bearer). GET /api/report — latest report as JSON metadata.
import { NextRequest, NextResponse } from "next/server";
import { supabaseRest, supabaseServerConfigured } from "@/lib/supabaseRest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_HTML = 2 * 1024 * 1024;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!supabaseServerConfigured()) return NextResponse.json({ error: "storage not configured" }, { status: 503 });
  let body: { html?: string; narrative?: string; from?: number; to?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  if (!body.html || typeof body.html !== "string" || body.html.length > MAX_HTML) {
    return NextResponse.json({ error: "html required (max 2 MB)" }, { status: 400 });
  }
  const res = await supabaseRest("weekly_reports", {
    method: "POST",
    prefer: "return=representation",
    body: JSON.stringify({
      period_from: new Date((body.from ?? Date.now() / 1000 - 7 * 86400) * 1000).toISOString(),
      period_to: new Date((body.to ?? Date.now() / 1000) * 1000).toISOString(),
      html: body.html,
      narrative: body.narrative ?? null,
    }),
  });
  if (!res || !res.ok) {
    return NextResponse.json({ error: "insert failed" }, { status: 502 });
  }
  const rows = (await res.json()) as Array<{ id: number }>;
  return NextResponse.json({ ok: true, id: rows[0]?.id ?? null });
}

export async function GET() {
  if (!supabaseServerConfigured()) return NextResponse.json({ report: null });
  const res = await supabaseRest(
    "weekly_reports?select=id,period_from,period_to,created_at&order=created_at.desc&limit=1",
  );
  if (!res || !res.ok) return NextResponse.json({ report: null });
  const rows = (await res.json()) as unknown[];
  return NextResponse.json({ report: rows[0] ?? null }, { headers: { "Cache-Control": "public, max-age=300" } });
}
