# FOID Foundation — Operator Runbook

**For:** Moses (remote ops, March 31 – May 11 2026)
**Last updated:** 2026-03-20

---

## 1. CONTRACT ADDRESSES (Fluent Testnet, Chain 20994)

### V1 Stack (deployed 2026-03-20)

| Contract | Address | Explorer |
|----------|---------|----------|
| PrayerTiers | `0x36ED105e09A881B6074250a43B2e26c0d6cfD4fb` | [View](https://testnet.fluentscan.xyz/address/0x36ED105e09A881B6074250a43B2e26c0d6cfD4fb) |
| StreakVotingPower | `0x7a889b3d38889E45EE48bbCBc3681a889F87C03e` | [View](https://testnet.fluentscan.xyz/address/0x7a889b3d38889E45EE48bbCBc3681a889F87C03e) |
| FoidTrest (Gallery) | `0x87Ea24ba4B61BbF35aD1161e11072Dc8Cf0858a6` | [View](https://testnet.fluentscan.xyz/address/0x87Ea24ba4B61BbF35aD1161e11072Dc8Cf0858a6) |
| Swipe | `0xddc2623Bd80B1429426e30Be3D02e52ff6f90C44` | [View](https://testnet.fluentscan.xyz/address/0xddc2623Bd80B1429426e30Be3D02e52ff6f90C44) |

### Pre-Existing (unchanged)

| Contract | Address |
|----------|---------|
| PrayerRegistry | `0x6FC7301fad7Ca0294152b23FD4f0467200376d65` |
| PrayerMirror | `0x8ff39c2a78FaF7d655e4Dab03076Cb26C97007FF` |
| Engrave | `0xe73f5f91159c2d84b1a66badf701d5312213b66a` |

### Swipe Contract Config

| Parameter | Value |
|-----------|-------|
| approvalThresholdBps | 6000 (60%) |
| submissionFee | 0.001 ETH |
| placementFee | 0.001 ETH |
| votingWindowSeconds | 259200 (72h) |
| voucherDurationSeconds | 604800 (7 days) |
| operator | `0x1a2a5E805342D5139111488C59d72832055A3e8F` |

---

## 2. SUBGRAPH STATUS CHECK

### Endpoints

| Subgraph | URL |
|----------|-----|
| Swipe (v1.1.0) | `https://api.goldsky.com/api/public/project_cmkwd7dgh0bq501z7fog65iag/subgraphs/foid-swipe-fluent-testnet/1.1.0/gn` |
| Prayer (v1.0.0) | `https://api.goldsky.com/api/public/project_cmkwd7dgh0bq501z7fog65iag/subgraphs/foid-prayer-fluent-testnet/1.0.0/gn` |
| Legacy Board (v2.0.2) | `https://api.goldsky.com/api/public/project_cmkwd7dgh0bq501z7fog65iag/subgraphs/foid-loreboard-fluent-testnet/2.0.2/gn` |
| Legacy Voting (v2.0.1) | `https://api.goldsky.com/api/public/project_cmkwd7dgh0bq501z7fog65iag/subgraphs/foid-loreboard-fluent-testnet/2.0.1/gn` |

### Check sync status

```bash
goldsky subgraph list
```

Look for `Synced: 100%` and `Status: healthy`.

### Quick health check (no CLI needed)

```bash
# Swipe subgraph
curl -s -X POST "https://api.goldsky.com/api/public/project_cmkwd7dgh0bq501z7fog65iag/subgraphs/foid-swipe-fluent-testnet/1.1.0/gn" \
  -H "Content-Type: application/json" \
  -d '{"query":"{ proposeds(first:3,orderBy:blockTimestamp,orderDirection:desc) { proposalId proposer blockTimestamp } }"}'

# Prayer subgraph
curl -s -X POST "https://api.goldsky.com/api/public/project_cmkwd7dgh0bq501z7fog65iag/subgraphs/foid-prayer-fluent-testnet/1.0.0/gn" \
  -H "Content-Type: application/json" \
  -d '{"query":"{ prayerSubmitteds(first:3,orderBy:timestamp,orderDirection:desc) { user timestamp } }"}'
```

### Redeploy a subgraph (if stuck)

```bash
cd /path/to/foid_fun
goldsky subgraph deploy foid-swipe/1.1.0 --from-abi foid-loreboard/swipe-1.1.0/foid-swipe-subgraph.json
```

---

## 3. EPOCH FINALIZATION

### What happens

1. Users submit proposals via `Swipe.proposeLoreboard()` — 0.001 ETH fee
2. Community votes via EIP-712 signed ballots — stored at `POST /api/swipe/vote`
3. After 72h voting window, operator calls `finalize()` with the batch of signatures
4. If >= 60% weighted approval → voucher issued; if < 60% → rejected

### Check pending proposals past voting window

```bash
# Read proposal count
cast call 0xddc2623Bd80B1429426e30Be3D02e52ff6f90C44 "proposalCount()(uint256)" --rpc-url https://rpc.testnet.fluent.xyz

# Read specific proposal (replace 0 with proposal ID)
cast call 0xddc2623Bd80B1429426e30Be3D02e52ff6f90C44 "getProposal(uint256)" 0 --rpc-url https://rpc.testnet.fluent.xyz
```

### Manual finalization via API

```bash
curl -X POST https://your-app.onrender.com/api/operator/finalize \
  -H "Content-Type: application/json" \
  -H "x-operator-key: YOUR_OPERATOR_API_KEY" \
  -d '{"epoch": 42}'
```

- Requires `OPERATOR_API_KEY` header matching the env var on Render
- The `epoch` field is optional — defaults to current epoch
- Add `?force=1` to force-finalize regardless of voting window

### Check finalization status

```bash
# Check if proposal N is finalized
cast call 0xddc2623Bd80B1429426e30Be3D02e52ff6f90C44 "getProposal(uint256)" N --rpc-url https://rpc.testnet.fluent.xyz
# Look for finalized=true in the output
```

---

## 4. FOID MUMMY REPORT

### Manual trigger

```bash
cd foid_fun

# Live run (queries chain + calls Anthropic API)
npx tsx src/agent/foidMummy/run.ts

# Custom date range
npx tsx src/agent/foidMummy/run.ts --from 2026-03-20 --to 2026-03-27

# Dry run with mock data + real API voice
npx tsx src/agent/foidMummy/run.ts --dry-run

# Dry run with mock data + mock narrative (no API call)
npx tsx src/agent/foidMummy/run.ts --dry-run --no-api
```

### Output location

```
foid_fun/reports/foid-mummy-YYYY-MM-DD.html   (styled report)
foid_fun/reports/foid-mummy-YYYY-MM-DD.md     (raw narrative)
```

### Required env vars

- `ANTHROPIC_API_KEY` — in `.env.local`
- `NEXT_PUBLIC_FLUENT_RPC` — RPC for on-chain reads
- `GOLDSKY_SWIPE_URL` — optional override (defaults to hardcoded URL)

### Check last run

```bash
ls -lt foid_fun/reports/ | head -5
```

---

## 5. COMMON ISSUES & FIXES

### Frontend deploy failed (Vercel)

1. Check Vercel dashboard → Deployments → click failed deploy → read build log
2. Common cause: TypeScript error or missing env var
3. To redeploy: push any commit to `mainnet-v1-wip` branch, or click "Redeploy" in Vercel UI
4. Check that all `NEXT_PUBLIC_*` env vars are set in Vercel project settings

### Worker crashed (Render)

1. Check Render dashboard → foid-x-bot service → Logs
2. Common cause: RPC timeout, Goldsky down, X API rate limit
3. Cron jobs auto-restart on next schedule (every 30 min)
4. Manual restart: Render dashboard → service → "Manual Deploy" button

### SQLite database corrupted

The DB file lives at: `foid_fun/data/foid.db`

```bash
# Backup
cp data/foid.db data/foid-backup-$(date +%Y%m%d).db

# Check integrity
sqlite3 data/foid.db "PRAGMA integrity_check;"

# Nuclear option: delete and let it recreate on next server start
# (loses all proposals/votes not yet finalized on-chain)
rm data/foid.db data/foid.db-wal data/foid.db-shm
# Restart server — schema auto-creates, seed manifest auto-inserts
```

### Subgraph fell behind

```bash
# Check sync percentage
goldsky subgraph list | grep -A5 "foid-swipe"

# If stuck at <100% for >1 hour, redeploy
goldsky subgraph deploy foid-swipe/1.1.0 --from-abi foid-loreboard/swipe-1.1.0/foid-swipe-subgraph.json
```

### Manifest out of date

```bash
# Check latest manifest on-chain
cast call 0x87Ea24ba4B61BbF35aD1161e11072Dc8Cf0858a6 "entryCount()(uint256)" --rpc-url https://rpc.testnet.fluent.xyz

# Trigger manual finalization to rebuild
curl -X POST https://your-app.onrender.com/api/operator/finalize?force=1 \
  -H "x-operator-key: YOUR_KEY"
```

### RPC not responding

```bash
# Test Fluent testnet RPC
curl -s -X POST https://rpc.testnet.fluent.xyz \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

If down, there's no backup RPC for Fluent testnet. Wait for recovery.

---

## 6. DASHBOARDS & ACCESS

| Service | URL |
|---------|-----|
| Render dashboard | https://dashboard.render.com |
| Vercel dashboard | https://vercel.com/dashboard |
| Goldsky dashboard | https://app.goldsky.com |
| Fluent testnet RPC | `https://rpc.testnet.fluent.xyz` |
| Block explorer | https://testnet.fluentscan.xyz |
| Goldsky auth | `~/.goldsky/auth_token` (local machine only) |

### Quick contract reads (no auth needed)

```bash
# Deployer/operator balance
cast balance 0x1a2a5E805342D5139111488C59d72832055A3e8F --rpc-url https://rpc.testnet.fluent.xyz

# Total proposals
cast call 0xddc2623Bd80B1429426e30Be3D02e52ff6f90C44 "proposalCount()(uint256)" --rpc-url https://rpc.testnet.fluent.xyz

# Gallery entry count
cast call 0x87Ea24ba4B61BbF35aD1161e11072Dc8Cf0858a6 "entryCount()(uint256)" --rpc-url https://rpc.testnet.fluent.xyz

# Check a user's prayer streak
cast call 0x8ff39c2a78FaF7d655e4Dab03076Cb26C97007FF "get(address)" 0xUSER_ADDRESS --rpc-url https://rpc.testnet.fluent.xyz
```

---

## 7. ENV VARS REFERENCE

### Render — Web Service (foid_fun)

| Var | Description |
|-----|-------------|
| `NEXT_PUBLIC_FLUENT_RPC` | Fluent testnet RPC URL |
| `NEXT_PUBLIC_CHAIN_ID` | Chain ID (20994) |
| `NEXT_PUBLIC_BLOCK_EXPLORER` | Block explorer base URL |
| `OPERATOR_PK` | Operator wallet private key (signs finalize txs) |
| `OPERATOR_API_KEY` | API key for `/api/operator/finalize` auth |
| `WEB3_STORAGE_TOKEN` | Web3.storage IPFS upload token (legacy) |
| `PINATA_JWT` | Pinata IPFS upload JWT |
| `OPENAI_API_KEY` | For Foid Mommy chat endpoint |
| `ANTHROPIC_API_KEY` | For Foid Mummy weekly reports |
| `DB_PATH` | SQLite database path (default: `./data/foid.db`) |
| `NEXT_PUBLIC_BOARD_PASSWORD` | Board access password (dev gating) |

### Render — Cron (foid-x-bot)

| Var | Description |
|-----|-------------|
| `X_API_KEY` | Twitter/X API key |
| `X_API_SECRET` | Twitter/X API secret |
| `X_ACCESS_TOKEN` | Twitter/X access token |
| `X_ACCESS_SECRET` | Twitter/X access secret |
| `OPENAI_API_KEY` | For tweet generation |
| `GOLDSKY_BOARD_V1_URL` | Override for board subgraph URL |
| `GOLDSKY_VOTING_URL` | Override for voting subgraph URL |

### Vercel

Same `NEXT_PUBLIC_*` vars as Render web service. Vercel only serves the frontend — no operator keys needed.

### Foundry (solidity_contracts/.env)

| Var | Description |
|-----|-------------|
| `OPERATOR_PK` | Deployer/operator private key |
| `PRAYER_MIRROR_ADDRESS` | PrayerMirror contract address |
| `FLUENT_RPC_URL` | RPC for forge scripts |
| `FEE_RECIPIENT` | Where fees go (defaults to operator) |

### Foid Mummy Agent

| Var | Description |
|-----|-------------|
| `ANTHROPIC_API_KEY` | Claude API key for narrative generation |
| `GOLDSKY_SWIPE_URL` | Override for Swipe subgraph |
| `GOLDSKY_PRAYER_URL` | Override for Prayer subgraph |
| `PAIR_X_URL` | URL for X handle batch lookup API |

---

## QUICK REFERENCE: Daily Ops Checklist

```
[ ] Check subgraph sync: goldsky subgraph list
[ ] Check pending proposals: cast call 0xddc2...0C44 "proposalCount()" --rpc-url https://rpc.testnet.fluent.xyz
[ ] Finalize any expired proposals: curl POST /api/operator/finalize
[ ] Check Render logs for errors
[ ] Check deployer wallet balance (needs ETH for finalize txs)
```
