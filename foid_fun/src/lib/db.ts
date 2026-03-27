import Database from "better-sqlite3";
import path from "path";

/* ─── HMR-safe singleton ─── */
const g = globalThis as typeof globalThis & { __foidDb?: Database.Database };

function initDb(): Database.Database {
  const dbPath = path.join(process.cwd(), "data", "foid.db");
  const db = new Database(dbPath);

  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = FULL");
  db.pragma("foreign_keys = ON");

  /* ── swipe_votes — create or migrate ── */
  const votesTableExists = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='swipe_votes'")
    .get();

  if (!votesTableExists) {
    db.exec(`
      CREATE TABLE swipe_votes (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        proposal_id INTEGER NOT NULL,
        voter       TEXT    NOT NULL,
        approve     INTEGER NOT NULL,
        deadline    INTEGER NOT NULL,
        signature   TEXT    NOT NULL,
        weight      INTEGER DEFAULT 100,
        created_at  INTEGER DEFAULT (unixepoch()),
        UNIQUE(proposal_id, voter)
      );
      CREATE INDEX IF NOT EXISTS idx_votes_proposal ON swipe_votes(proposal_id);
      CREATE INDEX IF NOT EXISTS idx_votes_voter    ON swipe_votes(voter);
    `);
  } else {
    // Migrate: add weight column if missing
    try { db.exec("ALTER TABLE swipe_votes ADD COLUMN weight INTEGER DEFAULT 100"); } catch { /* already exists */ }
    try { db.exec("ALTER TABLE swipe_votes ADD COLUMN created_at INTEGER DEFAULT 0"); } catch { /* already exists */ }
    // Ensure indexes exist
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_votes_proposal ON swipe_votes(proposal_id);
      CREATE INDEX IF NOT EXISTS idx_votes_voter    ON swipe_votes(voter);
    `);
  }

  /* ── rate_limits — drop old schema and recreate ── */
  const rlTableExists = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='rate_limits'")
    .get();

  if (rlTableExists) {
    // Check if it has the new schema (separate wallet + action columns)
    const rlCols = db.prepare("PRAGMA table_info(rate_limits)").all() as Array<{ name: string }>;
    const rlColNames = new Set(rlCols.map((c) => c.name));
    if (!rlColNames.has("wallet") || !rlColNames.has("action")) {
      // Old schema with wallet_action combined column — drop and recreate
      db.exec("DROP TABLE rate_limits");
      db.exec(`
        CREATE TABLE rate_limits (
          id        INTEGER PRIMARY KEY AUTOINCREMENT,
          wallet    TEXT    NOT NULL,
          action    TEXT    NOT NULL,
          timestamp INTEGER NOT NULL
        );
        CREATE INDEX idx_rl_wallet_action ON rate_limits(wallet, action);
      `);
    }
  } else {
    db.exec(`
      CREATE TABLE rate_limits (
        id        INTEGER PRIMARY KEY AUTOINCREMENT,
        wallet    TEXT    NOT NULL,
        action    TEXT    NOT NULL,
        timestamp INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_rl_wallet_action ON rate_limits(wallet, action);
    `);
  }

  return db;
}

if (!g.__foidDb) {
  g.__foidDb = initDb();
}

export const db: Database.Database = g.__foidDb!;

/* ─── Prepared statements ─── */

export const insertVote = db.prepare(`
  INSERT OR IGNORE INTO swipe_votes (proposal_id, voter, approve, deadline, signature, weight)
  VALUES (@proposalId, @voter, @approve, @deadline, @signature, @weight)
`);

export const getVotesByProposal = db.prepare(`
  SELECT proposal_id AS proposalId, voter, approve, deadline, signature, weight, created_at AS createdAt
  FROM swipe_votes WHERE proposal_id = ?
`);

export const getVoteCountsByProposal = db.prepare(`
  SELECT
    SUM(CASE WHEN approve = 1 THEN 1 ELSE 0 END) AS forCount,
    SUM(CASE WHEN approve = 0 THEN 1 ELSE 0 END) AS againstCount,
    COUNT(*) AS totalVotes
  FROM swipe_votes WHERE proposal_id = ?
`);

export const hasVoted = db.prepare(`
  SELECT 1 FROM swipe_votes WHERE proposal_id = ? AND voter = ? LIMIT 1
`);

export const getVotesForFinalize = db.prepare(`
  SELECT voter, approve, deadline, signature
  FROM swipe_votes WHERE proposal_id = ?
  ORDER BY created_at ASC
`);

/* ── Rate limit helpers ── */

export const insertRateLimit = db.prepare(`
  INSERT INTO rate_limits (wallet, action, timestamp) VALUES (?, ?, ?)
`);

export const countRecentActions = db.prepare(`
  SELECT COUNT(*) AS cnt FROM rate_limits
  WHERE wallet = ? AND action = ? AND timestamp > ?
`);

export const pruneOldRateLimits = db.prepare(`
  DELETE FROM rate_limits WHERE timestamp < ?
`);
