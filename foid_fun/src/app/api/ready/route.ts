import { NextResponse } from "next/server";
import { getServerRpcUrl } from "@/config/canonical";
import { supabaseRest, supabaseServerConfigured } from "@/lib/supabaseRest";
import { fetchBounded } from "@/lib/boundedHttp";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type HealthSnapshot = { at: number; ready: boolean; checks: Record<string, boolean> };
let cached: HealthSnapshot | null = null;
let inflight: Promise<HealthSnapshot> | null = null;
export async function GET() {
  if (!cached || Date.now() - cached.at > 30_000) {
    inflight ??= (async () => {
      const outcomes = await Promise.allSettled([
        (async () => {
          const url = getServerRpcUrl(); if (!url) return false;
          const { response, bytes } = await fetchBounded(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_blockNumber", params: [] }) }, 4096, 4000);
          return response.ok && /^0x[\da-f]+$/i.test(JSON.parse(new TextDecoder().decode(bytes)).result ?? "");
        })(),
        (async () => {
          if (!supabaseServerConfigured()) return false;
          const values = await Promise.all(["proposal_metadata_v2?select=id&limit=1", "request_budgets?select=key&limit=1"].map((p) => supabaseRest(p, { method: "HEAD", signal: AbortSignal.timeout(4000) })));
          return values.every((r) => r?.ok);
        })(),
        (async () => {
          if (!supabaseServerConfigured()) return false;
          // Zero is rejected before any SQL writes. This verifies the function
          // and service-role permission without consuming a real request budget.
          const response = await supabaseRest("rpc/consume_request_budget", {
            method: "POST",
            body: JSON.stringify({ budget_key: "readiness", max_count: 1, window_ms: 1000, amount: 0 }),
            signal: AbortSignal.timeout(4000),
          });
          return Boolean(response?.ok && (await response.json()) === false);
        })(),
      ]);
      const checks = { rpc: outcomes[0].status === "fulfilled" && outcomes[0].value, storage: outcomes[1].status === "fulfilled" && outcomes[1].value, requestBudgets: outcomes[2].status === "fulfilled" && outcomes[2].value, prayerConfig: Boolean(process.env.OPENAI_API_KEY && (process.env.MOMMY_SESSION_SECRET || process.env.CRON_SECRET)) };
      cached = { at: Date.now(), ready: Object.values(checks).every(Boolean), checks };
      return cached;
    })().finally(() => { inflight = null; });
    await inflight;
  }
  return NextResponse.json({ status: cached!.ready ? "ready" : "degraded", checks: cached!.checks }, { status: cached!.ready ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
