// GET /api/og/card/[app] — one share-card route for the site and every app
// (site, pray, board, vote, mifoid, about, files). This replaced seven
// per-route opengraph-image files: each of those compiled into its own
// route bundle carrying the image renderer, and the extra bundles pushed
// `next build` past the 2 GB heap cap the Render build runs with.
import { NextResponse } from "next/server";
import { ogCard, OG_CARDS } from "@/lib/ogCard";

export const runtime = "nodejs";
export const revalidate = 86400;

export async function GET(
  _req: Request,
  { params }: { params: { app: string } },
) {
  const card = OG_CARDS[params.app];
  if (!card) return NextResponse.json({ error: "unknown card" }, { status: 404 });
  return ogCard(card);
}
