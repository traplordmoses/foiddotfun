// Persistent placement intent store — SQLite-backed.
// Same export interface as the original in-memory version.
import type { Manifest, PlacementIntent } from "@/lib/types";
import { getDb } from "@/db/db";

type IntentRow = {
  id: string;
  epoch: number;
  owner: string;
  cid: string;
  rect_x: number;
  rect_y: number;
  rect_w: number;
  rect_h: number;
  cells: number;
  fee_per_cell_wei: string;
  tip_per_cell_wei: string;
  time_ms: number;
  name: string | null;
  mime: string | null;
  fit_mode: string | null;
};

function rowToIntent(row: IntentRow): PlacementIntent {
  return {
    id: row.id,
    owner: row.owner,
    cid: row.cid,
    rect: { x: row.rect_x, y: row.rect_y, w: row.rect_w, h: row.rect_h },
    cells: row.cells,
    feePerCellWei: row.fee_per_cell_wei,
    tipPerCellWei: row.tip_per_cell_wei,
    timeMs: row.time_ms,
    name: row.name ?? undefined,
    mime: (row.mime as "image/png" | "image/jpeg") ?? undefined,
    fitMode: (row.fit_mode as "contain" | "cover") ?? undefined,
  };
}

// Proxy object matching the original Store type interface
const store = {
  get pendingByEpoch() {
    const db = getDb();
    const rows = db.prepare("SELECT * FROM placement_intents ORDER BY time_ms ASC").all() as IntentRow[];
    const map = new Map<number, PlacementIntent[]>();
    for (const row of rows) {
      const list = map.get(row.epoch) ?? [];
      list.push(rowToIntent(row));
      map.set(row.epoch, list);
    }
    return {
      get(epochId: number) { return map.get(epochId); },
      set(epochId: number, intents: PlacementIntent[]) {
        const db = getDb();
        const tx = db.transaction(() => {
          db.prepare("DELETE FROM placement_intents WHERE epoch = ?").run(epochId);
          const insert = db.prepare(`
            INSERT INTO placement_intents
              (id, epoch, owner, cid, rect_x, rect_y, rect_w, rect_h, cells,
               fee_per_cell_wei, tip_per_cell_wei, time_ms, name, mime, fit_mode)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          for (const i of intents) {
            insert.run(
              i.id, epochId, i.owner, i.cid,
              i.rect.x, i.rect.y, i.rect.w, i.rect.h,
              i.cells, i.feePerCellWei, i.tipPerCellWei, i.timeMs,
              i.name ?? null, i.mime ?? null, i.fitMode ?? null,
            );
          }
        });
        tx();
      },
    };
  },

  get manifests() {
    // Delegate to the manifests table via _store's manifest functions
    return new Map<number, { cid: string | null; json: Manifest }>();
  },

  get latestEpochFinalized(): number {
    const db = getDb();
    const row = db.prepare("SELECT value FROM kv WHERE key = 'latest_epoch_finalized'").get() as { value: string } | undefined;
    return row ? Number(row.value) : -1;
  },

  set latestEpochFinalized(val: number) {
    const db = getDb();
    db.prepare("INSERT OR REPLACE INTO kv (key, value) VALUES ('latest_epoch_finalized', ?)").run(String(val));
  },
};

export default store;
export { store };
