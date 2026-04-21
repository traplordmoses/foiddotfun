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
// so it's the authoritative source. Previously defaulted to ipfs.io which
// is notoriously flaky and defeated the whole point of having a JWT.
// Operators with a paid Pinata plan should set PINATA_GATEWAY to their
// dedicated gateway (e.g. https://<prefix>.mypinata.cloud) to get
// authenticated, rate-limit-free reads.
const PINATA_GATEWAY_BASE =
  normalizeGateway(process.env.PINATA_GATEWAY) ?? "https://gateway.pinata.cloud";
const PINATA_JWT = process.env.PINATA_JWT?.trim();

export const runtime = "nodejs";

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(
  request: NextRequest,
  { params }: { params?: { cid?: string | string[] } }
) {
  const rawCid = Array.isArray(params?.cid) ? params?.cid[0] : params?.cid;
  const cleaned = cleanIpfsPath(rawCid);
  if (!cleaned) {
    return bad("Missing or invalid CID");
  }

  // Strict CID validation to prevent SSRF
  if (!CID_PATTERN.test(cleaned)) {
    return bad("Invalid CID format");
  }

  const url = `${PINATA_GATEWAY_BASE}/ipfs/${cleaned}`;

  const headers = new Headers();
  if (PINATA_JWT) {
    headers.set("Authorization", `Bearer ${PINATA_JWT}`);
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const response = await fetch(url, {
      method: "GET",
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      const message = text ? `${response.statusText}: ${text}` : response.statusText;
      return NextResponse.json(
        { error: `Gateway responded ${response.status}: ${message}` },
        { status: response.status }
      );
    }

    // Check Content-Length if available
    const contentLength = response.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_RESPONSE_BYTES) {
      return bad("Response too large (max 10MB)", 413);
    }

    const forwardedHeaders = new Headers(response.headers);
    // IPFS content is content-addressed — the same CID always returns the
    // same bytes. Safe to cache forever at the browser and the edge, and
    // `immutable` tells the browser never to send revalidation requests.
    // This is the single biggest lever on /board cold-load time: the first
    // visitor pays the upstream fetch, everyone else in the cache window
    // gets it from the edge (~10ms) or their browser cache (~0ms).
    forwardedHeaders.set(
      "Cache-Control",
      "public, max-age=31536000, s-maxage=31536000, immutable",
    );
    forwardedHeaders.delete("set-cookie");

    return new NextResponse(response.body, {
      status: response.status,
      headers: forwardedHeaders,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return NextResponse.json({ error: "IPFS gateway request timed out" }, { status: 504 });
    }
    console.error("[api/ipfs] fetch failed:", error);
    return NextResponse.json({ error: "Failed to fetch from IPFS gateway" }, { status: 502 });
  }
}
