import { createHash } from "node:crypto";
import { supabaseRest, supabaseServerConfigured } from "@/lib/supabaseRest";

const local = new Map<string, { count: number; until: number }>();

/** Atomic shared budget when configured; bounded local fallback for development. */
export async function consumeBudget(key: string, limit: number, windowMs: number, cost = 1): Promise<boolean> {
  if (supabaseServerConfigured()) {
    const response = await supabaseRest("rpc/consume_request_budget", {
      method: "POST", body: JSON.stringify({ budget_key: key, max_count: limit, window_ms: windowMs, amount: cost }),
    });
    if (!response?.ok) throw new Error("Request budget storage unavailable");
    return (await response.json()) === true;
  }
  // A production service must not silently turn a shared cap into a per-process cap.
  if (process.env.NODE_ENV === "production") throw new Error("Shared request budgets are not configured");
  const now = Date.now();
  for (const [k, v] of local) if (v.until <= now) local.delete(k);
  if (local.size >= 10_000 && !local.has(key)) return false;
  const entry = local.get(key) ?? { count: 0, until: now + windowMs };
  if (entry.count + cost > limit) return false;
  entry.count += cost;
  local.set(key, entry);
  return true;
}

export function requestIdentity(request: Request): string {
  // A coarse additional bucket, never authentication. Global budgets still apply.
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  return createHash("sha256").update(ip).digest("hex").slice(0, 24);
}
