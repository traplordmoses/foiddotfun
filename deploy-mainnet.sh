#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
#  FOID Foundation — Mainnet Deployment Script
#  Chain: Fluent Mainnet (ID 25363)
#  RPC:   https://rpc.fluent.xyz
#
#  Deploys 6 contracts in order:
#    1. PrayerMirror      (Solidity — EVM read layer for prayer data)
#    2. PrayerRegistry    (Rust/rWASM — prayer check-in logic)
#    3. Wire Mirror ↔ Registry
#    4. FoidMultisig      (Solidity — 2-of-3 governance wallet)
#    5. V1 Core           (Solidity — PrayerTiers, StreakVotingPower, FoidTrest, Swipe)
#    6. Loreboard + NFT   (Solidity — governance board + 1/1 live NFT)
#    7. Ownership transfer to multisig
#
#  Prerequisites:
#    - gblend CLI installed (for rWASM deploy)
#    - Docker running (gblend uses Docker to cross-compile Rust → WASM)
#    - forge / cast (Foundry) installed
#    - Deployer wallet funded with ~0.01 ETH on Fluent mainnet
#
#  Usage:
#    1. Copy .env.mainnet.example to .env.mainnet
#    2. Fill in your private key and signer addresses
#    3. Run: ./deploy-mainnet.sh
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONTRACTS_DIR="$SCRIPT_DIR/solidity_contracts"
PRAYER_REG_DIR="$SCRIPT_DIR/prayer-registry"

# Mainnet config
RPC="https://rpc.fluent.xyz"
CHAIN_ID=25363
EXPLORER="https://fluentscan.xyz"

# ── Load environment ──
if [ -f "$SCRIPT_DIR/.env.mainnet" ]; then
    echo "Loading .env.mainnet..."
    set -a
    source "$SCRIPT_DIR/.env.mainnet"
    set +a
else
    echo "ERROR: .env.mainnet not found. Copy .env.mainnet.example and fill in values."
    exit 1
fi

# ── Validate required vars ──
REQUIRED_VARS=(
    "OPERATOR_PK"
    "MULTISIG_SIGNER_1"
    "MULTISIG_SIGNER_2"
    "MULTISIG_SIGNER_3"
    "FEE_RECIPIENT"
)

for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var:-}" ]; then
        echo "ERROR: $var is not set in .env.mainnet"
        exit 1
    fi
done

OPERATOR_ADDR=$(cast wallet address --private-key "$OPERATOR_PK")
echo ""
echo "============================================"
echo "  FOID Mainnet Deployment"
echo "  Chain:    Fluent Mainnet ($CHAIN_ID)"
echo "  RPC:      $RPC"
echo "  Deployer: $OPERATOR_ADDR"
echo "  Fee To:   $FEE_RECIPIENT"
echo "============================================"
echo ""

# Check deployer balance
BALANCE=$(cast balance "$OPERATOR_ADDR" --rpc-url "$RPC" 2>/dev/null || echo "0")
echo "Deployer balance: $BALANCE wei"
echo ""

# ── Helper: save address to state file ──
STATE_FILE="$SCRIPT_DIR/.deploy-mainnet-state"
touch "$STATE_FILE"

save_addr() {
    local key="$1" val="$2"
    # Remove old entry if exists
    grep -v "^$key=" "$STATE_FILE" > "$STATE_FILE.tmp" 2>/dev/null || true
    echo "$key=$val" >> "$STATE_FILE.tmp"
    mv "$STATE_FILE.tmp" "$STATE_FILE"
    echo "  Saved $key=$val"
}

load_addr() {
    local key="$1"
    grep "^$key=" "$STATE_FILE" 2>/dev/null | cut -d= -f2 || echo ""
}

# ── Helper: prompt to continue ──
confirm_step() {
    local step="$1"
    echo ""
    echo "──────────────────────────────────────────"
    echo "  STEP $step"
    echo "──────────────────────────────────────────"
    read -p "  Press ENTER to continue (or Ctrl-C to abort)... "
}

# ======================================================================
#  STEP 1: Deploy PrayerMirror (Solidity)
# ======================================================================
confirm_step "1/7 — Deploy PrayerMirror"

EXISTING_MIRROR=$(load_addr "PRAYER_MIRROR")
if [ -n "$EXISTING_MIRROR" ]; then
    echo "  Already deployed: $EXISTING_MIRROR"
    echo "  (Delete .deploy-mainnet-state to redeploy)"
    MIRROR="$EXISTING_MIRROR"
else
    echo "  Deploying PrayerMirror with deployer as temporary registry..."
    echo "  (Registry will be updated after PrayerRegistry deploys)"

    cd "$CONTRACTS_DIR"
    RESULT=$(forge create src/PrayerMirror.sol:PrayerMirror \
        --rpc-url "$RPC" \
        --private-key "$OPERATOR_PK" \
        --constructor-args "$OPERATOR_ADDR" \
        --json 2>&1)

    MIRROR=$(echo "$RESULT" | jq -r '.deployedTo // empty')
    if [ -z "$MIRROR" ]; then
        echo "  ERROR: PrayerMirror deployment failed"
        echo "$RESULT"
        exit 1
    fi

    save_addr "PRAYER_MIRROR" "$MIRROR"
    echo "  PrayerMirror deployed: $MIRROR"
fi

# ======================================================================
#  STEP 2: Deploy PrayerRegistry (rWASM)
# ======================================================================
confirm_step "2/7 — Deploy PrayerRegistry (rWASM)"

EXISTING_REG=$(load_addr "PRAYER_REGISTRY")
if [ -n "$EXISTING_REG" ]; then
    echo "  Already deployed: $EXISTING_REG"
    REG="$EXISTING_REG"
else
    echo "  Building rWASM PrayerRegistry (requires Docker)..."
    cd "$PRAYER_REG_DIR"

    # Build the WASM binary via Docker cross-compilation
    gblend build
    if [ $? -ne 0 ]; then
        echo "  ERROR: gblend build failed. Is Docker running?"
        echo "  Start Docker Desktop, then re-run this script."
        exit 1
    fi

    # Find the .wasm output
    WASM_FILE=$(find "$PRAYER_REG_DIR/out" -name "prayer-registry.wasm" | head -1)
    if [ -z "$WASM_FILE" ]; then
        WASM_FILE=$(find "$PRAYER_REG_DIR/out" -name "*.wasm" | head -1)
    fi
    if [ -z "$WASM_FILE" ]; then
        echo "  ERROR: Could not find compiled .wasm file in $PRAYER_REG_DIR/out/"
        echo "  Check gblend build output above."
        exit 1
    fi
    echo "  Using WASM: $WASM_FILE"

    echo "  Deploying PrayerRegistry to Fluent mainnet..."
    DEPLOY_OUTPUT=$(gblend create "$WASM_FILE" \
        --wasm \
        --rpc-url "$RPC" \
        --private-key "$OPERATOR_PK" \
        --broadcast \
        --constructor-args "$MIRROR" 2>&1)

    echo "$DEPLOY_OUTPUT"

    # Try to extract the deployed address
    REG=$(echo "$DEPLOY_OUTPUT" | grep -oE '0x[0-9a-fA-F]{40}' | tail -1)
    if [ -z "$REG" ]; then
        echo ""
        echo "  Could not auto-extract registry address from output."
        read -p "  Paste the PrayerRegistry address manually: " REG
    fi

    save_addr "PRAYER_REGISTRY" "$REG"
    echo "  PrayerRegistry deployed: $REG"
fi

# ======================================================================
#  STEP 3: Wire PrayerMirror ↔ PrayerRegistry
# ======================================================================
confirm_step "3/7 — Wire Mirror ↔ Registry"

echo "  Getting Registry's EVM alias..."
REG_ALIAS=$(cast call "$REG" 'evmAlias()(address)' --rpc-url "$RPC" 2>/dev/null || echo "")

if [ -n "$REG_ALIAS" ] && [ "$REG_ALIAS" != "0x0000000000000000000000000000000000000000" ]; then
    echo "  Registry alias: $REG_ALIAS"
    echo "  Authorizing both in PrayerMirror..."
    cast send "$MIRROR" 'authorizeBoth(address,address)' "$REG_ALIAS" "$REG" \
        --rpc-url "$RPC" --private-key "$OPERATOR_PK"
else
    echo "  No alias found — setting registry directly..."
    cast send "$MIRROR" 'setRegistry(address)' "$REG" \
        --rpc-url "$RPC" --private-key "$OPERATOR_PK"
fi

# Verify
echo "  Verifying wiring..."
cast call "$MIRROR" 'registry()(address)' --rpc-url "$RPC"
cast call "$MIRROR" 'syncSelector()(bytes4)' --rpc-url "$RPC"
echo "  Mirror ↔ Registry wired."

# ======================================================================
#  STEP 4: Deploy FoidMultisig
# ======================================================================
confirm_step "4/7 — Deploy FoidMultisig"

EXISTING_MULTISIG=$(load_addr "MULTISIG")
if [ -n "$EXISTING_MULTISIG" ]; then
    echo "  Already deployed: $EXISTING_MULTISIG"
    MULTISIG="$EXISTING_MULTISIG"
else
    cd "$CONTRACTS_DIR"
    export MULTISIG_SIGNER_1 MULTISIG_SIGNER_2 MULTISIG_SIGNER_3

    RESULT=$(forge script script/DeployMultisig.s.sol \
        --rpc-url "$RPC" \
        --broadcast \
        --json 2>&1)

    # Extract from broadcast logs
    MULTISIG=$(echo "$RESULT" | grep -oE 'FoidMultisig:\s+0x[0-9a-fA-F]{40}' | grep -oE '0x[0-9a-fA-F]{40}' | head -1)
    if [ -z "$MULTISIG" ]; then
        # Try extracting from forge broadcast receipts
        MULTISIG=$(find broadcast -name "*.json" -newer "$STATE_FILE" -exec jq -r '.transactions[]? | select(.contractName=="FoidMultisig") | .contractAddress' {} \; 2>/dev/null | head -1)
    fi
    if [ -z "$MULTISIG" ]; then
        echo "$RESULT"
        read -p "  Paste the FoidMultisig address: " MULTISIG
    fi

    save_addr "MULTISIG" "$MULTISIG"
    echo "  FoidMultisig deployed: $MULTISIG"
fi

# ======================================================================
#  STEP 5: Deploy Mainnet Core (PrayerTiers + StreakVotingPower only)
#  NOTE: FoidTrest and Swipe are LEGACY — replaced by unified Loreboard
# ======================================================================
confirm_step "5/7 — Deploy PrayerTiers + StreakVotingPower"

EXISTING_VP=$(load_addr "STREAK_VOTING_POWER")
if [ -n "$EXISTING_VP" ]; then
    echo "  Already deployed. Addresses in .deploy-mainnet-state"
    STREAK_VP="$EXISTING_VP"
else
    cd "$CONTRACTS_DIR"
    export PRAYER_MIRROR_ADDRESS="$MIRROR"

    RESULT=$(forge script script/DeployMainnetCore.s.sol \
        --rpc-url "$RPC" \
        --broadcast 2>&1)

    echo "$RESULT" | tail -20

    # Extract addresses from output
    PRAYER_TIERS=$(echo "$RESULT" | grep -oE 'PrayerTiers:\s+0x[0-9a-fA-F]{40}' | grep -oE '0x[0-9a-fA-F]{40}' | head -1)
    STREAK_VP=$(echo "$RESULT" | grep -oE 'StreakVotingPower:\s+0x[0-9a-fA-F]{40}' | grep -oE '0x[0-9a-fA-F]{40}' | head -1)

    if [ -z "$STREAK_VP" ]; then
        read -p "  Paste StreakVotingPower address: " STREAK_VP
        read -p "  Paste PrayerTiers address: " PRAYER_TIERS
    fi

    save_addr "PRAYER_TIERS" "$PRAYER_TIERS"
    save_addr "STREAK_VOTING_POWER" "$STREAK_VP"

    echo "  PrayerTiers:       $PRAYER_TIERS"
    echo "  StreakVotingPower:  $STREAK_VP"
fi

# ======================================================================
#  STEP 6: Deploy Loreboard + LoreboardLiveNFT
# ======================================================================
confirm_step "6/7 — Deploy Loreboard + LiveNFT"

EXISTING_BOARD=$(load_addr "LOREBOARD")
if [ -n "$EXISTING_BOARD" ]; then
    echo "  Already deployed: $EXISTING_BOARD"
    LOREBOARD="$EXISTING_BOARD"
else
    cd "$CONTRACTS_DIR"
    export STREAK_VOTING_POWER_ADDRESS="$STREAK_VP"
    export MULTISIG_ADDRESS="$MULTISIG"
    export FEE_RECIPIENT

    RESULT=$(forge script script/DeployLoreboard.s.sol \
        --rpc-url "$RPC" \
        --broadcast 2>&1)

    echo "$RESULT" | tail -25

    LOREBOARD=$(echo "$RESULT" | grep -oE 'Loreboard:\s+0x[0-9a-fA-F]{40}' | grep -oE '0x[0-9a-fA-F]{40}' | head -1)
    LIVE_NFT=$(echo "$RESULT" | grep -oE 'LoreboardLiveNFT:\s+0x[0-9a-fA-F]{40}' | grep -oE '0x[0-9a-fA-F]{40}' | head -1)

    if [ -z "$LOREBOARD" ]; then
        read -p "  Paste Loreboard address: " LOREBOARD
        read -p "  Paste LoreboardLiveNFT address: " LIVE_NFT
    fi

    save_addr "LOREBOARD" "$LOREBOARD"
    save_addr "LOREBOARD_LIVE_NFT" "$LIVE_NFT"

    echo "  Loreboard:         $LOREBOARD"
    echo "  LoreboardLiveNFT:  $LIVE_NFT"
fi

# ======================================================================
#  STEP 7: Transfer Ownership to Multisig
# ======================================================================
confirm_step "7/7 — Transfer Ownership to Multisig"

echo "  Transferring StreakVotingPower ownership..."
cast send "$STREAK_VP" 'setOwner(address)' "$MULTISIG" \
    --rpc-url "$RPC" --private-key "$OPERATOR_PK" || echo "  (may already be transferred)"

echo "  Transferring PrayerTiers ownership..."
cast send "$PRAYER_TIERS" 'setOwner(address)' "$MULTISIG" \
    --rpc-url "$RPC" --private-key "$OPERATOR_PK" || echo "  (may already be transferred)"

# Note: Loreboard ownership is already transferred to multisig in DeployLoreboard.s.sol

echo ""
echo "============================================"
echo "  DEPLOYMENT COMPLETE"
echo "============================================"
echo ""
echo "  All addresses saved in: $STATE_FILE"
echo ""
cat "$STATE_FILE"
echo ""
echo "============================================"
echo "  NEXT STEPS"
echo "============================================"
echo ""
echo "  1. Verify contracts on explorer ($EXPLORER)"
echo "  2. Test a prayer check-in:"
echo "     PH=\$(cast keccak 'test prayer')"
echo "     cast send $REG 'checkIn(bytes32,uint16,uint8)' \$PH 72 1 --rpc-url $RPC --private-key \$OPERATOR_PK"
echo ""
LOREBOARD_ADDR=$(load_addr "LOREBOARD")
echo "  3. Test a loreboard proposal:"
echo "     cast send $LOREBOARD_ADDR 'propose(string,int32,int32,uint32,uint32)' 'QmTestCid' 0 0 64 64 --value 0.001ether --rpc-url $RPC --private-key \$OPERATOR_PK"
echo ""
echo "  4. Update your frontend .env for mainnet:"
echo "     NEXT_PUBLIC_CHAIN_ID=$CHAIN_ID"
echo "     NEXT_PUBLIC_FLUENT_RPC=$RPC"
echo "     NEXT_PUBLIC_BLOCK_EXPLORER=$EXPLORER"
echo "     NEXT_PUBLIC_IS_MAINNET=true"
echo "     # Paste contract addresses from $STATE_FILE"
echo ""
