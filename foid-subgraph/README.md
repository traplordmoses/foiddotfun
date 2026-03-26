# FOID Subgraphs (GoldSky)

Three subgraphs for indexing FOID on-chain events on Fluent Testnet.

## Subgraphs

| Name | Contract | Events |
|------|----------|--------|
| **swipe** | Swipe (`0xddc2...`) | Proposals, votes, finalization, placements |
| **prayer** | PrayerRegistry (`0x6FC7...`) | Prayer submissions |
| **loreboard-governance** | SwipeLoreboard (`0x3782...`) | Placements, flags, removal votes |

## Deploy to GoldSky

```bash
# Install GoldSky CLI
curl https://goldsky.com | sh

# Login
goldsky login

# Deploy each subgraph
cd swipe
goldsky subgraph deploy foid-swipe-fluent-testnet/1.2.0 --path .

cd ../prayer
goldsky subgraph deploy foid-prayer-fluent-testnet/1.1.0 --path .

cd ../loreboard-governance
goldsky subgraph deploy foid-loreboard-governance-fluent-testnet/1.0.0 --path .
```

## Update URLs in codebase

After deploying, update the URLs in:
- `src/agent/foidMummy/config.ts` (hardcoded defaults)
- Or set env vars: `GOLDSKY_SWIPE_URL`, `GOLDSKY_PRAYER_URL`, `GOLDSKY_GOVERNANCE_URL`
