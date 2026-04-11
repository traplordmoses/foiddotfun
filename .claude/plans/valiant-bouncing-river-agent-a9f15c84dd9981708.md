# Implementation Plan: Two New GoldSky Subgraphs for FOID

## Overview

Create two new GoldSky subgraphs to index the new Loreboard and PrayerTiers contracts deployed on Fluent testnet (chain 20994) on March 30, 2026. These replace the three legacy subgraphs (swipe, prayer, loreboard-governance) that tracked the old contract system. The free GoldSky plan allows 3 subgraphs, so deploying 2 new ones leaves room for a future third.

---

## Part 1: File Structure

### New directories under `foid-subgraph/`:

```
foid-subgraph/
├── loreboard/                    # NEW — replaces swipe + loreboard-governance
│   ├── abis/Loreboard.json       # ABI extracted from Forge output
│   ├── goldsky.json              # GoldSky deployment config
│   ├── schema.graphql            # Entity definitions
│   ├── src/mapping.ts            # AssemblyScript event handlers
│   └── subgraph.yaml             # Subgraph manifest
│
├── prayer-tiers/                 # NEW — replaces prayer
│   ├── abis/PrayerTiers.json     # ABI extracted from Forge output
│   ├── goldsky.json              # GoldSky deployment config
│   ├── schema.graphql            # Entity definitions
│   ├── src/mapping.ts            # AssemblyScript event handlers
│   └── subgraph.yaml             # Subgraph manifest
│
├── swipe/                        # OLD — archive or delete
├── prayer/                       # OLD — archive or delete
├── loreboard-governance/         # OLD — archive or delete
├── abis/                         # OLD shared abis (empty)
└── README.md                     # Update with new deploy instructions
```

---

## Part 2: Loreboard Subgraph

### 2A. ABI Extraction

The compiled ABI lives at:
`/Users/bengalagan/foid_fun/solidity_contracts/out/Loreboard.sol/Loreboard.json`

This is a full Forge artifact. The subgraph needs just the `abi` array. Extract it with:

```bash
python3 -c "
import json
with open('solidity_contracts/out/Loreboard.sol/Loreboard.json') as f:
    data = json.load(f)
print(json.dumps(data['abi'], indent=2))
" > foid-subgraph/loreboard/abis/Loreboard.json
```

The existing subgraph ABIs (e.g., `prayer/abis/PrayerRegistry.json`) are bare JSON arrays — this matches that convention.

### 2B. Schema Design (`loreboard/schema.graphql`)

```graphql
# ─── Stateful Entities (keyed by on-chain ID) ───

type Proposal @entity {
  id: ID!                          # proposalId.toString()
  proposalId: BigInt!
  proposer: Bytes!
  ipfsCid: String!
  x: Int!
  y: Int!
  w: Int!
  h: Int!
  votingEndsAt: BigInt!
  finalized: Boolean!
  approved: Boolean!
  overlapRejected: Boolean!
  weightFor: BigInt!
  weightAgainst: BigInt!
  placement: Placement             # Set when approved; null otherwise
  votes: [Vote!]! @derivedFrom(field: "proposal")
  blockNumber: BigInt!
  blockTimestamp: BigInt!
  transactionHash: Bytes!
}

type Vote @entity {
  id: ID!                          # tx.hash.concatI32(logIndex)
  proposal: Proposal!              # FK → Proposal
  proposalId: BigInt!
  voter: Bytes!
  approve: Boolean!
  weight: BigInt!
  blockNumber: BigInt!
  blockTimestamp: BigInt!
  transactionHash: Bytes!
}

type Placement @entity {
  id: ID!                          # placementId.toString()
  placementId: BigInt!
  proposal: Proposal!              # FK → Proposal
  proposalId: BigInt!
  placer: Bytes!
  ipfsCid: String!
  x: Int!
  y: Int!
  w: Int!
  h: Int!
  removed: Boolean!
  removedBy: Bytes                 # null if not removed; placer or admin address
  removalType: String              # null, "self", or "emergency"
  blockNumber: BigInt!
  blockTimestamp: BigInt!
  transactionHash: Bytes!
}

# ─── Event Log Entities (append-only) ───

type ManifestUpdate @entity {
  id: ID!                          # tx.hash.concatI32(logIndex)
  newCid: String!
  version: BigInt!
  placementCountAtUpdate: BigInt!
  blockNumber: BigInt!
  blockTimestamp: BigInt!
  transactionHash: Bytes!
}
```

**Design decisions:**

1. **Proposal is stateful** — keyed by `proposalId`, mutated by Finalized/ProposalRejected/ProposalOverlapRejected events to update `finalized`, `approved`, `overlapRejected`, `weightFor`, `weightAgainst`.

2. **Vote is event-log style** — one record per VoteCast event, linked to Proposal via `@derivedFrom`. This supports "all votes for proposal X" queries directly.

3. **Placement is stateful** — keyed by `placementId`, mutated by PlacementSelfRemoved / PlacementEmergencyRemoved to set `removed=true` and track who removed it.

4. **Proposal-Placement link** — Proposal has an optional `placement` field set when the proposal is approved and a placement is created. This supports the governance lifecycle query: proposal -> votes -> placement.

5. **ManifestUpdate is event-log style** — simple append-only history of manifest changes.

### 2C. Event Handler Signatures (`subgraph.yaml`)

```yaml
specVersion: 0.0.5
schema:
  file: ./schema.graphql
dataSources:
  - kind: ethereum
    name: Loreboard
    network: fluent-testnet
    source:
      address: "0xf9b72062a7e5933692ccbd247d70a9cdb40e0ec7"
      abi: Loreboard
      startBlock: 22865492
    mapping:
      kind: ethereum/events
      apiVersion: 0.0.7
      language: wasm/assemblyscript
      entities:
        - Proposal
        - Vote
        - Placement
        - ManifestUpdate
      abis:
        - name: Loreboard
          file: ./abis/Loreboard.json
      eventHandlers:
        - event: ProposalCreated(indexed uint256,indexed address,string,int32,int32,uint32,uint32,uint64)
          handler: handleProposalCreated
        - event: VoteCast(indexed uint256,indexed address,bool,uint256)
          handler: handleVoteCast
        - event: Finalized(indexed uint256,bool,uint256,uint256)
          handler: handleFinalized
        - event: PlacementCreated(indexed uint256,indexed uint256,indexed address,int32,int32,uint32,uint32,string)
          handler: handlePlacementCreated
        - event: ProposalRejected(indexed uint256,uint256,uint256)
          handler: handleProposalRejected
        - event: ProposalOverlapRejected(indexed uint256)
          handler: handleProposalOverlapRejected
        - event: PlacementSelfRemoved(indexed uint256,indexed address)
          handler: handlePlacementSelfRemoved
        - event: PlacementEmergencyRemoved(indexed uint256,indexed address)
          handler: handlePlacementEmergencyRemoved
        - event: ManifestUpdated(string,uint256,uint256)
          handler: handleManifestUpdated
      file: ./src/mapping.ts
```

**Note on event signatures:** These are derived directly from the compiled ABI. The Loreboard contract's `ProposalCreated` has `(indexed uint256, indexed address, string, int32, int32, uint32, uint32, uint64)` — the `uint64` for `votingEndsAt` is important since AssemblyScript will need `BigInt.fromI64()` conversion.

### 2D. GoldSky Config (`loreboard/goldsky.json`)

```json
{
  "version": "1",
  "name": "FoidLoreboard",
  "abis": {
    "Loreboard": {
      "path": "./abis/Loreboard.json"
    }
  },
  "instances": [
    {
      "abi": "Loreboard",
      "address": "0xf9b72062a7e5933692ccbd247d70a9cdb40e0ec7",
      "startBlock": 22865492,
      "chain": "fluent-testnet"
    }
  ]
}
```

### 2E. Mapping Logic (`loreboard/src/mapping.ts`)

```typescript
import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import {
  ProposalCreated as ProposalCreatedEvent,
  VoteCast as VoteCastEvent,
  Finalized as FinalizedEvent,
  PlacementCreated as PlacementCreatedEvent,
  ProposalRejected as ProposalRejectedEvent,
  ProposalOverlapRejected as ProposalOverlapRejectedEvent,
  PlacementSelfRemoved as PlacementSelfRemovedEvent,
  PlacementEmergencyRemoved as PlacementEmergencyRemovedEvent,
  ManifestUpdated as ManifestUpdatedEvent,
} from "../generated/Loreboard/Loreboard";
import { Proposal, Vote, Placement, ManifestUpdate } from "../generated/schema";

// ─── Governance ───

export function handleProposalCreated(event: ProposalCreatedEvent): void {
  let id = event.params.proposalId.toString();
  let entity = new Proposal(id);
  entity.proposalId = event.params.proposalId;
  entity.proposer = event.params.proposer;
  entity.ipfsCid = event.params.ipfsCid;
  entity.x = event.params.x;
  entity.y = event.params.y;
  entity.w = event.params.w.toI32();       // uint32 → i32
  entity.h = event.params.h.toI32();       // uint32 → i32
  entity.votingEndsAt = BigInt.fromI64(event.params.votingEndsAt);  // uint64 → BigInt
  entity.finalized = false;
  entity.approved = false;
  entity.overlapRejected = false;
  entity.weightFor = BigInt.zero();
  entity.weightAgainst = BigInt.zero();
  // entity.placement — leave null
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;
  entity.save();
}

export function handleVoteCast(event: VoteCastEvent): void {
  let entity = new Vote(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  entity.proposal = event.params.proposalId.toString();
  entity.proposalId = event.params.proposalId;
  entity.voter = event.params.voter;
  entity.approve = event.params.approve;
  entity.weight = event.params.weight;
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;
  entity.save();

  // Also update the Proposal's running tallies
  let proposal = Proposal.load(event.params.proposalId.toString());
  if (proposal) {
    if (event.params.approve) {
      proposal.weightFor = proposal.weightFor.plus(event.params.weight);
    } else {
      proposal.weightAgainst = proposal.weightAgainst.plus(event.params.weight);
    }
    proposal.save();
  }
}

export function handleFinalized(event: FinalizedEvent): void {
  let proposal = Proposal.load(event.params.proposalId.toString());
  if (proposal) {
    proposal.finalized = true;
    proposal.approved = event.params.approved;
    proposal.weightFor = event.params.weightFor;
    proposal.weightAgainst = event.params.weightAgainst;
    proposal.save();
  }
}

export function handlePlacementCreated(event: PlacementCreatedEvent): void {
  let placementId = event.params.placementId.toString();
  let entity = new Placement(placementId);
  entity.placementId = event.params.placementId;
  entity.proposal = event.params.proposalId.toString();
  entity.proposalId = event.params.proposalId;
  entity.placer = event.params.placer;
  entity.ipfsCid = event.params.ipfsCid;
  entity.x = event.params.x;
  entity.y = event.params.y;
  entity.w = event.params.w.toI32();
  entity.h = event.params.h.toI32();
  entity.removed = false;
  // removedBy, removalType — leave null
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;
  entity.save();

  // Link proposal → placement
  let proposal = Proposal.load(event.params.proposalId.toString());
  if (proposal) {
    proposal.placement = placementId;
    proposal.save();
  }
}

export function handleProposalRejected(event: ProposalRejectedEvent): void {
  let proposal = Proposal.load(event.params.proposalId.toString());
  if (proposal) {
    proposal.finalized = true;
    proposal.approved = false;
    proposal.weightFor = event.params.weightFor;
    proposal.weightAgainst = event.params.weightAgainst;
    proposal.save();
  }
}

export function handleProposalOverlapRejected(event: ProposalOverlapRejectedEvent): void {
  let proposal = Proposal.load(event.params.proposalId.toString());
  if (proposal) {
    proposal.overlapRejected = true;
    proposal.save();
  }
}

// ─── Removal ───

export function handlePlacementSelfRemoved(event: PlacementSelfRemovedEvent): void {
  let placement = Placement.load(event.params.placementId.toString());
  if (placement) {
    placement.removed = true;
    placement.removedBy = event.params.placer;
    placement.removalType = "self";
    placement.save();
  }
}

export function handlePlacementEmergencyRemoved(event: PlacementEmergencyRemovedEvent): void {
  let placement = Placement.load(event.params.placementId.toString());
  if (placement) {
    placement.removed = true;
    placement.removedBy = event.params.removedBy;
    placement.removalType = "emergency";
    placement.save();
  }
}

// ─── Manifest ───

export function handleManifestUpdated(event: ManifestUpdatedEvent): void {
  let entity = new ManifestUpdate(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  entity.newCid = event.params.newCid;
  entity.version = event.params.version;
  entity.placementCountAtUpdate = event.params.placementCountAtUpdate;
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;
  entity.save();
}
```

**Key patterns preserved from existing codebase:**
- Stateful entities keyed by on-chain ID (`proposalId.toString()`, `placementId.toString()`)
- Event-log entities keyed by `event.transaction.hash.concatI32(event.logIndex.toI32())`
- `uint32` fields use `.toI32()`
- `uint64` fields use `BigInt.fromI64()`
- Cross-entity updates: load, mutate, save (same pattern as old `handlePlacementFlagged`)

**Important edge case:** The Finalized event fires for ALL proposals (approved or rejected). ProposalRejected fires only for rejections. ProposalOverlapRejected fires only for overlap conflicts. The contract emits Finalized AFTER PlacementCreated (for approved) or AFTER ProposalRejected (for rejected). The handleFinalized handler sets `weightFor`/`weightAgainst` from the event params (authoritative values from the contract), overwriting the running tallies accumulated by handleVoteCast. This is intentional — the event params are the canonical final values.

---

## Part 3: PrayerTiers Subgraph

### 3A. ABI Extraction

```bash
python3 -c "
import json
with open('solidity_contracts/out/PrayerTiers.sol/PrayerTiers.json') as f:
    data = json.load(f)
print(json.dumps(data['abi'], indent=2))
" > foid-subgraph/prayer-tiers/abis/PrayerTiers.json
```

### 3B. Schema Design (`prayer-tiers/schema.graphql`)

```graphql
# Event log — every tier-up event
type TierUp @entity {
  id: ID!                          # tx.hash.concatI32(logIndex)
  user: Bytes!
  newTier: Int!
  tierName: String!
  blockNumber: BigInt!
  blockTimestamp: BigInt!
  transactionHash: Bytes!
}

# Stateful — current highest tier per user
type UserTier @entity {
  id: ID!                          # user address hex string
  user: Bytes!
  currentTier: Int!
  currentTierName: String!
  tierHistory: [TierUp!]! @derivedFrom(field: "user")
  lastUpdatedBlock: BigInt!
  lastUpdatedTimestamp: BigInt!
}
```

**Design decision on `@derivedFrom`:** The `tierHistory` field on `UserTier` uses `@derivedFrom(field: "user")`. This means `TierUp.user` must be `Bytes!` and `UserTier.id` must match the hex address. However, `@derivedFrom` works on entity references, not arbitrary `Bytes!` fields. We need to adjust: either (a) add a `userTier: UserTier!` FK field on `TierUp` instead, or (b) drop the `@derivedFrom` and query TierUp separately by user address.

**Revised schema (option a — FK approach):**

```graphql
type TierUp @entity {
  id: ID!
  userTier: UserTier!              # FK → UserTier (the user's entity)
  user: Bytes!                     # redundant but useful for direct queries
  newTier: Int!
  tierName: String!
  blockNumber: BigInt!
  blockTimestamp: BigInt!
  transactionHash: Bytes!
}

type UserTier @entity {
  id: ID!                          # user address hex (lowercase)
  user: Bytes!
  currentTier: Int!
  currentTierName: String!
  tierUps: [TierUp!]! @derivedFrom(field: "userTier")
  lastUpdatedBlock: BigInt!
  lastUpdatedTimestamp: BigInt!
}
```

### 3C. Configuration (`prayer-tiers/subgraph.yaml`)

```yaml
specVersion: 0.0.5
schema:
  file: ./schema.graphql
dataSources:
  - kind: ethereum
    name: PrayerTiers
    network: fluent-testnet
    source:
      address: "0x36ed105e09a881b6074250a43b2e26c0d6cfd4fb"
      abi: PrayerTiers
      startBlock: 21984763
    mapping:
      kind: ethereum/events
      apiVersion: 0.0.7
      language: wasm/assemblyscript
      entities:
        - TierUp
        - UserTier
      abis:
        - name: PrayerTiers
          file: ./abis/PrayerTiers.json
      eventHandlers:
        - event: TierUp(indexed address,uint8,string)
          handler: handleTierUp
        - event: OwnerChanged(indexed address,indexed address)
          handler: handleOwnerChanged
      file: ./src/mapping.ts
```

**Note:** We include `OwnerChanged` in the handler list for completeness, but its handler will be a no-op (or we skip it). The `TierUp` event is the one we care about. However, including OwnerChanged in the yaml is harmless and makes the subgraph fully aware of all contract events. If we truly don't need it, we can omit it from the yaml entirely.

**Revised:** Omit `OwnerChanged` from eventHandlers since we don't need to index admin events for this subgraph. Keep it simple.

```yaml
      eventHandlers:
        - event: TierUp(indexed address,uint8,string)
          handler: handleTierUp
```

### 3D. GoldSky Config (`prayer-tiers/goldsky.json`)

```json
{
  "version": "1",
  "name": "FoidPrayerTiers",
  "abis": {
    "PrayerTiers": {
      "path": "./abis/PrayerTiers.json"
    }
  },
  "instances": [
    {
      "abi": "PrayerTiers",
      "address": "0x36ed105e09a881b6074250a43b2e26c0d6cfd4fb",
      "startBlock": 21984763,
      "chain": "fluent-testnet"
    }
  ]
}
```

### 3E. Mapping Logic (`prayer-tiers/src/mapping.ts`)

```typescript
import { BigInt } from "@graphprotocol/graph-ts";
import { TierUp as TierUpEvent } from "../generated/PrayerTiers/PrayerTiers";
import { TierUp, UserTier } from "../generated/schema";

export function handleTierUp(event: TierUpEvent): void {
  // 1. Create event-log entity
  let tierUpEntity = new TierUp(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  let userId = event.params.user.toHexString();

  tierUpEntity.userTier = userId;
  tierUpEntity.user = event.params.user;
  tierUpEntity.newTier = event.params.newTier;          // uint8 — fits in i32
  tierUpEntity.tierName = event.params.tierName;
  tierUpEntity.blockNumber = event.block.number;
  tierUpEntity.blockTimestamp = event.block.timestamp;
  tierUpEntity.transactionHash = event.transaction.hash;
  tierUpEntity.save();

  // 2. Upsert UserTier entity (stateful — always reflects highest tier)
  let userTier = UserTier.load(userId);
  if (!userTier) {
    userTier = new UserTier(userId);
    userTier.user = event.params.user;
    userTier.currentTier = 0;
    userTier.currentTierName = "Unranked";
    userTier.lastUpdatedBlock = BigInt.zero();
    userTier.lastUpdatedTimestamp = BigInt.zero();
  }

  // TierUp only fires when newTier > highestTier (contract logic), so always update
  let newTierI32: i32 = event.params.newTier;
  userTier.currentTier = newTierI32;
  userTier.currentTierName = event.params.tierName;
  userTier.lastUpdatedBlock = event.block.number;
  userTier.lastUpdatedTimestamp = event.block.timestamp;
  userTier.save();
}
```

---

## Part 4: Frontend Config Updates

### 4A. Files that need updating

After deployment, the subgraph URLs will follow the GoldSky pattern:
```
https://api.goldsky.com/api/public/project_cmkwd7dgh0bq501z7fog65iag/subgraphs/<name>/<version>/gn
```

Expected URLs (naming convention: `foid-<name>-fluent-testnet`):
- **Loreboard:** `foid-loreboard-fluent-testnet/1.0.0`
- **PrayerTiers:** `foid-prayer-tiers-fluent-testnet/1.0.0`

### 4B. `foid_fun/src/agent/foidMummy/config.ts`

This file currently defines `SUBGRAPH_URLS.swipe`, `.prayer`, and `.governance`. The new Loreboard subgraph replaces all three because:
- The old `swipe` subgraph tracked Proposed, LoreboardProposed, Finalized, PlacementClaimed from the Swipe contract
- The old `governance` subgraph tracked Placement, RemovalVote, RemovalVoteCast from SwipeLoreboard
- The new Loreboard contract unifies all of this into one contract with new event names

**Required changes:**
```typescript
export const SUBGRAPH_URLS = {
  // V2 subgraphs (deployed 2026-03-30, new unified Loreboard contract)
  loreboard: process.env.GOLDSKY_LOREBOARD_URL ||
    "https://api.goldsky.com/api/public/project_cmkwd7dgh0bq501z7fog65iag/subgraphs/foid-loreboard-fluent-testnet/1.0.0/gn",
  prayerTiers: process.env.GOLDSKY_PRAYER_TIERS_URL ||
    "https://api.goldsky.com/api/public/project_cmkwd7dgh0bq501z7fog65iag/subgraphs/foid-prayer-tiers-fluent-testnet/1.0.0/gn",
};
```

Also update the `CONTRACTS` object to reference the new contract addresses:
```typescript
export const CONTRACTS = {
  loreboard: "0xf9b72062a7e5933692ccbd247d70a9cdb40e0ec7" as Address,
  prayerTiers: "0x36ED105e09A881B6074250a43B2e26c0d6cfD4fb" as Address,
  // ... keep others as needed for RPC reads
};
```

### 4C. `foid_fun/src/agent/foidMummy/dataCollector.ts`

**Major rewrite required.** The `collectLoreboardData()` function currently queries three different entity types (`proposeds`, `loreboardProposeds`, `finalizeds`, `placementClaimeds`) from the old swipe subgraph. With the new unified Loreboard subgraph, the queries become:

- `proposals` (replaces `proposeds` + `loreboardProposeds` — the new contract has only one proposal type with grid coords)
- `votes` (new — the old system had no vote subgraph from the Swipe contract; governance subgraph tracked SwipeLoreboard votes)
- `placements` (replaces `placementClaimeds` from swipe + `Placement` from governance)

The `collectVotingData()` function currently queries `voteCasts` from the governance subgraph (old SwipeLoreboard contract). This now comes from the same Loreboard subgraph under the `votes` entity.

**New query patterns for dataCollector.ts:**
```graphql
# All proposals in period (replaces proposeds + loreboardProposeds)
{
  proposals(
    first: 100
    orderBy: blockTimestamp
    orderDirection: desc
    where: { blockTimestamp_gte: "...", blockTimestamp_lte: "..." }
  ) {
    proposalId
    proposer
    ipfsCid
    x y w h
    votingEndsAt
    finalized
    approved
    overlapRejected
    weightFor
    weightAgainst
    blockTimestamp
    placement { placementId removed }
  }
}

# Votes in period (replaces governance subgraph voteCasts)
{
  votes(
    first: 1000
    orderBy: blockTimestamp
    orderDirection: desc
    where: { blockTimestamp_gte: "..." }
  ) {
    voter
    proposalId
    approve
    weight
    blockTimestamp
  }
}

# Active placements (not removed) — for board state
{
  placements(
    first: 1000
    where: { removed: false }
  ) {
    placementId
    proposalId
    placer
    ipfsCid
    x y w h
  }
}
```

### 4D. `foid_fun/foid_bot/src/goldsky.ts`

This file uses `GOLDSKY_BOARD_V1_URL` and `GOLDSKY_VOTING_URL` env vars to query the very old (pre-Swipe) loreboard contracts. The queries look for `placementProposeds`, `voteCasts`, `epochFinalizeds` — these are from the LoreboardBoardV2/LoreboardVotingV2 era.

**This file needs a full rewrite** to query the new Loreboard subgraph. The types `Proposal`, `VoteCast`, `EpochFinalized` will change to match the new schema. The env vars should change to `GOLDSKY_LOREBOARD_URL`.

### 4E. `foid_fun/src/app/api/votes/route.ts`

Currently queries `voteCasts` from the old swipe subgraph using `GOLDSKY_VOTING_URL`. This must be updated to query the new `votes` entity from the Loreboard subgraph. The query field names change (e.g., `support` → `approve`, `placementId` → `proposalId`, `timestamp_` → `blockTimestamp`).

### 4F. `foid_fun/src/app/api/agent/_lib/goldsky.ts`

This file does NOT use GoldSky at all despite the filename — it uses direct RPC `getLogs` calls. It can optionally be updated to use the new subgraph, but it works independently. Low priority.

### 4G. Environment Variables

**New env vars to add (all have hardcoded defaults, so not required):**
- `GOLDSKY_LOREBOARD_URL` — override for Loreboard subgraph URL
- `GOLDSKY_PRAYER_TIERS_URL` — override for PrayerTiers subgraph URL

**Old env vars to deprecate:**
- `GOLDSKY_SWIPE_URL`
- `GOLDSKY_PRAYER_URL`
- `GOLDSKY_GOVERNANCE_URL`
- `GOLDSKY_BOARD_V1_URL`
- `GOLDSKY_VOTING_URL`

**Update locations:**
- `render.yaml` — change `GOLDSKY_BOARD_V1_URL` and `GOLDSKY_VOTING_URL` to `GOLDSKY_LOREBOARD_URL`
- `.env.local` — add new vars if overrides are needed locally
- `.env.render` — update for production
- `.env.vercel-prod` — update for Vercel deployment
- `docs/OPERATOR_RUNBOOK.md` — update env var documentation table

---

## Part 5: GoldSky Deployment Commands

### 5A. Pre-deployment checklist

1. Ensure GoldSky CLI is installed: `curl https://goldsky.com | sh`
2. Ensure logged in: `goldsky login`
3. Verify current subgraph count: `goldsky subgraph list` (must be < 3 or delete old ones first)

### 5B. Delete old subgraphs (if still deployed)

The old subgraphs have been described as "deleted", but verify:
```bash
goldsky subgraph list
```

If any of these still exist, delete them:
```bash
goldsky subgraph delete foid-swipe-fluent-testnet/1.2.0
goldsky subgraph delete foid-prayer-fluent-testnet/1.1.0
goldsky subgraph delete foid-loreboard-governance-fluent-testnet/1.0.0
```

### 5C. Deploy new subgraphs

```bash
# Deploy Loreboard subgraph
cd foid-subgraph/loreboard
goldsky subgraph deploy foid-loreboard-fluent-testnet/1.0.0 --path .

# Deploy PrayerTiers subgraph
cd ../prayer-tiers
goldsky subgraph deploy foid-prayer-tiers-fluent-testnet/1.0.0 --path .
```

### 5D. Verify deployment

```bash
goldsky subgraph list
```

Test queries:
```bash
# Loreboard
curl -X POST \
  "https://api.goldsky.com/api/public/project_cmkwd7dgh0bq501z7fog65iag/subgraphs/foid-loreboard-fluent-testnet/1.0.0/gn" \
  -H "Content-Type: application/json" \
  -d '{"query": "{ proposals(first: 5) { proposalId proposer finalized } }"}'

# PrayerTiers
curl -X POST \
  "https://api.goldsky.com/api/public/project_cmkwd7dgh0bq501z7fog65iag/subgraphs/foid-prayer-tiers-fluent-testnet/1.0.0/gn" \
  -H "Content-Type: application/json" \
  -d '{"query": "{ tierUps(first: 5) { user newTier tierName } }"}'
```

---

## Part 6: Old Subgraph Directory Cleanup

### Options:

**Option A (Recommended): Git-archive, then delete**
```bash
# The old directories still exist at foid-subgraph/{swipe,prayer,loreboard-governance}
# Create a single commit archiving them, then remove
git rm -r foid-subgraph/swipe foid-subgraph/prayer foid-subgraph/loreboard-governance
```

The old code is preserved in git history. The README.md should note the migration.

**Option B: Move to a `legacy/` subfolder**
```bash
mkdir foid-subgraph/legacy
mv foid-subgraph/swipe foid-subgraph/legacy/
mv foid-subgraph/prayer foid-subgraph/legacy/
mv foid-subgraph/loreboard-governance foid-subgraph/legacy/
```

This keeps them visible but clearly marked as legacy.

**Recommendation:** Option A. The old contracts are at different addresses and the events are structurally different. There is no migration path — the new subgraphs start fresh from the new contract deployment blocks. Git history preserves the old code if needed for reference.

---

## Part 7: Implementation Sequence

### Phase 1: Subgraph creation and deployment (do first)
1. Create `foid-subgraph/loreboard/` directory structure
2. Extract Loreboard ABI from Forge output
3. Write `schema.graphql`, `subgraph.yaml`, `goldsky.json`, `src/mapping.ts`
4. Create `foid-subgraph/prayer-tiers/` directory structure
5. Extract PrayerTiers ABI from Forge output
6. Write `schema.graphql`, `subgraph.yaml`, `goldsky.json`, `src/mapping.ts`
7. Deploy both to GoldSky
8. Verify with test queries; wait for indexing to complete

### Phase 2: Frontend migration (after subgraphs are synced)
9. Update `config.ts` with new SUBGRAPH_URLS
10. Rewrite `dataCollector.ts` query functions for new schema
11. Rewrite `foid_bot/src/goldsky.ts` for new schema
12. Update `api/votes/route.ts` for new schema
13. Update env vars in `.env.render`, `.env.vercel-prod`, etc.
14. Update `render.yaml` env var names
15. Update `docs/OPERATOR_RUNBOOK.md`
16. Update `foid-subgraph/README.md`

### Phase 3: Cleanup
17. Remove old subgraph directories via git
18. Remove old `foid-subgraph/abis/` empty directory

---

## Potential Challenges

1. **GoldSky `fluent-testnet` chain support** — The old subgraphs used `fluent-testnet` successfully, so this chain is supported. No issue expected.

2. **`int32` handling in AssemblyScript** — The `x` and `y` fields are `int32` (signed). In the old mappings, `event.params.x` is used directly for `Int!` fields (which are i32 in AssemblyScript). This should work the same way for the new contract.

3. **`uint64` → BigInt conversion** — The `votingEndsAt` field in `ProposalCreated` is `uint64`. The old swipe mapping used `BigInt.fromI64(event.params.param2)` for `VoucherIssued.expiresAt` (also `uint64`). Same pattern applies. Note: `BigInt.fromI64()` takes an `i64`, and the generated code from a `uint64` ABI type should provide a compatible value. If GoldSky's code generator produces a `BigInt` directly for `uint64`, then no conversion is needed — just assign directly.

4. **Three-subgraph limit** — With 2 new subgraphs, 1 slot remains. If old subgraphs still exist on GoldSky, they must be deleted first.

5. **Subgraph sync time** — The Loreboard starts at block 22865492. If the current head is not far past that, sync should be fast. PrayerTiers starts at 21984763 (earlier), but has very few events (TierUp only fires on tier progressions), so also fast.

6. **Frontend breaking changes during migration** — Between deploying new subgraphs and updating frontend code, the old URLs will 404 (subgraphs deleted). The frontend has try/catch around all subgraph queries and degrades gracefully. Plan: deploy subgraphs first, then deploy frontend updates.

---

## Updated README.md for foid-subgraph/

```markdown
# FOID Subgraphs (GoldSky)

Two subgraphs for indexing FOID on-chain events on Fluent Testnet (chain 20994).

## Subgraphs

| Name | Contract | Events |
|------|----------|--------|
| **loreboard** | Loreboard (`0xf9b7...`) | Proposals, votes, placements, removals, manifest |
| **prayer-tiers** | PrayerTiers (`0x36ed...`) | Tier progression events |

## Deploy to GoldSky

    # Install GoldSky CLI
    curl https://goldsky.com | sh

    # Login
    goldsky login

    # Deploy each subgraph
    cd loreboard
    goldsky subgraph deploy foid-loreboard-fluent-testnet/1.0.0 --path .

    cd ../prayer-tiers
    goldsky subgraph deploy foid-prayer-tiers-fluent-testnet/1.0.0 --path .

## Environment Variables

Set these to override default subgraph URLs:
- `GOLDSKY_LOREBOARD_URL`
- `GOLDSKY_PRAYER_TIERS_URL`

## Legacy

The previous subgraphs (swipe, prayer, loreboard-governance) tracked the old
Swipe/SwipeLoreboard/PrayerRegistry contracts and were deleted March 2026.
See git history for their source.
```
