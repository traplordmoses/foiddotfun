// src/lib/server/placementPages.ts
// Typed view of the live placement list for the server-rendered pages:
// /board/proposal/<id>, /board/placements and /sitemap-placements.xml.
import { getPlacements } from "@/lib/server/placements";
import { captionFor, type PlacementCaption } from "@/lib/placementCaptions";
import { SITE_URL } from "@/lib/site";

export type PlacementSummary = {
  proposalId: number;
  cid: string;
  owner: string;
  w: number;
  h: number;
  cells: number;
  /** Unix seconds. */
  placedAt: number;
  yesVotes: number;
  noVotes: number;
  caption: PlacementCaption | null;
};

function normalize(raw: unknown): PlacementSummary | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  const proposalId = Number(p.proposalId);
  const cid = typeof p.cid === "string" ? p.cid : "";
  if (!Number.isInteger(proposalId) || proposalId < 0 || !cid || p.removed === true) return null;
  return {
    proposalId,
    cid,
    owner: typeof p.owner === "string" ? p.owner : "",
    w: Number(p.w) || 0,
    h: Number(p.h) || 0,
    cells: Number(p.cells) || 0,
    placedAt: Number(p.placedAt) || 0,
    yesVotes: Number(p.yesVotes) || 0,
    noVotes: Number(p.noVotes) || 0,
    caption: captionFor(cid),
  };
}

/** Every live placement, newest first. */
export async function listPlacements(): Promise<PlacementSummary[]> {
  const { data } = await getPlacements();
  const seen = new Set<number>();
  return data.proposals
    .map(normalize)
    .filter((p): p is PlacementSummary => {
      if (!p || seen.has(p.proposalId)) return false;
      seen.add(p.proposalId);
      return true;
    })
    .sort((a, b) => b.placedAt - a.placedAt || b.proposalId - a.proposalId);
}

/** Relative URL of the edge-cached WebP tile (see next.config.mjs rewrites). */
export function placementImagePath(cid: string, cssWidth: number, quality = 85): string {
  return `/img/ipfs/${cid}.webp?w=${cssWidth}&f=webp&q=${quality}`;
}

export function placementImageUrl(cid: string, cssWidth: number, quality = 85): string {
  return `${SITE_URL}${placementImagePath(cid, cssWidth, quality)}`;
}

export function placementTitle(p: PlacementSummary): string {
  return p.caption?.title ?? `Loreboard placement #${p.proposalId}`;
}

export function placementAlt(p: PlacementSummary): string {
  return p.caption?.alt ?? `Loreboard placement #${p.proposalId}`;
}

/** Alt text for a thumbnail next to its own title: the caption's alt adds
 *  detail; without a caption it would only repeat the title, so it is empty. */
export function thumbnailAlt(p: PlacementSummary): string {
  return p.caption?.alt ?? "";
}

export function placedDate(p: PlacementSummary): string {
  return p.placedAt ? new Date(p.placedAt * 1000).toISOString().slice(0, 10) : "";
}
