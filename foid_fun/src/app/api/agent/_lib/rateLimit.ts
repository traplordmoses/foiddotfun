// Persistent rate limiter — SQLite-backed.
import { getDb } from "@/db/db";

type ActionType = "pray" | "propose" | "vote" | "swipe_vote" | "ipfs_upload";

const LIMITS: Record<ActionType, { max: number; windowMs: number }> = {
  pray: { max: 1, windowMs: 24 * 60 * 60 * 1000 },
  propose: { max: 3, windowMs: 24 * 60 * 60 * 1000 },
  vote: { max: 20, windowMs: 24 * 60 * 60 * 1000 },
  swipe_vote: { max: 50, windowMs: 24 * 60 * 60 * 1000 },
  ipfs_upload: { max: 10, windowMs: 24 * 60 * 60 * 1000 },
};

function makeKey(wallet: string, action: ActionType): string {
  return `${wallet.toLowerCase()}:${action}`;
}

export function checkRateLimit(
  wallet: string,
  action: ActionType
): { ok: boolean; error?: string } {
  const { max, windowMs } = LIMITS[action];
  const k = makeKey(wallet, action);
  const cutoff = Date.now() - windowMs;

  const db = getDb();

  // Prune old entries
  db.prepare("DELETE FROM rate_limits WHERE wallet_action = ? AND timestamp <= ?").run(k, cutoff);

  const row = db.prepare(
    "SELECT COUNT(*) as c, MIN(timestamp) as oldest FROM rate_limits WHERE wallet_action = ?"
  ).get(k) as { c: number; oldest: number | null };

  if (row.c >= max) {
    const resetInMin = Math.ceil(((row.oldest ?? 0) + windowMs - Date.now()) / 60_000);
    return {
      ok: false,
      error: `Rate limit: max ${max} ${action}(s) per 24h. Try again in ~${resetInMin}m.`,
    };
  }

  return { ok: true };
}

export function recordAction(wallet: string, action: ActionType): void {
  const k = makeKey(wallet, action);
  const db = getDb();
  db.prepare("INSERT INTO rate_limits (wallet_action, timestamp) VALUES (?, ?)").run(k, Date.now());
}
