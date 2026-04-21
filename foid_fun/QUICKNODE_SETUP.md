# Dedicated RPC Setup (QuickNode / Fluent-issued)

Your dedicated Fluent RPC endpoint is kept **server-side only**. Clients reach it through the same-origin `/api/rpc` proxy so the URL is never inlined into the browser bundle, never shown to MetaMask, and never visible in DevTools Network.

## Environment variables

Use non-`NEXT_PUBLIC_*` names so Next.js cannot inline them into the client bundle at build time:

```bash
# Server-only — the dedicated URL goes here
FLUENT_RPC_URL=https://<your-dedicated-endpoint>
```

**Do NOT set** any of these to the private URL — they get inlined into the browser JS:

- ❌ `NEXT_PUBLIC_FLUENT_RPC`
- ❌ `NEXT_PUBLIC_RPC_URL`
- ❌ `NEXT_PUBLIC_RPC`

In Render / Vercel dashboards, delete those three keys. Re-deploy after removing.

## Architecture

| Caller | Path | URL seen |
|---|---|---|
| Browser JS (viem / wagmi reads) | `window → /api/rpc → FLUENT_RPC_URL` | only `/api/rpc` |
| FOID embedded wallet | same as above | only `/api/rpc` |
| MetaMask (injected wallet) | user's own chain config | **public** Fluent RPC (`rpc.fluent.xyz` / `rpc.testnet.fluent.xyz`) |
| API routes / cron / scripts | direct | `FLUENT_RPC_URL` |

If the proxy is unreachable, the client transport falls back to the public Fluent RPC automatically (defined in `src/providers.tsx`).

## Proxy hardening

`src/app/api/rpc/route.ts` enforces:

- Same-origin check (Origin or Referer host must match request host)
- JSON-RPC method allowlist: `eth_*`, `net_*`, `web3_*`
- Batch size cap: 50 calls per request
- `runtime = "nodejs"`, `dynamic = "force-dynamic"` (no caching)

## Verifying the fix

1. Build for production: `pnpm build`
2. Grep the built client bundle for the dedicated hostname:
   ```bash
   grep -r "<your-dedicated-host>" foid_fun/.next/static/ || echo "clean ✓"
   ```
3. Load the site, open DevTools → Network, pray or submit a tx. All RPC requests should go to `/api/rpc` (same origin). The MetaMask "add network" prompt should show the public Fluent RPC.

## If the dedicated RPC was ever deployed with a `NEXT_PUBLIC_*` prefix

The URL has been shipped to every site visitor since that deploy. **Rotate the token with Fluent / QuickNode** before relying on this fix.
