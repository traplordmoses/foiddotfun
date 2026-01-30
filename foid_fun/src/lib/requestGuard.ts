const FALLBACK_TTL = 30_000;
const FALLBACK_MAX_ENTRIES = 20;
const fallbackCache = new Map<string, number>();

function pruneFallbackCache(): void {
  while (fallbackCache.size > FALLBACK_MAX_ENTRIES) {
    const firstKey = fallbackCache.keys().next().value;
    if (firstKey) {
      fallbackCache.delete(firstKey);
    }
  }
}

function recordFallbackEntry(key: string, timestamp: number): void {
  fallbackCache.set(key, timestamp);
  pruneFallbackCache();
}

export function shouldFetchOnce(key: string, ttlMs = FALLBACK_TTL): boolean {
  const now = Date.now();

  if (typeof window !== "undefined") {
    try {
      const stored = window.sessionStorage.getItem(key);
      const parsedTime = stored ? Number(stored) : NaN;
      if (!Number.isNaN(parsedTime) && now - parsedTime < ttlMs) {
        return false;
      }
      window.sessionStorage.setItem(key, String(now));
      return true;
    } catch {
      // If sessionStorage is unavailable, fall back to in-memory cache.
    }
  }

  const cached = fallbackCache.get(key);
  if (cached && now - cached < ttlMs) {
    return false;
  }

  recordFallbackEntry(key, now);
  return true;
}
