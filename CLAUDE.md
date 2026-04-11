# FOID Foundation

On-chain cultural coordination platform on Fluent (L2). Three loops: Prayer (daily check-in streaks), Loreboard (community-voted permanent canvas), Vote/Swipe (streak-weighted governance).

## Architecture

**Source of truth for all addresses:** `foid_fun/src/config/canonical.ts`

Mainnet/testnet is controlled by `NEXT_PUBLIC_IS_MAINNET` env var. Testnet chain ID: 20994, mainnet: 25363.

## V1 Contracts (Current — the ONLY contracts that matter)

These are the active, multisig-owned contracts deployed March 2026. All new work should target these:

| Contract | Mainnet (25363) | Testnet (20994) | Solidity |
|----------|-----------------|-----------------|----------|
| PrayerMirror | `0x403ECF8ba28E58CE4d1847C1C95ac54651fAB151` | `0x8ff39c2a78FaF7d655e4Dab03076Cb26C97007FF` | `solidity_contracts/src/PrayerMirror.sol` |
| PrayerRegistry | `0xf98Ec3dd6BfFBf79528918dc6fD153ca2ba8d3Da` | `0x6FC7301fad7Ca0294152b23FD4f0467200376d65` | rWASM (`prayer-registry/`) |
| PrayerTiers | `0x5Cf1bf680FFF2ecB146eF977bF46C4CAE46bA4c6` | `0x36ED105e09A881B6074250a43B2e26c0d6cfD4fb` | `solidity_contracts/src/PrayerTiers.sol` |
| StreakVotingPower | `0x63D1447D01432e18Ac769968fdf78Ccc70015172` | `0x7a889b3d38889E45EE48bbCBc3681a889F87C03e` | `solidity_contracts/src/StreakVotingPower.sol` |
| Loreboard | `0x5362874e334bb5a2c8083a2cf2eb3db6f3d8e33c` | `0xF9b72062A7e5933692CcBd247d70a9cdB40E0eC7` | `solidity_contracts/src/Loreboard.sol` |
| LoreboardLiveNFT | `0x2578bEe9bC2bD66e3736a2Bc69d54D7e6BE7d359` | `0x9E17B30a41546E854778d91d6Ef0C0D982d49012` | `solidity_contracts/src/LoreboardLiveNFT.sol` |
| FoidMultisig | `0xCd674E3175fa87DF9D7534419a0e026336251d05` | `0x2379955b597d2a7fc9dbD918306aa59c43eBF6Ed` | `solidity_contracts/src/FoidMultisig.sol` |
| MiFOID | not yet deployed | not yet deployed | `solidity_contracts/src/MiFOID.sol` |

Key parameters (set in Loreboard constructor):
- Approval threshold: 51% (`approvalThresholdBps = 5100`)
- Voter quorum: 3 unique wallets
- Voting window: 72 hours
- Placement fee: 0.001 ETH
- Base voting weight: 100, MiFOID bonus: +50 flat

## Legacy Contracts — DO NOT MODIFY

These exist on-chain for historical data. The frontend references some for backward compatibility, but **no new features should use these**:

- `treasury` (0x4A77...) — old escrow
- `manifestStore` (0xeE46...) — old manifest anchoring
- `voting` (0xEbf0...) — old voting system
- `board` (0xE41B...) — old board proposals
- `liveNFT` (0x4b38...) — old NFT
- `prayerMirror` (0x8ff3...) — replaced by PrayerTiers
- `prayerRegistry` (0x6FC7...) — standalone, still active for prayer hash storage

Legacy Solidity files (do not touch): `Swipe.sol`, `SwipeLoreboard.sol`, `LoreboardBoardV2.sol`, `LoreboardVotingV2.sol`, `DuelArena.sol`, `PrayerMirror.sol`

## Frontend

- **Framework:** Next.js 14, React 18, pnpm
- **Web3:** viem + wagmi + RainbowKit
- **Database:** Supabase
- **Storage:** IPFS via Web3.storage

### Active Routes

| Route | Purpose |
|-------|---------|
| `/pray` | Prayer terminal (daily check-in with Foid Mommy) |
| `/board` | Loreboard canvas (view + propose placements) |
| `/swipe` | Submit proposals to Loreboard |
| `/vote` | Vote on active proposals (swipe UX) |
| `/gallery` | Browse gallery |
| `/mifoid` | MiFOID NFT page |
| `/about` | About page (10 sections) |
| `/dashboard` | User dashboard |
| `/enter` | Entry/auth |

### Key Files

- `foid_fun/src/config/canonical.ts` — all addresses + chain config (single source of truth)
- `foid_fun/src/config/contracts.ts` — wraps canonical with env overrides
- `foid_fun/src/hooks/usePrayerTiers.ts` — prayer tier names + multipliers
- `foid_fun/src/hooks/useSwipeCastVote.ts` — on-chain vote casting
- `foid_fun/src/hooks/useSwipePropose.ts` — proposal submission
- `foid_fun/src/lib/contracts/addresses.ts` — centralized address management
- `foid_fun/src/lib/embeddedWallet.ts` — FOID Wallet (passkey + PIN)
- `foid_fun/src/components/wallet/` — wallet UI components

### Prayer Tiers (10 tiers)

The contract uses internal names (Whisper, Ember, etc.) but the frontend maps them to user-facing names:

| Day | Tier Name | Multiplier |
|-----|-----------|------------|
| 1 | Lurker | 1x |
| 3 | NPC | 1.25x |
| 7 | Tapped In | 1.5x |
| 14 | Locked In | 1.75x |
| 21 | Certified | 2x |
| 30 | Undeniable | 2.5x |
| 45 | Built Different | 3x |
| 60 | Inevitable | 3.5x |
| 75 | Transcendent | 4x |
| 90 | Mommy Milker | 5x |

## Subgraphs (Goldsky)

- `foid-subgraph/loreboard/` — indexes Loreboard V1 (proposals, votes, placements, manifest updates)
- `foid-subgraph/prayer-tiers/` — indexes PrayerTiers V1 + PrayerRegistry

## Commands

```bash
# Frontend
cd foid_fun && pnpm install
pnpm dev          # local dev server
pnpm build        # production build (needs NODE_OPTIONS for memory)
pnpm test         # vitest
pnpm typecheck    # tsc --noEmit

# Contracts
cd solidity_contracts
forge build
forge test
```

## Deploy Scripts

- `solidity_contracts/script/DeployV1.s.sol` — primary V1 deployment (testnet)
- `solidity_contracts/script/DeployMainnetCore.s.sol` — mainnet deployment
- `solidity_contracts/script/DeployMultisig.s.sol` — multisig setup

## Common Pitfalls

- `canonical.ts` has both `swipe` and `loreboard` keys pointing to the SAME address (`0xF9b7...`). This is intentional — the unified Loreboard contract replaced the old Swipe.
- The Swipe.sol contract has `approvalThresholdBps = 6000` (60%), but the V1 Loreboard.sol uses 5100 (51%). The about page and all user-facing docs reference 51% (the Loreboard value).
- MiFOID contract exists but has no supply cap or tiered pricing on-chain yet. The 3,333 supply and Genesis/Awakened/Ascended tiers are design intentions.
- Prayer tier names in Solidity (Whisper, Ember, Devotee...) differ from frontend names (Lurker, NPC, Tapped In...). The frontend names are canonical for users.
