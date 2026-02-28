const CACHE_DURATION = 25_000;

const dataCache = new Map<string, { ts: number; data: unknown }>();
const inFlight = new Map<string, Promise<unknown>>();

function purgeExpired() {
  const now = Date.now();
  for (const [key, entry] of dataCache) {
    if (now - entry.ts >= CACHE_DURATION) {
      dataCache.delete(key);
    }
  }
}

export function getCached<T>(key: string): T | null {
  purgeExpired();
  const entry = dataCache.get(key);
  return entry ? (entry.data as T) : null;
}

export function setCached<T>(key: string, data: T): void {
  purgeExpired();
  dataCache.set(key, { ts: Date.now(), data });
}

export async function fetchOnce<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const cached = getCached<T>(key);
  if (cached !== null) {
    return cached;
  }

  let request = inFlight.get(key) as Promise<T> | undefined;
  if (request) {
    return request;
  }

  request = (async () => {
    try {
      const result = await fn();
      setCached(key, result);
      return result;
    } finally {
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, request);
  return request;
}
