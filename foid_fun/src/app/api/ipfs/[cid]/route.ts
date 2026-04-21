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

// Default to Pinata's public gateway — the board's content is pinned there,
// so it's the authoritative source. Operators with a paid Pinata plan
// should set PINATA_GATEWAY to their dedicated gateway (e.g.
// https://<prefix>.mypinata.cloud) to get authenticated, rate-limit-free
// reads.
const PINATA_GATEWAY_BASE =
  normalizeGateway(process.env.PINATA_GATEWAY) ?? "https://gateway.pinata.cloud";
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
const imageCache = new Map<string, CachedImage>();

function cacheGet(cid: string): CachedImage | null {
  const hit = imageCache.get(cid);
  if (!hit) return null;
  imageCache.delete(cid);
  imageCache.set(cid, hit);
  return hit;
}

function cachePut(cid: string, entry: CachedImage): void {
  if (imageCache.has(cid)) imageCache.delete(cid);
  imageCache.set(cid, entry);
  while (imageCache.size > CACHE_MAX_ENTRIES) {
    const first = imageCache.keys().next().value;
    if (first === undefined) break;
    imageCache.delete(first);
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

export async function GET(
  _request: NextRequest,
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

  const memoryHit = cacheGet(cleaned);
  if (memoryHit) {
    return new NextResponse(memoryHit.bytes, {
      status: 200,
      headers: cacheHeaders(memoryHit.contentType, true),
    });
  }

  const url = `${PINATA_GATEWAY_BASE}/ipfs/${cleaned}`;

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

    cachePut(cleaned, { bytes, contentType });

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
