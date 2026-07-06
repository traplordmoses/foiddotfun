/**
 * Global (all-callers) rolling-window rate cap for the agent relayer routes.
 *
 * The agent endpoints are already per-wallet rate limited, but wallets are
 * free to mint, so a Sybil swarm of fresh wallets can still drain relayer gas
 * and OpenAI completions. This is a coarse module-level backstop: one shared
 * counter per route, capping total accepted requests per window regardless of
 * wallet. In-memory is fine — a reset on redeploy just re-opens the window.
 *
 * FOUNDER FOLLOW-UP: this is a blunt drain-limiter, not access control. A real
 * allowlist / per-wallet quota / staked-key gate is the intended long-term fix
 * (see H1 in the security audit). Do not treat this cap as authorization.
 */

const WINDOW_MS = 60_000; // 1 minute

// Conservative per-route ceilings. Legit agent traffic is low-volume; these
// sit well above expected first-party use while bounding worst-case drain.
const DEFAULT_LIMITS: Record<string, number> = {
  propose: 30,
  vote: 60,
  pray: 30,
};

const hits = new Map<string, number[]>();

/**
 * Records an attempt for `route` and returns true if the global window is now
 * saturated (i.e. this request should be rejected). Call once per request,
 * before doing expensive work (OpenAI, on-chain sends).
 */
export function isGloballyRateLimited(route: string): boolean {
  const now = Date.now();
  const max = DEFAULT_LIMITS[route] ?? 30;
  const recent = (hits.get(route) ?? []).filter((t) => now - t < WINDOW_MS);

  if (recent.length >= max) {
    hits.set(route, recent);
    return true;
  }

  recent.push(now);
  hits.set(route, recent);
  return false;
}
