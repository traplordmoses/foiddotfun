// src/lib/pairings.ts
// X-handle pairings (audit S4). Supabase (service role) when configured so
// the data survives deploys on Render's ephemeral disk; SQLite fallback for
// local development. See sql/server_tables.sql.
import { supabaseRest, supabaseServerConfigured } from "@/lib/supabaseRest";

export type Pairing = { wallet: string; handle: string };

async function sqlite() {
  const { getDb } = await import("@/db/db");
  return getDb();
}

export async function getPairing(wallet: string): Promise<Pairing | null> {
  const w = wallet.toLowerCase();
  if (supabaseServerConfigured()) {
    const res = await supabaseRest(`x_pairings?select=wallet,handle&wallet=eq.${w}&active=is.true&limit=1`);
    if (!res || !res.ok) return null;
    const rows = (await res.json()) as Pairing[];
    return rows[0] ?? null;
  }
  const db = await sqlite();
  const row = db
    .prepare("SELECT wallet, handle FROM x_pairings WHERE wallet = ? AND active = 1")
    .get(w) as Pairing | undefined;
  return row ?? null;
}

export async function getPairings(wallets: string[]): Promise<Record<string, string>> {
  const list = wallets.map((w) => w.toLowerCase());
  const out: Record<string, string> = {};
  if (list.length === 0) return out;
  if (supabaseServerConfigured()) {
    const res = await supabaseRest(
      `x_pairings?select=wallet,handle&active=is.true&wallet=in.(${list.join(",")})`,
    );
    if (!res || !res.ok) return out;
    for (const row of (await res.json()) as Pairing[]) out[row.wallet] = row.handle;
    return out;
  }
  const db = await sqlite();
  const placeholders = list.map(() => "?").join(",");
  const rows = db
    .prepare(`SELECT wallet, handle FROM x_pairings WHERE wallet IN (${placeholders}) AND active = 1`)
    .all(...list) as Pairing[];
  for (const row of rows) out[row.wallet] = row.handle;
  return out;
}

export async function upsertPairing(wallet: string, handle: string, signature: string): Promise<boolean> {
  const w = wallet.toLowerCase();
  if (supabaseServerConfigured()) {
    const res = await supabaseRest("x_pairings?on_conflict=wallet", {
      method: "POST",
      prefer: "resolution=merge-duplicates,return=minimal",
      body: JSON.stringify({ wallet: w, handle, signature, paired_at: new Date().toISOString(), active: true }),
    });
    return Boolean(res && res.ok);
  }
  const db = await sqlite();
  db.prepare(`
    INSERT INTO x_pairings (wallet, handle, signature, paired_at, active)
    VALUES (?, ?, ?, ?, 1)
    ON CONFLICT(wallet) DO UPDATE SET
      handle = excluded.handle,
      signature = excluded.signature,
      paired_at = excluded.paired_at,
      active = 1
  `).run(w, handle, signature, Date.now());
  return true;
}

export async function deactivatePairing(wallet: string): Promise<boolean> {
  const w = wallet.toLowerCase();
  if (supabaseServerConfigured()) {
    const res = await supabaseRest(`x_pairings?wallet=eq.${w}`, {
      method: "PATCH",
      prefer: "return=minimal",
      body: JSON.stringify({ active: false }),
    });
    return Boolean(res && res.ok);
  }
  const db = await sqlite();
  db.prepare("UPDATE x_pairings SET active = 0 WHERE wallet = ?").run(w);
  return true;
}
