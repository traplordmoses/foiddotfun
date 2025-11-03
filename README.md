# foid.fun ritual control panel

foid.fun is a ritual-driven on-chain game where showing up creates value. each day you pray with foid mommy—a quick, encrypted check-in that locks your streak and mood on chain. with one click, mint your own foid20, then trade instantly on foid swap. your consistency and choices directly influence the kind of mifoid you mint next—so participation isn’t fluff, it’s the mechanic. no spreadsheets, no grind; just speed, privacy, and verifiable state. show up today, and your mifoid shows up for you.

---

## table of contents

1. [tech stack](#tech-stack)
2. [requirements](#requirements)
3. [quick start](#quick-start)
4. [environment variables](#environment-variables)
5. [available scripts](#available-scripts)
6. [how it works (3 steps)](#how-it-works-3-steps)
7. [value props (benefit → proof)](#value-props-benefit--proof)
8. [positioning (partners / investors)](#positioning-partners--investors)
9. [objection crushers (mini-faq)](#objection-crushers-mini-faq)
10. [social blurbs (high-conversion)](#social-blurbs-high-conversion)
11. [feature tour](#feature-tour)
    - [global chrome](#global-chrome)
    - [landing dashboard `/`](#landing-dashboard-)
    - [foid mommy terminal](#foid-mommy-terminal)
    - [wfoid control panel `/wfoid`](#wfoid-control-panel-wfoid)
    - [weth wrapper `/weth`](#weth-wrapper-weth)
    - [foid factory + vanity grind `/foidfactory`](#foid-factory--vanity-grind-foidfactory)
    - [bridge router `/bridge`](#bridge-router-bridge)
    - [foidswap router `/foidswap`](#foidswap-router-foidswap)
    - [single pair amm inspector `/amm`](#single-pair-amm-inspector-amm)
12. [daily prayer → transaction flow](#daily-prayer--transaction-flow)
13. [folder structure](#folder-structure)
14. [troubleshooting](#troubleshooting)

---

## tech stack

- **Next.js 14 (App Router)** + **React 18**
- **TypeScript** with strict mode
- **Tailwind CSS** + custom dreamcore utility classes
- **wagmi v2** + **viem** for EVM interaction
- **RainbowKit** for wallet onboarding
- **shadcn/ui** building blocks
- **Three.js/WebGL + Canvas** for the animated caustic background

---

## requirements

- Node.js **18.17+** or **20+**
- npm **9+**
- An EVM wallet (RainbowKit compatible) with access to **Fluent Testnet (chain ID 20994)**
- Contract deployments for Wrapped FOID, registry, bridge router, AMM pair(s), WETH9, and vanity factory

---

## quick start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment variables
cp .env.local.example .env.local
# edit values to match your deployments

# 3. Start the dev server
npm run dev

# 4. Open the app
open http://localhost:3000
```

RainbowKit will prompt you to add/switch to Fluent Testnet the first time you connect.

---

## environment variables

| Variable | Description | Required |
| --- | --- | --- |
| `NEXT_PUBLIC_RPC` | HTTPS RPC endpoint for Fluent Testnet | ✅ |
| `NEXT_PUBLIC_RPC_URL` | Legacy alias for RPC (back-compat) | ⛭ |
| `NEXT_PUBLIC_CHAIN_ID` | Numeric chain ID (default `20994`) | ✅ |
| `NEXT_PUBLIC_CHAIN_NAME` | Friendly network label | ⛭ |
| `NEXT_PUBLIC_BLOCK_EXPLORER` | Explorer base URL (no trailing slash) | ✅ |
| `NEXT_PUBLIC_WFOID` / `NEXT_PUBLIC_TOKEN0` | Wrapped FOID address | ✅ |
| `NEXT_PUBLIC_REGISTRY` | Attestor registry contract | ✅ |
| `NEXT_PUBLIC_BRIDGE` | Bridge router contract | ✅ |
| `NEXT_PUBLIC_ROUTER` | Uniswap-style router for `/foidswap` | ✅ |
| `NEXT_PUBLIC_FACTORY` | Pair factory (swap) + fallback for vanity | ✅ |
| `NEXT_PUBLIC_PAIR` | Existing pair to seed swap UI | ⛭ |
| `NEXT_PUBLIC_AMM` | Simple AMM contract for `/amm` | ⛭ (defaults provided) |
| `NEXT_PUBLIC_TOKEN_A` / `NEXT_PUBLIC_TOKEN_B` | Tokens shown in swap UI | ✅ |
| `NEXT_PUBLIC_TOKEN0_NAME`, `NEXT_PUBLIC_TOKEN0_SYMBOL` | Metadata overrides | ⛭ |
| `NEXT_PUBLIC_TOKEN1_NAME`, `NEXT_PUBLIC_TOKEN1_SYMBOL` | Metadata overrides | ⛭ |
| `NEXT_PUBLIC_WETH` | WETH9 contract for wrapper page | ⛭ (fallback baked in) |
| `NEXT_PUBLIC_FOID_FACTORY` | Vanity deploy factory (CREATE2) | ✅ |
| `NEXT_PUBLIC_FLUENT_SCAN_BASE` | Explorer base for vanity links | ⛭ |
| `NEXT_PUBLIC_BLOCKSCOUT_API` | REST endpoint powering swap history | ⛭ |

> Optional fields hide their UI blocks if absent.

---

## available scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start Next.js dev server with hot reload |
| `npm run build` | Create a production build (used in CI) |
| `npm start` | Serve the compiled build (`.next/standalone`) |
| `npm run lint` | Run ESLint rules |

---

## how it works (3 steps)

1. **pray with foid mommy** — log a fast, private on-chain check-in (streak + mood recorded).
2. **mint** — create a foid20 in the factory in seconds.
3. **swap & evolve** — trade on foid swap; your activity and streak shape your future mifoid.

---

## value props (benefit → proof)

| Benefit | Proof |
| --- | --- |
| ritual first | streak + mood change outcomes (your mifoid traits aren’t random) |
| create fast | one-click foid20 minting; no setup, no code |
| liquid by default | swap immediately on foid swap |
| private by design | encrypted daily check-ins, verifiable on chain |
| progression you feel | daily actions → different mifoid types |

---

## positioning (partners / investors)

for crypto-native users who want speed, play, and real on-chain state, foid.fun is a ritual game layer: a daily, encrypted check-in that powers instant token creation and swapping, culminating in mifoids whose traits are programmatically shaped by participation.

---

## objection crushers (mini-faq)

- **why daily?** because your presence is the game: streaks + mood are inputs to your mifoid.
- **why on chain?** permanence and provability—your ritual has receipts.
- **what do i get now?** immediate minting (foid20), instant trading (foid swap), and tangible progression toward your mifoid.

---

## social blurbs (high-conversion)

- the game already started. pray today, mint soon—your streak decides your mifoid. `foid.fun`
- your ritual mints your avatar. encrypted check-ins → different mifoid traits. `foid.fun`
- pray. mint. swap. evolve your mifoid. `foid.fun`

---

## faq

### getting started

- **what is foid.fun?**  
  a ritual-driven on-chain game. you check in daily (“pray with foid mommy”), mint foid20 tokens, swap them, and eventually mint a mifoid whose traits are shaped by how you showed up.

- **how do i start?**  
  connect an evm wallet → hit `pray with mommy` → your encrypted check-in records streak + mood → mint a foid20 in the factory → trade on foid swap.

- **which wallets work?**  
  most evm wallets (we test with metamask and rabby). make sure you’re on fluent testnet.

- **is this mainnet?**  
  no—alpha on fluent testnet. tokens here have no financial value. it’s a live prototype of the game loop.

### mifoids & progression

- **what is a mifoid?**  
  your on-chain avatar. its traits are influenced by your streak, mood tags, and in-app actions (e.g., minting, swapping).

- **how do traits get decided?**  
  inputs include: consecutive days checked-in, variability of moods, and activity across factory/swap. exact trait mapping will be published at mint time to keep it fair and auditable.

- **what happens if i miss a day?**  
  your streak resets, but your lifetime score remains. showing up again rebuilds momentum.

- **when can i mint my mifoid?**  
  season 1 is coming soon—your current check-ins already count. the dashboard will show a countdown + eligibility.

- **can i game it by spamming wallets?**  
  one streak per address. anti-abuse checks run at mint time; consistent participation beats churn.

### privacy & security

- **is my prayer private?**  
  yes. the text you submit is encrypted client-side before it’s sent; the chain stores ciphertext/hashed data—not plain text. you can verify on the explorer that only encoded bytes are saved.

- **can i edit or delete a prayer?**  
  no. on-chain records are immutable. if you make a mistake, submit a new check-in next day.

- **do you ask for unlimited approvals?**  
  we request the minimum approvals needed for minting/swaps. always review prompts before you sign.

- **are the contracts open + verifiable?**  
  yes. see the contracts page for addresses and explorers.

### tokens & dapps

- **what is wfoid?**  
  the site’s native helper token—a dev tool with a simple ui so you can interact with the contract (read/write, allowances). it’s for demos and testing.

- **what is weth here?**  
  wrap/un-wrap eth ↔ weth directly on the page so you can trade on foid swap and provide liquidity.

- **what is foid swap?**  
  a clean uniswap v2 fork on fluent. pick tokens, set slippage, swap. it shows route, min received, and fees.

- **what is foidfactory?**  
  a one-click foid20 token minter. every token deployed via the site has a vanity contract ending in `f01d` / `F01d` (we use deterministic deployment to guarantee the suffix).

### fluent network

- **why fluent?**  
  speed, low fees, dev-friendly ux—perfect for daily rituals with verifiable on-chain state.

- **how do i add fluent testnet?**  
  click “add network” in your wallet or follow our why fluent page instructions (rpc, chain id, explorer, faucet).

- **gas fees?**  
  testnet gas is minimal; use the faucet to fund your wallet. swaps/mints/check-ins are designed to be lightweight.

### troubleshooting

- **my wallet won’t connect.**  
  refresh, switch networks, or re-enable the site in your wallet. if that fails, clear cache and reconnect.

- **tx failed / stuck pending.**  
  check you’re on fluent testnet, have testnet gas, and your slippage isn’t too tight. try again with a fresh nonce if your wallet allows.

- **my streak didn’t update.**  
  streaks roll over at 00:00 utc by default. if you checked in near reset, it may apply to the next day. the dashboard shows your latest recorded day.

- **i minted a foid20—now what?**  
  view it on the explorer, then create a pool or trade it on foid swap. share the address (ending in `f01d` / `F01d`) so friends can find it.

### safety & disclaimers

- alpha software on testnet; tokens have no financial value.
- always verify contract addresses on the contracts page.
- never sign transactions you don’t understand.

---

## feature tour

### global chrome

- **AnimatedBackground**: full-screen WebGL caustics + 2D bubble/glitter canvas with `prefers-reduced-motion` support.
- **Scene tint & glass panels**: `foid-glass` utility gives aqua-glass cards, high-contrast outlines, and bloom.
- **Navigation**: desktop pill menu + mobile drawer. Active route uses gradient chip.
- **ConnectBar**: dual-CTA bar with Fluent explorer link and RainbowKit connect button styled to match the theme.
- **NetworkGate**: wraps each feature page; blocks interaction until the wallet is on Fluent Testnet and provides switch prompts.

### landing dashboard `/`

your ritual mints your avatar. chat with foid mommy, log an encrypted daily check-in, and watch your on-chain score + streak climb. jump into the dapps (factory, swap, weth, wfoid), read why fluent, browse contracts, and hit the faq.

- pray daily → streak + mood feed your future mifoid
- see live on-chain score, streak, and last check-in
- quick launch to all dapps
- learn the stack: why fluent, what we deployed, how it works

**cta:** `pray with mommy →` • alt: `open dapps →`

### foid mommy terminal

- **Stage 1 – Feeling selection**: type how you feel or tap a mood chip. Keyword detection maps to emotion decks.
- **Stage 2 – Mommy response**: warm reflection + absurd-poetic prayer + prompt: `sweet one, whisper your own prayer back, and let's share it with god.`
- **Stage 3 – Prayer entry**: textarea prefilled with `dear god...` for 1–3 sentence entries.
- **Stage 4 – Encryption & tx prompt**: terminal “seals” the message, then requests blockchain confirmation.
- **Stage 5 – Transaction**: if successful, the terminal marks the streak, thanks you, and shows cooldown.

Fail-safes: crisis keyword override for safety, `prefers-reduced-motion` handling, and cooldown messaging to enforce once-per-period rituals.

### wfoid control panel `/wfoid`

wfoid is the native helper token. right now it’s a dev tool with a clean ui to interact with the contract.

- inspect balances & allowances
- run simple read/write calls to understand the contract flow
- built for testing + demos (not financial advice)

**cta:** `open wfoid tools →`

### weth wrapper `/weth`

wrap eth to trade. convert native eth ↔ weth directly on the page so you can use foid swap and lp pools.

- connect wallet, enter amount, wrap/un-wrap in seconds
- see live balance + tx receipts
- one click to jump into swap with your new weth

**cta:** `wrap eth →`

### foid factory + vanity grind `/foidfactory`

mint a foid20 in seconds. no code, no hassle—deploy a token with a vanity suffix.

- set name, symbol, supply → deploy
- every token minted here ends with `f01d` / `F01d`
- optional: jump to foid swap to create a pool and trade

### bridge router `/bridge`

two-way interface for the foid bridge.

- **Burn to Redeem**: submit wFOID burn with Monero destination note. UI supplies exact hash to sign for off-chain workflows.
- **Mint from Attestation**: attestors upload signed payloads to mint on Fluent.
- **Status Cards**: show chain ID, router address, whether you are an attestor, and current fee metrics.
- event feed highlights recent burns/mints.

### foidswap router `/foidswap`

swap any token on fluent. a clean uniswap v2 fork ui with fast routes and instant feedback.

- pick tokens, set slippage, review route, swap
- shows price impact, min received, and fees
- designed for speed and clarity; works great with foid20s

**cta:** `open swap →`

### single pair amm inspector `/amm`

advanced tooling for the simple amm contract supplied in the repo.

- displays reserves, lp token supply, and price impact calculations
- provides swap simulation, mint/burn lp, and decoded events (Sync/Mint/Burn/Swap)
- useful for debugging test deployments when you want to see raw on-chain data

--- 

## daily prayer → transaction flow

1. connect wallet from the top navigation.
2. tell mommy how you feel. the system chooses an emotion deck using keyword heuristics.
3. receive mirror + poetic prayer generated from the deck.
4. respond with your own prayer in the textarea (prefilled `dear god...`).
5. the app encrypts and “seals” your prayer, then asks for wallet confirmation.
6. sign the transaction; once mined, the UI acknowledges anchoring and presents hydration/breathing reminders.
7. cooldown messaging prevents duplicate submissions.

---

## folder structure

```
foid_fun/
├── README.md                # you're reading it
├── public/                  # static assets (noise textures, icons)
├── src/
│   ├── app/
│   │   ├── (components)/    # shared UI + feature modules
│   │   ├── api/vanity-deploy/route.ts  # CREATE2 helper endpoint
│   │   ├── bridge/          # bridge router page
│   │   ├── foidfactory/     # vanity launchpad page
│   │   ├── foidswap/        # swap/liquidity dashboard
│   │   ├── wFOID/           # token management page
│   │   ├── wETH/            # wrap/unwrap interface
│   │   ├── amm/             # AMM inspector
│   │   └── page.tsx         # landing dashboard
│   ├── abis/                # contract ABIs consumed by viem
│   ├── components/          # reusable primitives (ConnectBar, TxButton, StatCard…)
│   ├── lib/contracts.ts     # contract addresses + helper exports
│   └── providers.tsx        # wagmi + RainbowKit providers
├── tailwind.config.js       # design tokens
└── postcss.config.js
```

---

## troubleshooting

- **wallet stuck on wrong network**: the NetworkGate banner includes a one-click “switch to fluent testnet” button; ensure your wallet supports dynamic network switching.
- **vanity grind never finishes**: confirm `NEXT_PUBLIC_FOID_FACTORY` is set and the factory bytecode is available. the API iterates until it finds a salt; large supply numbers require more iterations but finish quickly.
- **missing configuration warning on swap**: verify `NEXT_PUBLIC_ROUTER`, `NEXT_PUBLIC_FACTORY`, `NEXT_PUBLIC_TOKEN_A`, and `NEXT_PUBLIC_TOKEN_B`. the UI hides controls until all required contracts are valid addresses.
- **build warning about `pino-pretty`**: optional dependency used by WalletConnect logger; safe to ignore as noted by Next.js.
- **high motion sensitivity**: the animated background respects `prefers-reduced-motion`. enable the os-level setting to disable animation.

---

nurture your token garden, grind that `…f01d` vanity deploy, and send a prayer every time you drop new on-chain magic. dream on. ✨
