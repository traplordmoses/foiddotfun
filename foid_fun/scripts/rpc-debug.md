# RPC Debugging (Fluent Testnet)

These examples use raw JSON-RPC (no cast) with strict timeouts to avoid hanging.

Set the RPC endpoint if needed:

```sh
RPC_URL="https://rpc.testnet.fluent.xyz/"
```

## eth_chainId

```sh
curl -sS --connect-timeout 5 --max-time 10 \
  -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}' \
  "$RPC_URL"
```

## eth_getCode at a specific block

```sh
ADDRESS="0xE41B2D418C09Ea928E4F657ED2438f5D01472105"
BLOCK_TAG="0xF170E0" # hex block number
curl -sS --connect-timeout 5 --max-time 10 \
  -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","id":1,"method":"eth_getCode","params":["'"$ADDRESS"'","'"$BLOCK_TAG"'"]}' \
  "$RPC_URL"
```

## eth_getLogs for a small range

```sh
ADDRESS="0x4A777d8650b3FA2419377F4ffeF0EF8007151536"
FROM_BLOCK="0xF17000"
TO_BLOCK="0xF17800"
curl -sS --connect-timeout 5 --max-time 15 \
  -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","id":1,"method":"eth_getLogs","params":[{"address":"'"$ADDRESS"'","fromBlock":"'"$FROM_BLOCK"'","toBlock":"'"$TO_BLOCK"'"}]}' \
  "$RPC_URL"
```
