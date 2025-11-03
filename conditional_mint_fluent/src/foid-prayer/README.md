# foid-prayer — blended Rust (rWASM) + Solidity on Fluent

A daily on-chain check‑in ("prayer") system built with **Gblend** on **Fluent**:

* **Rust rWASM** contract (`PrayerRegistry`) enforces the 24‑hour cadence, tracks
  `streak / longest / total / milestones / score / prayerHash`, and in the **same tx** mirrors a snapshot to…
* **Solidity** mirror (`PrayerMirror`) for cheap, read‑friendly UI/NFT access.

---

## What it does (at a glance)

1. Frontend hashes the user’s text locally (`keccak256(message)` → `bytes32 prayerHash`).
2. User calls **`checkIn(bytes32 prayerHash, uint16 score, uint8 label)`** on `PrayerRegistry`.
3. Registry validates the 24h rule, updates stats, flips milestone bits at **7/14/21/28/60/90** days.
4. Registry **ABI‑encodes** and calls **`PrayerMirror.sync(...)`** in the same transaction.
5. Apps (and later mints) read **`PrayerMirror.get(user)`** for a compact snapshot.

Privacy by default: only the **hash** of the prayer is stored on‑chain.

---

## Repo layout

```
conditional_mint_fluent/
└─ src/
   └─ foid-prayer/
      ├─ src/prayer-registry/          # Rust rWASM crate (the write path)
      │  ├─ Cargo.toml
      │  └─ src/lib.rs
      └─ ProofOfPrayer.sol             # Solidity mirror (the read path)
```

---

## Data model

**Per user (in Registry):**

* `streak (u32)` – current consecutive days
* `longest (u32)` – all‑time longest streak
* `total (u32)` – total check‑ins
* `milestones (u32 bitmask)` – bit flags set at `[7,14,21,28,60,90]`
* `last_check_in (u64)` – unix seconds
* `score (u16)` – client‑provided 0..10,000
* `label (u8)` – small tag (kept in Registry only)
* `prayer_hash (bytes32)` – keccak256 of the prayer text

**In Mirror:** a compact snapshot for UI: `(streak, longest, total, milestones, score, prayerHash)`.

> **24h rule:** A check‑in is allowed if `now >= last_check_in + 86_400`. Missing **≥ 48h** resets `streak` to 1; otherwise it increments.

---

## Interfaces (high level)

### Registry (rWASM)

* `checkIn(bytes32 prayerHash, uint16 score, uint8 label)` → returns the updated snapshot
* `getUser(address user)` → full tuple view for that user
* `nextAllowedAt(address user)` → unix timestamp of next legal check‑in
* `mirror()` / `evmAlias()` / `owner()` / `setMirror(address)`

### Mirror (Solidity)

* `sync(address user, uint*, uint*, uint*, uint*, uint*, bytes32)` – internal bridge target (called by Registry)
* `get(address user) → (uint32 streak, uint32 longest, uint32 total, uint32 milestones, uint16 score, bytes32 prayerHash)`
* `authorizeBoth(address registryAlias, address registry)` – owner‑gated wire‑up helper
* Introspection helpers (e.g., `syncSelector()`, `isAuthorizedRegistry(addr)`, etc.)

> **Selector sanity:** `sync(address,uint256,uint256,uint256,uint256,uint256,bytes32)` → `0x3f104dad`. Mirror exposes `syncSelector()` which should return the same value.

---

## Prereqs

* **Docker Desktop** on macOS with **Rosetta** for x86_64 emulation **enabled**, or **Colima** started with `--arch x86_64`.
* **Gblend** installed and on `PATH`.
* **Foundry** (`cast`) and `jq` for CLI decoding.
* Fluent testnet RPC + a funded key:

```bash
export RPC="https://rpc.testnet.fluent.xyz"
export PK=0xYOUR_PRIVATE_KEY
```

---

## Build

From the repo root:

```bash
cd conditional_mint_fluent
# Build rust + solidity artifacts
gblend build
# Artifacts land under ./out
```

> You can also build on‑the‑fly during `gblend create`; below commands compile if needed.

---

## Deploy & wire (exact sequence)

### 1) Deploy **PrayerMirror** (Solidity)

```bash
gblend create src/foid-prayer/ProofOfPrayer.sol:PrayerMirror \
  --rpc-url "$RPC" --private-key "$PK" --broadcast \
  --constructor-args $(cast wallet address --private-key "$PK")
# capture the address
export MIRROR=0x...
```

### 2) Deploy **PrayerRegistry** (rWASM) and point it at the Mirror

Using the package:artifact form (recommended):

```bash
gblend create src/foid-prayer/src/prayer-registry:prayer-registry.wasm \
  --wasm --rpc-url "$RPC" --private-key "$PK" --broadcast \
  --constructor-args "$MIRROR"
export REG=0x...
```

(Alternative: direct path)

```bash
gblend create out/prayer-registry.wasm/prayer-registry.wasm \
  --wasm --rpc-url "$RPC" --private-key "$PK" --broadcast \
  --constructor-args "$MIRROR"
```

### 3) Authorize the Registry in the Mirror (one‑time)

Some environments use both the **bytecode alias** and the **deployed address**; wire both:

```bash
REG_ALIAS=$(cast call "$REG" 'evmAlias()(address)' --rpc-url "$RPC")
cast send "$MIRROR" 'authorizeBoth(address,address)' "$REG_ALIAS" "$REG" \
  --rpc-url "$RPC" --private-key "$PK"

# sanity checks
cast call "$MIRROR" 'isAuthorizedRegistry(address)(bool)' "$REG"       --rpc-url "$RPC"
cast call "$MIRROR" 'isAuthorizedRegistry(address)(bool)' "$REG_ALIAS" --rpc-url "$RPC"
cast call "$REG"    'mirror()(address)'                                   --rpc-url "$RPC"
cast call "$MIRROR" 'syncSelector()(bytes4)'                              --rpc-url "$RPC"
```

You should see `true/true`, the Mirror address in `registry.mirror()`, and `0x3f104dad` from `syncSelector()`.

---

## First check‑in (manual sanity)

```bash
EOA=$(cast wallet address --private-key "$PK")
PH=$(cast keccak "today i am grateful for…")

cast send "$REG" 'checkIn(bytes32,uint16,uint8)' "$PH" 72 1 \
  --rpc-url "$RPC" --private-key "$PK"

# read snapshots
cast call "$MIRROR" 'get(address)(uint32,uint32,uint32,uint32,uint16,bytes32)' "$EOA" --rpc-url "$RPC"
cast call "$REG"    'getUser(address)(uint256,uint256,uint256,uint256,uint256,bytes32,uint256,uint256)' "$EOA" --rpc-url "$RPC"

# when next?
cast call "$REG" 'nextAllowedAt(address)(uint256)' "$EOA" --rpc-url "$RPC"
```

Expected: streak/longest/total = `1`, score = `72`, milestones = `0`, and `already checked today` if you try again before `nextAllowedAt`.

---

## Decoding the Mirror event (CLI)

The Mirror emits a single **`Synced(...)`** event per successful check‑in, with `user` indexed in `topics[1]`. All value types are 32‑byte ABI words, so decoding is straightforward even without the ABI.

### A) Quick one‑liner to fetch the **data** payload

```bash
TX=0x<tx_hash>
SIG=$(cast receipt "$TX" --rpc-url "$RPC" --json \
  | jq -r '.logs[0].topics[0]')

# The Mirror's topic0 for Synced in your deployment was:
# 0xc7f6cce89e7a76ba9216a910e7ef049e41e07d832e5530cefe42edfc8d893b0a

DATA=$(cast receipt "$TX" --rpc-url "$RPC" --json \
  | jq -r --arg addr "$(echo "$MIRROR" | tr '[:upper:]' '[:lower:]')" --arg sig "$SIG" \
      '.logs[] | select((.address|ascii_downcase)==$addr and .topics[0]==$sig) | .data')
```

### B) Minimal parser to slice words and print values

```bash
# grab the indexed user from topic[1]
USER_TOPIC=$(cast receipt "$TX" --rpc-url "$RPC" --json \
  | jq -r --arg addr "$(echo "$MIRROR" | tr '[:upper:]' '[:lower:]')" --arg sig "$SIG" \
      '.logs[] | select((.address|ascii_downcase)==$addr and .topics[0]==$sig) | .topics[1]')
USER="0x$(echo "$USER_TOPIC" | sed -E 's/^0x0{24}//')"

echo "user=$USER"

# helper to pull 32‑byte words from the hex blob (0‑indexed)
word() {
  i=$1; hex=${DATA#0x}; s=$((i*64+1)); e=$((s+63)); printf '0x%s\n' "$(printf %s "$hex" | cut -c ${s}-${e})"
}

STREAK=$(   cast to-dec "$(word 0)")
LONGEST=$(  cast to-dec "$(word 1)")
TOTAL=$(    cast to-dec "$(word 2)")
MILESTONES=$(cast to-dec "$(word 3)")
SCORE=$(    cast to-dec "$(word 4)")
PRAYER_HASH=$(word 5)

printf "streak=%s\nlongest=%s\ntotal=%s\nmilestones=%s\nscore=%s\nprayer_hash=%s\n" \
  "$STREAK" "$LONGEST" "$TOTAL" "$MILESTONES" "$SCORE" "$PRAYER_HASH"
```

> If you have the ABI JSON for the Mirror handy, you can also use `cast decode-logs` directly. The manual slicer above is robust and ABI‑free.

---

## Verification (optional)

```bash
# rWASM
gblend verify-contract "$REG" prayer-registry.wasm \
  --wasm --verifier blockscout --verifier-url https://testnet.fluentscan.xyz/api/

# Solidity
gblend verify-contract "$MIRROR" PrayerMirror \
  --verifier blockscout --verifier-url https://testnet.fluentscan.xyz/api/
```

---

## Tests (Rust unit tests)

```bash
cd src/foid-prayer/src/prayer-registry
cargo test --features std
```

Recommended: add tests that advance time and assert milestone bits flip exactly at 7/14/21/28/60/90; test double check‑in revert and 48h gap reset.

---

## Frontend notes (viem/wagmi)

* Read **`PrayerMirror.get(user)`** (6 fields) for display/NFT.
* Show next window via **`Registry.nextAllowedAt(user)`** minus current time.
* Always hash the prayer text **client‑side** before calling `checkIn`.

---

## Troubleshooting

* **`already checked today`** – You’re inside the 24h window. Read `nextAllowedAt(user)` for the exact timestamp.
* **`mirror not set`** – Deploy order/wiring issue. Ensure the Registry constructor received the Mirror, and Mirror authorized the Registry/alias.
* **`execution reverted` on `sync`** – Check Mirror’s paused/authorization flags and that `syncSelector()` matches the encoded selector `0x3f104dad`.
* **Gas estimation fails** – The revert reason will show in Foundry’s error. Commonly authorization or the daily gate.

---

## Notes on strictness

The current logic keeps streaks if the next check happens within **< 48h** of the previous one (forgiving day rollover). To enforce a strict 24h cadence (miss > 24h resets), change the branch in `handle_check_in` accordingly.

---

## Roadmap ideas

* Expose `label` in a separate read path if you want it UI‑visible.
* Badge/NFT mints when milestone bits flip.
* Leaderboard indexer streaming `Synced` events.
