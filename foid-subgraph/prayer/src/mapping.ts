import {
  PrayerSubmitted as PrayerSubmittedEvent,
} from "../generated/PrayerRegistry/PrayerRegistry";
import { PrayerSubmitted } from "../generated/schema";

export function handlePrayerSubmitted(event: PrayerSubmittedEvent): void {
  let entity = new PrayerSubmitted(event.transaction.hash.concatI32(event.logIndex.toI32()));
  entity.user = event.params.user;
  entity.prayerHash = event.params.prayerHash;
  entity.timestamp = event.params.timestamp;
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;
  entity.save();
}
