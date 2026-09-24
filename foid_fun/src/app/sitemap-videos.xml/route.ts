// /sitemap-videos.xml — every published MiFOID episode and archive film with
// its watch page, thumbnail, file, duration and date (Google video sitemap
// extension). Rendered per request so a scheduled episode appears the
// moment it is published.
import { absoluteUrl, listWatchVideos } from "@/lib/server/videos";
import { SITE_URL } from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function xmlEscape(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

export async function GET() {
  const entries = listWatchVideos().map((video) => {
    const description = video.kind === "episode" ? `${video.logline} ${video.description}` : video.description || video.title;
    return [
      "<url>",
      `<loc>${SITE_URL}/watch/${video.id}</loc>`,
      "<video:video>",
      `<video:thumbnail_loc>${xmlEscape(absoluteUrl(video.posterPath))}</video:thumbnail_loc>`,
      `<video:title>${xmlEscape(video.title)}</video:title>`,
      `<video:description>${xmlEscape(description.slice(0, 2000))}</video:description>`,
      `<video:content_loc>${xmlEscape(absoluteUrl(video.videoPath))}</video:content_loc>`,
      video.durationSec ? `<video:duration>${Math.max(1, Math.round(video.durationSec))}</video:duration>` : "",
      `<video:publication_date>${video.publishedAt}</video:publication_date>`,
      "</video:video>",
      "</url>",
    ].join("");
  });
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">',
    `<url><loc>${SITE_URL}/watch</loc></url>`,
    ...entries,
    "</urlset>",
  ].join("\n");
  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=600",
    },
  });
}
