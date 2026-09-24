// src/lib/mediaBase.ts
// Optional off-origin host for the heavy media folders (audit P5). When
// NEXT_PUBLIC_MEDIA_BASE is set (e.g. https://media.foid.fun backed by
// Cloudflare R2), FILES.EXE videos and the music library load from there;
// unset, they serve from /public exactly as before. Small assets (posters,
// effects, icons) stay on the app origin either way.
export const MEDIA_BASE = (process.env.NEXT_PUBLIC_MEDIA_BASE ?? "").replace(/\/+$/, "");

const OFFLOADED_PREFIXES = ["/media/", "/sfx/music/"];

export function mediaUrl(path: string): string {
  if (!MEDIA_BASE) return path;
  if (!path.startsWith("/")) return path;
  // Posters, thumbnails and share cards stay local: first paint, and small
  // enough for git.
  if (/-(poster|thumb|card)\.jpg$/.test(path)) return path;
  return OFFLOADED_PREFIXES.some((p) => path.startsWith(p)) ? `${MEDIA_BASE}${path}` : path;
}

/** The app-origin copy of a URL on the media host, or null for anything
 *  else. Players list it as a second <source>, so a file that has not been
 *  synced to R2 yet still plays from the deploy. */
export function originFallback(url: string): string | null {
  return MEDIA_BASE && url.startsWith(`${MEDIA_BASE}/`) ? url.slice(MEDIA_BASE.length) : null;
}
