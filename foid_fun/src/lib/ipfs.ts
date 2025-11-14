// /src/lib/ipfs.ts
// Client-safe utilities + a server-safe JSON uploader.
// Env options: WEB3_STORAGE_TOKEN (preferred) or PINATA_JWT (fallback).

export { ipfsToHttp, cidToHttpUrl, ipfsUrl } from "./ipfsUrl";

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
  const payload = JSON.stringify(data);
  const body = new Blob([payload], {
    type: "application/json",
  });

  const parseJson = (txt: string) => {
    try {
      return JSON.parse(txt);
    } catch {
      return null;
    }
  };

  const W3 = process.env.WEB3_STORAGE_TOKEN;
  if (W3) {
    const res = await fetch("https://api.web3.storage/upload", {
      method: "POST",
      headers: { Authorization: `Bearer ${W3}` },
      body,
    });
    const text = await res.text();
    const json = parseJson(text);
    if (!res.ok) {
      throw new Error(
        `web3.storage upload failed: ${res.status} ${
          json?.error ?? text ?? "unknown error"
        }`
      );
    }
    if (!json?.cid) {
      throw new Error("web3.storage upload failed: missing cid");
    }
    return json.cid as string;
  }

  const PINATA_JWT = process.env.PINATA_JWT;
  if (PINATA_JWT) {
    const res = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
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
    const text = await res.text();
    const json = parseJson(text);
    if (!res.ok) {
      const errMsg =
        json?.error?.message ?? json?.error ?? text ?? "unknown error";
      throw new Error(`pinata upload failed: ${res.status} ${errMsg}`);
    }
    if (!json?.IpfsHash) {
      throw new Error("pinata upload failed: missing IpfsHash");
    }
    return json.IpfsHash as string;
  }

  console.warn(
    "[ipfs] No WEB3_STORAGE_TOKEN or PINATA_JWT configured. Using dev CID."
  );
  return `dev-manifest-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
