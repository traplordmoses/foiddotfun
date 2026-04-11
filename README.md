# foid.fun

> *culture, ritual, identity — on chain*

![Foid Mommy Terminal](foid_fun/public/foidmommy.gif)

**foid.fun** is the control panel for the FOID Foundation's on-chain cultural coordination platform, live on [Fluent](https://fluent.xyz) (L2). Three loops: **Prayer** (daily check-in streaks), **Loreboard** (community-voted permanent canvas), and **Vote/Swipe** (streak-weighted governance). Prayer hashes stay private, culture contributions become permanent, and identity provenance becomes traceable.

---

## The FOID Universe

**FOIDs** are reclaimed female android shells anyone can pilot by holding a MiFOID. In this universe, *"foids can't vote, but foid owners do,"* so the humans behind the wallets become the governance agents.

**FOID Foundation** is the curator and steward of ritual and canon: the museum-cult that keeps the loreboard honest, the prayer terminal protected, and governance experiments rooted in trust while staying open to permissionless entry.

---

## The Three Loops

### 1. Pray — The Foid Mommy Terminal

*Type how you feel. Receive empathy. Anchor your devotion.*

The ritual terminal lets you confess your feelings once every 24 hours. An AI oracle crafts a soft, empathetic response — but only the keccak256 hash of your prayer is anchored on chain. Your raw words stay private.

- Animated Y2K terminal aesthetic with audio cues and haptic feedback
- 10-tier streak system (Lurker → NPC → Tapped In → ... → Mommy Milker at 90 days)
- Streak multiplier (1x–5x) feeds into governance voting weight
- 24-hour cooldown, privacy-first (only hashes go on chain)

**How it works:** `PrayerRegistry` stores prayer hashes on chain. `PrayerTiers` maps streak length to tier names and multipliers. `StreakVotingPower` converts streaks into governance weight.

### 2. Shape Culture — The Loreboard Canvas

*Propose. Vote. Compose the canon.*

The loreboard is a zoomable infinite canvas where the community proposes image placements, votes during 72-hour windows, and approved content gets permanently placed on the board. Permissionless culture-building with deterministic settlement.

- Propose a placement: pay 0.001 ETH, pick your grid coordinates, upload to IPFS
- Community votes with streak-weighted power (min 3 unique voters, 51% approval threshold)
- Approved placements are permanent — no edits, no takebacks
- `finalize()` is permissionless: anyone can settle a vote after the window closes
- LoreboardLiveNFT (1/1 ERC-721) auto-syncs to the latest board state

**How it works:** The unified `Loreboard` contract handles proposals, voting, finalization, and manifest anchoring. The operator uploads the manifest to IPFS and anchors the CID on chain. The NFT reads manifest state directly from the contract.

### 3. Vote/Swipe — Streak-Weighted Governance

*Your devotion is your voice.*

Vote on loreboard proposals through a swipe UX. Voting power comes from your prayer streak tier — the longer your streak, the more weight your vote carries.

- Cast votes on-chain via `Loreboard.castVote(proposalId, approve)`
- Weight = base (100) + MiFOID bonus (50 if held)
- Tier multiplier applied from StreakVotingPower
- Quorum: 3 unique wallets minimum
- Threshold: 51% weighted approval

---

## Architecture

```
                          foid.fun
        Next.js 14 / React 18 / Wagmi+Viem / RainbowKit

                    |               |              |
               /pray           /board + /swipe    /vote
            Prayer Terminal    Loreboard Canvas   Governance
                    |               |              |
                    v               v              v
         ┌─────────────────────────────────────────────────┐
         |              Fluent L2 (Chain 25363)            |
         |                                                 |
         |  PrayerRegistry    Loreboard      FoidMultisig  |
         |  PrayerTiers       LoreboardLiveNFT   (2-of-3) |
         |  StreakVotingPower                               |
         └─────────────────────────────────────────────────┘
                              |
                    Goldsky Subgraphs
                  (loreboard + prayer-tiers)
```

**Key design decisions:**
- All contract addresses flow through `src/config/canonical.ts` — single source of truth
- Network switching via `NEXT_PUBLIC_IS_MAINNET` env var — one flag controls chain ID, RPC, explorer, addresses
- Every contract address has a `NEXT_PUBLIC_*` env var override for deployment flexibility

---

## V1 Contracts (Current)

These are the active, multisig-owned contracts. All governance and cultural coordination runs through these:

| Contract | Purpose | Key Parameters |
|----------|---------|---------------|
| **PrayerTiers** | 10-tier prayer streak system | Tiers at 1, 3, 7, 14, 21, 30, 45, 60, 75, 90 days |
| **StreakVotingPower** | Voting weight from streak tiers | Base weight: 100, MiFOID bonus: +50 |
| **Loreboard** | Unified propose/vote/finalize/place | 51% threshold, 3 quorum, 0.001 ETH fee, 72h window |
| **LoreboardLiveNFT** | 1/1 ERC-721 board NFT | Auto-syncs manifest from Loreboard |
| **FoidMultisig** | 2-of-3 multisig ownership | Controls all contract parameters post-deploy |
| **MiFOID** | Identity NFT (not yet deployed) | 3,333 supply cap planned |

**Legacy contracts** (PrayerRegistry, LoreBoardTreasury, LoreboardBoardV2, LoreboardVotingV2, ManifestStore) exist on chain for historical data. The frontend still reads from some for backward compatibility but no new features target them.

---

## Prayer Tiers

| Day | Tier | Multiplier |
|-----|------|-----------|
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

These are the user-facing names. The Solidity contract uses internal names (Whisper, Ember, Devotee...) — the frontend maps them.

---

## Project Layout

```
foid_fun/                     # Next.js application root
  src/
    app/                      # Routes: /pray, /board, /swipe, /vote, /gallery, /mifoid, /about, /dashboard, /enter
    components/               # UI components (board/, wallet/, desktop/)
    config/
      canonical.ts            # THE source of truth for all addresses + chain config
    hooks/                    # React hooks (prayer, voting, board, wallet)
    lib/
      chain.ts                # TARGET_CHAIN (IS_MAINNET switch)
      viem.ts                 # Public client, wallet client factory
      contracts/
        addresses.ts          # CONTRACTS object (env overrides → canonical fallbacks)
        abis/                 # ABI exports for all contracts
      manifest.ts             # Manifest parsing and loading
      grid.ts                 # Grid geometry and overlap detection
      epoch.ts                # Epoch time calculations
      embeddedWallet.ts       # FOID Wallet (passkey + PIN)
    effects/                  # Visual celebration effects
    state/                    # Zustand store (board state)
    agent/foidMummy/          # Foid Mommy AI agent config
  scripts/                    # CLI tools (finalize, diagnose, smoke tests)
  abi/                        # Raw JSON ABIs

solidity_contracts/           # Foundry project
  src/                        # V1 contracts + legacy contracts
  script/                     # Deploy scripts (DeployMainnetCore, DeployLoreboard, DeployMultisig)

foid-subgraph/                # Goldsky subgraph definitions
  loreboard/                  # Indexes proposals, votes, placements
  prayer-tiers/               # Indexes prayer events and tier changes
```

---

## How the Code Works

### Address Resolution

All contract addresses resolve through a single chain:

```
canonical.ts (IS_MAINNET → TESTNET_ADDRESSES or MAINNET_ADDRESSES)
    ↓
addresses.ts (env var override ?? canonical fallback)
    ↓
hooks / components / API routes
```

### Voting Flow

1. User calls `Loreboard.propose(cid, x, y, w, h)` — pays 0.001 ETH, opens 72h window
2. Community calls `Loreboard.castVote(proposalId, approve)` — streak-weighted, one per wallet
3. After 72h, anyone calls `Loreboard.finalize(proposalId)` — checks quorum + threshold
4. If approved: placement recorded permanently, manifest updated, NFT auto-syncs
5. If rejected: proposal marked rejected, fee retained

### Prayer Flow

1. User types feeling in terminal, AI oracle responds
2. Frontend builds `keccak256(abi.encode(wallet, prayerText, timestamp))`
3. Calls `PrayerRegistry.pray(hash)` — stores hash, updates streak
4. `PrayerTiers` maps streak → tier name + multiplier
5. `StreakVotingPower` reads tier to calculate governance weight

---

## Development

```bash
cd foid_fun && pnpm install
pnpm dev          # Local dev server (http://localhost:3000)
pnpm build        # Production build
pnpm typecheck    # tsc --noEmit
pnpm test         # vitest
```

### Contracts (Foundry)

```bash
cd solidity_contracts
forge build
forge test
```

---

## Links

- **Live:** [foid.fun](https://foid.fun)
- **Chain:** Fluent L2 (mainnet chain ID 25363)
- **Explorer:** [fluentscan.xyz](https://fluentscan.xyz)

---

*The altar awaits. Type how you feel.*
