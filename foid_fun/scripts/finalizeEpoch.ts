import ABI from "../src/abi/LoreBoardTreasury.json";
import {
  createPublicClient,
  createWalletClient,
  http,
  keccak256,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { fluentTestnet } from "../src/lib/chains/fluentTestnet";

const RPC = process.env.NEXT_PUBLIC_FLUENT_RPC!;
const CONTRACT = process.env.NEXT_PUBLIC_LOREBOARD_ADDRESS as `0x${string}`;
const OPERATOR_KEY = process.env.OPERATOR_KEY as `0x${string}`;

// TODO: populate these with real ids from LoreVM output.
const acceptedIds: `0x${string}`[] = [];
const rejectedIds: `0x${string}`[] = [];
const manifestCID = "bafy..."; // replace with actual manifest CID

function fakeRoot(ids: string[]) {
  const concat = (`0x${ids.map((x) => x.slice(2)).join("")}` || "0x") as `0x${string}`;
  return keccak256(concat);
}

async function main() {
  if (!RPC || !CONTRACT || !OPERATOR_KEY) {
    throw new Error("Missing envs");
  }

  const account = privateKeyToAccount(OPERATOR_KEY);
  const publicClient = createPublicClient({
    chain: fluentTestnet,
    transport: http(RPC),
  });
  const wallet = createWalletClient({
    chain: fluentTestnet,
    transport: http(RPC),
    account,
  });

  const epoch = (await publicClient.readContract({
    address: CONTRACT,
    abi: ABI as any,
    functionName: "currentEpoch",
    args: [],
  })) as bigint;

  const root = fakeRoot([...acceptedIds, ...rejectedIds]);

  const finalizeSig = (ABI as any[]).find(
    (entry) => entry.type === "function" && entry.name === "finalizeEpoch"
  );
  const cidIsString = finalizeSig?.inputs?.some(
    (input: any) =>
      typeof input?.name === "string" &&
      input.name.includes("manifestCID") &&
      input.type === "string"
  );

  const args = cidIsString
    ? ([epoch, root, manifestCID, acceptedIds, rejectedIds] as const)
    : ([
        epoch,
        root,
        new TextEncoder().encode(manifestCID),
        acceptedIds,
        rejectedIds,
      ] as const);

  const hash = await wallet.writeContract({
    address: CONTRACT,
    abi: ABI as any,
    functionName: "finalizeEpoch",
    args,
  });

  console.log("finalize tx:", hash);
  await publicClient.waitForTransactionReceipt({ hash });
  console.log("✅ finalized epoch", epoch.toString());
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
