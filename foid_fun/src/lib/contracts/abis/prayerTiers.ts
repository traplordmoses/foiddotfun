export const PRAYER_TIERS_ABI = [
  {
    type: "constructor",
    inputs: [{ name: "_prayerMirror", type: "address" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getTier",
    inputs: [{ name: "streakDays", type: "uint256" }],
    outputs: [
      { name: "tierLevel", type: "uint8" },
      { name: "tierName", type: "string" },
      { name: "multiplierBps", type: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getTierForAddress",
    inputs: [{ name: "user", type: "address" }],
    outputs: [
      { name: "tierLevel", type: "uint8" },
      { name: "tierName", type: "string" },
      { name: "multiplierBps", type: "uint256" },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getTierForAddressView",
    inputs: [{ name: "user", type: "address" }],
    outputs: [
      { name: "tierLevel", type: "uint8" },
      { name: "tierName", type: "string" },
      { name: "multiplierBps", type: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getMultiplierBps",
    inputs: [{ name: "streakDays", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getAllTiers",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "tuple[10]",
        components: [
          { name: "level", type: "uint8" },
          { name: "name", type: "string" },
          { name: "minDays", type: "uint256" },
          { name: "multiplierBps", type: "uint256" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getTierDef",
    inputs: [{ name: "level", type: "uint8" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "level", type: "uint8" },
          { name: "name", type: "string" },
          { name: "minDays", type: "uint256" },
          { name: "multiplierBps", type: "uint256" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "highestTier",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "owner",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "prayerMirror",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "TierUp",
    anonymous: false,
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "newTier", type: "uint8", indexed: false },
      { name: "tierName", type: "string", indexed: false },
    ],
  },
  {
    type: "event",
    name: "OwnerChanged",
    anonymous: false,
    inputs: [
      { name: "oldOwner", type: "address", indexed: true },
      { name: "newOwner", type: "address", indexed: true },
    ],
  },
] as const;
