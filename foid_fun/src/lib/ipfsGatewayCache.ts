// IPFS gateway cache + circuit breaker.
//
// Remembers which gateway served a placement successfully, so subsequent
// placements try that gateway first instead of round-robining through the
// fallback list. Failed gateways are recorded and deprioritized (or skipped
// entirely) until the circuit-breaker escape hatch trips.
//
// Storage: localStorage (persists across sessions) with a sessionStorage
// fallback for private-mode / quota-exceeded browsers, and an in-memory map
// as the last resort. Persistence matters — a returning visitor shouldn't
// have to re-probe gateways every time they land on /board.
//
// All reads/writes are guarded for SSR — functions are safe to call from any
// React component without adding extra typeof window checks at the call site.

const PREFERRED_KEY = "foid:ipfs:preferred-base";
const FAILED_KEY = "foid:ipfs:failed-bases";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

// Last-resort fallback when both localStorage and sessionStorage are
// unavailable (rare, but iOS private mode historically threw on every write).
const memoryStore = new Map<string, string>();

function safeGet(key: string): string | null {
  if (!isBrowser()) return null;
  try {
    const ls = window.localStorage?.getItem(key);
    if (ls !== null && ls !== undefined) return ls;
  } catch { /* fall through */ }
  try {
    const ss = window.sessionStorage?.getItem(key);
    if (ss !== null && ss !== undefined) return ss;
  } catch { /* fall through */ }
  return memoryStore.get(key) ?? null;
}

function safeSet(key: string, value: string): void {
  if (!isBrowser()) return;
  memoryStore.set(key, value);
  try {
    window.localStorage?.setItem(key, value);
    return;
  } catch { /* fall through */ }
  try {
    window.sessionStorage?.setItem(key, value);
  } catch {
    /* quota, private mode — memoryStore already has it */
  }
}

function safeRemove(key: string): void {
  if (!isBrowser()) return;
  memoryStore.delete(key);
  try { window.localStorage?.removeItem(key); } catch { /* non-fatal */ }
  try { window.sessionStorage?.removeItem(key); } catch { /* non-fatal */ }
}

function gatewayBase(url: string): string {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}`;
  } catch {
    return url;
  }
}

export function getPreferredGateway(): string | null {
  return safeGet(PREFERRED_KEY);
}

export function getFailedGateways(): string[] {
  const raw = safeGet(FAILED_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

/** Record a gateway that successfully served an image. */
export function markGatewaySuccess(gatewayUrl: string): void {
  const base = gatewayBase(gatewayUrl);
  safeSet(PREFERRED_KEY, base);
  // Successful load also exonerates any prior failure for this base.
  const failed = getFailedGateways().filter((b) => b !== base);
  safeSet(FAILED_KEY, JSON.stringify(failed));
}

/**
 * Count of CSP-whitelisted gateways in FALLBACK_GATEWAY_BASES (ipfsUrl.ts).
 * If every whitelisted gateway has been marked failed, we reset the circuit
 * breaker — otherwise a transient network blip can permanently lock out all
 * images for the session.
 */
const CSP_WHITELISTED_GATEWAY_COUNT = 5;

/** Record a gateway that returned an error or timed out. */
export function markGatewayFailure(gatewayUrl: string): void {
  const base = gatewayBase(gatewayUrl);
  const failed = getFailedGateways();
  if (!failed.includes(base)) {
    failed.push(base);
    safeSet(FAILED_KEY, JSON.stringify(failed));
  }
  // If the failed gateway was the preferred one, clear the preference so
  // the next load doesn't keep hitting it.
  if (safeGet(PREFERRED_KEY) === base) {
    safeRemove(PREFERRED_KEY);
  }
  // Escape hatch: if every CSP-whitelisted gateway is now marked failed,
  // reset the failed list. This prevents runaway circuit-breaker poisoning
  // from a transient network issue leaving the session permanently unable
  // to load images.
  if (getFailedGateways().length >= CSP_WHITELISTED_GATEWAY_COUNT) {
    safeRemove(FAILED_KEY);
  }
}

/**
 * Reorder a list of gateway URLs according to the session's memoization:
 *   - preferred gateway first (if present in the list)
 *   - failed gateways deprioritized to the tail (still reachable as a last
 *     resort, but only after every non-failed gateway has been tried)
 *   - unknown gateways keep their original relative order
 */
export function reorderGateways(urls: string[]): string[] {
  if (!isBrowser() || urls.length <= 1) return urls;

  const preferred = getPreferredGateway();
  const failedSet = new Set(getFailedGateways());

  const fresh: string[] = [];
  const stale: string[] = [];
  for (const url of urls) {
    if (failedSet.has(gatewayBase(url))) stale.push(url);
    else fresh.push(url);
  }

  if (preferred) {
    const idx = fresh.findIndex((u) => gatewayBase(u) === preferred);
    if (idx > 0) {
      const [pref] = fresh.splice(idx, 1);
      fresh.unshift(pref);
    }
  }

  return [...fresh, ...stale];
}
