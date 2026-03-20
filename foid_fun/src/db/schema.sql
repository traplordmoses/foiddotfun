-- FOID persistent storage schema
-- Replaces in-memory stores: _store.ts, proposalStore.ts, voteStore.ts, server/store.ts, rateLimit.ts

-- ─── Loreboard referendum proposals ───
-- Replaces: _store.ts proposals[] array
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
  is_votable    INTEGER,  -- boolean as 0/1
  yes_count     INTEGER NOT NULL DEFAULT 0,
  no_count      INTEGER NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'proposed',  -- proposed|accepted|rejected|expired
  created_at    INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals(status);
CREATE INDEX IF NOT EXISTS idx_proposals_epoch ON proposals(epoch_submitted);

-- ─── Referendum voters (per-proposal) ───
-- Replaces: _store.ts proposal.voters Record<string, boolean>
CREATE TABLE IF NOT EXISTS proposal_voters (
  proposal_id   TEXT NOT NULL,
  voter         TEXT NOT NULL,   -- lowercase wallet address
  vote_yes      INTEGER NOT NULL, -- 0 or 1
  PRIMARY KEY (proposal_id, voter),
  FOREIGN KEY (proposal_id) REFERENCES proposals(id) ON DELETE CASCADE
);

-- ─── Accepted placements (current board state) ───
-- Replaces: _store.ts accepted[] array
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

-- ─── Manifest history ───
-- Replaces: _store.ts manifestHistory + manifest cache file
CREATE TABLE IF NOT EXISTS manifests (
  epoch         INTEGER PRIMARY KEY,
  cid           TEXT NOT NULL DEFAULT '',
  finalized_at  INTEGER NOT NULL,
  placements_json TEXT NOT NULL  -- JSON array of Placement objects
);

-- ─── Proposal metadata store ───
-- Replaces: proposalStore.ts Map<string, StoredProposal>
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

-- ─── Swipe votes (EIP-712 signed ballots) ───
-- Replaces: voteStore.ts Map<number, StoredVote[]>
CREATE TABLE IF NOT EXISTS swipe_votes (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  proposal_id   INTEGER NOT NULL,
  voter         TEXT NOT NULL,     -- lowercase wallet address
  approve       INTEGER NOT NULL,  -- 0 or 1
  deadline      INTEGER NOT NULL,
  signature     TEXT NOT NULL,
  timestamp     INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_swipe_votes_proposal ON swipe_votes(proposal_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_swipe_votes_unique ON swipe_votes(proposal_id, voter);

-- ─── Placement intents (server/store.ts pending) ───
-- Replaces: server/store.ts pendingByEpoch Map
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
  fit_mode      TEXT  -- 'contain' or 'cover'
);

CREATE INDEX IF NOT EXISTS idx_intents_epoch ON placement_intents(epoch);

-- ─── Rate limiting ───
-- Replaces: rateLimit.ts in-memory Map
CREATE TABLE IF NOT EXISTS rate_limits (
  wallet_action TEXT NOT NULL,  -- "0xabc:propose"
  timestamp     INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_key ON rate_limits(wallet_action);

-- ─── Key-value config ───
-- For storing latest_epoch_finalized and other scalar state
CREATE TABLE IF NOT EXISTS kv (
  key           TEXT PRIMARY KEY,
  value         TEXT NOT NULL
);

-- ─── Additional performance indexes ───
CREATE INDEX IF NOT EXISTS idx_proposal_voters_voter ON proposal_voters(voter);
CREATE INDEX IF NOT EXISTS idx_swipe_votes_timestamp ON swipe_votes(timestamp);
CREATE INDEX IF NOT EXISTS idx_intents_owner ON placement_intents(owner);

-- ─── X/Twitter account pairings ───
-- Opt-in self-declared handle, proven by wallet signature.
-- Used by Foid Mummy agent for content generation.
CREATE TABLE IF NOT EXISTS x_pairings (
  wallet        TEXT PRIMARY KEY,      -- lowercase 0x address
  handle        TEXT NOT NULL,         -- X handle without @
  signature     TEXT NOT NULL,         -- EIP-191 signature proving wallet ownership
  paired_at     INTEGER NOT NULL,      -- unix ms
  active        INTEGER NOT NULL DEFAULT 1  -- soft delete: 0 = unpaired
);

CREATE INDEX IF NOT EXISTS idx_x_pairings_handle ON x_pairings(handle);
