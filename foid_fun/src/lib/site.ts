// src/lib/site.ts
// Canonical site facts shared by metadata, structured data and sitemaps.
export const SITE_URL = "https://foid.fun";
export const SITE_NAME = "FOID Foundation";
export const SITE_DESCRIPTION =
  "A community canvas for memes and culture, onchain. Pray daily with Foid Mommy, vote on what stays on the Loreboard, and earn up to 5x voting power.";

/** Where the MiFOID episodes post (launch schedule: @foidfun everywhere). */
export const SOCIAL_PROFILES = {
  tiktok: "https://www.tiktok.com/@foidfun",
  instagram: "https://www.instagram.com/foidfun",
  x: "https://x.com/foidfun",
} as const;

/** Official profiles (src/content/aboutDocs.ts, links.md, the schedule). */
export const SAME_AS = [
  SOCIAL_PROFILES.x,
  SOCIAL_PROFILES.tiktok,
  SOCIAL_PROFILES.instagram,
  "https://github.com/traplordmoses/foiddotfun",
];

export const ORG_ID = `${SITE_URL}/#organization`;
export const WEBSITE_ID = `${SITE_URL}/#website`;

export function absoluteUrl(path: string): string {
  return new URL(path, SITE_URL).toString();
}
