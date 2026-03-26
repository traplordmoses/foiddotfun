// /app/api/ipfs-upload/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30; // seconds

type UploadReq = { name: string; base64: string; mime: "image/png" | "image/jpeg" };

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

export async function POST(req: Request) {
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
      const err = await res.text();
      console.error("[ipfs-upload] Pinata error:", res.status, err);
      return NextResponse.json(
        { error: `Pinata upload failed (${res.status}): ${err}` },
        { status: 502 },
      );
    }

    const data = (await res.json()) as { IpfsHash: string };
    return NextResponse.json({ cid: data.IpfsHash });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Upload failed";
    console.error("[ipfs-upload] error:", message, e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
