export const LOREBOARD_TREASURY_ABI = [
  {
    inputs: [{ name: "id", type: "bytes32" }],
    name: "accepted",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "id", type: "bytes32" }],
    name: "rejected",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
] as const;
