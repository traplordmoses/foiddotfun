# Fluent Testnet Deploy (LoreboardVotingV2)

This deploy flow uses Foundry from `solidity_contracts/` and reads `OPERATOR_PK`
from your environment. It prefers `NEXT_PUBLIC_FLUENT_RPC` and falls back to
`FLUENT_RPC_URL` for the RPC endpoint.

## Required env vars

- `OPERATOR_PK` (private key, do not commit)
- `NEXT_PUBLIC_FLUENT_RPC` (preferred) or `FLUENT_RPC_URL`

Optional:

- `VOTING_POWER_SOURCE` (use an existing OnePerPlacementVotingPower address;
  if omitted, a new one is deployed)

## Commands

```bash
# from repo root
set -a
source foid_fun/.env.local
set +a

cd solidity_contracts
forge build
forge script script/DeployLoreboardVotingV2.s.sol:DeployLoreboardVotingV2 \
  --rpc-url "$NEXT_PUBLIC_FLUENT_RPC" \
  --broadcast
```

If you only have `FLUENT_RPC_URL` set, replace the `--rpc-url` value with
`"$FLUENT_RPC_URL"`.
