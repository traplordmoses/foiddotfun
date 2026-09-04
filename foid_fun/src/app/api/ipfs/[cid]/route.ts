import { NextRequest, NextResponse } from "next/server";
import { cleanIpfsPath } from "@/lib/ipfsUrl";

const CID_PATTERN = /^(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{58,})$/;
const FETCH_TIMEOUT_MS = 30_000;
const MAX_RESPONSE_BYTES = 10 * 1024 * 1024; // 10 MB

function normalizeGateway(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const strippedSlash = trimmed.replace(/\/+$/, "");
  return strippedSlash.replace(/\/ipfs$/i, "");
}

// Upstream gateway selection:
//   1. PINATA_GATEWAY — explicit server-only dedicated gateway
//   2. NEXT_PUBLIC_IPFS_GATEWAY_BASE — reuse the client-side value if it
//      already points at a `.mypinata.cloud` dedicated gateway. Saves
//      the operator from having to set two env vars for the same thing.
//   3. gateway.pinata.cloud — Pinata's public gateway, works for any
//      pinned content but DOES NOT support image transforms, so the
//      transform path in this route is effectively a no-op without a
//      dedicated gateway.
function resolvePinataBase(): string {
  const explicit = normalizeGateway(process.env.PINATA_GATEWAY);
  if (explicit) return explicit;

  const fromClient = normalizeGateway(
    process.env.NEXT_PUBLIC_IPFS_GATEWAY_BASE,
  );
  if (fromClient && /\.mypinata\.cloud$/i.test(fromClient)) {
    return fromClient;
  }

  return "https://gateway.pinata.cloud";
}

const PINATA_GATEWAY_BASE = resolvePinataBase();
const PINATA_HAS_TRANSFORMS = /\.mypinata\.cloud$/i.test(PINATA_GATEWAY_BASE);
const PINATA_JWT = process.env.PINATA_JWT?.trim();

export const runtime = "nodejs";

// ──────────────────────────────────────────────────────────────────────
// Per-instance in-memory image cache.
//
// Why this exists: Render's edge (Cloudflare in front of the service)
// flags /api/* as `cf-cache-status: DYNAMIC` regardless of Cache-Control,
// so our `immutable, max-age=1y` header only helps the *same* browser on
// repeat visits — every new visitor pays the full Pinata round-trip.
// This Map caches the bytes in the Node process so concurrent visitors on
// the same Render instance hit our own RAM instead of Pinata. A single
// instance lives minutes-to-hours under Render's rolling deploys, which
// is plenty to keep the hot set warm.
//
// No TTL needed: IPFS CIDs are content-addressed, so the same CID always
// maps to the same bytes. Evict purely by LRU when the cap is hit.
//
// Why not Next.js's `unstable_cache` / fetch data cache: Next's data cache
// is optimized for JSON under ~2 MB and persists to disk. For binary
// payloads that can be up to 10 MB per entry, a plain Map is simpler,
// avoids serialization overhead, and doesn't fight Next's size limits.
// ──────────────────────────────────────────────────────────────────────

type CachedImage = { bytes: Uint8Array; contentType: string };
const CACHE_MAX_ENTRIES = 128;
// Byte budget. Entries can be up to MAX_RESPONSE_BYTES each, so an
// entry-count cap alone allowed 128 x 10 MB = 1.28 GB on an instance whose
// Node heap is limited to 1 GB. 64 MB holds a few hundred board tiles.
const CACHE_MAX_BYTES = 64 * 1024 * 1024;
const imageCache = new Map<string, CachedImage>();
let imageCacheBytes = 0;

function cacheGet(cid: string): CachedImage | null {
  const hit = imageCache.get(cid);
  if (!hit) return null;
  imageCache.delete(cid);
  imageCache.set(cid, hit);
  return hit;
}

function cacheDelete(key: string): void {
  const existing = imageCache.get(key);
  if (!existing) return;
  imageCacheBytes -= existing.bytes.byteLength;
  imageCache.delete(key);
}

function cachePut(cid: string, entry: CachedImage): void {
  // Never let a single oversized payload evict the whole hot set.
  if (entry.bytes.byteLength > CACHE_MAX_BYTES / 4) return;
  cacheDelete(cid);
  imageCache.set(cid, entry);
  imageCacheBytes += entry.bytes.byteLength;
  while (
    imageCache.size > CACHE_MAX_ENTRIES ||
    imageCacheBytes > CACHE_MAX_BYTES
  ) {
    const first = imageCache.keys().next().value;
    if (first === undefined) break;
    cacheDelete(first);
  }
}

function cacheHeaders(contentType: string, hit: boolean): Headers {
  const h = new Headers();
  h.set("Content-Type", contentType);
  h.set(
    "Cache-Control",
    "public, max-age=31536000, s-maxage=31536000, immutable",
  );
  // Makes it easy to tell from DevTools whether the in-process cache is
  // working without having to eyeball timings.
  h.set("X-Ipfs-Proxy-Cache", hit ? "HIT" : "MISS");
  return h;
}

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

// Query params accepted from the client; translate to Pinata's image-
// transform API. Dedicated Pinata gateways serve the transformed variant
// from their own edge cache separately from the original, so the same
// CID can have many cached renditions. Measured: 118 KB JPEG → 29 KB
// WebP, 820ms → 100ms on Pinata CDN HIT (`?img-width=400&img-format=webp
// &img-quality=80`). Public gateways ignore these params — they serve
// the original bytes — which is fine because we only fall back there on
// proxy failure.
const FORMAT_WHITELIST = new Set(["webp", "jpeg", "png", "auto"]);

function parseTransformParams(search: URLSearchParams): {
  search: string;
  cacheSuffix: string;
} {
  // No-op when the configured gateway is the public one (it doesn't know
  // `img-*`). Avoids poisoning the in-process cache with per-variant
  // entries that all return the same original bytes.
  if (!PINATA_HAS_TRANSFORMS) return { search: "", cacheSuffix: "" };

  const w = search.get("w");
  const h = search.get("h");
  const f = search.get("f");
  const q = search.get("q");

  const upstream = new URLSearchParams();
  // img-dpr=2 paired with img-width=<CSS_px> means a retina-clean render
  // for the CSS pixel size the card asked for, without the client having
  // to know the user's actual DPR.
  if (w && /^\d+$/.test(w)) {
    upstream.set("img-width", w);
    upstream.set("img-dpr", "2");
  }
  if (h && /^\d+$/.test(h)) upstream.set("img-height", h);
  if (f && FORMAT_WHITELIST.has(f)) upstream.set("img-format", f);
  if (q && /^\d+$/.test(q)) {
    const qn = Math.max(1, Math.min(100, parseInt(q, 10)));
    upstream.set("img-quality", String(qn));
  }
  if (upstream.has("img-width") || upstream.has("img-height")) {
    upstream.set("img-fit", "cover");
  }

  const s = upstream.toString();
  return {
    search: s ? `?${s}` : "",
    cacheSuffix: s ? `|${s}` : "",
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params?: { cid?: string | string[] } },
) {
  const rawCid = Array.isArray(params?.cid) ? params?.cid[0] : params?.cid;
  const cleaned = cleanIpfsPath(rawCid);
  if (!cleaned) {
    return bad("Missing or invalid CID");
  }

  // Strict CID validation to prevent SSRF.
  if (!CID_PATTERN.test(cleaned)) {
    return bad("Invalid CID format");
  }

  const { searchParams } = new URL(request.url);
  const transform = parseTransformParams(searchParams);
  // Cache transformed variants under distinct keys so a 200w WebP and the
  // original JPEG don't collide in the Map.
  const cacheKey = `${cleaned}${transform.cacheSuffix}`;

  const memoryHit = cacheGet(cacheKey);
  if (memoryHit) {
    return new NextResponse(memoryHit.bytes, {
      status: 200,
      headers: cacheHeaders(memoryHit.contentType, true),
    });
  }

  const url = `${PINATA_GATEWAY_BASE}/ipfs/${cleaned}${transform.search}`;

  const fetchHeaders = new Headers();
  if (PINATA_JWT) {
    fetchHeaders.set("Authorization", `Bearer ${PINATA_JWT}`);
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const response = await fetch(url, {
      method: "GET",
      headers: fetchHeaders,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      const message = text ? `${response.statusText}: ${text}` : response.statusText;
      return NextResponse.json(
        { error: `Gateway responded ${response.status}: ${message}` },
        { status: response.status },
      );
    }

    const contentLength = response.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_RESPONSE_BYTES) {
      return bad("Response too large (max 10MB)", 413);
    }

    // Buffer the full body so we can both cache it in-process AND return
    // it to this caller. Previously this streamed response.body straight
    // through — which was fine for a single caller but left nothing for
    // the next visitor to reuse. Images on /board are typically 50KB–1MB
    // so the buffer cost is negligible.
    const arrayBuf = await response.arrayBuffer();
    if (arrayBuf.byteLength > MAX_RESPONSE_BYTES) {
      return bad("Response too large (max 10MB)", 413);
    }

    const bytes = new Uint8Array(arrayBuf);
    const contentType =
      response.headers.get("content-type") ?? "application/octet-stream";

    cachePut(cacheKey, { bytes, contentType });

    return new NextResponse(bytes, {
      status: 200,
      headers: cacheHeaders(contentType, false),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return NextResponse.json({ error: "IPFS gateway request timed out" }, { status: 504 });
    }
    console.error("[api/ipfs] fetch failed:", error);
    return NextResponse.json({ error: "Failed to fetch from IPFS gateway" }, { status: 502 });
  }
}
