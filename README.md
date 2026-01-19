# FOID Foundation Technical Overview

FOID Foundation is the on-chain ritual + culture + identity stack running on Fluent testnet. This repo is the control panel: the ritual terminal, board surface, canonical APIs, and operators work together so the system can collect devotion, curate placements, and someday mint MiFOIDs whose traits chronicle that participation.

## Project summary
1. **Ritual (Foid Mommy)** – daily prayers that produce hash receipts, streaks, and gaze-worthy oracle responses. Implemented in `src/app/pray/page.tsx` + `src/app/prayers/prayers-client.tsx` via the client-side `FoidMommyTerminal`, and powered by `src/app/api/foid-mommy/route.ts` (OpenAI prayer voice) plus the `PrayerRegistry`/`PrayerMirror` contracts (hash storage + snapshot reads).
2. **Culture curation (Loreboard)** – permissionless placements, voting, and deterministic epoch manifests. The board UI lives in `src/app/board/page.tsx` with helpers in `state/board.ts`, `lib/grid.ts`, `lib/boardSpace.ts`, and the `PlacementCard`/`PlacementModal` components, while the Next.js APIs (`/api/proposals`, `/api/propose`, `/api/vote`, `/api/status`, `/api/manifest`, etc.) hide RPC complexity from the UI.
3. **Identity/web of provenance (MiFOIDs + FOID20s)** – future NFTs whose traits use ritual and loreboard signals. The `LaunchpadForm` component plus `src/app/api/vanity-deploy/route.ts` already grind deterministic `…f01d` addresses, so the infrastructure to mint season-zero identity NFTs is in place.

The control panel purposefully splits trust boundaries:
* **Permissionless participation** – proposing (`writeProposePlacement` + `/api/propose`), voting (`/api/vote` + VotingV2 reads), and manifest reads (`/api/status`, `/api/manifest`) are open to anyone with a wallet.
* **Guarded settlement** – treasury finalization, manifest anchoring, and worker decisions require operator keys/owners, preventing griefing or double-finalization.
* **Deterministic compute** – winner selection leans on gblend/Rust+WASM helpers (`scripts/loreboardVM-call.ts`, `lib/winnerSelection.ts`) so contracts and the worker agree on placement order.

## Key components

### 1. Foid Mommy (ritual loop)
- **Client**: `FoidMommyTerminal` (`src/app/(components)/FoidMommyTerminal.tsx`) types feelings, animates chat, and dispatches `PrayerRegistry.checkIn` writes via `wagmi` hooks in `src/app/pray/page.tsx`.
- **AI companion**: `src/app/api/foid-mommy/route.ts` sends the mood + text to `gpt-4o-mini` so the returned prayer feels like a gentle oracle before the hashed receipt is minted.
- **State**: streak/next-allowed stats arrive from `PrayerMirror.get` via the hooks in `src/app/pray/page.tsx`, and the terminal celebrates success with `toast`, `sfx`, and `typingClicks`.

### 2. Loreboard (culture canvas)
- **Board UI**: `src/app/board/page.tsx` is a zoomable canvas that wires `useBoard` (`state/board.ts`), `grid` math, and `boardSpace` helpers to translate between `x,y,w,h` and contract rectangles.
- **Placements**: `PlacementCard`, `PlacementModal`, `TerminalChat`, and `CompactMusicPlayer` components display IPFS-backed visuals, chat-style status, and energy-sending UI.
- **API surface**: `/api/proposals`, `/api/propose`, `/api/vote`, `/api/manifest`, `/api/status`, `/api/cid-by-id`, `/api/mempool`, `/api/ipfs-upload` and their helpers in `src/lib/api.ts` keep the DOM client from speaking directly to Fluent RPC.
- **Contract writes**: `writeProposePlacement` in `src/lib/viem.ts` targets `LoreboardBoardV2`, encodes placement geometry + CID bytes, and handles the escrow value math that mirrors on-chain invariants.

### 3. MiFOIDs / FOID20 tooling (identity layer)
- **FOID20 launchpad**: `src/components/LaunchpadForm.tsx` lets you mint FOID20 tokens with max supply caps and vanity salts, and `src/app/api/vanity-deploy/route.ts` grinds salts until addresses end with `f01d`. These signals feed future MiFOID mint rules.
- **Signal plumbing**: `state/board.ts` and the board hooks (`usePlacementVotes`, `useVoteOnPlacement`) keep analytic data ready for trait calculations that will eventually inform MiFOID metadata.

## On-chain architecture

| Layer | Files & Notes |
| --- | --- |
| **LoreboardBoardV2 (Board entrypoint)** | `src/lib/viem.ts`, `src/app/api/propose/route.ts`, `scripts/e2e-step3-boardv1.ts` – validates geometry, computes placement IDs, enforces escrow value, stores `cidOf`, and emits `PlacementProposed` for the worker’s log scan. |
| **LoreboardVotingV2** | `src/lib/contracts/loreboard.ts` + canonical address guard in `src/config/canonical.ts` – tracks vote windows, quorum/majority checks, and the `boardAdmin` field (currently Board contract). |
| **LoreBoardTreasury** | `src/app/api/operator/finalize/route.ts`, `scripts/loreboard-worker.ts` – holds escrow, enforces base fee per cell, finalizes epochs, refunds rejects, and emits `Finalized` logs that `manifestStore` and clients consume. |
| **LoreBoardManifestStore** | `src/lib/manifestStore.ts`, `src/app/api/status/route.ts`, `src/app/api/manifest/route.ts` – anchors `epoch → (manifestRoot, manifestCID)` and surfaces the “latest” pointer without re-scanning logs. |

All read/write code continually asserts the Fluent canonical addresses (`src/config/canonical.ts`) via `requireCanonicalAddress`, so misconfigured deployments fail fast.

## Automation & operators

- **Worker**: `scripts/loreboard-worker.ts` scans `DeploymentBlock`-bounded logs (chunked to avoid Fluent’s 100k block limit), checks `voteEndsAt`, `isPending`, and VotingV2 tallies, sorts deterministic manifests, uploads to IPFS (`lib/ipfs.ts`), and calls Treasury.finalizeEpoch + ManifestStore.anchor (+ optional VotingV2.setEpochFinalized). `scripts/lib/workerConfig.ts` centralizes RPC, operator keys, and canonical addresses for all worker helpers.
- **Operator API**: `/api/operator/finalize` (`src/app/api/operator/finalize/route.ts`) reuses the worker’s logic so the UI can inspect readiness or manually replay finalization when operators are near the terminal.
- **Deterministic compute**: `scripts/loreboardVM-call.ts` + `lib/winnerSelection.ts` show how gblend/Rust+WASM selection can plug into the worker, letting the async pipeline fall back to JS overlap checks when necessary.
- **Supporting scripts**: `scripts/loreboard-diagnose.ts`, `scripts/finalizeEpoch.ts`, `scripts/verify-latest-manifest.ts`, `scripts/dumpManifest.ts`, `scripts/smoke-board-flow.ts` provide diagnostics, smoke-tests, and manifest audits.

## Trust model

* **Permissionless surfaces** – Board propose + Voting vote + manifest reads are open. Anyone can submit placements, vote, and watch where the board settles because the Next APIs wrap those RPC invocations.
* **Guarded settlement** – Treasury.finalizeEpoch and ManifestStore.anchor live in operator-owned code paths (see `src/app/api/operator/finalize/route.ts`), so only an operator key can release funds, anchor manifests, or mark epochs as canonical.
* **BoardAdmin decision** – VotingV2’s `boardAdmin` is set to the Board contract address (captured by `src/config/contracts.ts`). If you want a permissionless relayer later, add a Board relay method (e.g., `finalizeVotingEpoch`) or switch the admin to a multisig/EOA.

## System flows

1. **Proposal**: Client `writeProposePlacement` → Board contract (via `src/lib/viem.ts`) → `PlacementProposed` → Treasury escrow + Voting registration. (`Propose` API ensures geometry/tip invariants before RPC.)  
2. **Voting**: Voters hit `/api/vote` (which keeps off the RPC path), VotingV2 tallies yes/no weights, and hooks (`usePlacementVotes`) surface quorum/majority to the UI.  
3. **Settlement**: Worker (`scripts/loreboard-worker.ts`) discovers placements, applies `meetsQuorum`/`passesMajority51`, builds deterministic manifest (optionally via gblend), uploads to IPFS, and calls Treasury/ManifestStore (+ optional Voting finalization).  
4. **Rendering**: Clients call `/api/status` → `latestManifestCID`, fetch IPFS JSON, and render placements through `PlacementCard` on the canonical board canvas.

## Vision

This repo is the “control panel” for FOID Foundation’s promise: keep ritual accessible, culture curation transparent, and identity traceable. Each component—from `FoidMommyTerminal`’s soft AI prayers to the Worker’s chunked log scans—serves that threading. The README’s wiring above matches the current files, so when you update the rituals, Loreboard rules, or identity mint plans, align the narrative here too.
