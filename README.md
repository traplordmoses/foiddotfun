# foid.fun control panel

foid.fun is the control panel for FOID Foundation’s altar: it pairs the daily ritual terminal with the loreboard canvas, canonical APIs, and the worker/automation that anchors epochs on Fluent testnet. The site, Next.js APIs, scripts, and Rust-backed VM helpers together keep prayer hashes private, culture contributions composable, and identity provenance traceable.

## Universe & lore

- **FOIDs** are reclaimed android avatars—fictional shells anyone can pilot by holding a MiFOID. In this universe, “foids can’t vote, but foid owners do,” so the humans behind the wallets become the governance agents.
- **FOID Foundation** is the curator/steward of ritual and canon: the museum/cult that keeps the loreboard honest, the prayer terminal protected, and governance experiments rooted in trust while staying open to permissionless entry.
- The tagline “culture, ritual, identity on chain” still guides the work: ceremonies happen in Foid Mommy, culture is shaped in the loreboard, and membership is surfaced through MiFOID traits.

## Product stack

### 1. Ritual — Foid Mommy Terminal

- The terminal (see `src/app/pray/page.tsx` + `src/app/(components)/FoidMommyTerminal.tsx`) lets you type how you feel, watch the animated terminal, and send a prayer once every 24 hours.
- Prayers are hashed locally (`keccak256`) and submitted through `PrayerRegistry.checkIn`, while `PrayerMirror` reads deliver streak/total stats. The UI pulls these vaults via `wagmi`/`viem` hooks, shows the next cooldown window, and spawns `FoidMommyTerminal` chat plus audio cues (`useAeroSounds`).
- An OpenAI-backed API (`src/app/api/foid-mommy/route.ts`) crafts the oracle response so the ritual stays soft, empathetic, and grounded; only the hash is anchored on chain, keeping raw text private.

### 2. Culture canvas — Loreboard.app

- The board page (`src/app/board/page.tsx`) is a zoomable canvas with terminal chat, music player, pending queue, and the `PlacementCard`/`PlacementModal` components; it wires `useEpochCountdown`, `useLatestManifestFromChain`, `usePlacementVotes`, and `useVoteOnPlacement` to keep community insights synced.
- Placement geometry is normalized by `src/lib/grid.ts` and `src/lib/boardSpace.ts`, while the zustand store (`src/state/board.ts`) keeps pending tiles, tips, and local storage so you can drop, size, and bid before writing on chain.
- API helpers (`src/lib/api.ts`) power Next endpoints such as `/api/propose`, `/api/vote`, `/api/status`, `/api/manifest`, `/api/proposals`, `/api/place`, `/api/mempool`, `/api/ipfs-upload`, and `/api/operator/finalize`, shielding the UI from raw RPC chatter while mirroring on-chain invariants (grid math, base-fee per cell, escrow math, cid sizing).
- Contract writes go through `src/lib/viem.ts`’s `writeProposePlacement`, which enforces Tile=32 planes, caps max cells, and treats `bidPerCellWei` + cells the same way the Solidity entrypoint expects; Helpers like `scripts/e2e-step3-boardv1.ts`, `scripts/propose.ts`, and `scripts/smoke-board-flow.ts` mirror this flow for debugging.

### 3. Identity — MiFOIDs + FOID20 tooling

- MiFOIDs are the identity NFTs whose provenance eventually tells the story of your devotion, loreboard contributions, and governance weight. Early tooling lives in `src/components/LaunchpadForm.tsx`, which drives the FOID20 factory and mints tokens whose addresses end with `f01d`.
- Vanity salt grinding is handled by `/api/vanity-deploy` (`src/app/api/vanity-deploy/route.ts`), so the UI can preview deterministic bodies before sending transactions.
- As the ritual streaks and loreboard signals accumulate, they’ll feed MiFOID trait rules (streaks, vote history, board contributions, provenance “body count”) and later surfaces such as FoidBoardNFTs (future ERC-721 + ERC-4906) or gated identity experiences.

## Governance & on-chain architecture

- Permissionless entry lies in `LoreboardBoardV2`/`LoreboardVotingV2`: BoardV2 validate proposals (`PlacementProposed`, escrow math, cid storage) while VotingV2 tracks epochs, vote windows, quorum, and majority flags. The addresses are gated by `src/config/canonical.ts`, so misconfigurations fail fast, and all reads/writes funnel through `src/lib/viem.ts` + `src/lib/manifestStore.ts`.
- Guarded settlement lives in `LoreBoardTreasury`, `LoreBoardManifestStore`, and the worker scripts (`scripts/loreboard-worker.ts`, `scripts/operatorFinalize.ts`, `scripts/finalizeEpoch.ts`). Only the operator key can finalize epochs, anchor manifests, and refund losers. Manifest state is described by `src/lib/manifest.ts` + `src/lib/manifestStore.ts`, while `src/lib/winnerSelection.ts` shows how gblend/Rust can mirror the deterministic winner selection used by the worker.
- On-chain read helpers (`src/lib/events.ts`, `src/lib/epoch.ts`, `src/lib/manifest.ts`, `src/lib/boardSpace.ts`) feed the frontend with canonical data for `PlacementCard`, stats dashboards, and manifest rendering.

## Automation & worker flow

- `scripts/loreboard-worker.ts` is the cron-friendly pipeline: it scans logs since `NEXT_PUBLIC_LOREBOARD_DEPLOY_BLOCK`, filters placements by `voteEndsAt < now` and `isPending`, computes deterministic manifests (optionally with `scripts/loreboardVM-call.ts` calling the gblend VM at `NEXT_PUBLIC_LOREBOARD_VM_ADDRESS`/`LOREBOARD_VM_ADDRESS`), uploads JSON to IPFS, calls Treasury.finalizeEpoch + ManifestStore.anchor, and (if reachable) sets VotingV2’s epoch finalization.
- Worker helpers (`scripts/lib/workerConfig.ts`, `scripts/lib/logScan.ts`, `scripts/lib/finalize.ts`) centralize RPC, canonical addresses, epoch math, and chunked log scanning (Fluent’s 100k block cap). Supporting tooling (`scripts/loreboard-diagnose.ts`, `scripts/loreboard-rpc-smoke.ts`, `scripts/dumpManifest.ts`, `scripts/verify-latest-manifest.ts`) give operators transparency before they run `pnpm worker:finalize`.
- gblend’s Rust module sits under `blended/loreboardvm`; `scripts/loreboardVM-call.ts` demonstrates how to ping the WASM helper so the worker and UI share deterministic overlap resolution without brittle Solidity loops.
- Worker commands (`pnpm worker:sync`, `pnpm worker:finalize`, `pnpm worker:dry`, `DOTENV_CONFIG_PATH=.env.local pnpm -C foid_fun exec tsx scripts/loreboard-worker.ts run`) require `OPERATOR_KEY/PK`, canonical addresses, the epoch cadence (`NEXT_PUBLIC_EPOCH_ZERO_UNIX`, `NEXT_PUBLIC_EPOCH_SECONDS`), the Fluent RPC URL, IPFS token, and optionally `LOREBOARD_VOTING_ADMIN_PRIVATE_KEY` if boardAdmin is not callable.

## Roadmap & priorities

1. Ship loreboard finalization as a standalone product: user proposals + votes → canonical manifest → IPFS root → UI renders board. Worker automation and diagnostics already cover discovery, base fee, voting checks, manifest builds, and logging.
2. Run the Foid Mommy campaign with the terminal as a retention loop so streaks, hashes, and devotion signatures feed the loreboard narrative and MiFOID metrics.
3. Surface MiFOIDs (and later FoidBoardNFTs) as the identity layer that encodes prayers, placements, and provenance, then experiment with optional futarchy modules that let the community bet on beliefs.

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

## VSCode TypeScript

Use the workspace TypeScript version so scripts with JSON import assertions parse correctly.

1. Command Palette → “TypeScript: Select TypeScript Version” → “Use Workspace Version”
2. Command Palette → “TypeScript: Restart TS Server”

Verify:
- Command Palette → “TypeScript: Open TS Server Log” and confirm it references `node_modules/typescript/lib` in this repo, or
- Hover a TypeScript diagnostic and confirm TS version is `5.6.3`.

## Environment variables

This app is contract-address driven. See `.env.local.example` for the full list. The minimum set for the ritual + loreboard experience is:

- `NEXT_PUBLIC_RPC` and `NEXT_PUBLIC_CHAIN_ID`
- `NEXT_PUBLIC_FLUENT_RPC`
- `NEXT_PUBLIC_BLOCK_EXPLORER`
- `NEXT_PUBLIC_LOREBOARD_ADDRESS`
- `NEXT_PUBLIC_LOREBOARD_BOARD_ADDRESS` (or `LOREBOARD_BOARD_ADDRESS`)
- `NEXT_PUBLIC_LOREBOARD_VOTING_ADDRESS` (or `LOREBOARD_VOTING_ADDRESS`)
- `NEXT_PUBLIC_LOREBOARD_MANIFEST_STORE_ADDRESS`
- `NEXT_PUBLIC_LOREBOARD_DEPLOY_BLOCK`
- `NEXT_PUBLIC_EPOCH_ZERO_UNIX`
- `NEXT_PUBLIC_EPOCH_SECONDS`
- `NEXT_PUBLIC_LOREBOARD_VM_ADDRESS` (or `LOREBOARD_VM_ADDRESS` if you call the gblend VM)
- `WEB3_STORAGE_TOKEN` or `PINATA_JWT` (for IPFS uploads)
- `LOREBOARD_NFT` (optional, live NFT sync)
- `OPERATOR_KEY` or `OPERATOR_PK`
- `LOREBOARD_VOTING_ADMIN_PRIVATE_KEY` (only if VotingV2’s boardAdmin isn’t callable)

Legacy variables that powered the retired swap/factory tooling (like `NEXT_PUBLIC_FACTORY`, `NEXT_PUBLIC_ROUTER`, `NEXT_PUBLIC_TOKEN_A/B`, `NEXT_PUBLIC_WFOID`, and `NEXT_PUBLIC_REGISTRY`) remain in `.env.local.example` for historical reference but are not needed by the core ritual + loreboard loop.

## Scripts

- `npm run dev` - start local dev server
- `npm run build` - production build
- `npm start` - run production server
- `npm run lint` - lint
- `npm run test` - vitest run
- `npm run typecheck` - type checking
- `npm run demo:one` - loreboard demo flow (uses pnpm in the script)
- `DOTENV_CONFIG_PATH=.env.local pnpm -C foid_fun exec tsx scripts/loreboard-worker.ts run` - summarize + finalize the prior epoch (VotingV2 flow)
- `pnpm worker:sync` - summarize the prior epoch
- `pnpm worker:finalize` - finalize the prior epoch
- `pnpm worker:dry` - dry-run finalize without sending transactions

Worker commands:

```bash
pnpm worker:sync
pnpm worker:finalize
DOTENV_CONFIG_PATH=.env.local pnpm -C foid_fun exec tsx scripts/loreboard-worker.ts run
```

Flags:

- `DRY_RUN=1` logs actions without sending transactions.
- `SKIP_NFT_SYNC=1` disables the live NFT sync call.
- `EPOCH=<n>` or `--epoch <n>` overrides the default target epoch (`epochAt(now) - 1`).

Test plan:

```bash
pnpm -C foid_fun typecheck
pnpm -C foid_fun smoke:board
DRY_RUN=1 pnpm -C foid_fun worker:finalize
pnpm -C foid_fun worker:finalize
```

## Project layout

- `src/app` - Next.js routes and pages
- `src/components` - UI building blocks
- `src/lib` - contract helpers, utilities
- `src/abis` - contract ABIs
- `scripts` - operators, loreboard, and demo scripts

## Notes

- This is testnet software. Verify contract addresses before signing any transaction.
- Some pages are gated by contract roles; the UI hides admin actions unless your wallet has permission.
