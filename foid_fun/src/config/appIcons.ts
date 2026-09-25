// src/config/appIcons.ts
// Glass app icons (public/icons/glass-v2/<name>-<96|128>.webp): clear
// crystal glyphs for the dock (96px, drawn at ~30px) and the phone home
// screen (128px, drawn at ~40px).
//
// How they were made, so new ones match: fal.ai "fal-ai/nano-banana"
// rendered the house on a pure black background ("a small stylised house
// made entirely of clear transparent crystal glass ... thick glass with
// refraction, bright white specular highlights along the edges, soft
// aqua-cyan light caustics inside ... pure black background, no floor, no
// reflection, no shadow, no text"), then "fal-ai/nano-banana/edit" made
// every other glyph from that house as the style reference ("replace the
// house with <object>, made of the same clear crystal glass ..."). Black
// became transparency (alpha = brightness^1.4, colour unpremultiplied): the
// bright edges stay, the glass bodies go see-through, and the glass picks up
// whatever is behind it. Each glyph was trimmed and centred with 12% air.
// GlassIcon adds the glossy cap and the glint in CSS.
//
// Bump the folder (glass-v3) when an icon changes: /icons is edge-cached
// for a week.

export type GlassIconName =
  | "home"
  | "pray"
  | "board"
  | "vote"
  | "mifoid"
  | "files"
  | "about"
  | "music"
  | "chat"
  | "episodes"
  | "more";

export function glassIconSrc(name: GlassIconName, px: 96 | 128 = 96): string {
  return `/icons/glass-v2/${name}-${px}.webp`;
}
