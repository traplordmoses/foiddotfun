# Loreboard worker sanity checklist

Prereqs:
- Set `NEXT_PUBLIC_FLUENT_RPC` (or `FLUENT_RPC_URL`), `NEXT_PUBLIC_LOREBOARD_ADDRESS`, `NEXT_PUBLIC_LOREBOARD_BOARD_ADDRESS`, `NEXT_PUBLIC_LOREBOARD_VOTING_ADDRESS`.
- Set `OPERATOR_KEY` for finalize (and optional `LOREBOARD_VOTING_ADMIN_PRIVATE_KEY` if needed).

Commands:
- Sync proposals for an epoch:
  - `DOTENV_CONFIG_PATH=.env.local pnpm -C foid_fun exec tsx scripts/loreboard-worker.ts sync --epoch N`
  - Expect: `[logs] PlacementProposed board=0xE41B...` and a summary of proposals.
- Finalize voting for an epoch:
  - `DOTENV_CONFIG_PATH=.env.local pnpm -C foid_fun exec tsx scripts/loreboard-worker.ts finalize --epoch N`
  - Expect: `[finalize] setEpochFinalized direct tx: 0x...` (or a skip if already finalized).

Optional onchain check:
- `cast call 0xEbf065A7ca3917BB5e669982e8C6954cC27A7075 "epochs(uint256)(bool)" N`
- Expect: `true` for finalized epochs.
