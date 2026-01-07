# Deploy LoreboardBoardV1 (Fluent testnet)

## Prereqs
- `OPERATOR_PK` set in `solidity_contracts/.env.local`
- RPC set via `NEXT_PUBLIC_FLUENT_RPC` or `FLUENT_RPC_URL`

## Commands
```sh
cd solidity_contracts
cp .env.local.example .env.local

# edit .env.local with real values
$EDITOR .env.local

# load env vars from .env.local
set -a
source .env.local
set +a

# choose RPC (prefers NEXT_PUBLIC_FLUENT_RPC)
export RPC="${NEXT_PUBLIC_FLUENT_RPC:-$FLUENT_RPC_URL}"

forge build

forge script script/DeployLoreboardBoardV1.s.sol \
  --rpc-url "$RPC" \
  --broadcast
```

## Post-deploy
```sh
cast send <VotingV2> "setBoardAdmin(address)" <BoardAddress> \
  --private-key $OPERATOR_PK \
  --rpc-url $RPC
```

## Sanity check
```sh
cast call <VotingV2> "boardAdmin()" --rpc-url $RPC
```
