const GATEWAY_BASE =
  process.env.NEXT_PUBLIC_IPFS_GATEWAY_BASE ??
  process.env.NEXT_PUBLIC_IPFS_GATEWAY ??
  "https://ipfs.io/ipfs/";

const FALLBACK_GATEWAYS = [
  GATEWAY_BASE,
  "https://ipfs.io/ipfs/",
  "https://gateway.pinata.cloud/ipfs/",
];

const NORMALIZED_GATEWAYS = Array.from(
  new Set(
    FALLBACK_GATEWAYS
      .filter((base): base is string => Boolean(base?.trim()))
      .map((base) => (base.endsWith("/") ? base : `${base}/`))
  )
);

export function getIpfsGateways(): string[] {
  return NORMALIZED_GATEWAYS.slice();
}

export function ipfsToHttp(
  uri: string,
  gateways = NORMALIZED_GATEWAYS
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

  const uniqueGateways = gateways.length
    ? Array.from(new Set(gateways))
    : NORMALIZED_GATEWAYS;

  return uniqueGateways.map((base) => {
    const prefix = base.endsWith("/") ? base : `${base}/`;
    return `${prefix}${cidPath}`;
  });
}

export function cidToHttpUrl(cid: string): string {
  return ipfsToHttp(cid)[0] ?? "";
}

export function ipfsUrl(cid: string): string {
  return cidToHttpUrl(cid);
}
