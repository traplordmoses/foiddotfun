// Persistent proposal metadata store — SQLite-backed.
// Same export signatures as the original in-memory version.
import { getDb } from "@/db/db";

export type StoredProposal = {
  id: string;
  owner?: string;
  cid?: string;
  cidHash?: `0x${string}`;
  name?: string;
  filename?: string;
  mime?: "image/png" | "image/jpeg";
  width?: number;
  height?: number;
  epoch?: number;
  rect?: { x: number; y: number; w: number; h: number };
  bidPerCellWei?: string | number | bigint;
};

function rowToStored(row: Record<string, unknown>): StoredProposal {
  const result: StoredProposal = { id: row.id as string };
  if (row.owner != null) result.owner = row.owner as string;
  if (row.cid != null) result.cid = row.cid as string;
  if (row.cid_hash != null) result.cidHash = row.cid_hash as `0x${string}`;
  if (row.name != null) result.name = row.name as string;
  if (row.filename != null) result.filename = row.filename as string;
  if (row.mime != null) result.mime = row.mime as "image/png" | "image/jpeg";
  if (row.width != null) result.width = row.width as number;
  if (row.height != null) result.height = row.height as number;
  if (row.epoch != null) result.epoch = row.epoch as number;
  if (row.rect_x != null && row.rect_y != null && row.rect_w != null && row.rect_h != null) {
    result.rect = {
      x: row.rect_x as number,
      y: row.rect_y as number,
      w: row.rect_w as number,
      h: row.rect_h as number,
    };
  }
  if (row.bid_per_cell_wei != null) result.bidPerCellWei = row.bid_per_cell_wei as string;
  return result;
}

class _ProposalStore {
  get(id: string): StoredProposal | undefined {
    const db = getDb();
    const row = db.prepare("SELECT * FROM proposal_metadata WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    if (!row) return undefined;
    return rowToStored(row);
  }

  set(id: string, value: StoredProposal) {
    const db = getDb();
    db.prepare(`
      INSERT OR REPLACE INTO proposal_metadata
        (id, owner, cid, cid_hash, name, filename, mime, width, height, epoch, rect_x, rect_y, rect_w, rect_h, bid_per_cell_wei)
      VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      value.owner ?? null,
      value.cid ?? null,
      value.cidHash ?? null,
      value.name ?? null,
      value.filename ?? null,
      value.mime ?? null,
      value.width ?? null,
      value.height ?? null,
      value.epoch ?? null,
      value.rect?.x ?? null,
      value.rect?.y ?? null,
      value.rect?.w ?? null,
      value.rect?.h ?? null,
      value.bidPerCellWei != null ? String(value.bidPerCellWei) : null,
    );
  }

  upsert(value: StoredProposal) {
    if (!value?.id) return;
    const prev = this.get(value.id);
    this.set(value.id, { ...prev, ...value, id: value.id });
  }

  has(id: string): boolean {
    const db = getDb();
    const row = db.prepare("SELECT 1 FROM proposal_metadata WHERE id = ?").get(id);
    return !!row;
  }

  delete(id: string) {
    const db = getDb();
    db.prepare("DELETE FROM proposal_metadata WHERE id = ?").run(id);
  }

  all(): StoredProposal[] {
    const db = getDb();
    const rows = db.prepare("SELECT * FROM proposal_metadata").all() as Record<string, unknown>[];
    return rows.map(rowToStored);
  }
}

export const ProposalStore = new _ProposalStore();
