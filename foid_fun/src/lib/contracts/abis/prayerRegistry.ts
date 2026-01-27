export const PRAYER_REGISTRY_ABI = [
  {
    inputs: [{ name: "user", type: "address" }],
    name: "nextAllowedAt",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;
