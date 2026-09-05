#!/usr/bin/env npx tsx
// Confirms the Supabase lockdown SQL actually ran in the target project
// (audit S8): with RLS locked, an anon INSERT into board_messages and
// board_events must fail with 42501. Reads NEXT_PUBLIC_SUPABASE_URL and
// NEXT_PUBLIC_SUPABASE_ANON_KEY from the environment.
//
//   DOTENV_CONFIG_PATH=.env.local npx tsx scripts/verify-rls.ts
import "dotenv/config";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function probe(table: string, body: Record<string, unknown>) {
  const res = await fetch(`${URL_}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      apikey: ANON!,
      Authorization: `Bearer ${ANON}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  const locked = res.status === 401 || res.status === 403 || text.includes("42501");
  console.log(`${table}: ${locked ? "LOCKED (good)" : `OPEN (status ${res.status})`}`);
  if (!locked) console.log("  response:", text.slice(0, 200));
  return locked;
}

async function main() {
  if (!URL_ || !ANON) {
    console.error("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY missing");
    process.exit(2);
  }
  const a = await probe("board_messages", {
    wallet_address: "0x0000000000000000000000000000000000000001",
    message: "rls probe",
    type: "chat",
  });
  const b = await probe("board_events", { event_type: "vote_cast", data: { probe: true } });
  const c = await probe("mifoid_reservations", {
    wallet: "0x0000000000000000000000000000000000000001",
    signature: "0x",
  });
  process.exit(a && b && c ? 0 : 1);
}

main();
