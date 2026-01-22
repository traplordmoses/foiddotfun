// src/contracts/loreboardVoting.ts
import loreboardVotingAbiJson from "@/abi/loreboardVoting.json" assert { type: "json" };
import type { Abi } from "viem";
import { Hex } from "viem";
import { VOTING_ADDRESS } from "@/config/canonical";

export type PlacementId = Hex;

export const LOREBOARD_VOTING_ADDRESS = VOTING_ADDRESS.toLowerCase() as `0x${string}`;

export const loreboardVotingAbi = loreboardVotingAbiJson as Abi;
