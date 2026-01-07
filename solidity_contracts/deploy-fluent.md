# Deploy on Fluent testnet

## Setup env
```sh
cd solidity_contracts
cp .env.example .env
$EDITOR .env
set -a
source .env
set +a
export RPC="$FLUENT_RPC_URL"
```

## Build
```sh
forge clean && forge build
```

## Deploy VotingV2
```sh
forge script script/DeployLoreboardVotingV2.s.sol:DeployLoreboardVotingV2 \
  --rpc-url "$RPC" \
  --broadcast
```

Update `.env` with the printed `LoreboardVotingV2` address as `VOTING_V2_ADDRESS`.

## Deploy Board
```sh
forge script script/DeployLoreboardBoardV1.s.sol:DeployLoreboardBoardV1 \
  --rpc-url "$RPC" \
  --broadcast
```

## Verify board admin
```sh
cast call --rpc-url "$RPC" $VOTING_V2_ADDRESS "boardAdmin()(address)"
```
