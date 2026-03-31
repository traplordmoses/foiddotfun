import { BigInt } from "@graphprotocol/graph-ts";
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
import {
  Proposal,
  Vote,
  Placement,
  ManifestUpdate,
} from "../generated/schema";

// ── Proposals ──

export function handleProposalCreated(event: ProposalCreatedEvent): void {
  let id = event.params.proposalId.toString();
  let entity = new Proposal(id);
  entity.proposalId = event.params.proposalId;
  entity.proposer = event.params.proposer;
  entity.ipfsCid = event.params.ipfsCid;
  entity.x = event.params.x;
  entity.y = event.params.y;
  entity.w = event.params.w.toI32();
  entity.h = event.params.h.toI32();
  entity.votingEndsAt = BigInt.fromI64(event.params.votingEndsAt);
  entity.finalized = false;
  entity.approved = false;
  entity.overlapRejected = false;
  entity.weightFor = BigInt.zero();
  entity.weightAgainst = BigInt.zero();
  entity.voteCount = 0;
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;
  entity.save();
}

// ── Votes ──

export function handleVoteCast(event: VoteCastEvent): void {
  let voteId = event.transaction.hash.concatI32(event.logIndex.toI32());
  let entity = new Vote(voteId);
  entity.proposal = event.params.proposalId.toString();
  entity.voter = event.params.voter;
  entity.approve = event.params.approve;
  entity.weight = event.params.weight;
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;
  entity.save();

  // Update proposal tallies
  let proposal = Proposal.load(event.params.proposalId.toString());
  if (proposal) {
    if (event.params.approve) {
      proposal.weightFor = proposal.weightFor.plus(event.params.weight);
    } else {
      proposal.weightAgainst = proposal.weightAgainst.plus(event.params.weight);
    }
    proposal.voteCount = proposal.voteCount + 1;
    proposal.save();
  }
}

// ── Finalization ──

export function handleFinalized(event: FinalizedEvent): void {
  let proposal = Proposal.load(event.params.proposalId.toString());
  if (proposal) {
    proposal.finalized = true;
    proposal.approved = event.params.approved;
    // Use authoritative final tallies from the event
    proposal.weightFor = event.params.weightFor;
    proposal.weightAgainst = event.params.weightAgainst;
    proposal.save();
  }
}

export function handleProposalRejected(event: ProposalRejectedEvent): void {
  // Finalized handler already sets approved=false via the Finalized event.
  // This handler exists to ensure rejection is recorded even if event ordering differs.
  let proposal = Proposal.load(event.params.proposalId.toString());
  if (proposal) {
    proposal.finalized = true;
    proposal.approved = false;
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

// ── Placements ──

export function handlePlacementCreated(event: PlacementCreatedEvent): void {
  let id = event.params.placementId.toString();
  let entity = new Placement(id);
  entity.placementId = event.params.placementId;
  entity.proposalId = event.params.proposalId;
  entity.placer = event.params.placer;
  entity.ipfsCid = event.params.ipfsCid;
  entity.x = event.params.x;
  entity.y = event.params.y;
  entity.w = event.params.w.toI32();
  entity.h = event.params.h.toI32();
  entity.removed = false;
  entity.removalType = null;
  entity.removedBy = null;
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.save();

  // Link placement to proposal
  let proposal = Proposal.load(event.params.proposalId.toString());
  if (proposal) {
    proposal.placement = id;
    proposal.save();
  }
}

export function handlePlacementSelfRemoved(event: PlacementSelfRemovedEvent): void {
  let placement = Placement.load(event.params.placementId.toString());
  if (placement) {
    placement.removed = true;
    placement.removalType = "self";
    placement.removedBy = event.params.placer;
    placement.save();
  }
}

export function handlePlacementEmergencyRemoved(event: PlacementEmergencyRemovedEvent): void {
  let placement = Placement.load(event.params.placementId.toString());
  if (placement) {
    placement.removed = true;
    placement.removalType = "emergency";
    placement.removedBy = event.params.removedBy;
    placement.save();
  }
}

// ── Manifest ──

export function handleManifestUpdated(event: ManifestUpdatedEvent): void {
  let entity = new ManifestUpdate(event.transaction.hash.concatI32(event.logIndex.toI32()));
  entity.cid = event.params.newCid;
  entity.version = event.params.version;
  entity.placementCountAtUpdate = event.params.placementCountAtUpdate;
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;
  entity.save();
}
