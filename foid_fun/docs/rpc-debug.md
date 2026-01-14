# RPC Debugging

This repo includes a worker and a diagnostics script that can hit the Fluent
testnet RPC. If `cast` hangs, force a deterministic timeout so failures are
obvious and quick.

Cast timeout options
- Use the flag: `--rpc-timeout <seconds>`
- Or set env: `ETH_RPC_TIMEOUT=<seconds>`

Smoke commands
```bash
# Prints chain id quickly or fails fast with a timeout error.
cast chain-id --rpc-url https://rpc.testnet.fluent.xyz/ --rpc-timeout 10
```

Blockscout log query (strict timeouts)
```bash
curl --max-time 10 --connect-timeout 5 \
  "https://testnet.fluentscan.xyz/api?module=logs&action=getLogs&address=0xE41B2D418C09Ea928E4F657ED2438f5D01472105&fromBlock=0&toBlock=99999999"
```

OS-level timeout + cast
```bash
# Linux (timeout) or macOS with coreutils (gtimeout)
timeout 12s cast chain-id --rpc-url https://rpc.testnet.fluent.xyz/ --rpc-timeout 10
```

Expected output (example)
```
20994
```

If the RPC is slow or unresponsive, `cast` should exit with a timeout error
within the specified number of seconds.
