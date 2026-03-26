import { BigInt } from "@graphprotocol/graph-ts";
import {
  PlacementCreated as PlacementCreatedEvent,
  PlacementFlagged as PlacementFlaggedEvent,
  PlacementRemoved as PlacementRemovedEvent,
  RemovalVoteStarted as RemovalVoteStartedEvent,
  RemovalVoteCast as RemovalVoteCastEvent,
  RemovalVoteResolved as RemovalVoteResolvedEvent,
} from "../generated/SwipeLoreboard/SwipeLoreboard";
import {
  Placement,
  PlacementFlag,
  RemovalVote,
  RemovalVoteCast,
} from "../generated/schema";

export function handlePlacementCreated(event: PlacementCreatedEvent): void {
  let id = event.params.placementId.toString();
  let entity = new Placement(id);
  entity.placementId = event.params.placementId;
  entity.placer = event.params.placer;
  entity.x = event.params.x;
  entity.y = event.params.y;
  entity.w = event.params.w.toI32();
  entity.h = event.params.h.toI32();
  entity.cells = event.params.cells.toI32();
  entity.removed = false;
  entity.flagCount = 0;
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.save();
}

export function handlePlacementFlagged(event: PlacementFlaggedEvent): void {
  let entity = new PlacementFlag(event.transaction.hash.concatI32(event.logIndex.toI32()));
  entity.placementId = event.params.placementId;
  entity.flagger = event.params.flagger;
  entity.flagCount = event.params.flagCount;
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.save();

  // Update placement flag count
  let placement = Placement.load(event.params.placementId.toString());
  if (placement) {
    placement.flagCount = event.params.flagCount.toI32();
    placement.save();
  }
}

export function handlePlacementRemoved(event: PlacementRemovedEvent): void {
  let placement = Placement.load(event.params.placementId.toString());
  if (placement) {
    placement.removed = true;
    placement.save();
  }
}

export function handleRemovalVoteStarted(event: RemovalVoteStartedEvent): void {
  let entity = new RemovalVote(event.params.voteId.toString());
  entity.placementId = event.params.placementId;
  entity.voteId = event.params.voteId;
  entity.resolved = false;
  entity.removalPassed = false;
  entity.votesFor = BigInt.zero();
  entity.votesAgainst = BigInt.zero();
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.save();
}

export function handleRemovalVoteCast(event: RemovalVoteCastEvent): void {
  let entity = new RemovalVoteCast(event.transaction.hash.concatI32(event.logIndex.toI32()));
  entity.voteId = event.params.voteId;
  entity.voter = event.params.voter;
  entity.support = event.params.support;
  entity.weight = event.params.weight;
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.save();

  // Update vote totals
  let vote = RemovalVote.load(event.params.voteId.toString());
  if (vote) {
    if (event.params.support) {
      vote.votesFor = vote.votesFor.plus(event.params.weight);
    } else {
      vote.votesAgainst = vote.votesAgainst.plus(event.params.weight);
    }
    vote.save();
  }
}

export function handleRemovalVoteResolved(event: RemovalVoteResolvedEvent): void {
  let vote = RemovalVote.load(event.params.voteId.toString());
  if (vote) {
    vote.resolved = true;
    vote.removalPassed = event.params.removed;
    vote.save();
  }
}
