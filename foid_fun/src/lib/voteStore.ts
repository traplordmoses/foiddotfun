export type StoredVote = {
  proposalId: number;
  approve: boolean;
  deadline: number;
  signature: string;
  voter: string;
  timestamp: number;
};

// Global singleton — survives hot-reload in dev
const globalForVotes = globalThis as unknown as {
  __foidVoteStore?: Map<number, StoredVote[]>;
};
export const voteStore =
  globalForVotes.__foidVoteStore ?? new Map<number, StoredVote[]>();
globalForVotes.__foidVoteStore = voteStore;

export function getVoteCounts(proposalId: number) {
  const votes = voteStore.get(proposalId) ?? [];
  return {
    forCount: votes.filter((v) => v.approve).length,
    againstCount: votes.filter((v) => !v.approve).length,
    totalVotes: votes.length,
  };
}
