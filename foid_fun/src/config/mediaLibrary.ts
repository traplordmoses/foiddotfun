// src/config/mediaLibrary.ts
// ============================================================================
// MEDIA LIBRARY — the manifest behind FILES.EXE (/files).
//
// CURATOR-ONLY, BY DESIGN. This is the official MiFOID media archive: the
// founder's videos + MiFOID image artifacts + pointers to the open-source
// repo. There is no upload path and there never will be — visitors browse,
// the foundation curates. FILES.EXE renders exactly what is registered
// here, in array order. No entry, no file.
//
// MAINTAINER NOTES (not user-facing — keep it that way):
//
// LOCAL FILE (simplest — good for MiFOID music videos)
//   1. Drop the file into  foid_fun/public/media/   (e.g. my-video.mp4)
//   2. Add an entry below with  src: "/media/my-video.mp4"
//   Next.js serves everything in public/ verbatim, so the path is just the
//   filename with a /media/ prefix. Images already in public/ (like the
//   MiFOID renders below) can be referenced by their root path directly.
//
// IPFS (permanent — good for canon artifacts)
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
