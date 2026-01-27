export const LOREBOARD_BOARD_ABI = [
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "id", type: "bytes32" },
      { indexed: true, name: "bidder", type: "address" },
      { indexed: false, name: "epoch", type: "uint32" },
      { indexed: false, name: "x", type: "int32" },
      { indexed: false, name: "y", type: "int32" },
      { indexed: false, name: "w", type: "uint32" },
      { indexed: false, name: "h", type: "uint32" },
      { indexed: false, name: "cells", type: "uint32" },
      { indexed: false, name: "bidPerCellWei", type: "uint96" },
      { indexed: false, name: "cidHash", type: "bytes32" },
    ],
    name: "PlacementProposed",
    type: "event",
  },
  {
    inputs: [{ name: "id", type: "bytes32" }],
    name: "cidOf",
    outputs: [{ name: "", type: "bytes" }],
    stateMutability: "view",
    type: "function",
  },
] as const;
