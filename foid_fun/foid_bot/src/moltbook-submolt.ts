import { resolve } from "path";
import { config } from "dotenv";

config({ path: resolve(__dirname, "..", "..", ".env.local") });

const MOLTBOOK_API = "https://www.moltbook.com/api/v1";

async function createSubmolt() {
  const apiKey = process.env.MOLTBOOK_API_KEY;
  if (!apiKey) {
    console.error("Missing MOLTBOOK_API_KEY in .env.local");
    process.exit(1);
  }

  console.log("[moltbook] creating m/loreboard...");

  const res = await fetch(`${MOLTBOOK_API}/submolts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      name: "loreboard",
      display_name: "The Loreboard",
      description:
        "on-chain culture curation. propose memes, vote democratically, canonize permanently. the shared camera roll of the internet. foid.fun/board",
    }),
  });

  const body = await res.text();

  if (!res.ok) {
    console.error(`[moltbook] failed (${res.status}): ${body}`);
    process.exit(1);
  }

  console.log(`[moltbook] created m/loreboard: ${body}`);
}

createSubmolt().catch((err) => {
  console.error("[moltbook] fatal:", err);
  process.exit(1);
});
