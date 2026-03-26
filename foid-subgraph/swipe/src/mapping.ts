import { BigInt } from "@graphprotocol/graph-ts";
import {
  Proposed as ProposedEvent,
  LoreboardProposed as LoreboardProposedEvent,
  Finalized as FinalizedEvent,
  VoucherIssued as VoucherIssuedEvent,
  PlacementClaimed as PlacementClaimedEvent,
} from "../generated/Swipe/Swipe";
import {
  Proposed,
  LoreboardProposed,
  Finalized,
  VoucherIssued,
  PlacementClaimed,
} from "../generated/schema";

export function handleProposed(event: ProposedEvent): void {
  let entity = new Proposed(event.transaction.hash.concatI32(event.logIndex.toI32()));
  entity.proposalId = event.params.param0; // indexed proposalId
  entity.proposer = event.params.param1;   // indexed proposer
  entity.ipfsCid = event.params.param2;
  entity.votingEndsAt = event.params.param3;
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;
  entity.save();
}

export function handleLoreboardProposed(event: LoreboardProposedEvent): void {
  let entity = new LoreboardProposed(event.transaction.hash.concatI32(event.logIndex.toI32()));
  entity.proposalId = event.params.param0;
  entity.proposer = event.params.param1;
  entity.ipfsCid = event.params.param2;
  entity.x = event.params.param3;
  entity.y = event.params.param4;
  entity.w = event.params.param5.toI32();
  entity.h = event.params.param6.toI32();
  entity.votingEndsAt = event.params.param7;
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;
  entity.save();
}

export function handleFinalized(event: FinalizedEvent): void {
  let entity = new Finalized(event.transaction.hash.concatI32(event.logIndex.toI32()));
  entity.proposalId = event.params.param0;
  entity.canonized = event.params.param1;
  entity.weightFor = event.params.param2;
  entity.weightAgainst = event.params.param3;
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;
  entity.save();
}

export function handleVoucherIssued(event: VoucherIssuedEvent): void {
  let entity = new VoucherIssued(event.transaction.hash.concatI32(event.logIndex.toI32()));
  entity.proposalId = event.params.param0;
  entity.proposer = event.params.param1;
  entity.expiresAt = BigInt.fromI64(event.params.param2);
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.save();
}

export function handlePlacementClaimed(event: PlacementClaimedEvent): void {
  let entity = new PlacementClaimed(event.transaction.hash.concatI32(event.logIndex.toI32()));
  entity.proposalId = event.params.param0;
  entity.proposer = event.params.param1;
  entity.x = event.params.param2;
  entity.y = event.params.param3;
  entity.w = event.params.param4.toI32();
  entity.h = event.params.param5.toI32();
  entity.ipfsCid = event.params.param6;
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.save();
}
