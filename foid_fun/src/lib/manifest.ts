import { parseAbiItem } from "viem";
import { publicClient, TREASURY, DEPLOY_BLOCK } from "@/lib/viem";

const FinalizedEvt = parseAbiItem(
  "event Finalized(uint32 indexed epoch, bytes32 manifestRoot, string manifestCID)"
);
const ProposedEvt = parseAbiItem(
  "event ProposedEvt(bytes32 indexed id, address indexed bidder, uint32 epoch, (int32 x,int32 y,int32 w,int32 h) rect, uint96 bidPerCellWei, uint32 cells, bytes32 cidHash, uint256 value)"
);

export async function loadLatestFinalized() {
  const latest = await publicClient.getBlockNumber();
  const logs = await publicClient.getLogs({
    address: TREASURY,
    fromBlock: DEPLOY_BLOCK,
    toBlock: latest,
    events: [FinalizedEvt],
    strict: false,
  });
  if (!logs.length) return null;
  const last = logs[logs.length - 1];
  const epoch = Number((last as any).args.epoch);
  const manifestCID = (last as any).args.manifestCID as string;
  return { epoch, manifestCID };
}

export async function loadCidMap() {
  const latest = await publicClient.getBlockNumber();
  const logs = await publicClient.getLogs({
    address: TREASURY,
    fromBlock: DEPLOY_BLOCK,
    toBlock: latest,
    events: [ProposedEvt],
    strict: false,
  });
  const map = new Map<string, { cidHash: `0x${string}` }>();
  for (const l of logs) {
    const a: any = (l as any).args;
    map.set(a.id.toLowerCase(), { cidHash: a.cidHash });
  }
  return map;
}
