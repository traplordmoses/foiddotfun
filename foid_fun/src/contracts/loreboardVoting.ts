// src/contracts/loreboardVoting.ts
import loreboardVotingAbiJson from "@/abi/loreboardVoting.json" assert { type: "json" };
import { Address, getAddress, Hex } from "viem";

export type PlacementId = Hex;

const votingAddressEnv =
  process.env.NEXT_PUBLIC_LOREBOARD_VOTING_ADDRESS ??
  process.env.LOREBOARD_VOTING_ADDRESS ??
  "";

if (!votingAddressEnv) {
  throw new Error("Missing NEXT_PUBLIC_LOREBOARD_VOTING_ADDRESS/LOREBOARD_VOTING_ADDRESS");
}

export const LOREBOARD_VOTING_ADDRESS = getAddress(votingAddressEnv) as Address;

export const loreboardVotingAbi = loreboardVotingAbiJson as const;
