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
  if (path.endsWith("-poster.jpg")) return path; // posters stay local: first paint
  return OFFLOADED_PREFIXES.some((p) => path.startsWith(p)) ? `${MEDIA_BASE}${path}` : path;
}
