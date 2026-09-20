// A failed HTTP request OR failed proposal/manifest must fail the cron run.
const origin = process.env.FOID_APP_URL;
const secret = process.env.CRON_SECRET;
if (!origin || !secret) throw new Error('FOID_APP_URL and CRON_SECRET are required');
const response = await fetch(new URL('/api/swipe/finalize', origin), {
  method: 'POST', headers: { 'x-cron-secret': secret }, signal: AbortSignal.timeout(300_000),
});
if (!response.ok) throw new Error(`Finalization HTTP ${response.status}`);
const result = await response.json();
if (!Array.isArray(result.results) || result.error || result.failed > 0 || result.results.some((r) => r.status === 'failed') || result.manifest?.error) {
  throw new Error('Finalization incomplete; inspect the server logs and retry');
}
console.log(JSON.stringify({ finalized: result.finalized, failed: result.failed, completedAt: new Date().toISOString() }));
