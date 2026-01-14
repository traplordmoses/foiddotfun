import { config as loadEnv } from "dotenv";
import { createPublicClient, http, type Hex } from "viem";

loadEnv({ path: ".env.local" });
loadEnv();

type Address = `0x${string}`;

type MaybeAddress = Address | undefined;

function requireEnv<T>(label: string, value: T | undefined | null): T {
  if (value == null || value === "") {
    throw new Error(`Missing ${label}`);
  }
  return value as T;
}

async function main() {
  const rpc = process.env.NEXT_PUBLIC_FLUENT_RPC || process.env.FLUENT_RPC_URL;
  const txHash = process.env.TX_HASH as Hex | undefined;
  const boardAddress = (process.env.NEXT_PUBLIC_LOREBOARD_BOARD_ADDRESS ||
    process.env.LOREBOARD_BOARD_ADDRESS) as MaybeAddress;

  requireEnv("NEXT_PUBLIC_FLUENT_RPC or FLUENT_RPC_URL", rpc);
  requireEnv("TX_HASH", txHash);

  const publicClient = createPublicClient({
    transport: http(rpc),
  });

  const receipt = await publicClient.waitForTransactionReceipt({
    hash: txHash!,
  });

  console.log("blockNumber:", receipt.blockNumber);

  let foundBoardLog = false;
  const boardAddressLower = boardAddress?.toLowerCase();

  for (const log of receipt.logs) {
    const topic0 = log.topics[0];
    const topic1 = log.topics[1];
    const topic2 = log.topics[2];
    console.log("log:", {
      address: log.address,
      topic0,
      topic1,
      topic2,
    });
    if (boardAddressLower && log.address.toLowerCase() === boardAddressLower) {
      foundBoardLog = true;
    }
  }

  if (foundBoardLog) {
    console.log("FOUND BOARD LOG");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
