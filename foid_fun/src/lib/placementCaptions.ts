// src/lib/placementCaptions.ts
// AI-written captions for Loreboard placements (title, alt text, description,
// tags, sensitive flag), keyed by IPFS CID. Generated and reviewed offline by
// scripts/caption-placements.ts; this module only reads the JSON.
import captionsFile from "@/content/placementCaptions.json";

export type PlacementCaption = {
  title: string;
  alt: string;
  description: string;
  tags: string[];
  sensitive: boolean;
  model: string;
  captionedAt: string;
};

const CAPTIONS = (captionsFile as { captions: Record<string, PlacementCaption> }).captions;

export function captionFor(cid: string | null | undefined): PlacementCaption | null {
  if (!cid) return null;
  return CAPTIONS[cid] ?? null;
}
