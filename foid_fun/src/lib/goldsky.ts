// Thin GraphQL client for our Goldsky subgraphs.
//
// Why a tiny bespoke client instead of urql/Apollo: we make maybe a dozen
// queries across the whole app and they're all POST + JSON + no auth. A
// 40-line fetch wrapper is simpler than either of those deps and gives us
// a single place to enforce the server-timeout + error-swallowing policy
// that the callers actually want.

export type GoldskyEndpoint = "loreboard" | "prayerTiers";

const ENDPOINT_ENV: Record<GoldskyEndpoint, string[]> = {
  // Accept both the server-canonical name and the NEXT_PUBLIC_ variant —
  // some platforms (Render) expose env vars with the prefix even when the
  // value is only read server-side. First non-empty wins.
  loreboard: ["GOLDSKY_LOREBOARD_URL", "NEXT_PUBLIC_GOLDSKY_LOREBOARD_URL"],
  prayerTiers: [
    "GOLDSKY_PRAYER_TIERS_URL",
    "NEXT_PUBLIC_GOLDSKY_PRAYER_TIERS_URL",
  ],
};

export function goldskyEndpoint(which: GoldskyEndpoint): string | null {
  for (const name of ENDPOINT_ENV[which]) {
    const v = process.env[name]?.trim();
    if (v) return v;
  }
  return null;
}

export class GoldskyError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "GoldskyError";
  }
}

export type GoldskyQueryOpts = {
  /** Hard timeout — default 5s. Callers should always have an RPC fallback. */
  timeoutMs?: number;
};

/**
 * POST a GraphQL query to the named subgraph. Returns the `data` field
 * unwrapped. Throws `GoldskyError` on network failure, HTTP non-2xx, or
 * any non-empty `errors[]` array in the response body.
 */
export async function goldskyQuery<T>(
  which: GoldskyEndpoint,
  query: string,
  variables?: Record<string, unknown>,
  opts: GoldskyQueryOpts = {},
): Promise<T> {
  const url = goldskyEndpoint(which);
  if (!url) {
    throw new GoldskyError(`Subgraph endpoint not configured for "${which}"`);
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    opts.timeoutMs ?? 5_000,
  );

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables: variables ?? {} }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new GoldskyError(`Subgraph query timed out after ${opts.timeoutMs ?? 5_000}ms`);
    }
    throw new GoldskyError(`Subgraph fetch failed: ${String(err)}`);
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    throw new GoldskyError(`Subgraph HTTP ${res.status}`, res.status);
  }

  const body = (await res.json()) as {
    data?: T;
    errors?: Array<{ message: string }>;
  };

  if (body.errors && body.errors.length > 0) {
    throw new GoldskyError(
      `Subgraph returned errors: ${body.errors.map((e) => e.message).join("; ")}`,
    );
  }

  if (body.data === undefined || body.data === null) {
    throw new GoldskyError("Subgraph returned empty data");
  }

  return body.data;
}

/**
 * Sync-lag check. The subgraph only knows about what it's already indexed,
 * so if it's far behind the chain head we should fall back to RPC rather
 * than render a stale board. Callers that care about freshness should
 * compare this against their RPC's current block and reject if the delta
 * exceeds some tolerance (a few dozen blocks is usually fine for a user-
 * facing board).
 */
export async function goldskyLatestBlock(
  which: GoldskyEndpoint,
): Promise<number | null> {
  try {
    const data = await goldskyQuery<{ _meta: { block: { number: number } } }>(
      which,
      `{ _meta { block { number } } }`,
      undefined,
      { timeoutMs: 2_000 },
    );
    return data._meta?.block?.number ?? null;
  } catch {
    return null;
  }
}
