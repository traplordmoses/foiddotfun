// Persistent swipe vote store — SQLite-backed.
// Same export signatures as the original in-memory version.
import { getDb } from "@/db/db";

export type StoredVote = {
  proposalId: number;
  approve: boolean;
  deadline: number;
  signature: string;
  voter: string;
  timestamp: number;
};

type VoteRow = {
  proposal_id: number;
  voter: string;
  approve: number;
  deadline: number;
  signature: string;
  timestamp: number;
};

function rowToVote(row: VoteRow): StoredVote {
  return {
    proposalId: row.proposal_id,
    approve: row.approve === 1,
    deadline: row.deadline,
    signature: row.signature,
    voter: row.voter,
    timestamp: row.timestamp,
  };
}

// Proxy object that implements Map-like interface backed by SQLite
export const voteStore = {
  get(proposalId: number): StoredVote[] | undefined {
    const db = getDb();
    const rows = db
      .prepare("SELECT * FROM swipe_votes WHERE proposal_id = ? ORDER BY timestamp ASC")
      .all(proposalId) as VoteRow[];
    return rows.length > 0 ? rows.map(rowToVote) : undefined;
  },

  set(proposalId: number, votes: StoredVote[]) {
    const db = getDb();
    const tx = db.transaction(() => {
      db.prepare("DELETE FROM swipe_votes WHERE proposal_id = ?").run(proposalId);
      const insert = db.prepare(`
        INSERT INTO swipe_votes (proposal_id, voter, approve, deadline, signature, timestamp)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      for (const v of votes) {
        insert.run(v.proposalId, v.voter, v.approve ? 1 : 0, v.deadline, v.signature, v.timestamp);
      }
    });
    tx();
  },

  has(proposalId: number): boolean {
    const db = getDb();
    const row = db.prepare("SELECT 1 FROM swipe_votes WHERE proposal_id = ? LIMIT 1").get(proposalId);
    return !!row;
  },
};

/**
 * Return all EIP-712 signed votes for a proposal in the array format
 * expected by Swipe.finalize() on-chain.
 */
export function getVotesForProposal(proposalId: number): {
  voters: string[];
  approvals: boolean[];
  deadlines: number[];
  signatures: string[];
} {
  const db = getDb();
  const rows = db
    .prepare(
      "SELECT voter, approve, deadline, signature FROM swipe_votes WHERE proposal_id = ? ORDER BY timestamp ASC"
    )
    .all(proposalId) as Array<{
    voter: string;
    approve: number;
    deadline: number;
    signature: string;
  }>;

  const voters: string[] = [];
  const approvals: boolean[] = [];
  const deadlines: number[] = [];
  const signatures: string[] = [];

  for (const r of rows) {
    voters.push(r.voter);
    approvals.push(r.approve === 1);
    deadlines.push(r.deadline);
    signatures.push(r.signature);
  }

  return { voters, approvals, deadlines, signatures };
}

export function getVoteCounts(proposalId: number) {
  try {
    const db = getDb();
    const row = db.prepare(`
      SELECT
        SUM(CASE WHEN approve = 1 THEN 1 ELSE 0 END) as for_count,
        SUM(CASE WHEN approve = 0 THEN 1 ELSE 0 END) as against_count,
        COUNT(*) as total
      FROM swipe_votes WHERE proposal_id = ?
    `).get(proposalId) as { for_count: number | null; against_count: number | null; total: number };

    return {
      forCount: row.for_count ?? 0,
      againstCount: row.against_count ?? 0,
      totalVotes: row.total,
    };
  } catch {
    // SQLite not available (e.g. Vercel serverless) — return zero counts
    return { forCount: 0, againstCount: 0, totalVotes: 0 };
  }
}
