/**
 * Prod-safe error text for API responses.
 *
 * Anonymous GET routes were echoing String(error) straight to the client,
 * leaking internal RPC/DB/subgraph text (URLs, driver messages, stack hints).
 * Mirror the pattern already used in api/operator/finalize: return a generic
 * message in production, keep the real detail in development for DX.
 *
 * The full error is always logged server-side by the caller — this only
 * governs what crosses the wire.
 */
export function safeErrorMessage(error: unknown, generic = "request failed"): string {
  if (process.env.NODE_ENV === "production") return generic;
  if (error instanceof Error) return error.message;
  return String(error);
}
