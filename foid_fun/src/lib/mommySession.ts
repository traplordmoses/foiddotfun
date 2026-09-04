// src/lib/mommySession.ts
//
// Short-lived, HMAC-signed session tokens for the Foid Mommy endpoint
// (audit S5). The endpoint burns an OpenAI completion per call and used to
// be reachable by anyone with only IP-based limits, so a scraper could
// drain the global window and lock real users out. A token proves the call
// came from a page that fetched /api/foid-mommy/session first, and gives us
// a per-session counter that is not spoofable through X-Forwarded-For.
//
// Server-only. The secret comes from MOMMY_SESSION_SECRET, then CRON_SECRET,
// then a per-process random key (tokens then survive until the next deploy,
// which is fine: the client refetches on 401).
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const TTL_MS = 60 * 60 * 1000; // 1 hour
const MAX_CALLS_PER_TOKEN = 40; // ~13 full prayers per hour per session

function secret(): string {
  const fromEnv = process.env.MOMMY_SESSION_SECRET || process.env.CRON_SECRET;
  if (fromEnv) return fromEnv;
  const g = globalThis as { __mommySecret?: string };
  if (!g.__mommySecret) g.__mommySecret = randomBytes(32).toString("hex");
  return g.__mommySecret;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function issueSessionToken(): { token: string; expiresAt: number } {
  const id = randomBytes(12).toString("base64url");
  const expiresAt = Date.now() + TTL_MS;
  const payload = `${id}.${expiresAt}`;
  return { token: `${payload}.${sign(payload)}`, expiresAt };
}

const counters = new Map<string, { count: number; expiresAt: number }>();

/** Validates a token and consumes one call from its budget. */
export function consumeSessionToken(
  token: string | null,
): { ok: true } | { ok: false; reason: "missing" | "invalid" | "expired" | "exhausted" } {
  if (!token) return { ok: false, reason: "missing" };
  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false, reason: "invalid" };
  const [id, expStr, sig] = parts;
  const expected = sign(`${id}.${expStr}`);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, reason: "invalid" };
  const expiresAt = Number(expStr);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return { ok: false, reason: "expired" };

  const entry = counters.get(id) ?? { count: 0, expiresAt };
  if (entry.count >= MAX_CALLS_PER_TOKEN) return { ok: false, reason: "exhausted" };
  entry.count += 1;
  counters.set(id, entry);
  return { ok: true };
}

// Drop expired counters so the map cannot grow without bound.
setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of counters) {
    if (entry.expiresAt < now) counters.delete(id);
  }
}, 10 * 60_000).unref?.();
