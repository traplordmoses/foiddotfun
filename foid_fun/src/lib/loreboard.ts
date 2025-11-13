import { createPublicClient, http, parseAbiItem } from "viem";

const client = createPublicClient({
  transport: http(process.env.NEXT_PUBLIC_FLUENT_RPC!),
});

const Finalized = parseAbiItem(
  "event Finalized(uint32 indexed epoch, bytes32 manifestRoot, string manifestCID)"
);

const MAX_RANGE = 100_000n;

export async function fetchLatestManifest(addr: `0x${string}`) {
  const latestBlock = await client.getBlockNumber();
  let to = latestBlock;
  let from = to > MAX_RANGE ? to - MAX_RANGE + 1n : 0n;

  while (true) {
    const logs = await client.getLogs({
      address: addr,
      events: [Finalized],
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

async function fetchManifestFromLog(log: any) {
  const cid = (log.args as any).manifestCID as string;
  const gw = process.env.NEXT_PUBLIC_IPFS_GATEWAY ?? "https://ipfs.io/ipfs/";
  const url = cid.startsWith("ipfs://") ? cid.replace("ipfs://", gw) : cid;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`failed to fetch manifest ${res.status}`);
  return res.json();
}
