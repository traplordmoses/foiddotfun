# scripts/mint_with_attestation.sh
#!/usr/bin/env bash
set -euo pipefail

# Load .env (PRIVATE_KEY, ATTESTOR_PRIVKEY, FLUENT_RPC, CHAIN_ID, ROUTER, REGISTRY)
set -a; source "$(dirname "$0")/../.env"; set +a

DEST_DEFAULT=$(cast wallet address --private-key "$PRIVATE_KEY")
DEST="${1:-$DEST_DEFAULT}"
AMOUNT="${2:-1000000000000000000}"  # 1e18

# Validate dest
if ! [[ "$DEST" =~ ^0x[0-9a-fA-F]{40}$ ]]; then
  echo "Error: DEST must be 0x + 40 hex chars. Got: $DEST"; exit 1
fi

ATTESTOR_ADDR=$(cast wallet address --private-key "$ATTESTOR_PRIVKEY")
echo "ATTESTOR_ADDR = $ATTESTOR_ADDR"
IN_REG=$(cast call "$REGISTRY" "isAttestor(address)(bool)" "$ATTESTOR_ADDR" --rpc-url "$FLUENT_RPC")
echo "isAttestor(ATTESTOR_ADDR) = $IN_REG"
[ "$IN_REG" = "true" ] || { echo "Attestor not registered. Fix first."; exit 1; }

ROUTER_CHAIN_ID=$(cast call "$ROUTER" "chainId()(uint256)" --rpc-url "$FLUENT_RPC")
echo "ROUTER.chainId = $ROUTER_CHAIN_ID ; ENV CHAIN_ID = $CHAIN_ID"

LOCK_ID=0x$(openssl rand -hex 32)
MONERO_TX=0x$(openssl rand -hex 32)
EXPIRY=$(($(date +%s) + 3600))   # 1 hour

echo "LOCK_ID   = $LOCK_ID"
echo "MONERO_TX = $MONERO_TX"
echo "DEST      = $DEST"
echo "AMOUNT    = $AMOUNT"
echo "EXPIRY    = $EXPIRY"

# structHash = keccak256(abi.encode(
#   MINT_TYPEHASH, lockId, moneroTx, dest, amount, expiry, router, chainId))
MINT_TYPEHASH=$(cast keccak "BridgeMint(bytes32,bytes32,address,uint256,uint256,address,uint256)")
ENCODED=$(cast abi-encode \
  "f(bytes32,bytes32,bytes32,address,uint256,uint256,address,uint256)" \
  "$MINT_TYPEHASH" "$LOCK_ID" "$MONERO_TX" "$DEST" "$AMOUNT" "$EXPIRY" "$ROUTER" "$CHAIN_ID")

STRUCT_HASH=$(cast keccak "$ENCODED")
echo "STRUCT_HASH = $STRUCT_HASH"

# ❌ REMOVE the manual EIP-191 prefix section
# PREFIX_HEX=$(printf '\x19Ethereum Signed Message:\n32' | xxd -p -c 1000)
# DIGEST=0x$(cast keccak 0x${PREFIX_HEX}${STRUCT_HASH#0x})
# echo "DIGEST      = $DIGEST"

# ✅ Sign the 32-byte struct hash directly.
# On older cast, `wallet sign` applies the Ethereum prefix internally,
# which will then match the contract’s `toEthSignedMessageHash(...)`.
SIG=$(cast wallet sign --private-key "$ATTESTOR_PRIVKEY" "$STRUCT_HASH")
echo "SIG = $SIG"

# Call with tuple in parentheses
cast send "$ROUTER" \
  "mintWithAttestation((bytes32,bytes32,address,uint256,uint256),bytes)" \
  "($LOCK_ID,$MONERO_TX,$DEST,$AMOUNT,$EXPIRY)" "$SIG" \
  --private-key "$PRIVATE_KEY" \
  --rpc-url "$FLUENT_RPC"