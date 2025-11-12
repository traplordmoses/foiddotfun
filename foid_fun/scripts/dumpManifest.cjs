const { fetchLatestManifest } = require("../src/lib/loreboard");

async function main() {
  const addr = process.env.NEXT_PUBLIC_LOREBOARD_ADDRESS;
  if (!addr) throw new Error("NEXT_PUBLIC_LOREBOARD_ADDRESS missing");
  const manifest = await fetchLatestManifest(addr);
  console.log(JSON.stringify(manifest, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
