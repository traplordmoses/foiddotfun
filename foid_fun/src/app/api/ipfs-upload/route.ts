// /app/api/ipfs-upload/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type UploadReq = { name: string; base64: string; mime: "image/png" | "image/jpeg" };

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

export async function POST(req: Request) {
  let body: UploadReq | null = null;
  try { body = await req.json(); } catch { return bad("Invalid JSON body"); }
  if (!body) return bad("Missing body");

  const { name, base64, mime } = body;
  if (!name || !base64 || !mime) return bad("Required: { name, base64, mime }");
  if (mime !== "image/png" && mime !== "image/jpeg") return bad("Only PNG/JPEG allowed", 415);

  // Safety: limit upload size (rough base64->bytes)
  const MAX_BYTES = 5 * 1024 * 1024; // 5MB
  const approxBytes = Math.floor(base64.length * 0.75);
  if (approxBytes > MAX_BYTES) return bad("File too large", 413);

  // Decode once
  const buf = Buffer.from(base64, "base64");
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;

  const web3Token = process.env.WEB3_STORAGE_TOKEN; // legacy token, if you have one
  const pinataJwt = process.env.PINATA_JWT;         // recommended fallback

  try {
    // Prefer Web3.Storage if configured
    if (web3Token) {
      const { Web3Storage, File } = await import("web3.storage");
      const client = new Web3Storage({ token: web3Token });
      const file = new File([ab], name, { type: mime });
      const cid = await client.put([file], { wrapWithDirectory: false });
      return NextResponse.json({ cid });
    }

    // Fallback: Pinata JWT
    if (pinataJwt) {
      const fd = new FormData();
      fd.append("file", new Blob([ab], { type: mime }), name);
      fd.append("pinataMetadata", JSON.stringify({ name }));

      const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
        method: "POST",
        headers: { Authorization: `Bearer ${pinataJwt}` },
        body: fd,
      });

      if (!res.ok) {
        const err = await res.text();
        return NextResponse.json({ error: `Pinata upload failed: ${err}` }, { status: 502 });
      }
      const data = await res.json() as { IpfsHash: string };
      return NextResponse.json({ cid: data.IpfsHash });
    }

    // Neither configured
    return NextResponse.json(
      { error: "IPFS disabled (set WEB3_STORAGE_TOKEN or PINATA_JWT)" },
      { status: 501 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Upload failed" }, { status: 500 });
  }
}
