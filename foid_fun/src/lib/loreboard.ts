import { createPublicClient, http } from "viem";
import { CANONICAL_CHAIN } from "@/config/canonical";
import { cidToHttpUrl } from "./ipfsUrl";
import { FINALIZED_EVENT } from "./events";

const rpcUrl = process.env.NEXT_PUBLIC_FLUENT_RPC ?? CANONICAL_CHAIN.rpcUrl;
const client = createPublicClient({
  transport: http(rpcUrl),
});

const MAX_RANGE = 100_000n;

export async function fetchLatestManifest(addr: `0x${string}`) {
  const latestBlock = await client.getBlockNumber();
  let to = latestBlock;
  let from = to > MAX_RANGE ? to - MAX_RANGE + 1n : 0n;

  while (true) {
    const logs = await client.getLogs({
      address: addr,
      events: [FINALIZED_EVENT],
      fromBlock: from,
      toBlock: to,
    });

    if (logs.length) {
      const last = logs[logs.length - 1]!;
      return fetchManifestFromLog(last);
    }

    if (from === 0n) break;
    to = from - 1n;
    from = to > MAX_RANGE ? to - MAX_RANGE + 1n : 0n;
  }

  return null;
}

async function fetchManifestFromLog(log: unknown) {
  const args = (log as { args?: { manifestCID?: string } }).args;
  const cid = args?.manifestCID;
  if (!cid) throw new Error("missing manifest cid");
  const url = cidToHttpUrl(cid);
  if (!url) throw new Error("invalid manifest cid");
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`failed to fetch manifest ${res.status}`);
  return res.json();
}
