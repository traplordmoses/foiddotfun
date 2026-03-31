import { BigInt } from "@graphprotocol/graph-ts";
import {
  TierUp as TierUpEvent,
} from "../generated/PrayerTiers/PrayerTiers";
import {
  PrayerSubmitted as PrayerSubmittedEvent,
} from "../generated/PrayerRegistry/PrayerRegistry";
import {
  TierUp,
  UserTier,
  PrayerSubmitted,
} from "../generated/schema";

// ── PrayerTiers events ──

export function handleTierUp(event: TierUpEvent): void {
  // Event log entity
  let tierUp = new TierUp(event.transaction.hash.concatI32(event.logIndex.toI32()).toHexString());
  tierUp.user = event.params.user;
  tierUp.newTier = event.params.newTier;
  tierUp.tierName = event.params.tierName;
  tierUp.blockNumber = event.block.number;
  tierUp.blockTimestamp = event.block.timestamp;
  tierUp.transactionHash = event.transaction.hash;
  tierUp.save();

  // Upsert UserTier (keyed by address)
  let userId = event.params.user.toHexString();
  let userTier = UserTier.load(userId);
  if (!userTier) {
    userTier = new UserTier(userId);
    userTier.user = event.params.user;
  }
  userTier.currentTier = event.params.newTier;
  userTier.tierName = event.params.tierName;
  userTier.lastUpdated = event.block.timestamp;
  userTier.save();
}

// ── PrayerRegistry events ──

export function handlePrayerSubmitted(event: PrayerSubmittedEvent): void {
  let entity = new PrayerSubmitted(event.transaction.hash.concatI32(event.logIndex.toI32()).toHexString());
  entity.user = event.params.user;
  entity.prayerHash = event.params.prayerHash;
  entity.timestamp = event.params.timestamp;
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;
  entity.save();
}
