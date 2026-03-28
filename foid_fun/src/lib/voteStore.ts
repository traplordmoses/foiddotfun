import {
  getDb,
  insertVote,
  getVotesByProposal,
  getVoteCountsByProposal,
  hasVoted as hasVotedStmt,
  getVotesForFinalize as getVotesForFinalizeStmt,
} from "@/lib/db";

export type StoredVote = {
  proposalId: number;
  approve: boolean;
  deadline: number;
  signature: string;
  voter: string;
  weight?: number;
  timestamp?: number;
};

/**
 * Add a vote to SQLite. Returns true if inserted, false if duplicate (UNIQUE violation).
 */
export function addVote(vote: StoredVote): boolean {
  const info = insertVote().run({
    proposalId: vote.proposalId,
    voter: vote.voter.toLowerCase(),
    approve: vote.approve ? 1 : 0,
    deadline: vote.deadline,
    signature: vote.signature,
    weight: vote.weight ?? 100,
  });
  return info.changes > 0;
}

/**
 * Get vote counts for a proposal.
 */
export function getVoteCounts(proposalId: number): {
  forCount: number;
  againstCount: number;
  totalVotes: number;
} {
  const row = getVoteCountsByProposal().get(proposalId) as
    | { forCount: number; againstCount: number; totalVotes: number }
    | undefined;
  return row ?? { forCount: 0, againstCount: 0, totalVotes: 0 };
}

/**
 * Get all votes for a proposal (for display / API).
 */
export function getVotes(proposalId: number): StoredVote[] {
  const rows = getVotesByProposal().all(proposalId) as Array<{
    proposalId: number;
    voter: string;
    approve: number;
    deadline: number;
    signature: string;
    weight: number;
    createdAt: number;
  }>;
  return rows.map((r) => ({
    proposalId: r.proposalId,
    voter: r.voter,
    approve: r.approve === 1,
    deadline: r.deadline,
    signature: r.signature,
    weight: r.weight,
    timestamp: r.createdAt,
  }));
}

/**
 * Check if a voter has already voted on a proposal.
 */
export function hasVoted(proposalId: number, voter: string): boolean {
  return !!hasVotedStmt().get(proposalId, voter.toLowerCase());
}

/**
 * Get votes for on-chain finalization (arrays matching contract's finalize() args).
 */
export function getVotesForFinalize(proposalId: number): {
  voters: string[];
  approvals: boolean[];
  deadlines: number[];
  signatures: string[];
} {
  const rows = getVotesForFinalizeStmt().all(proposalId) as Array<{
    voter: string;
    approve: number;
    deadline: number;
    signature: string;
  }>;

  return {
    voters: rows.map((r) => r.voter),
    approvals: rows.map((r) => r.approve === 1),
    deadlines: rows.map((r) => r.deadline),
    signatures: rows.map((r) => r.signature),
  };
}

// Re-export getDb for direct access if needed
export { getDb };
