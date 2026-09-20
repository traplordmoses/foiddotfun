// Durable shared proposal metadata. SQLite is a development-only fallback.
import { supabaseRest, supabaseServerConfigured } from "@/lib/supabaseRest";
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

export function rowToStored(row: Record<string, unknown>): StoredProposal {
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

async function remote(path: string, init: RequestInit = {}) {
  const res = await supabaseRest(`proposal_metadata_v2${path}`, init);
  if (!res?.ok) throw new Error("Proposal metadata storage unavailable");
  return res;
}
function localDb() {
  if (process.env.NODE_ENV === "production") throw new Error("Durable proposal metadata requires Supabase");
  return getDb();
}
class _ProposalStore {
  async get(id: string): Promise<StoredProposal | undefined> {
    if (supabaseServerConfigured()) {
      const rows = await (await remote(`?id=eq.${encodeURIComponent(id)}&select=data&limit=1`)).json();
      return rows[0]?.data;
    }
    const row = localDb().prepare("SELECT * FROM proposal_metadata WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    return row ? rowToStored(row) : undefined;
  }
  async byCid(cid: string): Promise<StoredProposal | undefined> {
    if (supabaseServerConfigured()) {
      const rows = await (await remote(`?cid=eq.${encodeURIComponent(cid)}&select=data&limit=1`)).json();
      return rows[0]?.data;
    }
    const row = localDb().prepare("SELECT * FROM proposal_metadata WHERE cid = ? LIMIT 1").get(cid) as Record<string, unknown> | undefined;
    return row ? rowToStored(row) : undefined;
  }
  async forPage(ids: string[], cids: string[]): Promise<StoredProposal[]> {
    const values: StoredProposal[] = [];
    const keys = [...new Set([...ids, ...cids])];
    const quote = (value: string) => JSON.stringify(value);
    for (let start = 0; start < keys.length; start += 200) {
      const batch = keys.slice(start, start + 200);
      if (supabaseServerConfigured()) {
        const list = batch.map(quote).join(",");
        const params = new URLSearchParams({ or: `(id.in.(${list}),cid.in.(${list}))`, select: "data" });
        const rows = await (await remote(`?${params}`)).json() as { data: StoredProposal }[];
        values.push(...rows.map((r) => r.data));
      } else {
        const placeholders = batch.map(() => "?").join(",");
        values.push(...(localDb().prepare(`SELECT * FROM proposal_metadata WHERE id IN (${placeholders}) OR cid IN (${placeholders})`).all(...batch, ...batch) as Record<string, unknown>[]).map(rowToStored));
      }
    }
    return values;
  }
  async all(): Promise<StoredProposal[]> {
    if (supabaseServerConfigured()) {
      const values: StoredProposal[] = [];
      for (let offset = 0; ; offset += 1000) {
        const rows = await (await remote(`?select=data&order=id&limit=1000&offset=${offset}`)).json() as { data: StoredProposal }[];
        values.push(...rows.map((r) => r.data));
        if (rows.length < 1000) return values;
      }
    }
    return (localDb().prepare("SELECT * FROM proposal_metadata").all() as Record<string, unknown>[]).map(rowToStored);
  }
  async set(id: string, value: StoredProposal) {
    if (supabaseServerConfigured()) {
      await remote("?on_conflict=id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ id, data: JSON.parse(JSON.stringify({ ...value, id }, (_, v) => typeof v === "bigint" ? v.toString() : v)) }) });
      return;
    }
    localDb().prepare(`INSERT OR REPLACE INTO proposal_metadata (id, owner, cid, cid_hash, name, filename, mime, width, height, epoch, rect_x, rect_y, rect_w, rect_h, bid_per_cell_wei) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, value.owner ?? null, value.cid ?? null, value.cidHash ?? null, value.name ?? null, value.filename ?? null, value.mime ?? null, value.width ?? null, value.height ?? null, value.epoch ?? null, value.rect?.x ?? null, value.rect?.y ?? null, value.rect?.w ?? null, value.rect?.h ?? null, value.bidPerCellWei == null ? null : String(value.bidPerCellWei));
  }
  async upsert(value: StoredProposal) { if (value.id) await this.set(value.id, { ...await this.get(value.id), ...value }); }
  async has(id: string) { return Boolean(await this.get(id)); }
  async delete(id: string) {
    if (supabaseServerConfigured()) { await remote(`?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" }); return; }
    localDb().prepare("DELETE FROM proposal_metadata WHERE id = ?").run(id);
  }
}
export const ProposalStore = new _ProposalStore();
