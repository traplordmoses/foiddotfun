export const PRAYER_MIRROR_ABI = [
  {
    inputs: [{ name: "user", type: "address" }],
    name: "get",
    outputs: [
      { name: "currentStreak", type: "uint256" },
      { name: "longestStreak", type: "uint256" },
      { name: "totalPrayers", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;
