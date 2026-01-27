import { getAbiEvent } from "./getAbiEvent";
import { LOREBOARD_BOARD_ABI, LOREBOARD_VOTING_ABI } from "./abis";

export const PlacementProposedEvent = getAbiEvent(
  LOREBOARD_BOARD_ABI,
  "PlacementProposed"
);

export const VoteCastEvent = getAbiEvent(
  LOREBOARD_VOTING_ABI,
  "VoteCast"
);

export const PendingPlacementRegisteredEvent = getAbiEvent(
  LOREBOARD_VOTING_ABI,
  "PendingPlacementRegistered"
);
