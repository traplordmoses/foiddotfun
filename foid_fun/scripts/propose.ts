// scripts/propose.ts
// Usage:
//   OPERATOR_KEY=0xyourfundedkey npx ts-node scripts/propose.ts

import "dotenv/config";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  encodePacked,
  http,
  keccak256,
  toHex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { CID } from "multiformats/cid";
import ABI from "../src/abi/LoreBoardTreasury.json" assert { type: "json" };

const rpc = process.env.NEXT_PUBLIC_FLUENT_RPC!;
const treasury = process.env.NEXT_PUBLIC_LOREBOARD_ADDRESS! as `0x${string}`;
const operatorKey = (process.env.OPERATOR_KEY!.startsWith("0x")
  ? process.env.OPERATOR_KEY!
  : `0x${process.env.OPERATOR_KEY!}`) as `0x${string}`;

const fluentTestnet = defineChain({
  id: 20994,
  name: "Fluent Testnet",
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [rpc] } },
});

async function main() {
  const account = privateKeyToAccount(operatorKey);
  const wallet = createWalletClient({
    account,
    chain: fluentTestnet,
    transport: http(rpc),
  });
  const publicClient = createPublicClient({
    chain: fluentTestnet,
    transport: http(rpc),
  });

  const toI32 = (n: number) => Number(BigInt.asIntN(32, BigInt(n)));
  const toU32 = (n: number) => Number(BigInt.asUintN(32, BigInt(n)));

  // --- fill these for the test ---
  const bidder = account.address as `0x${string}`;
  const epoch = 1;
  const rect = { x: 0, y: 0, w: 64, h: 64 };
  const cells = 16;
  const bidPerCellWei = 10_000_000_000_000n;
  const cid = "bafy..."; // replace with a real CID v1 string (no ipfs://)
  // -------------------------------

  const cidBytes = CID.parse(cid).bytes;
  const cidHash = keccak256(toHex(cidBytes));

  const id = keccak256(
    encodePacked(
      ["address", "uint32", "bytes32", "int32", "int32", "int32", "int32"],
      [
        bidder,
        toU32(epoch),
        cidHash,
        toI32(rect.x),
        toI32(rect.y),
        toI32(rect.w),
        toI32(rect.h),
      ]
    )
  );

  const value = bidPerCellWei * BigInt(cells);

  const hash = await wallet.writeContract({
    address: treasury,
    abi: ABI as any,
    functionName: "proposePlacement",
    args: [
      {
        id,
        bidder,
        rect: {
          x: toI32(rect.x),
          y: toI32(rect.y),
          w: toI32(rect.w),
          h: toI32(rect.h),
        },
        cells: toU32(cells),
        bidPerCellWei,
        cidHash,
        epoch: toU32(epoch),
      },
    ],
    value,
  });

  console.log("submitted tx:", hash);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log("status:", receipt.status);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
