import { NextRequest, NextResponse } from "next/server";
import { cleanIpfsPath } from "@/lib/ipfsUrl";

function normalizeGateway(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const strippedSlash = trimmed.replace(/\/+$/, "");
  return strippedSlash.replace(/\/ipfs$/i, "");
}

const PINATA_GATEWAY_BASE = normalizeGateway(process.env.PINATA_GATEWAY) ?? "https://ipfs.io";
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

  const url = `${PINATA_GATEWAY_BASE}/ipfs/${cleaned}`;

  const headers = new Headers();
  if (PINATA_JWT) {
    headers.set("Authorization", `Bearer ${PINATA_JWT}`);
  }

  try {
    const response = await fetch(url, { method: "GET", headers });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      const message = text ? `${response.statusText}: ${text}` : response.statusText;
      return NextResponse.json(
        { error: `Gateway responded ${response.status}: ${message}` },
        { status: response.status }
      );
    }

    const forwardedHeaders = new Headers(response.headers);
    forwardedHeaders.set("Cache-Control", "public, max-age=600, s-maxage=600");
    forwardedHeaders.delete("set-cookie");

    return new NextResponse(response.body, {
      status: response.status,
      headers: forwardedHeaders,
    });
  } catch (error) {
    console.error("[api/ipfs] fetch failed:", error);
    return NextResponse.json({ error: "Failed to fetch from IPFS gateway" }, { status: 502 });
  }
}
