// src/config/mediaLibrary.ts
// ============================================================================
// MEDIA LIBRARY — the manifest behind FILES.EXE (/files).
//
// FILES.EXE renders exactly what is registered here, in array order.
// No entry, no tile. Two ways to add media:
//
// LOCAL FILE (simplest — good for MiFOID music videos)
//   1. Drop the file into  foid_fun/public/media/   (e.g. my-video.mp4)
//   2. Add an entry below with  src: "/media/my-video.mp4"
//   Next.js serves everything in public/ verbatim, so the path is just the
//   filename with a /media/ prefix.
//
// IPFS (permanent — good for canon artifacts)
//   1. Pin the file to Pinata (or any pinning service) and copy the CID.
//   2. Use  src: "ipfs://<cid>"  (a bare CID also works). FILES.EXE resolves
//      it with the same ipfsToHttp helper the board uses — which prefers the
//      /api/ipfs/<cid> proxy when NEXT_PUBLIC_IPFS_PROXY_PATH is set, and
//      falls back to public gateways otherwise.
//
// `poster` is an optional 16:9 thumbnail (same path rules as `src`); tiles
// without one show a kind glyph instead. `addedAt` is an ISO date
// (YYYY-MM-DD) displayed on the tile.
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
  // Example — local file dropped into foid_fun/public/media/:
  // {
  //   id: "mifoid-anthem",
  //   title: "MIFOID ANTHEM (OFFICIAL VIDEO)",
  //   kind: "video",
  //   src: "/media/mifoid-anthem.mp4",
  //   poster: "/media/mifoid-anthem-poster.jpg",
  //   addedAt: "2026-07-05",
  //   description: "First transmission from the MiFOID sound division.",
  // },
  //
  // Example — pinned to Pinata, resolved via ipfsToHttp → /api/ipfs proxy:
  // {
  //   id: "prayer-loop-001",
  //   title: "PRAYER LOOP 001",
  //   kind: "audio",
  //   src: "ipfs://bafybeihq5g5tsundpm3o56xrfp3sy6ry3ny5kv3fkgtklslpcv3ac7wmxa",
  //   addedAt: "2026-07-05",
  // },
];
