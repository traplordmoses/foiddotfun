// IPFS gateway session cache + circuit breaker.
//
// Remembers which gateway served a placement successfully in this session,
// so subsequent placements try that gateway first instead of round-robining
// through the fallback list. Failed gateways are recorded and deprioritized
// (or skipped entirely) for the remainder of the session.
//
// All reads/writes are guarded for SSR — functions are safe to call from any
// React component without adding extra typeof window checks at the call site.

const PREFERRED_KEY = "foid:ipfs:preferred-base";
const FAILED_KEY = "foid:ipfs:failed-bases";

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof sessionStorage !== "undefined";
}

function safeGet(key: string): string | null {
  if (!isBrowser()) return null;
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  if (!isBrowser()) return;
  try {
    sessionStorage.setItem(key, value);
  } catch {
    /* quota, private mode — non-fatal */
  }
}

function safeRemove(key: string): void {
  if (!isBrowser()) return;
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* non-fatal */
  }
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
