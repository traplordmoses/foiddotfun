import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), "data", "foid.db");

// Singleton — one connection per process
const g = globalThis as typeof globalThis & { __foid_db__?: Database.Database };

const SCHEMA = `
CREATE TABLE IF NOT EXISTS proposals (
  id            TEXT PRIMARY KEY,
  owner         TEXT NOT NULL,
  cid           TEXT NOT NULL,
  name          TEXT NOT NULL DEFAULT '',
  mime          TEXT NOT NULL DEFAULT 'image/png',
  rect_x        INTEGER NOT NULL DEFAULT 0,
  rect_y        INTEGER NOT NULL DEFAULT 0,
  rect_w        INTEGER NOT NULL DEFAULT 0,
  rect_h        INTEGER NOT NULL DEFAULT 0,
  cells         INTEGER NOT NULL DEFAULT 0,
  bid_per_cell_wei TEXT NOT NULL DEFAULT '0',
  width         INTEGER,
  height        INTEGER,
  epoch_submitted   INTEGER NOT NULL,
  vote_ends_at_epoch INTEGER NOT NULL,
  vote_ends_at_sec   INTEGER,
  chain_id      TEXT,
  is_votable    INTEGER,
  yes_count     INTEGER NOT NULL DEFAULT 0,
  no_count      INTEGER NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'proposed',
  created_at    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals(status);
CREATE INDEX IF NOT EXISTS idx_proposals_epoch ON proposals(epoch_submitted);

CREATE TABLE IF NOT EXISTS proposal_voters (
  proposal_id   TEXT NOT NULL,
  voter         TEXT NOT NULL,
  vote_yes      INTEGER NOT NULL,
  PRIMARY KEY (proposal_id, voter),
  FOREIGN KEY (proposal_id) REFERENCES proposals(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS accepted_placements (
  id            TEXT PRIMARY KEY,
  owner         TEXT NOT NULL DEFAULT '',
  cid           TEXT NOT NULL,
  name          TEXT NOT NULL DEFAULT '',
  mime          TEXT NOT NULL DEFAULT 'image/png',
  rect_x        INTEGER NOT NULL DEFAULT 0,
  rect_y        INTEGER NOT NULL DEFAULT 0,
  rect_w        INTEGER NOT NULL DEFAULT 0,
  rect_h        INTEGER NOT NULL DEFAULT 0,
  cells         INTEGER NOT NULL DEFAULT 0,
  bid_per_cell_wei TEXT NOT NULL DEFAULT '0',
  width         INTEGER,
  height        INTEGER
);

CREATE TABLE IF NOT EXISTS manifests (
  epoch         INTEGER PRIMARY KEY,
  cid           TEXT NOT NULL DEFAULT '',
  finalized_at  INTEGER NOT NULL,
  placements_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS proposal_metadata (
  id            TEXT PRIMARY KEY,
  owner         TEXT,
  cid           TEXT,
  cid_hash      TEXT,
  name          TEXT,
  filename      TEXT,
  mime          TEXT,
  width         INTEGER,
  height        INTEGER,
  epoch         INTEGER,
  rect_x        INTEGER,
  rect_y        INTEGER,
  rect_w        INTEGER,
  rect_h        INTEGER,
  bid_per_cell_wei TEXT
);

CREATE TABLE IF NOT EXISTS swipe_votes (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  proposal_id   INTEGER NOT NULL,
  voter         TEXT NOT NULL,
  approve       INTEGER NOT NULL,
  deadline      INTEGER NOT NULL,
  signature     TEXT NOT NULL,
  timestamp     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_swipe_votes_proposal ON swipe_votes(proposal_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_swipe_votes_unique ON swipe_votes(proposal_id, voter);

CREATE TABLE IF NOT EXISTS placement_intents (
  id            TEXT PRIMARY KEY,
  epoch         INTEGER NOT NULL,
  owner         TEXT NOT NULL,
  cid           TEXT NOT NULL,
  rect_x        INTEGER NOT NULL DEFAULT 0,
  rect_y        INTEGER NOT NULL DEFAULT 0,
  rect_w        INTEGER NOT NULL DEFAULT 0,
  rect_h        INTEGER NOT NULL DEFAULT 0,
  cells         INTEGER NOT NULL DEFAULT 0,
  fee_per_cell_wei TEXT NOT NULL DEFAULT '0',
  tip_per_cell_wei TEXT NOT NULL DEFAULT '0',
  time_ms       INTEGER NOT NULL,
  name          TEXT,
  mime          TEXT,
  fit_mode      TEXT
);
CREATE INDEX IF NOT EXISTS idx_intents_epoch ON placement_intents(epoch);

CREATE TABLE IF NOT EXISTS rate_limits (
  wallet_action TEXT NOT NULL,
  timestamp     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rate_limits_key ON rate_limits(wallet_action);

CREATE TABLE IF NOT EXISTS kv (
  key           TEXT PRIMARY KEY,
  value         TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_proposal_voters_voter ON proposal_voters(voter);
CREATE INDEX IF NOT EXISTS idx_swipe_votes_timestamp ON swipe_votes(timestamp);
CREATE INDEX IF NOT EXISTS idx_intents_owner ON placement_intents(owner);

CREATE TABLE IF NOT EXISTS x_pairings (
  wallet        TEXT PRIMARY KEY,
  handle        TEXT NOT NULL,
  signature     TEXT NOT NULL,
  paired_at     INTEGER NOT NULL,
  active        INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_x_pairings_handle ON x_pairings(handle);
`;

function initDb(): Database.Database {
  if (g.__foid_db__) return g.__foid_db__;

  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new Database(DB_PATH);

  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.pragma("foreign_keys = ON");

  db.exec(SCHEMA);

  g.__foid_db__ = db;
  return db;
}

let _db: Database.Database | null = null;

/** Get the singleton database connection. Lazily initializes on first call. */
export function getDb(): Database.Database {
  if (!_db) {
    _db = initDb();
  }
  return _db;
}

export default getDb;
