export const LOREBOARD_VOTING_ABI = [
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "epochId", type: "uint256" },
      { indexed: true, name: "placementId", type: "bytes32" },
      { indexed: false, name: "registeredAt", type: "uint64" },
      { indexed: false, name: "voteEndsAt", type: "uint64" },
    ],
    name: "PendingPlacementRegistered",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "epochId", type: "uint256" },
      { indexed: true, name: "placementId", type: "bytes32" },
      { indexed: true, name: "voter", type: "address" },
      { indexed: false, name: "support", type: "bool" },
      { indexed: false, name: "weight", type: "uint256" },
    ],
    name: "VoteCast",
    type: "event",
  },
  {
    inputs: [{ name: "t", type: "uint64" }],
    name: "epochAt",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;
