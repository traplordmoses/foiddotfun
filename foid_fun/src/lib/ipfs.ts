// /src/lib/ipfs.ts
// Client-safe utilities + a server-safe JSON uploader.
// Env options: WEB3_STORAGE_TOKEN (preferred) or PINATA_JWT (fallback).

const DEFAULT_IPFS_GATEWAYS = [
  "https://cloudflare-ipfs.com/ipfs/",
  "https://ipfs.io/ipfs/",
  "https://gateway.pinata.cloud/ipfs/",
];

export function ipfsToHttp(
  uri: string,
  gateways = DEFAULT_IPFS_GATEWAYS
): string[] {
  if (!uri) return [];
  let cidPath = uri.trim();
  if (!cidPath) return [];

  if (/^https?:\/\//i.test(cidPath)) {
    return [cidPath];
  }

  if (cidPath.startsWith("ipfs://")) {
    cidPath = cidPath.slice("ipfs://".length);
  }

  cidPath = cidPath.replace(/^ipfs\//i, "").replace(/^\/+/, "");
  if (!cidPath) return [];

  return gateways.map((base) => {
    const prefix = base.endsWith("/") ? base : `${base}/`;
    return `${prefix}${cidPath}`;
  });
}

export function ipfsUrl(cid: string): string {
  return ipfsToHttp(cid)[0] ?? "";
}

/** Convert a Blob/File to base64 (no data: prefix). */
async function blobToBase64(b: Blob): Promise<string> {
  const buf = new Uint8Array(await b.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
  return btoa(bin);
}

/**
 * Upload an image to your local API → Web3.Storage.
 * Returns the CID string on success, or null if IPFS is disabled (501).
 * Throws on other failures.
 */
export async function uploadImage(
  name: string,
  file: File | Blob,
  mime: "image/png" | "image/jpeg"
): Promise<string | null> {
  const base64 = await blobToBase64(file);

  const res = await fetch("/api/ipfs-upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, base64, mime }),
  });

  if (res.status === 501) return null; // IPFS not configured — caller should fallback to objectURL
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error ?? `Upload failed with ${res.status}`);
  }

  const data = (await res.json()) as { cid: string };
  return data.cid;
}

export async function uploadJSON(
  name: string,
  data: unknown
): Promise<string> {
  const W3 = process.env.WEB3_STORAGE_TOKEN;
  const body = new Blob([JSON.stringify(data)], {
    type: "application/json",
  });

  if (W3) {
    const r = await fetch("https://api.web3.storage/upload", {
      method: "POST",
      headers: { Authorization: `Bearer ${W3}` },
      body,
    });
    if (!r.ok) throw new Error("web3.storage upload failed");
    const j = await r.json();
    return j.cid as string;
  }

  const PINATA_JWT = process.env.PINATA_JWT;
  if (PINATA_JWT) {
    const r = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PINATA_JWT}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        pinataMetadata: { name },
        pinataContent: data,
      }),
    });
    if (!r.ok) throw new Error("pinata upload failed");
    const j = await r.json();
    return j.IpfsHash as string;
  }

  return `bafy-dev-${Math.random().toString(36).slice(2)}`;
}
