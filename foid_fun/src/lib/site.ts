// src/lib/site.ts
// Canonical site facts shared by metadata, structured data and sitemaps.
export const SITE_URL = "https://foid.fun";
export const SITE_NAME = "FOID Foundation";
export const SITE_DESCRIPTION =
  "A community canvas for memes and culture, onchain. Pray daily with Foid Mommy, vote on what stays on the Loreboard, and earn up to 5x voting power.";

/** Official profiles (src/content/aboutDocs.ts, links.md). */
export const SAME_AS = [
  "https://x.com/foidfun",
  "https://github.com/traplordmoses/foiddotfun",
];

export const ORG_ID = `${SITE_URL}/#organization`;
export const WEBSITE_ID = `${SITE_URL}/#website`;

export function absoluteUrl(path: string): string {
  return new URL(path, SITE_URL).toString();
}
