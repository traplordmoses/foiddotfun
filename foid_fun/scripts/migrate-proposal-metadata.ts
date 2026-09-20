/** Run against the production SQLite file before deploying the new store.
 * Dry run by default. --apply requires --backup=/absolute/new-backup.sqlite.
 * No existing destination records are overwritten.
 */
import Database from "better-sqlite3";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { rowToStored } from "../src/lib/proposalStore";
import { supabaseRest, supabaseServerConfigured } from "../src/lib/supabaseRest";

async function main() {
  const source = process.env.DB_PATH;
  if (!source || !existsSync(source)) throw new Error("Set DB_PATH to the existing SQLite file; no new file will be created");
  const db = new Database(source, { readonly: true, fileMustExist: true });
  try {
    const values = (db.prepare("SELECT * FROM proposal_metadata ORDER BY id").all() as Record<string, unknown>[]).map(rowToStored);
    console.log(`Source metadata records: ${values.length}`);
    if (!process.argv.includes("--apply")) { console.log("Dry run complete. To migrate, apply sql/proposal_metadata.sql and rerun with --apply --backup=/absolute/new-backup.sqlite."); return; }
    const backup = process.argv.find((v) => v.startsWith("--backup="))?.slice(9);
    if (!backup || existsSync(backup) || resolve(backup) === resolve(source)) throw new Error("Supply a new backup filename with --backup=; existing files will not be overwritten");
    if (!supabaseServerConfigured()) throw new Error("Supabase service-role configuration is required");
    await db.backup(backup);
    for (let start = 0; start < values.length; start += 100) {
      const batch = values.slice(start, start + 100);
      const response = await supabaseRest("proposal_metadata_v2?on_conflict=id", {
        method: "POST", prefer: "resolution=ignore-duplicates,return=minimal",
        body: JSON.stringify(batch.map((data) => ({ id: data.id, data }))),
      });
      if (!response?.ok) throw new Error(`Migration failed at batch ${start}; backup retained. Retry is safe.`);
      // Verify every field, not just a row count. Conflicts need manual review.
      for (const data of batch) {
        const check = await supabaseRest(`proposal_metadata_v2?id=eq.${encodeURIComponent(data.id)}&select=data`);
        if (!check?.ok) throw new Error("Destination verification failed");
        const rows = await check.json();
        if (!isDeepStrictEqual(rows[0]?.data, data)) throw new Error(`Destination differs for record ${data.id}; it was not overwritten. Review before deployment.`);
      }
    }
    console.log(`Verified ${values.length} records. Backup preserved at ${backup}.`);
  } finally { db.close(); }
}
main().catch((error) => { console.error(error instanceof Error ? error.message : "Migration failed"); process.exitCode = 1; });
