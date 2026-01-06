# foid.fun control panel

foid.fun is a ritual-driven on-chain game and tooling hub on Fluent testnet. The app combines a daily encrypted check-in flow ("pray with foid mommy") with token creation, swaps, and supporting dapp tools. Your streak and activity feed into the evolution of a future on-chain avatar (mifoid), while the rest of the UI makes it fast to mint, trade, and inspect contracts.

## What this project includes

- **Daily ritual terminal** to submit an encrypted check-in and track streaks.
- **Foid factory** to mint a new foid20 token with a vanity suffix.
- **Foid swap** to trade tokens and manage liquidity.
- **wFOID and wETH tools** for wrapping, balances, allowances, and basic admin actions.
- **Bridge router UI** to burn for redemption and mint from attestations.
- **AMM inspector** for debugging a single-pair AMM contract.
- **Board/Loreboard pages** for on-chain voting and manifest verification flows.

## Tech stack

- Next.js (App Router), React, TypeScript
- wagmi + viem + RainbowKit
- Tailwind CSS + custom UI components

## Quick start

1. Install dependencies (Node 20.x):

```bash
npm install
```

2. Configure environment:

```bash
cp .env.local.example .env.local
```

3. Run the dev server:

```bash
npm run dev
```

Then open `http://localhost:3000` and connect a wallet on Fluent testnet (chain ID 20994).

## Environment variables

This app is contract-address driven. See `.env.local.example` for the full list. The minimum set for most pages is:

- `NEXT_PUBLIC_RPC` and `NEXT_PUBLIC_CHAIN_ID`
- `NEXT_PUBLIC_BLOCK_EXPLORER`
- `NEXT_PUBLIC_FACTORY`, `NEXT_PUBLIC_ROUTER`
- `NEXT_PUBLIC_TOKEN_A`, `NEXT_PUBLIC_TOKEN_B`
- `NEXT_PUBLIC_WFOID`, `NEXT_PUBLIC_REGISTRY`, `NEXT_PUBLIC_BRIDGE`

Optional features (board/loreboard, AMM inspector, vanity factory, etc.) appear only when their related vars are configured.

## Scripts

- `npm run dev` - start local dev server
- `npm run build` - production build
- `npm start` - run production server
- `npm run lint` - lint
- `npm run test` - vitest run
- `npm run typecheck` - type checking
- `npm run demo:one` - loreboard demo flow (uses pnpm in the script)

## Project layout

- `src/app` - Next.js routes and pages
- `src/components` - UI building blocks
- `src/lib` - contract helpers, utilities
- `src/abis` - contract ABIs
- `scripts` - operators, loreboard, and demo scripts

## Notes

- This is testnet software. Verify contract addresses before signing any transaction.
- Some pages are gated by contract roles; the UI hides admin actions unless your wallet has permission.
