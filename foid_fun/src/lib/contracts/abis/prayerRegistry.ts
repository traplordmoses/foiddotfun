export const PRAYER_REGISTRY_ABI = [
  // Read functions
  {
    type: "function",
    name: "nextAllowedAt",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  // Write functions
  {
    type: "function",
    name: "submitPrayer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "prayerHash", type: "bytes32" },
      { name: "label", type: "uint256" },
      { name: "category", type: "uint256" },
    ],
    outputs: [],
  },
  // Events
  {
    type: "event",
    name: "PrayerSubmitted",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "prayerHash", type: "bytes32", indexed: true },
      { name: "label", type: "uint256", indexed: false },
      { name: "category", type: "uint256", indexed: false },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
  // Custom errors
  {
    type: "error",
    name: "CooldownActive",
    inputs: [{ name: "nextAllowedAt", type: "uint256" }],
  },
  {
    type: "error",
    name: "InvalidPrayer",
    inputs: [],
  },
] as const;
