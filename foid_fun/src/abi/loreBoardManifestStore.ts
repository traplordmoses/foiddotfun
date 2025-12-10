export const loreBoardManifestStoreAbi = [
  {
    type: "function",
    name: "latest",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "epoch", type: "uint32" },
      { name: "root", type: "bytes32" },
      { name: "cid", type: "string" },
    ],
  },
  {
    type: "function",
    name: "latestFinalizedEpoch",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint32" }],
  },
  {
    type: "function",
    name: "manifestOf",
    stateMutability: "view",
    inputs: [{ name: "epoch", type: "uint32" }],
    outputs: [
      { name: "root", type: "bytes32" },
      { name: "cid", type: "string" },
    ],
  },
  {
    type: "function",
    name: "anchor",
    stateMutability: "nonpayable",
    inputs: [
      { name: "epoch", type: "uint32" },
      { name: "root", type: "bytes32" },
      { name: "cid", type: "string" },
    ],
    outputs: [],
  },
] as const;
