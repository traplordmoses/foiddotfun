// /app/api/ipfs-upload/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30; // seconds

type UploadReq = { name: string; base64: string; mime: "image/png" | "image/jpeg" };

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

// ─── Rate limiting ──────────────────────────────────────────────────────────
// This endpoint has no wallet to key on, so we bound it two ways: a per-IP
// limit (best-effort; x-forwarded-for is spoofable) AND a module-level global
// cap as a backstop so header rotation can't run Pinata pinning unbounded.
// In-memory is fine — a reset on redeploy just re-opens the window, and Pinata
// itself enforces the hard account quota behind this.
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const PER_IP_MAX = 10; // uploads per IP per window
const GLOBAL_MAX = 60; // uploads across ALL callers per window

const ipHits = new Map<string, number[]>();
let globalHits: number[] = [];

function withinWindow(now: number, ts: number): boolean {
  return now - ts < RATE_LIMIT_WINDOW_MS;
}

/** Returns true if this request should be rejected as rate-limited. */
function isRateLimited(ip: string): boolean {
  const now = Date.now();

  // Global backstop first — spoofed IPs still count here.
  globalHits = globalHits.filter((t) => withinWindow(now, t));
  if (globalHits.length >= GLOBAL_MAX) return true;

  const recent = (ipHits.get(ip) ?? []).filter((t) => withinWindow(now, t));
  if (recent.length >= PER_IP_MAX) {
    ipHits.set(ip, recent);
    return true;
  }

  recent.push(now);
  ipHits.set(ip, recent);
  globalHits.push(now);
  return false;
}

// Periodically drop stale IP buckets so the map can't grow unbounded.
setInterval(() => {
  const now = Date.now();
  for (const [ip, timestamps] of ipHits) {
    const recent = timestamps.filter((t) => withinWindow(now, t));
    if (recent.length === 0) ipHits.delete(ip);
    else ipHits.set(ip, recent);
  }
  globalHits = globalHits.filter((t) => withinWindow(now, t));
}, 5 * 60_000);

export async function POST(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || "unknown";
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many uploads. Please wait a moment." },
      { status: 429 },
    );
  }

  let body: UploadReq | null = null;
  try {
    body = await req.json();
  } catch (e) {
    console.error("[ipfs-upload] JSON parse failed:", e);
    return bad("Invalid JSON body");
  }
  if (!body) return bad("Missing body");

  const { name, base64, mime } = body;
  if (!name || !base64 || !mime) return bad("Required: { name, base64, mime }");
  if (mime !== "image/png" && mime !== "image/jpeg") return bad("Only PNG/JPEG allowed", 415);

  // Safety: limit upload size (rough base64->bytes)
  const MAX_BYTES = 5 * 1024 * 1024; // 5MB
  const approxBytes = Math.floor(base64.length * 0.75);
  if (approxBytes > MAX_BYTES) return bad("File too large", 413);

  const pinataJwt = process.env.PINATA_JWT;
  if (!pinataJwt) {
    return NextResponse.json(
      { error: "IPFS disabled (set PINATA_JWT)" },
      { status: 501 },
    );
  }

  try {
    // Decode base64 → binary
    const buf = Buffer.from(base64, "base64");

    const fd = new FormData();
    fd.append("file", new Blob([buf]), name);
    fd.append("pinataMetadata", JSON.stringify({ name }));

    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 25_000);

    let res: Response;
    try {
      res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
        method: "POST",
        headers: { Authorization: `Bearer ${pinataJwt}` },
        body: fd,
        signal: ac.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      // Log the raw Pinata detail server-side only; don't leak upstream error
      // text (which can carry gateway/account internals) to the caller.
      const err = await res.text().catch(() => "");
      console.error("[ipfs-upload] Pinata error:", res.status, err);
      return NextResponse.json(
        { error: "Upload failed. Please try again." },
        { status: 502 },
      );
    }

    const data = (await res.json()) as { IpfsHash: string };
    return NextResponse.json({ cid: data.IpfsHash });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Upload failed";
    console.error("[ipfs-upload] error:", message, e);
    // Generic to the caller; detail stays in the server log above.
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }
}
