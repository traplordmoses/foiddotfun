import { NextRequest, NextResponse } from "next/server";
import {
  createPublicClient,
  defineChain,
  http,
  parseAbiItem,
  type Hex,
} from "viem";

const rpc = process.env.NEXT_PUBLIC_FLUENT_RPC!;
const address = process.env.NEXT_PUBLIC_LOREBOARD_ADDRESS as `0x${string}`;
const deployBlockEnv = process.env.NEXT_PUBLIC_LOREBOARD_DEPLOY_BLOCK;

const fluentTestnet = defineChain({
  id: 20994,
  name: "Fluent Testnet",
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [rpc] } },
});

const publicClient = createPublicClient({
  chain: fluentTestnet,
  transport: http(rpc),
});

const ProposedEvt = parseAbiItem(
  "event ProposedEvt(bytes32 indexed id, address indexed bidder, uint32 epoch, (int32 x,int32 y,int32 w,int32 h) rect, uint96 bidPerCellWei, uint32 cells, bytes32 cidHash, uint256 value)"
);

async function getLogsChunked(args: {
  fromBlock: bigint;
  toBlock: bigint;
  step?: bigint;
}) {
  const { fromBlock, toBlock, step = 90_000n } = args;
  const all: typeof publicClient.getLogs extends (...args: any) => infer R
    ? Awaited<R>
    : never = [];
  let start = fromBlock;
  while (start <= toBlock) {
    const end = start + step > toBlock ? toBlock : start + step;
    const chunk = await publicClient.getLogs({
      address,
      event: ProposedEvt,
      fromBlock: start,
      toBlock: end,
    });
    all.push(...chunk);
    start = end + 1n;
  }
  return all;
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const epochQ = url.searchParams.get("epoch");
    const epoch = epochQ ? Number(epochQ) : undefined;

    const latest = await publicClient.getBlockNumber();
    const fromBlock = deployBlockEnv
      ? BigInt(deployBlockEnv)
      : latest > 95_000n
      ? latest - 95_000n
      : 0n;

    const logs = await getLogsChunked({ fromBlock, toBlock: latest });

    const proposed = logs
      .map((l) => ({
        id: l.args.id as Hex,
        bidder: l.args.bidder as `0x${string}`,
        epoch: Number(l.args.epoch),
        rect: {
          x: Number(l.args.rect?.x ?? 0),
          y: Number(l.args.rect?.y ?? 0),
          w: Number(l.args.rect?.w ?? 0),
          h: Number(l.args.rect?.h ?? 0),
        },
        bidPerCellWei: l.args.bidPerCellWei?.toString() ?? "0",
        cells: Number(l.args.cells ?? 0),
        cidHash: l.args.cidHash as Hex,
        value: l.args.value?.toString() ?? "0",
      }))
      .filter((p) => (epoch === undefined ? true : p.epoch === epoch));

    const uniq = Object.values(
      proposed.reduce<Record<string, (typeof proposed)[number]>>(
        (acc, p) => {
          acc[p.id] = p;
          return acc;
        },
        {}
      )
    );

    return NextResponse.json(
      { epoch: epoch ?? null, proposed: uniq, finalized: [] },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("[api/proposals]", e);
    return NextResponse.json(
      {
        epoch: null,
        proposed: [],
        finalized: [],
        error: String(e?.message ?? e),
      },
      { status: 200 }
    );
  }
}
