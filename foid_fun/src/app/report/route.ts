// GET /report — the latest weekly Foid Mommy report, served as the HTML the
// narrator rendered. Cached five minutes at the origin; the cron writes at
// most once a week.
import { NextResponse } from "next/server";
import { supabaseRest, supabaseServerConfigured } from "@/lib/supabaseRest";

export const runtime = "nodejs";
export const revalidate = 300;

const EMPTY = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>FOID MUMMY WEEKLY</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0a0a1a;color:#e0e0f0;font-family:ui-monospace,monospace}p{letter-spacing:.2em;text-transform:uppercase;font-size:12px;opacity:.7}</style></head><body><p>no report yet. foid mommy files on mondays.</p></body></html>`;

export async function GET() {
  if (!supabaseServerConfigured()) {
    return new NextResponse(EMPTY, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
  const res = await supabaseRest("weekly_reports?select=html&order=created_at.desc&limit=1");
  const rows = res && res.ok ? ((await res.json()) as Array<{ html: string }>) : [];
  const html = rows[0]?.html ?? EMPTY;
  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
    },
  });
}
