import { createPublicClient, http } from "viem";
import { CANONICAL_CHAIN, getServerRpcUrl } from "@/config/canonical";
import { cidToHttpUrl } from "./ipfsUrl";
import { FINALIZED_EVENT } from "./events";

// Server-only: this module reads logs across large block ranges and must
// hit the private RPC directly (not the /api/rpc proxy, to avoid a self-
// request loop and because batch eth_getLogs benefits from the dedicated
// quota). Falls back to the public RPC if FLUENT_RPC_URL is not set.
const rpcUrl = getServerRpcUrl() ?? CANONICAL_CHAIN.rpcUrl;
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
