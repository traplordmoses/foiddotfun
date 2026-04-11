// Shared types for the /vote system

export type SwipeDirection = "left" | "right" | "up" | null;

export type SwipeProposal = {
  id: number;
  proposer: string;
  ipfsCid: string;
  createdAt: number;
  votingEndsAt: number;
  finalized: boolean;
  approved: boolean;
  trestEntryId: number;
  forCount: number;
  againstCount: number;
  name?: string;
};

export type OnChainProposal = {
  id: bigint;
  proposer: string;
  ipfsCid: string;
  createdAt: bigint;
  votingEndsAt: bigint;
  finalized: boolean;
  approved: boolean;
  trestEntryId: bigint;
};
