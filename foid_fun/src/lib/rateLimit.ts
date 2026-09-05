// src/lib/rateLimit.ts
// Per-wallet action limits for the agent relayer routes (audit S4).
// Supabase (service role) when configured, so limits hold across deploys
// and instances; SQLite fallback for local development.
//
// chat-send is NOT here: /api/chat/send rate-limits by counting rows in the
// Supabase board_messages table itself.
import { supabaseRest, supabaseServerConfigured } from "@/lib/supabaseRest";

type ActionType = "pray" | "propose" | "vote" | "swipe-vote";

const LIMITS: Record<ActionType, { max: number; windowMs: number }> = {
  pray: { max: 1, windowMs: 24 * 60 * 60 * 1000 },
  propose: { max: 3, windowMs: 24 * 60 * 60 * 1000 },
  vote: { max: 10, windowMs: 24 * 60 * 60 * 1000 },
  "swipe-vote": { max: 20, windowMs: 60 * 60 * 1000 }, // 20 per hour
};

function keyFor(wallet: string, action: ActionType) {
  return `${wallet.toLowerCase()}:${action}`;
}

async function countSince(wallet: string, action: ActionType, cutoffMs: number): Promise<number> {
  if (supabaseServerConfigured()) {
    const since = new Date(cutoffMs).toISOString();
    const res = await supabaseRest(
      `rate_limits?select=id&wallet_action=eq.${encodeURIComponent(keyFor(wallet, action))}&ts=gte.${since}`,
      { method: "HEAD", prefer: "count=exact" },
    );
    const total = res?.headers.get("content-range")?.split("/")[1];
    const n = total ? Number(total) : NaN;
    // Fail open on a storage outage: the onchain contracts still enforce
    // the real limits (one prayer per day, fee per proposal).
    return Number.isFinite(n) ? n : 0;
  }
  const { countRecentActions, pruneOldRateLimits } = await import("@/lib/db");
  if (Math.random() < 0.01) pruneOldRateLimits().run(cutoffMs);
  const row = countRecentActions().get(wallet.toLowerCase(), action, cutoffMs) as { cnt: number } | undefined;
  return row?.cnt ?? 0;
}

/**
 * Check if an action is within rate limits.
 * Returns { ok: true } if allowed, { ok: false, error } if rate-limited.
 */
export async function checkRateLimit(
  wallet: string,
  action: ActionType,
  batchSize: number = 1,
): Promise<{ ok: boolean; error?: string }> {
  const { max, windowMs } = LIMITS[action];
  const cutoff = Date.now() - windowMs;
  const used = await countSince(wallet, action, cutoff);
  if (used + batchSize > max) {
    const remaining = Math.max(0, max - used);
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
export async function recordAction(wallet: string, action: ActionType): Promise<void> {
  if (supabaseServerConfigured()) {
    await supabaseRest("rate_limits", {
      method: "POST",
      prefer: "return=minimal",
      body: JSON.stringify({ wallet_action: keyFor(wallet, action) }),
    });
    return;
  }
  const { insertRateLimit } = await import("@/lib/db");
  insertRateLimit().run(wallet.toLowerCase(), action, Date.now());
}
