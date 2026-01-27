const HTTP_URL_REGEX = /^https?:\/\//i;
const IPFS_SCHEME_REGEX = /^ipfs:\/\//i;
const IPFS_PATH_PREFIX = "/ipfs/";

const FALLBACK_GATEWAY_BASES = ["https://cloudflare-ipfs.com", "https://ipfs.io", "https://gateway.pinata.cloud"];
const PROXY_PATH_RAW = process.env.NEXT_PUBLIC_IPFS_PROXY_PATH?.trim();
const PROXY_PATH = PROXY_PATH_RAW ? PROXY_PATH_RAW.replace(/\/+$/, "") : null;
const DEFAULT_PROXY_PATH = "/api/ipfs";
const PROXY_BASE = (PROXY_PATH ?? DEFAULT_PROXY_PATH).replace(/\/+$/, "") || DEFAULT_PROXY_PATH;

function normalizeGatewayBase(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const strippedSlash = trimmed.replace(/\/+$/, "");
  const withoutIpfsSuffix = strippedSlash.replace(/\/ipfs$/i, "");
  return withoutIpfsSuffix || null;
}

  const envGateway =
    normalizeGatewayBase(process.env.NEXT_PUBLIC_IPFS_GATEWAY_BASE) ??
    normalizeGatewayBase(process.env.NEXT_PUBLIC_IPFS_GATEWAY);

const NORMALIZED_GATEWAY_BASES = Array.from(
  new Set(
    [
      envGateway,
      ...FALLBACK_GATEWAY_BASES.map(normalizeGatewayBase),
    ].filter((value): value is string => Boolean(value))
  )
);

const DEFAULT_GATEWAY_BASE = NORMALIZED_GATEWAY_BASES[0] ?? "https://ipfs.io";

function stripQueryAndHash(value: string): string {
  const match = value.match(/^[^?#]*/);
  return match ? match[0] : value;
}

function removeLeadingIpfsSegments(value: string): string {
  let working = value;
  if (IPFS_SCHEME_REGEX.test(working)) {
    working = working.replace(IPFS_SCHEME_REGEX, "");
  }
  if (/^ipfs\//i.test(working)) {
    working = working.replace(/^ipfs\//i, "");
  }
  if (/^\/ipfs\//i.test(working)) {
    working = working.replace(/^\/ipfs\//i, "");
  }
  if (/^\/?api\/ipfs\//i.test(working)) {
    working = working.replace(/^\/?api\/ipfs\//i, "");
  }
  return working;
}

export function cleanIpfsPath(input?: string | null): string | null {
  if (!input) return null;
  let candidate = input.trim();
  if (!candidate) return null;

  if (HTTP_URL_REGEX.test(candidate)) {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(candidate);
    } catch {
      return null;
    }
    const lowercasePath = parsedUrl.pathname.toLowerCase();
    const ipfsIndex = lowercasePath.indexOf(IPFS_PATH_PREFIX);
    if (ipfsIndex === -1) {
      return null;
    }
    candidate = parsedUrl.pathname.slice(ipfsIndex + IPFS_PATH_PREFIX.length);
    candidate = removeLeadingIpfsSegments(candidate);
  } else {
    candidate = removeLeadingIpfsSegments(candidate);
  }

  candidate = stripQueryAndHash(candidate);
  candidate = candidate.replace(/^\/+/, "");
  return candidate || null;
}

export function extractIpfsCid(input?: string | null): string | null {
  if (!input) return null;
  const candidateRaw = stripQueryAndHash(input.trim());
  if (!candidateRaw) return null;

  if (HTTP_URL_REGEX.test(candidateRaw)) {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(candidateRaw);
    } catch {
      return null;
    }
    return cleanIpfsPath(parsedUrl.pathname);
  }

  return cleanIpfsPath(candidateRaw);
}

export function toIpfsHttpUrl(input?: string | null, gatewayBase?: string | null): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  const cleaned = cleanIpfsPath(trimmed);
  if (cleaned) {
    if (gatewayBase) {
      const normalizedBase = normalizeGatewayBase(gatewayBase) ?? DEFAULT_GATEWAY_BASE;
      return `${normalizedBase.replace(/\/+$/, "")}/ipfs/${cleaned}`;
    }
    if (PROXY_PATH) {
      return `${PROXY_PATH}/${cleaned}`;
    }
    const normalizedBase = normalizeGatewayBase(DEFAULT_GATEWAY_BASE) ?? DEFAULT_GATEWAY_BASE;
    return `${normalizedBase.replace(/\/+$/, "")}/ipfs/${cleaned}`;
  }

  return HTTP_URL_REGEX.test(trimmed) ? trimmed : null;
}

export function getIpfsGatewayBases(): string[] {
  return NORMALIZED_GATEWAY_BASES.slice();
}

export function getIpfsGatewayCandidates(input?: string | null): string[] {
  const cid = extractIpfsCid(input);
  if (cid) {
    const normalizedCid = cid.replace(/^\/+|\/+$/g, "");
    const proxy = `${PROXY_BASE}/${normalizedCid}`;
    return [
      proxy,
      ...getIpfsGatewayBases().map((base) => `${base.replace(/\/+$/, "")}/ipfs/${normalizedCid}`),
    ];
  }
  if (input && HTTP_URL_REGEX.test(input)) {
    return [input.trim()];
  }
  return [];
}

export function ipfsToHttp(uri: string, gateways: string[] = NORMALIZED_GATEWAY_BASES): string[] {
  if (!uri) return [];
  const trimmed = uri.trim();
  if (!trimmed) return [];

  const cid = extractIpfsCid(trimmed);
  if (cid) {
    const uniqueGateways = gateways.length ? Array.from(new Set(gateways)) : getIpfsGatewayBases();
    return uniqueGateways.map((base) => `${base.replace(/\/+$/, "")}/ipfs/${cid}`);
  }

  if (HTTP_URL_REGEX.test(trimmed)) {
    return [trimmed];
  }
  return [];
}

export function cidToHttpUrl(cid: string): string {
  return ipfsToHttp(cid)[0] ?? "";
}

export function ipfsUrl(cid: string): string {
  return cidToHttpUrl(cid);
}

export { cleanIpfsPath as normalizeIpfsPath };
