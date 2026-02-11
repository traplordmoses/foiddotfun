type ActionType = "pray" | "propose" | "vote";

const LIMITS: Record<ActionType, { max: number; windowMs: number }> = {
  pray: { max: 1, windowMs: 24 * 60 * 60 * 1000 },
  propose: { max: 3, windowMs: 24 * 60 * 60 * 1000 },
  vote: { max: 10, windowMs: 24 * 60 * 60 * 1000 },
};

// In-memory store: wallet:action → timestamps
const store = new Map<string, number[]>();

function key(wallet: string, action: ActionType): string {
  return `${wallet.toLowerCase()}:${action}`;
}

function prune(timestamps: number[], windowMs: number): number[] {
  const cutoff = Date.now() - windowMs;
  return timestamps.filter((t) => t > cutoff);
}

export function checkRateLimit(
  wallet: string,
  action: ActionType
): { ok: boolean; error?: string } {
  const { max, windowMs } = LIMITS[action];
  const k = key(wallet, action);
  const timestamps = prune(store.get(k) ?? [], windowMs);
  store.set(k, timestamps);

  if (timestamps.length >= max) {
    const oldestMs = timestamps[0];
    const resetInMin = Math.ceil((oldestMs + windowMs - Date.now()) / 60_000);
    return {
      ok: false,
      error: `Rate limit: max ${max} ${action}(s) per 24h. Try again in ~${resetInMin}m.`,
    };
  }

  return { ok: true };
}

export function recordAction(wallet: string, action: ActionType): void {
  const { windowMs } = LIMITS[action];
  const k = key(wallet, action);
  const timestamps = prune(store.get(k) ?? [], windowMs);
  timestamps.push(Date.now());
  store.set(k, timestamps);
}
