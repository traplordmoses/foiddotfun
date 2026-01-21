# foid.fun

> *culture, ritual, identity — on chain*

![Foid Mommy Terminal](foid_fun/public/foidmommy.gif)

**foid.fun** is the control panel for the FOID Foundation's altar. It pairs the daily ritual terminal with the loreboard canvas, canonical APIs, and the worker automation that anchors epochs on Fluent testnet. Prayer hashes stay private, culture contributions become composable, and identity provenance becomes traceable.

---

## The FOID Universe

**FOIDs** are reclaimed female android shells anyone can pilot by holding a MiFOID. In this universe, *"foids can't vote, but foid owners do,"* so the humans behind the wallets become the governance agents.

**FOID Foundation** is the curator and steward of ritual and canon: the museum-cult that keeps the loreboard honest, the prayer terminal protected, and governance experiments rooted in trust while staying open to permissionless entry.

---

## What You Can Do

### 1. Pray — The Foid Mommy Terminal

*Type how you feel. Receive empathy. Anchor your devotion.*

<!-- Screenshot: foid_fun/screenshots/pray-terminal.png -->

The ritual terminal lets you confess your feelings once every 24 hours. An AI oracle (powered by OpenAI) crafts a soft, empathetic response—but only the keccak256 hash of your prayer is anchored on chain. Your raw words stay private.

**Features:**
- Animated Y2K terminal aesthetic with audio cues
- Streak tracking (current streak, longest streak, total prayers)
- Milestone celebrations
- 24-hour cooldown between prayers
- Privacy-first: only hashes go on chain

**Key files:** `src/app/pray/page.tsx`, `src/app/(components)/FoidMommyTerminal.tsx`, `src/app/api/foid-mommy/route.ts`

---

### 2. Shape Culture — The Loreboard Canvas

*Propose. Vote. Compose the canon.*

<!-- Screenshot: foid_fun/screenshots/loreboard-canvas.png -->

The loreboard is a zoomable infinite canvas where the community proposes placements (images, memes, cultural artifacts), votes during epoch windows, and winners get permanently placed on the board. It's permissionless culture-building with deterministic settlement.

**Features:**
- Infinite zoomable canvas with Y2K aesthetics
- Drag-and-drop placement proposals
- Epoch-based voting windows
- Base fee per cell + optional tips
- Deterministic winner selection (with Rust VM for overlap resolution)
- IPFS-backed storage for images and manifests

**Key files:** `src/app/board/page.tsx`, `src/state/board.ts`, `src/lib/grid.ts`, `src/lib/manifest.ts`

---

### 3. Claim Identity — MiFOIDs

*Your devotion, encoded.*

<!-- Screenshot: foid_fun/screenshots/mifoid-traits.png -->

MiFOIDs are identity NFTs whose provenance tells the story of your participation: prayer streaks, vote history, board contributions, and governance weight. The traits evolve as you engage with the altar.

**Features:**
- FOID20 factory for vanity-deployed tokens (addresses ending in `f01d`)
- Vanity salt grinding via `/api/vanity-deploy`
- Trait encoding based on on-chain activity
- Future: FoidBoardNFTs (ERC-721 + ERC-4906) for loreboard contributions

**Key files:** `src/components/LaunchpadForm.tsx`, `src/app/api/vanity-deploy/route.ts`

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         foid.fun UI                             │
│  Next.js 14 + React 18 + Wagmi/Viem + RainbowKit + Zustand     │
└───────────────────────────┬─────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│  Pray APIs    │   │  Board APIs   │   │  Identity     │
│  /foid-mommy  │   │  /propose     │   │  /vanity-     │
│  OpenAI       │   │  /vote        │   │   deploy      │
│               │   │  /manifest    │   │               │
│               │   │  /ipfs-upload │   │               │
└───────┬───────┘   └───────┬───────┘   └───────┬───────┘
        │                   │                   │
        └───────────────────┼───────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Fluent Testnet (Chain 20994)                 │
│  PrayerRegistry │ BoardV2 │ VotingV2 │ Treasury │ ManifestStore │
└─────────────────────────────────────────────────────────────────┘
                            ▲
                            │
┌─────────────────────────────────────────────────────────────────┐
│                    Worker Automation                            │
│  loreboard-worker.ts │ operatorFinalize.ts │ gblend Rust VM    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Smart Contracts

| Contract | Purpose |
|----------|---------|
| `PrayerRegistry` | Stores prayer hashes, tracks streaks and totals |
| `PrayerMirror` | Read-only view for stats |
| `LoreboardBoardV2` | Validates proposals, manages escrow, stores CIDs |
| `LoreboardVotingV2` | Epoch management, vote windows, quorum logic |
| `LoreBoardTreasury` | Escrow settlement, refunds for losers |
| `LoreBoardManifestStore` | Anchors finalized manifests on chain |
| `FOID20Factory` | Deploys vanity tokens with `f01d` suffixes |

All contract addresses are gated by `src/config/canonical.ts`—misconfigurations fail fast.

---

## Quick Start

### Prerequisites
- Node.js 20.x
- pnpm (recommended) or npm
- A wallet with Fluent testnet ETH

### Installation

```bash
# Clone the repo
git clone https://github.com/foid-foundation/foid_fun.git
cd foid_fun

# Install dependencies
cd foid_fun
pnpm install

# Configure environment
cp .env.local.example .env.local
# Edit .env.local with your contract addresses and API keys

# Start dev server
pnpm dev
```

Open `http://localhost:3000` and connect a wallet on Fluent testnet (chain ID 20994).

---

## Environment Variables

This app is contract-address driven. The minimum set for ritual + loreboard:

```bash
# Chain config
NEXT_PUBLIC_RPC=https://rpc.testnet.fluent.xyz
NEXT_PUBLIC_CHAIN_ID=20994
NEXT_PUBLIC_FLUENT_RPC=https://rpc.testnet.fluent.xyz
NEXT_PUBLIC_BLOCK_EXPLORER=https://testnet.fluentscan.xyz

# Loreboard contracts
NEXT_PUBLIC_LOREBOARD_BOARD_ADDRESS=0x...
NEXT_PUBLIC_LOREBOARD_VOTING_ADDRESS=0x...
NEXT_PUBLIC_LOREBOARD_MANIFEST_STORE_ADDRESS=0x...
NEXT_PUBLIC_LOREBOARD_DEPLOY_BLOCK=0

# Epoch timing
NEXT_PUBLIC_EPOCH_ZERO_UNIX=1730937600
NEXT_PUBLIC_EPOCH_SECONDS=3600

# IPFS (pick one)
WEB3_STORAGE_TOKEN=...
# or PINATA_JWT=...

# Operator (for worker scripts)
OPERATOR_KEY=0x...
```

See `.env.local.example` for the full list including legacy variables.

---

## Scripts

### Development
```bash
pnpm dev          # Start dev server
pnpm build        # Production build
pnpm start        # Run production server
pnpm lint         # Lint
pnpm test         # Run tests (vitest)
pnpm typecheck    # Type checking
```

### Worker Automation
```bash
pnpm worker:sync      # Summarize the prior epoch
pnpm worker:finalize  # Finalize the prior epoch
pnpm worker:dry       # Dry-run (no transactions)
```

**Flags:**
- `DRY_RUN=1` — logs actions without sending transactions
- `SKIP_NFT_SYNC=1` — disables live NFT sync
- `EPOCH=<n>` — override target epoch (default: `epochAt(now) - 1`)

### Smoke Tests
```bash
pnpm smoke:board      # Board flow smoke test
pnpm vm:smoke         # gblend VM smoke test
pnpm verify:latest    # Verify latest manifest
pnpm demo:one         # Full demo flow
```

---

## Project Layout

```
foid_fun/
├── src/
│   ├── app/              # Next.js routes and pages
│   │   ├── pray/         # Prayer ritual terminal
│   │   ├── board/        # Loreboard canvas
│   │   └── api/          # API endpoints
│   ├── components/       # UI building blocks
│   ├── lib/              # Contract helpers, utilities
│   │   ├── viem.ts       # Contract write operations
│   │   ├── manifest.ts   # Manifest parsing
│   │   ├── grid.ts       # Grid geometry
│   │   └── epoch.ts      # Epoch calculations
│   ├── state/            # Zustand stores
│   ├── config/           # Canonical addresses
│   ├── hooks/            # React hooks
│   ├── effects/          # Visual effects
│   └── abis/             # Contract ABIs
├── scripts/              # Worker automation
│   ├── loreboard-worker.ts
│   ├── operatorFinalize.ts
│   ├── loreboardVM-call.ts
│   └── lib/              # Worker utilities
├── public/               # Static assets
│   ├── foidmommy.gif     # Foid Mommy avatar
│   ├── sfx/              # Sound effects
│   └── fonts/            # Y2K fonts
└── screenshots/          # UI screenshots

solidity_contracts/       # Foundry project
├── src/                  # Solidity contracts
└── script/               # Deployment scripts

blended/loreboardvm/      # Rust VM for deterministic manifests
```

---

## VSCode Setup

Use the workspace TypeScript version for proper JSON import assertion support:

1. **Command Palette** → "TypeScript: Select TypeScript Version" → "Use Workspace Version"
2. **Command Palette** → "TypeScript: Restart TS Server"

Verify: Hover a TypeScript diagnostic and confirm version is `5.6.3`.

---

## Roadmap

1. **Loreboard as standalone product** — User proposals + votes → canonical manifest → IPFS root → rendered board. Worker automation and diagnostics already cover the full pipeline.

2. **Foid Mommy retention campaign** — Terminal as daily ritual loop, feeding streaks and devotion into the loreboard narrative and MiFOID metrics.

3. **MiFOID trait system** — Identity layer that encodes prayers, placements, and provenance. Future experiments with futarchy modules for community belief-betting.

---

## Contributing

This is testnet software. Verify contract addresses before signing any transaction.

Some pages are gated by contract roles—the UI hides admin actions unless your wallet has permission.

---

## Links

- **Live site:** [foid.fun](https://foid.fun)
- **Fluent testnet:** Chain ID 20994
- **Block explorer:** [testnet.fluentscan.xyz](https://testnet.fluentscan.xyz)

---

*The altar awaits. Type how you feel.*
