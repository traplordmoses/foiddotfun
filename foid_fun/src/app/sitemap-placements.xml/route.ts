// /sitemap-placements.xml — every Loreboard placement page, with its image
// (Google image sitemap extension). Next 14's MetadataRoute.Sitemap type has
// no image field, hence a plain route. Placements flagged sensitive by the
// caption pass are left out, matching their noindex.
import { listPlacements, placedDate, placementImageUrl } from "@/lib/server/placementPages";
import { SITE_URL } from "@/lib/site";

export const runtime = "nodejs";
// Rendered per request (the placement list has its own 15s cache); a
// build-time prerender would hit the indexer during `next build`.
export const dynamic = "force-dynamic";

function xmlEscape(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function GET() {
  let placements: Awaited<ReturnType<typeof listPlacements>> = [];
  try {
    placements = await listPlacements();
  } catch {
    // Leave the list empty rather than fail; the main sitemap still works.
  }
  const entries = placements
    .filter((p) => !p.caption?.sensitive)
    .map((p) => {
      const date = placedDate(p);
      return [
        "<url>",
        `<loc>${SITE_URL}/board/proposal/${p.proposalId}</loc>`,
        date ? `<lastmod>${date}</lastmod>` : "",
        `<image:image><image:loc>${xmlEscape(placementImageUrl(p.cid, 640))}</image:loc></image:image>`,
        "</url>",
      ].join("");
    });
  const newest = placements.length ? placedDate(placements[0]) : "";
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
    `<url><loc>${SITE_URL}/board/placements</loc>${newest ? `<lastmod>${newest}</lastmod>` : ""}</url>`,
    ...entries,
    "</urlset>",
  ].join("\n");
  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
