import ABI from "../src/abi/LoreBoardTreasury.json";
import {
  createPublicClient,
  createWalletClient,
  http,
  keccak256,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { fluentTestnet } from "../src/lib/chains/fluentTestnet";
import { loreBoardManifestStoreAbi } from "../src/abi/loreBoardManifestStore";

const RPC = process.env.NEXT_PUBLIC_FLUENT_RPC!;
const CONTRACT = process.env.NEXT_PUBLIC_LOREBOARD_ADDRESS as `0x${string}`;
const OPERATOR_KEY = process.env.OPERATOR_KEY as `0x${string}`;
const MANIFEST_STORE = (process.env.NEXT_PUBLIC_LOREBOARD_MANIFEST_STORE_ADDRESS ||
  process.env.NEXT_PUBLIC_LOREBOARD_ANCHOR ||
  process.env.NEXT_PUBLIC_MANIFEST_STORE ||
  process.env.NEXT_PUBLIC_MANIFEST_STORE_ADDRESS) as `0x${string}`;

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
  if (!MANIFEST_STORE) {
    throw new Error("NEXT_PUBLIC_LOREBOARD_MANIFEST_STORE_ADDRESS is required");
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

  const anchorTx = await wallet.writeContract({
    address: MANIFEST_STORE,
    abi: loreBoardManifestStoreAbi as any,
    functionName: "anchor",
    args: [Number(epoch), root, manifestCID],
  });
  console.log("anchor tx:", anchorTx);
  await publicClient.waitForTransactionReceipt({ hash: anchorTx });
  console.log("✅ anchored manifest for epoch", epoch.toString());
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
