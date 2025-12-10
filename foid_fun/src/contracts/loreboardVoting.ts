// src/contracts/loreboardVoting.ts
import { getAddress } from "viem";

export type PlacementId = `0x${string}`;

const votingAddressEnv =
  process.env.NEXT_PUBLIC_LOREBOARD_VOTING_ADDRESS ??
  process.env.LOREBOARD_VOTING_ADDRESS ??
  "";

if (!votingAddressEnv) {
  throw new Error("Missing NEXT_PUBLIC_LOREBOARD_VOTING_ADDRESS/LOREBOARD_VOTING_ADDRESS");
}

export const LOREBOARD_VOTING_ADDRESS = getAddress(votingAddressEnv);

// Minimal ABI surface needed by the frontend + admin helpers.
export const loreboardVotingAbi = [
  {
    type: "function",
    name: "voteOnPlacement",
    stateMutability: "nonpayable",
    inputs: [
      { name: "epochId", type: "uint256" },
      { name: "placementId", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "placementVotes",
    stateMutability: "view",
    inputs: [
      { name: "epochId", type: "uint256" },
      { name: "placementId", type: "bytes32" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "getEpochConfig",
    stateMutability: "view",
    inputs: [{ name: "epochId", type: "uint256" }],
    outputs: [
      { name: "startsAt", type: "uint64" },
      { name: "endsAt", type: "uint64" },
      { name: "finalized", type: "bool" },
    ],
  },
  {
    type: "function",
    name: "isPendingPlacement",
    stateMutability: "view",
    inputs: [
      { name: "epochId", type: "uint256" },
      { name: "placementId", type: "bytes32" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "configureEpoch",
    stateMutability: "nonpayable",
    inputs: [
      { name: "epochId", type: "uint256" },
      { name: "votingStartsAt", type: "uint64" },
      { name: "votingEndsAt", type: "uint64" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "registerPendingPlacement",
    stateMutability: "nonpayable",
    inputs: [
      { name: "epochId", type: "uint256" },
      { name: "placementId", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "setEpochFinalized",
    stateMutability: "nonpayable",
    inputs: [
      { name: "epochId", type: "uint256" },
      { name: "finalized", type: "bool" },
    ],
    outputs: [],
  },
] as const;
