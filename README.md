# Loreboard

> *On-chain infrastructure for cultural coordination*

![Foid Mommy Terminal](foid_fun/public/foidmommy.gif)

**Loreboard** is a shared, permanent, on-chain cultural canvas — governed democratically by the community that builds on it. Every placement is a consensus statement: *"this matters to us."* The board becomes a living artifact of collective identity that only grows through earned participation.

Loreboard is not an app. It is not a meme gallery. It is not a feature inside a product. **It is a new primitive for how communities build culture, accumulate identity, and coordinate on-chain.** It turns contribution into status, status into access, and access into influence over what gets built next.

**[FOID Foundation](https://foid.fun)** is the first community deployed on Loreboard. There will be others.

---

## Three Interlocking Loops

Loreboard runs on three systems that reinforce each other. None works alone. Together, they produce something no existing platform offers: **a democratic, on-chain cultural record with earned governance.**

### Loop 01 — Commitment: The Check-In

A daily ritual that signals commitment to the community. For FOID, this is **Prayer** — a one-tap on-chain check-in that builds a consecutive streak. The streak is not a vanity metric. It is a **governance credential.** The longer your streak, the more influence you earn over what gets placed on the board.

Every community deploying Loreboard defines their own check-in. The ritual is cultural, the mechanism is universal.

### Loop 02 — Governance: The Vote

Someone submits a placement to the board with a 0.001 ETH application fee. The community has 72 hours to vote. Swipe right: *"this earns a spot."* Swipe left: *"no."* Votes are weighted by check-in streak — the people who show up every day have the most say over what gets built. If it fails, the submission is gone. No archive. No consolation. That finality is what makes a yes mean something.

### Loop 03 — Permanence: The Placement

An approved placement is recorded on-chain and lives on the board permanently. Every placement is a legible, verifiable statement: **this community decided this matters.** Over time, the board becomes the most honest representation of what a community actually values.

### The Flywheel

```
check in daily → build streak → earn vote weight → govern placements → board grows → show up again
```

The key insight: **streak isn't just a number — it's zoning power.** The person who checks in every day is accumulating influence over what gets built on the board permanently. That changes the meaning of showing up.

---

## What the System Produces: Reputation

Every action generates on-chain signal. Check-in streaks, placement submissions, voting patterns — this is a continuous, composable data stream that describes how engaged someone actually is.

Someone with a 90-day streak and five approved placements is objectively more invested than someone who showed up once. You don't need mods to vouch for them. The chain tells you.

| Signal | Unlocks | Why |
|--------|---------|-----|
| Check-in streak | Governance weight, NFT customization | Commitment earns influence |
| Approved placements | Contributor status, board presence | Community-validated taste is rewarded |
| Voting history | Curation reputation, increased weight | Consistent good judgment compounds |
| Combined signals | Priority access, agent interactions | Most engaged members shape the future |

---

## The Agent Layer

Loreboard's most novel layer: **an autonomous AI agent that reads all on-chain activity and turns it into a living cultural narrative.**

In FOID's deployment, this agent is **Foid Mommy** — the narrator, curator, and hype beast of the community. She has full access to on-chain data: streaks, placements, voting patterns, NFT transfers. She watches everything. She has opinions.

- **Weekly Report** — Generated media where Foid Mommy reacts to on-chain activity like a reality TV host. Shouts out long streakers, roasts people who fell off, creates drama around contentious votes. The marketing engine runs itself.
- **MiFOID Reactions** — Personalized renders triggered by your on-chain behavior. Hit a 30-day streak? Confetti. Stop praying? Your MiFOID sits alone in the dark. Every reaction is shareable content.
- **Sub-Agent Companions** — Each MiFOID is a live agentic NFT with persistent memory. Your companion reflects your on-chain reputation. When she transfers, she carries forward personality traits from previous eras. She has history.

The pattern is universal: *on-chain activity → agent interpretation → generated cultural content → drives more activity.* The flywheel is recursive.

---

## First Deployment: FOID Foundation

FOID Foundation proves the primitive with a specific audience (meme-native, crypto-cultural) and a specific aesthetic (Frutiger Aero, iridescent, frosted glass).

| Loreboard Primitive | FOID Implementation |
|---------------------|---------------------|
| Check-in ritual | **Prayer** — daily on-chain tap, builds streak |
| Governance vote | **Swipe** — streak-weighted approval for placements |
| Cultural canvas | **Loreboard** — infinite collaborative grid |
| Identity layer | **MiFOID** — 3,333 AI-generated 3D NFTs with agent companions |
| Narrator agent | **Foid Mommy** — autonomous cultural commentator |
| Reputation signal | Prayer streaks + placements + voting |
| Access layer | Streak unlocks MiFOID customization, placements earn status |

### Prayer Tiers (10 tiers)

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

---

## V1 Contracts

Active, multisig-owned contracts on Fluent. All governance and cultural coordination runs through these:

| Contract | Purpose | Key Parameters |
|----------|---------|---------------|
| **PrayerTiers** | 10-tier prayer streak system | Tiers at 1, 3, 7, 14, 21, 30, 45, 60, 75, 90 days |
| **StreakVotingPower** | Voting weight from streak tiers | Base weight: 100, MiFOID bonus: +50 |
| **Loreboard** | Unified propose/vote/finalize/place | 51% threshold, 3 quorum, 0.001 ETH fee, 72h window |
| **LoreboardLiveNFT** | 1/1 ERC-721 board NFT | Auto-syncs manifest from Loreboard |
| **FoidMultisig** | 2-of-3 multisig ownership | Controls all contract parameters post-deploy |
| **MiFOID** | Identity NFT (not yet deployed) | 3,333 supply cap planned |

All contract addresses flow through `src/config/canonical.ts` — single source of truth. Network switching via `NEXT_PUBLIC_IS_MAINNET` env var.

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
         +-------------------------------------------------+
         |              Fluent L2 (Chain 25363)             |
         |                                                  |
         |  PrayerRegistry    Loreboard      FoidMultisig   |
         |  PrayerTiers       LoreboardLiveNFT   (2-of-3)  |
         |  StreakVotingPower                                |
         +-------------------------------------------------+
                              |
                    Goldsky Subgraphs
                  (loreboard + prayer-tiers)
```

### How Voting Works

1. User calls `Loreboard.propose(cid, x, y, w, h)` — pays 0.001 ETH, opens 72h window
2. Community calls `Loreboard.castVote(proposalId, approve)` — streak-weighted, one per wallet
3. After 72h, anyone calls `Loreboard.finalize(proposalId)` — checks quorum + threshold
4. If approved: placement recorded permanently, manifest updated, NFT auto-syncs
5. If rejected: proposal marked rejected, fee retained

### How Prayer Works

1. User types feeling in terminal, AI oracle responds
2. Frontend builds `keccak256(abi.encode(wallet, prayerText, timestamp))`
3. Calls `PrayerRegistry.pray(hash)` — stores hash, updates streak
4. `PrayerTiers` maps streak to tier name + multiplier
5. `StreakVotingPower` reads tier to calculate governance weight

---

## Project Layout

```
foid_fun/                     # Next.js application root
  src/
    app/                      # Routes: /pray, /board, /swipe, /vote, /gallery, /mifoid, /about
    config/
      canonical.ts            # THE source of truth for all addresses + chain config
    hooks/                    # React hooks (prayer, voting, board, wallet)
    lib/
      chain.ts                # TARGET_CHAIN (IS_MAINNET switch)
      contracts/addresses.ts  # CONTRACTS object (env overrides -> canonical fallbacks)
      embeddedWallet.ts       # FOID Wallet (passkey + PIN)

solidity_contracts/           # Foundry project
  src/                        # V1 contracts + legacy contracts
  script/                     # Deploy scripts (DeployMainnetCore, DeployLoreboard, DeployMultisig)

foid-subgraph/                # Goldsky subgraph definitions
  loreboard/                  # Indexes proposals, votes, placements
  prayer-tiers/               # Indexes prayer events and tier changes
```

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
forge test        # 195 tests, all passing
```

---

## Links

- **Live:** [foid.fun](https://foid.fun)
- **Chain:** Fluent L2 (mainnet chain ID 25363)
- **Explorer:** [fluentscan.xyz](https://fluentscan.xyz)
- **Twitter:** [@foidfun](https://twitter.com/foidfun)

---

*FOID is the first city. Loreboard is the zoning law.*
