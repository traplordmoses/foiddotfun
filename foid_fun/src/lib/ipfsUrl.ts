const HTTP_URL_REGEX = /^https?:\/\//i;
const IPFS_SCHEME_REGEX = /^ipfs:\/\//i;
const IPFS_PATH_PREFIX = "/ipfs/";

// IMPORTANT: This list MUST stay in sync with the CSP img-src/connect-src
// whitelist in next.config.mjs. Any gateway added here that is not
// whitelisted by the CSP will be blocked by the browser, fire onError on
// the <img>, poison the session circuit breaker (ipfsGatewayCache.ts),
// and can cascade into "no images ever load" failures. If you change
// one list, mirror the change in the other.
// Order: Pinata first (content is pinned there), then public gateways.
// Ordering is only the initial guess — probeGatewaysForCid races all of
// these in parallel on first load and memoizes the winner in localStorage.
// Cloudflare (cloudflare-ipfs.com) removed — host is globally dead
// (ERR_NAME_NOT_RESOLVED).
const FALLBACK_GATEWAY_BASES = [
  "https://gateway.pinata.cloud",
  "https://ipfs.io",
  "https://dweb.link",
  "https://w3s.link",
  "https://4everland.io",
];
const PROXY_PATH_RAW = process.env.NEXT_PUBLIC_IPFS_PROXY_PATH?.trim();
const PROXY_PATH = PROXY_PATH_RAW ? PROXY_PATH_RAW.replace(/\/+$/, "") : null;

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
  if (!cid) {
    if (input && HTTP_URL_REGEX.test(input)) {
      return [input.trim()];
    }
    return [];
  }
  const normalizedCid = cid.replace(/^\/+|\/+$/g, "");
  return [
    `https://ipfs.io/ipfs/${normalizedCid}`,
    `https://ipfs.filebase.io/ipfs/${normalizedCid}`,
    `https://dweb.link/ipfs/${normalizedCid}`,
    `https://4everland.io/ipfs/${normalizedCid}`,
    `https://w3s.link/ipfs/${normalizedCid}`,
    `https://gateway.pinata.cloud/ipfs/${normalizedCid}`,
  ];
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

/**
 * Optional hints to the proxy for Pinata image-transform params. When a
 * dedicated Pinata gateway is configured (PINATA_GATEWAY env var set to a
 * `<prefix>.mypinata.cloud` URL), these translate into `img-width`,
 * `img-format`, etc. query params on the upstream fetch. Pinata serves the
 * transformed variant from its own edge cache — typically 4× smaller and
 * 7× faster than the raw original (measured: 118 KB JPEG → 29 KB WebP,
 * 820ms → 100ms on Pinata CDN hit).
 *
 * Public gateway fallbacks ignore these params — they only take effect on
 * the proxy path. That's fine: the proxy is our primary candidate, and a
 * board card's fallback to ipfs.io-over-failure is rare enough that
 * getting the original size is acceptable.
 */
export type IpfsImageOpts = {
  /** Target display width in CSS pixels. Transforms at DPR 2 for retina. */
  width?: number;
  /** Target display height in CSS pixels. Optional — width alone preserves aspect. */
  height?: number;
  /** Output format. Defaults to webp (best size/quality ratio). */
  format?: "webp" | "jpeg" | "png" | "auto";
  /** 1–100. Defaults to 80 (visually lossless for board-sized images). */
  quality?: number;
};

function buildTransformQuery(opts?: IpfsImageOpts): string {
  if (!opts) return "";
  const params = new URLSearchParams();
  if (opts.width && opts.width > 0) params.set("w", String(Math.round(opts.width)));
  if (opts.height && opts.height > 0) params.set("h", String(Math.round(opts.height)));
  if (opts.format) params.set("f", opts.format);
  if (opts.quality && opts.quality > 0) params.set("q", String(opts.quality));
  const s = params.toString();
  return s ? `?${s}` : "";
}

/**
 * Build the same-origin proxy URL for a CID, or null if the proxy is not
 * configured. The proxy (`src/app/api/ipfs/[cid]/route.ts`) fetches the
 * content with our Pinata JWT and returns it with an immutable cache header,
 * so second-visit + edge-cached content becomes effectively instant.
 *
 * Relative path is intentional — the browser resolves it against the page
 * origin. Server-side callers that need an absolute URL should use
 * `cidToHttpUrl` / `ipfsToHttp` instead.
 */
export function ipfsProxyUrl(uri?: string | null, opts?: IpfsImageOpts): string | null {
  if (!PROXY_PATH) return null;
  const cid = extractIpfsCid(uri ?? null);
  if (!cid) return null;
  return `${PROXY_PATH}/${cid}${buildTransformQuery(opts)}`;
}

/**
 * URL list for rendering a CID as an `<img>` with client-side fallback:
 *   1. Same-origin `/api/ipfs/<cid>` proxy (authenticated Pinata upstream,
 *      edge-cached, HTTP/2-multiplexed with the page document). When
 *      `opts` are provided, the proxy applies Pinata image transforms —
 *      smaller payload, faster origin.
 *   2. Public gateway fallbacks (used only if the proxy errors / stalls).
 *      Transforms don't apply here — public gateways serve original bytes.
 *
 * Returning the proxy as candidate #0 means a board with N cards opens one
 * multiplexed connection to our server instead of N concurrent handshakes
 * against Pinata/ipfs.io. Fallback list preserved so the circuit breaker
 * still has somewhere to land if the proxy is down.
 */
const PINATA_DEDICATED_HOST = /\.mypinata\.cloud$/i;

/**
 * Mirror the proxy's transform mapping onto a dedicated Pinata gateway URL
 * so the fallback path is bounded to the same right-sized WebP the proxy
 * would have served, not the full original. A stalled proxy on a slow phone
 * used to fall back to a 250 KB JPEG for a 48 px tile; now it falls back to
 * the ~8 KB variant. Public gateways ignore the params (harmless).
 */
function withGatewayTransforms(url: string, opts?: IpfsImageOpts): string {
  if (!opts || !(opts.width || opts.height)) return url;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  if (!PINATA_DEDICATED_HOST.test(parsed.hostname)) return url;
  if (opts.width && opts.width > 0) {
    parsed.searchParams.set("img-width", String(Math.round(opts.width)));
    parsed.searchParams.set("img-dpr", "2");
  }
  if (opts.height && opts.height > 0) {
    parsed.searchParams.set("img-height", String(Math.round(opts.height)));
  }
  parsed.searchParams.set("img-format", opts.format ?? "webp");
  if (opts.quality && opts.quality > 0) {
    parsed.searchParams.set(
      "img-quality",
      String(Math.max(1, Math.min(100, Math.round(opts.quality)))),
    );
  }
  parsed.searchParams.set("img-fit", "cover");
  return parsed.toString();
}

/**
 * True for the same-origin `/api/ipfs/...` candidate (a relative path). The
 * public-gateway circuit breaker must not track it: its "host" would be a
 * per-image string, and a slow proxy is a network condition, not a broken
 * gateway.
 */
export function isProxyCandidate(url: string): boolean {
  return url.startsWith("/");
}

export function ipfsImageUrls(uri: string, opts?: IpfsImageOpts): string[] {
  const gatewayUrls = ipfsToHttp(uri).map((u) => withGatewayTransforms(u, opts));
  const proxy = ipfsProxyUrl(uri, opts);
  if (!proxy) return gatewayUrls;
  return [proxy, ...gatewayUrls];
}

export { cleanIpfsPath as normalizeIpfsPath };
