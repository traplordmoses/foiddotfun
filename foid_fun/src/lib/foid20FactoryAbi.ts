export const FOID20_FACTORY_ABI = [
  {
    "type": "function",
    "stateMutability": "nonpayable",
    "name": "deployToken",
    "inputs": [
      { "name": "name_", "type": "string" },
      { "name": "symbol_", "type": "string" },
      { "name": "decimals_", "type": "uint8" },
      { "name": "cap_", "type": "uint256" },
      { "name": "initialMintTo_", "type": "address" },
      { "name": "initialMintAmount_", "type": "uint256" },
      { "name": "userSalt_", "type": "bytes32" }
    ],
    "outputs": [{ "name": "token", "type": "address" }]
  },
  {
    "type": "event",
    "name": "TokenDeployed",
    "inputs": [
      { "indexed": true, "name": "token", "type": "address" },
      { "indexed": true, "name": "creator", "type": "address" },
      { "indexed": false, "name": "name", "type": "string" },
      { "indexed": false, "name": "symbol", "type": "string" },
      { "indexed": false, "name": "decimals", "type": "uint8" },
      { "indexed": false, "name": "cap", "type": "uint256" },
      { "indexed": false, "name": "initialMint", "type": "uint256" },
      { "indexed": false, "name": "initialMintTo", "type": "address" },
      { "indexed": false, "name": "userSalt", "type": "bytes32" },
      { "indexed": false, "name": "namespacedSalt", "type": "bytes32" }
    ],
    "anonymous": false
  }
] as const;
