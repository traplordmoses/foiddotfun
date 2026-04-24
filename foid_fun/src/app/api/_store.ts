// Persistent SQLite store — replaces the in-memory referendum store.
// Every export signature is preserved so consumers need zero changes.
import { type Rect } from "@/lib/grid";
import { currentEpoch, voteWindowEpochs } from "@/lib/epoch";
import { getDb } from "@/db/db";

export type Placement = {
  id: string;
  owner: string;
  cid: string;
  name: string;
  mime: "image/png" | "image/jpeg";
  rect: Rect;
  cells: number;
  bidPerCellWei: string;
  width?: number;
  height?: number;
};

export type ProposalStatus = "proposed" | "accepted" | "rejected" | "expired";

export type Proposal = Placement & {
  epochSubmitted: number;
  voteEndsAtEpoch: number;
  voteEndsAtSec?: number;
  chainId?: string;
  isVotable?: boolean;
  voters: Record<string, boolean>;
  yes: number;
  no: number;
  status: ProposalStatus;
  createdAt: number;
};

export type Manifest = {
  epoch: number;
  finalizedAt: number;
  placements: Placement[];
};

export type StoredManifest = {
  epoch: number;
  placements: Placement[];
  finalizedAt: number;
  cid: string;
};

// ─── Row ↔ Object helpers ───

function placementToRow(p: Placement) {
  return {
    id: p.id,
    owner: p.owner ?? "",
    cid: p.cid,
    name: p.name ?? "",
    mime: p.mime ?? "image/png",
    rect_x: p.rect.x,
    rect_y: p.rect.y,
    rect_w: p.rect.w,
    rect_h: p.rect.h,
    cells: p.cells,
    bid_per_cell_wei: String(p.bidPerCellWei),
    width: p.width ?? null,
    height: p.height ?? null,
  };
}

function rowToPlacement(row: Record<string, unknown>): Placement {
  return {
    id: row.id as string,
    owner: row.owner as string,
    cid: row.cid as string,
    name: (row.name as string) ?? "",
    mime: (row.mime as "image/png" | "image/jpeg") ?? "image/png",
    rect: {
      x: row.rect_x as number,
      y: row.rect_y as number,
      w: row.rect_w as number,
      h: row.rect_h as number,
    },
    cells: row.cells as number,
    bidPerCellWei: (row.bid_per_cell_wei as string) ?? "0",
    width: row.width as number | undefined,
    height: row.height as number | undefined,
  };
}

function rowToProposal(row: Record<string, unknown>): Proposal {
  const db = getDb();
  const voterRows = db
    .prepare("SELECT voter, vote_yes FROM proposal_voters WHERE proposal_id = ?")
    .all(row.id as string) as Array<{ voter: string; vote_yes: number }>;

  const voters: Record<string, boolean> = {};
  for (const v of voterRows) {
    voters[v.voter] = v.vote_yes === 1;
  }

  return {
    ...rowToPlacement(row),
    epochSubmitted: row.epoch_submitted as number,
    voteEndsAtEpoch: row.vote_ends_at_epoch as number,
    voteEndsAtSec: row.vote_ends_at_sec as number | undefined,
    chainId: row.chain_id as string | undefined,
    isVotable: row.is_votable ? true : undefined,
    voters,
    yes: row.yes_count as number,
    no: row.no_count as number,
    status: row.status as ProposalStatus,
    createdAt: row.created_at as number,
  };
}

// ─── Seed data (disabled for mainnet — board starts clean) ───
// To re-enable seeding for dev, uncomment the ensureSeeded() call below.

// function ensureSeeded() { ... }
// try { ensureSeeded(); } catch { /* lazy init if DB not ready yet */ }

// ─── getStore (compatibility shim) ───

export function getStore() {
  return {
    accepted: listAccepted(),
    proposals: listProposals(),
    latestManifest: null,
    latestManifestCID: latestManifestCID(),
    manifestHistory: new Map(),
    yesThreshold: Number(process.env.NEXT_PUBLIC_YES_THRESHOLD ?? 0.51),
    quorum: Number(process.env.NEXT_PUBLIC_QUORUM ?? 5),
    voteWindowEpochs: voteWindowEpochs(),
  };
}

// ─── Proposals ───

export function addProposal(
  p: Omit<Proposal, "yes" | "no" | "voters" | "status" | "createdAt">
): Proposal {
  const db = getDb();
  const now = Date.now();
  db.prepare(`
    INSERT INTO proposals
      (id, owner, cid, name, mime, rect_x, rect_y, rect_w, rect_h, cells,
       bid_per_cell_wei, width, height, epoch_submitted, vote_ends_at_epoch,
       vote_ends_at_sec, chain_id, is_votable, yes_count, no_count, status, created_at)
    VALUES
      (@id, @owner, @cid, @name, @mime, @rect_x, @rect_y, @rect_w, @rect_h, @cells,
       @bid_per_cell_wei, @width, @height, @epoch_submitted, @vote_ends_at_epoch,
       @vote_ends_at_sec, @chain_id, @is_votable, 0, 0, 'proposed', @created_at)
  `).run({
    id: p.id,
    owner: p.owner,
    cid: p.cid,
    name: p.name ?? "",
    mime: p.mime ?? "image/png",
    rect_x: p.rect.x,
    rect_y: p.rect.y,
    rect_w: p.rect.w,
    rect_h: p.rect.h,
    cells: p.cells,
    bid_per_cell_wei: String(p.bidPerCellWei),
    width: p.width ?? null,
    height: p.height ?? null,
    epoch_submitted: p.epochSubmitted,
    vote_ends_at_epoch: p.voteEndsAtEpoch,
    vote_ends_at_sec: p.voteEndsAtSec ?? null,
    chain_id: p.chainId ?? null,
    is_votable: p.isVotable ? 1 : null,
    created_at: now,
  });

  return {
    ...p,
    voters: {},
    yes: 0,
    no: 0,
    status: "proposed" as ProposalStatus,
    createdAt: now,
  };
}

export function listProposals(): Proposal[] {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM proposals").all() as Record<string, unknown>[];
  return rows.map(rowToProposal);
}

export function listAccepted(): Placement[] {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM accepted_placements").all() as Record<string, unknown>[];
  return rows.map(rowToPlacement);
}

export function replaceAccepted(next: Placement[]) {
  const db = getDb();
  const insert = db.prepare(`
    INSERT OR REPLACE INTO accepted_placements
      (id, owner, cid, name, mime, rect_x, rect_y, rect_w, rect_h, cells, bid_per_cell_wei, width, height)
    VALUES
      (@id, @owner, @cid, @name, @mime, @rect_x, @rect_y, @rect_w, @rect_h, @cells, @bid_per_cell_wei, @width, @height)
  `);
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM accepted_placements").run();
    for (const p of next) {
      insert.run(placementToRow(p));
    }
  });
  tx();
}

export function proposalById(id: string): Proposal | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM proposals WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  return rowToProposal(row);
}

export function vote(proposalId: string, voter: string, yes: boolean): Proposal | null {
  const db = getDb();
  const voterKey = voter.toLowerCase();

  const tx = db.transaction(() => {
    // Upsert voter record
    db.prepare(`
      INSERT INTO proposal_voters (proposal_id, voter, vote_yes)
      VALUES (?, ?, ?)
      ON CONFLICT(proposal_id, voter) DO UPDATE SET vote_yes = excluded.vote_yes
    `).run(proposalId, voterKey, yes ? 1 : 0);

    // Recompute yes/no counts
    const counts = db.prepare(`
      SELECT
        SUM(CASE WHEN vote_yes = 1 THEN 1 ELSE 0 END) as yes_count,
        SUM(CASE WHEN vote_yes = 0 THEN 1 ELSE 0 END) as no_count
      FROM proposal_voters WHERE proposal_id = ?
    `).get(proposalId) as { yes_count: number; no_count: number };

    db.prepare("UPDATE proposals SET yes_count = ?, no_count = ? WHERE id = ?")
      .run(counts.yes_count ?? 0, counts.no_count ?? 0, proposalId);
  });
  tx();

  return proposalById(proposalId);
}

export function gcProposals() {
  const db = getDb();
  const cur = currentEpoch();
  db.prepare(`
    DELETE FROM proposals
    WHERE status != 'proposed' AND vote_ends_at_epoch + 24 < ?
  `).run(cur);
}

// ─── Manifests ───

export function setLatestManifest(m: Manifest, cid: string | null) {
  saveManifestForEpoch(m.epoch, m.placements, m.finalizedAt, cid ?? "");
}

export function latestManifestCID(): string | null {
  const db = getDb();
  const row = db.prepare("SELECT cid FROM manifests ORDER BY epoch DESC LIMIT 1").get() as { cid: string } | undefined;
  return row?.cid ?? null;
}

export function saveManifestForEpoch(
  epoch: number,
  placements: Placement[],
  finalizedAt: number,
  cid: string
) {
  const db = getDb();
  db.prepare(`
    INSERT OR REPLACE INTO manifests (epoch, cid, finalized_at, placements_json)
    VALUES (?, ?, ?, ?)
  `).run(epoch, cid, finalizedAt, JSON.stringify(placements));
}

export function getManifestForEpoch(epoch: number): StoredManifest | null {
  if (!Number.isFinite(epoch)) return null;
  const db = getDb();
  const row = db.prepare("SELECT * FROM manifests WHERE epoch = ?").get(epoch) as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    epoch: row.epoch as number,
    finalizedAt: row.finalized_at as number,
    cid: row.cid as string,
    placements: JSON.parse(row.placements_json as string) as Placement[],
  };
}

export function getLatestManifest(): StoredManifest | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM manifests ORDER BY epoch DESC LIMIT 1").get() as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    epoch: row.epoch as number,
    finalizedAt: row.finalized_at as number,
    cid: row.cid as string,
    placements: JSON.parse(row.placements_json as string) as Placement[],
  };
}

// ─── Onchain linking helpers ───

export function getProposalByOnChainId(onChainId: number): Proposal | null {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM proposals WHERE on_chain_id = ?")
    .get(onChainId) as Record<string, unknown> | undefined;
  if (!row) return null;
  return rowToProposal(row);
}

export function linkOnChainId(localId: string, onChainId: number): void {
  const db = getDb();
  db.prepare("UPDATE proposals SET on_chain_id = ? WHERE id = ?").run(
    onChainId,
    localId
  );
}

export function markFinalized(localId: string): void {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);
  // Determine outcome based on vote counts
  const row = db
    .prepare("SELECT yes_count, no_count FROM proposals WHERE id = ?")
    .get(localId) as { yes_count: number; no_count: number } | undefined;

  const status: ProposalStatus =
    row && row.yes_count > row.no_count ? "accepted" : "rejected";

  db.prepare(
    "UPDATE proposals SET finalized_at = ?, status = ? WHERE id = ?"
  ).run(now, status, localId);
}

export function getUnfinalizedExpiredProposals(): Proposal[] {
  const db = getDb();
  const nowSec = Math.floor(Date.now() / 1000);
  const rows = db
    .prepare(
      `SELECT * FROM proposals
       WHERE status = 'proposed'
         AND vote_ends_at_sec < ?
         AND finalized_at IS NULL`
    )
    .all(nowSec) as Record<string, unknown>[];
  return rows.map(rowToProposal);
}

export function manifestForEpoch(epoch: number | "latest") {
  const record =
    epoch === "latest"
      ? getLatestManifest()
      : typeof epoch === "number"
      ? getManifestForEpoch(epoch)
      : null;
  if (!record) return null;
  return {
    epoch: record.epoch,
    manifest: {
      epoch: record.epoch,
      finalizedAt: record.finalizedAt,
      placements: record.placements,
    },
    cid: record.cid,
  };
}
