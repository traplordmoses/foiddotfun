// src/contracts/loreboardVoting.ts
import loreboardVotingAbiJson from "@/abi/loreboardVoting.json" assert { type: "json" };
import type { Abi } from "viem";
import { Address, Hex } from "viem";
import { CANONICAL_ADDRESSES, requireCanonicalAddress } from "@/config/canonical";

export type PlacementId = Hex;

const votingAddressEnv =
  process.env.NEXT_PUBLIC_LOREBOARD_VOTING_ADDRESS ??
  process.env.LOREBOARD_VOTING_ADDRESS;

export const LOREBOARD_VOTING_ADDRESS = requireCanonicalAddress({
  label: "LOREBOARD_VOTING_ADDRESS",
  envValue: votingAddressEnv,
  expected: CANONICAL_ADDRESSES.voting,
  envHint: "NEXT_PUBLIC_LOREBOARD_VOTING_ADDRESS or LOREBOARD_VOTING_ADDRESS",
}) as Address;

export const loreboardVotingAbi = loreboardVotingAbiJson as Abi;
