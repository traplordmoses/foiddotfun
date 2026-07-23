// src/config/mediaLibrary.ts
// ============================================================================
// MEDIA LIBRARY — the manifest behind FILES.EXE (/files).
//
// CURATOR-ONLY, BY DESIGN. This is the official MiFOID media archive: the
// founder's videos + MiFOID image artifacts + internet-culture stills the
// foundation is preserving. There is no upload path and there never will be —
// visitors browse, the foundation curates. FILES.EXE renders exactly what is
// registered here, in array order. No entry, no file.
//
// MAINTAINER NOTES (not user-facing — keep it that way):
//
// LOCAL FILE (simplest — good for MiFOID videos + renders)
//   1. Drop the file into  foid_fun/public/media/   (e.g. my-video.mp4)
//   2. Add an entry below with  src: "/media/my-video.mp4"
//   Next.js serves everything in public/ verbatim, so the path is just the
//   filename with a /media/ prefix. Images already in public/ (like the
//   MiFOID renders below) can be referenced by their root path directly.
//
//   OPTIMIZE before committing — this is a git repo, not a CDN. Videos:
//   H.264 720p, CRF ~27, +faststart, AAC 128k (keeps a 10-min 1080p clip
//   ~20MB instead of 230MB). Images: max ~1500px, JPEG q~84 (or keep PNG
//   only for flat-color graphics). Give each video a 16:9 `poster` frame
//   (ffmpeg -ss <t> -frames:v 1) so its tile shows art, not a glyph.
//
// IPFS (permanent — good for canon artifacts too big for git)
//   1. Pin the file to Pinata (or any pinning service) and copy the CID.
//   2. Use  src: "ipfs://<cid>"  (a bare CID also works). FILES.EXE resolves
//      it with the same ipfsToHttp helper the board uses — which prefers the
//      /api/ipfs/<cid> proxy when NEXT_PUBLIC_IPFS_PROXY_PATH is set, and
//      falls back to public gateways otherwise.
//
// `poster` is an optional 16:9 thumbnail (same path rules as `src`). Items
// of kind "image" fall back to their own `src` as the thumbnail; video and
// audio without a poster show a kind glyph. `addedAt` is an ISO date
// (YYYY-MM-DD) shown in the Date Added column.
// ============================================================================

export type MediaItem = {
  id: string;
  title: string;
  kind: "video" | "audio" | "image";
  src: string;
  poster?: string;
  addedAt: string;
  description?: string;
};

export const MEDIA_LIBRARY: MediaItem[] = [
  // ── VIDEOS ────────────────────────────────────────────────────────────
  {
    id: "backrooms-vhs",
    title: "MIFOID // BACKROOMS VHS",
    kind: "video",
    src: "/media/backrooms-vhs.mp4",
    poster: "/media/backrooms-vhs-poster.jpg",
    addedAt: "2026-07-22",
    description: "tape recovered from the backrooms. she was there the whole time.",
  },
  {
    id: "bliss-dream",
    title: "BLISS.DREAM",
    kind: "video",
    src: "/media/bliss-dream.mp4",
    poster: "/media/bliss-dream-poster.jpg",
    addedAt: "2026-07-22",
    description: "rolling green hills, xp sky. the wallpaper you can live inside.",
  },
  {
    id: "kush-haze",
    title: "KUSH HAZE",
    kind: "video",
    src: "/media/kush-haze.mp4",
    poster: "/media/kush-haze-poster.jpg",
    addedAt: "2026-07-22",
    description: "slow smoke, heavy air. mifoid in the haze.",
  },
  {
    id: "golden-hour-cabin",
    title: "GOLDEN HOUR // CABIN",
    kind: "video",
    src: "/media/golden-hour-cabin.mp4",
    poster: "/media/golden-hour-cabin-poster.jpg",
    addedAt: "2026-07-06",
    description: "next week fr this time. sun going down over the cabin, ten minutes of it.",
  },
  {
    id: "mifoid-succubus-mode",
    title: "MIFOID // SUCCUBUS MODE",
    kind: "video",
    src: "/media/mifoid-succubus-mode.mp4",
    poster: "/media/mifoid-succubus-mode-poster.jpg",
    addedAt: "2026-07-06",
    description: "devil skin unlocked. 666.exe running in the background.",
  },
  {
    id: "summer-torii-aero",
    title: "SUMMER.EXE",
    kind: "video",
    src: "/media/summer-torii-aero.mp4",
    poster: "/media/summer-torii-aero-poster.jpg",
    addedAt: "2026-07-06",
    description: "torii gate, aero water, endless summer. the frutiger dream, rendered.",
  },
  {
    id: "travis-cabin-underwater",
    title: "TRAVIS CABIN // UNDERWATER",
    kind: "video",
    src: "/media/travis-cabin-underwater.mp4",
    poster: "/media/travis-cabin-underwater-poster.jpg",
    addedAt: "2026-07-06",
    description: "aquarium summer. the cabin, but submerged.",
  },
  {
    id: "olympics-tv",
    title: "OLYMPICS.TV",
    kind: "video",
    src: "/media/olympics-tv.mp4",
    poster: "/media/olympics-tv-poster.jpg",
    addedAt: "2026-07-06",
    description: "brazil mode on a CRT. mifoid goes to the beer olympics.",
  },
  {
    id: "brazil-beer-olympics",
    title: "BRAZIL MODE // BEER OLYMPICS",
    kind: "video",
    src: "/media/brazil-beer-olympics.mp4",
    poster: "/media/brazil-beer-olympics-poster.jpg",
    addedAt: "2026-07-06",
    description: "we're going as brazil for the beer olympics this coming saturday.",
  },
  {
    id: "travis-cabin-soon",
    title: "TRAVIS CABIN // SOON",
    kind: "video",
    src: "/media/travis-cabin-soon.mp4",
    poster: "/media/travis-cabin-soon-poster.jpg",
    addedAt: "2026-07-06",
    description: "let's go to travis cabin.",
  },
  {
    id: "shes-back",
    title: "SHE'S BACK",
    kind: "video",
    src: "/media/shes-back.mp4",
    poster: "/media/shes-back-poster.jpg",
    addedAt: "2026-07-06",
    description: "red succubus // eternal.",
  },
  {
    id: "were-actually-going",
    title: "WE'RE ACTUALLY GOING.MP4",
    kind: "video",
    src: "/media/were-actually-going.mp4",
    poster: "/media/were-actually-going-poster.jpg",
    addedAt: "2026-07-06",
    description: "we're actually planning to go to travis cabin next week this time.",
  },
  {
    id: "life-is-beautiful",
    title: "LIFE IS BEAUTIFUL.MP4",
    kind: "video",
    src: "/media/life-is-beautiful.mp4",
    poster: "/media/life-is-beautiful-poster.jpg",
    addedAt: "2026-07-06",
    description: "torii at golden hour. life is beautiful, actually.",
  },

  // ── MIFOID RENDERS ────────────────────────────────────────────────────
  {
    id: "mifoid-workin-like-a-dog",
    title: "MIFOID // WORKIN' LIKE A DOG",
    kind: "image",
    src: "/media/mifoid-workin-like-a-dog.png",
    addedAt: "2026-07-06",
    description: "workin' like a dog all day on mifoid. the beanie says it all.",
  },
  {
    id: "mifoid-full-body",
    title: "MIFOID // FULL BODY",
    kind: "image",
    src: "/media/mifoid-full-body.jpg",
    addedAt: "2026-07-06",
    description: "flares, pink-sole sneakers, hikki emori connection hoodie. in the bubble.",
  },
  {
    id: "mifoid-lowerr",
    title: "MIFOID // LOWERR",
    kind: "image",
    src: "/media/mifoid-lowerr.jpg",
    addedAt: "2026-07-06",
    description: "two of them — lowerr green, devil-horned black. the crew.",
  },
  {
    id: "sybau-heartbreak",
    title: "SYBAU 💔",
    kind: "image",
    src: "/media/sybau-heartbreak.jpg",
    addedAt: "2026-07-06",
    description: "halftone, horns, both birds up. sybau.",
  },
  {
    id: "mifoid-blue-headphones",
    title: "MIFOID // BLUE HEADPHONES",
    kind: "image",
    src: "/media/mifoid-blue-headphones.png",
    addedAt: "2026-07-06",
    description: "straight from the viewport — headphones on, tuned in.",
  },
  {
    id: "mifoid-single-tear",
    title: "MIFOID // SINGLE TEAR",
    kind: "image",
    src: "/media/mifoid-single-tear.jpg",
    addedAt: "2026-07-06",
    description: "one tear, still smiling. painted close.",
  },

  // ── INTERNET-CULTURE ARCHIVE ──────────────────────────────────────────
  {
    id: "bullish-on-foids",
    title: "BULLISH ON FOIDS",
    kind: "image",
    src: "/media/bullish-on-foids.jpg",
    addedAt: "2026-07-06",
    description: "the only chart that matters.",
  },
  {
    id: "epic-gold-star",
    title: "EPIC GOLD STAR",
    kind: "image",
    src: "/media/epic-gold-star.png",
    addedAt: "2026-07-06",
    description: "here is an epic gold star for an even more epic person. you are so swag. mwah.",
  },
  {
    id: "chef-hamster",
    title: "CHEF HAMSTER",
    kind: "image",
    src: "/media/chef-hamster.jpg",
    addedAt: "2026-07-06",
    description: "he's cooking.",
  },
  {
    id: "wire-me-a-band-twin",
    title: "WIRE ME A BAND TWIN",
    kind: "image",
    src: "/media/wire-me-a-band-twin.jpg",
    addedAt: "2026-07-06",
  },
  {
    id: "post-this-milady",
    title: "POST THIS MILADY",
    kind: "image",
    src: "/media/post-this-milady.jpg",
    addedAt: "2026-07-06",
    description: "post this milady when they least expect it.",
  },
  {
    id: "peaceful-shi",
    title: "BEEN ON THAT PEACEFUL SHI",
    kind: "image",
    src: "/media/peaceful-shi.jpg",
    addedAt: "2026-07-06",
  },

  // ── SEED ARTIFACTS (public root) ──────────────────────────────────────
  {
    id: "foid-mommy",
    title: "FOID MOMMY",
    kind: "image",
    src: "/foidmommy.gif",
    addedAt: "2026-07-05",
    description: "The original Foid Mommy loop — the face of the prayer terminal.",
  },
  {
    id: "mifoid-01",
    title: "MIFOID — PRAY DAILY",
    kind: "image",
    src: "/mifoid01.png",
    addedAt: "2026-07-05",
    description: "MiFOID in the bubble. pray daily. win forever.",
  },
  {
    id: "mifoid-02",
    title: "MIFOID — GREEN HOODIE",
    kind: "image",
    src: "/mifoid02.png",
    addedAt: "2026-07-05",
  },
  {
    id: "mifoid-03",
    title: "MIFOID — BLACK HOODIE",
    kind: "image",
    src: "/mifoid03.png",
    addedAt: "2026-07-05",
  },
  {
    id: "mifoid-04",
    title: "MIFOID — GRAY TEE",
    kind: "image",
    src: "/mifoid04.png",
    addedAt: "2026-07-05",
  },
  {
    id: "mifoid-05",
    title: "MIFOID — UNTITLED (PAINT)",
    kind: "image",
    src: "/mifoid05.png",
    addedAt: "2026-07-05",
    description: "MiFOID rendered inside untitled - Paint.",
  },
  {
    id: "mifoid-07",
    title: "MIFOID — BLENDER VIEWPORT",
    kind: "image",
    src: "/mifoid07.png",
    addedAt: "2026-07-05",
    description: "Straight from the workshop — the living agent mid-build.",
  },
  {
    id: "mifoid-08",
    title: "MIFOID — TEXTURE PAINT",
    kind: "image",
    src: "/mifoid08.png",
    addedAt: "2026-07-05",
    description: "Baggy jeans cloth pass, texture paint mode.",
  },
];
