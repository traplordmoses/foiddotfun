export const FOID_TREST_DIRECT_ABI = [
  {
    type: "constructor",
    inputs: [
      { name: "_foidTrest", type: "address" },
      { name: "_feeRecipient", type: "address" },
      { name: "_placementFeeWei", type: "uint256" },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "feeRecipient",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "foidTrest",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
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
    name: "placeDirect",
    inputs: [
      { name: "ipfsCid", type: "string" },
      { name: "title", type: "string" },
      { name: "description", type: "string" },
    ],
    outputs: [{ name: "entryId", type: "uint256" }],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "placementFeeWei",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "setFeeRecipient",
    inputs: [{ name: "newRecipient", type: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setOwner",
    inputs: [{ name: "newOwner", type: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setPlacementFee",
    inputs: [{ name: "newFee", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "event",
    name: "DirectPlacement",
    anonymous: false,
    inputs: [
      { name: "entryId", type: "uint256", indexed: true },
      { name: "creator", type: "address", indexed: true },
      { name: "feePaid", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "FeeRecipientChanged",
    anonymous: false,
    inputs: [
      { name: "oldRecipient", type: "address", indexed: true },
      { name: "newRecipient", type: "address", indexed: true },
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
  {
    type: "event",
    name: "PlacementFeeChanged",
    anonymous: false,
    inputs: [
      { name: "oldFee", type: "uint256", indexed: false },
      { name: "newFee", type: "uint256", indexed: false },
    ],
  },
] as const;
