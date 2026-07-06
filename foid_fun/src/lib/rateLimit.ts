import { countRecentActions, insertRateLimit, pruneOldRateLimits } from "@/lib/db";

// chat-send is NOT here: /api/chat/send rate-limits by counting rows in the
// Supabase board_messages table itself (shared across instances; this SQLite
// file is per-instance and wiped on deploy).
type ActionType = "pray" | "propose" | "vote" | "swipe-vote";

const LIMITS: Record<ActionType, { max: number; windowMs: number }> = {
  pray: { max: 1, windowMs: 24 * 60 * 60 * 1000 },
  propose: { max: 3, windowMs: 24 * 60 * 60 * 1000 },
  vote: { max: 10, windowMs: 24 * 60 * 60 * 1000 },
  "swipe-vote": { max: 20, windowMs: 60 * 60 * 1000 }, // 20 per hour
};

/**
 * Check if an action is within rate limits.
 * Returns { ok: true } if allowed, { ok: false, error } if rate-limited.
 */
export function checkRateLimit(
  wallet: string,
  action: ActionType,
  batchSize: number = 1
): { ok: boolean; error?: string } {
  const { max, windowMs } = LIMITS[action];
  const cutoff = Date.now() - windowMs;
  const w = wallet.toLowerCase();

  // Prune old entries periodically (every ~100 checks)
  if (Math.random() < 0.01) {
    pruneOldRateLimits().run(cutoff);
  }

  const row = countRecentActions().get(w, action, cutoff) as { cnt: number } | undefined;
  const used = row?.cnt ?? 0;

  if (used + batchSize > max) {
    const remaining = max - used;
    return {
      ok: false,
      error: `Rate limit: max ${max} ${action}(s) per ${windowMs / 60_000}m. ${remaining} remaining, tried ${batchSize}. Try again later.`,
    };
  }

  return { ok: true };
}

/**
 * Record that an action was taken (call after successful execution).
 */
export function recordAction(wallet: string, action: ActionType): void {
  insertRateLimit().run(wallet.toLowerCase(), action, Date.now());
}
