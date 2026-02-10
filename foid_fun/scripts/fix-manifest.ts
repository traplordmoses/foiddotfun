// fix-manifest.ts — One-time fix: merge old manifest with epoch 459 accepted placement,
// re-anchor at epoch > latestFinalizedEpoch so latest() picks it up.

import dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: ".env.local", override: true });

import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  keccak256,
  stringToHex,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { loreBoardManifestStoreAbi } from "../src/abi/loreBoardManifestStore";
import { uploadJSON } from "../src/lib/ipfs";

const rpc = process.env.NEXT_PUBLIC_FLUENT_RPC!;
const manifestStoreAddr = process.env.NEXT_PUBLIC_LOREBOARD_MANIFEST_STORE_ADDRESS as `0x${string}`;
const treasury = process.env.NEXT_PUBLIC_LOREBOARD_ADDRESS as `0x${string}`;
const operatorPk = (process.env.OPERATOR_KEY ?? process.env.OPERATOR_PK)!;

const chain = defineChain({
  id: 20994,
  name: "Fluent Testnet",
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [rpc] } },
});

const account = privateKeyToAccount(
  operatorPk.startsWith("0x") ? operatorPk as `0x${string}` : `0x${operatorPk}` as `0x${string}`
);
const publicClient = createPublicClient({ chain, transport: http(rpc) });
const wallet = createWalletClient({ chain, transport: http(rpc), account });

const finalizeAbi = [
  {
    type: "function",
    name: "finalizeEpoch",
    stateMutability: "nonpayable",
    inputs: [
      { name: "epoch", type: "uint32" },
      { name: "manifestRoot", type: "bytes32" },
      { name: "manifestCID", type: "string" },
      { name: "accepted", type: "bytes32[]" },
      { name: "rejected", type: "bytes32[]" },
    ],
    outputs: [],
  },
] as const;

async function main() {
  // 1. Get latestFinalizedEpoch
  const latestEpoch = Number(await publicClient.readContract({
    address: manifestStoreAddr,
    abi: loreBoardManifestStoreAbi,
    functionName: "latestFinalizedEpoch",
  }));
  console.log("latestFinalizedEpoch:", latestEpoch);

  // 2. Fetch old manifest from IPFS
  const oldManifestData = await publicClient.readContract({
    address: manifestStoreAddr,
    abi: loreBoardManifestStoreAbi,
    functionName: "manifestOf",
    args: [latestEpoch],
  });
  const oldCid = String((oldManifestData as any)[1]).replace(/^ipfs:\/\//, "");
  console.log("old CID:", oldCid);

  const oldRes = await fetch(`https://ipfs.io/ipfs/${oldCid}`, { signal: AbortSignal.timeout(15000) });
  if (!oldRes.ok) throw new Error(`Failed to fetch old manifest: ${oldRes.status}`);
  const oldManifest = await oldRes.json();
  console.log("old manifest placements:", oldManifest.placements?.length ?? 0);

  // 3. The new accepted placement from epoch 459
  // IMPORTANT: Use WORLD coordinates (centered at origin), not contract coordinates.
  // Contract coords = world + 4096. The board renderer expects world coords in the manifest.
  const newPlacement = {
    id: "0xac7f4415c7bf4525dabda029260d2bb1410aacdcd0e35c9a84d3b493f2b59ece",
    owner: "0x0E666f8f38549BB62F41f50C6E94D7b5367D1fF9",
    cid: "ipfs://QmTjqwoZee4Uw5ahkQGbEndNbRt8EBQCJRZSUHmsadzHQB",
    name: "",
    mime: "image/png",
    rect: { x: 1152, y: -672, w: 448, h: 672 },
    cells: 294,
    bidPerCellWei: "10000000000000",
    width: 448,
    height: 672,
    cidHash: "0x766f148cb039fcc5d2b1459b3c8d2a234f80a69763c5005e43c1bbae9eba9c0a",
  };

  // 4. Merge: check if placement already exists (by id)
  const existingIds = new Set(
    (oldManifest.placements ?? []).map((p: any) => p.id?.toLowerCase())
  );
  const mergedPlacements = [...(oldManifest.placements ?? [])];
  if (!existingIds.has(newPlacement.id.toLowerCase())) {
    mergedPlacements.push(newPlacement);
    console.log("adding new placement to manifest");
  } else {
    console.log("placement already in manifest, updating it");
    const idx = mergedPlacements.findIndex(
      (p: any) => p.id?.toLowerCase() === newPlacement.id.toLowerCase()
    );
    if (idx >= 0) mergedPlacements[idx] = newPlacement;
  }

  // 5. Build merged manifest
  const newEpoch = latestEpoch + 1;
  const mergedManifest = {
    epoch: newEpoch,
    finalizedAt: Math.floor(Date.now() / 1000),
    placements: mergedPlacements,
    placementsRoot: oldManifest.placementsRoot ?? "0x",
  };

  console.log(`\nmerged manifest: epoch=${newEpoch}, placements=${mergedPlacements.length}`);

  // 6. Upload to IPFS
  const cid = await uploadJSON(`loreboard-epoch-${newEpoch}.manifest.json`, mergedManifest);
  console.log("uploaded manifest CID:", cid);

  // 7. Compute manifest root
  const manifestJson = JSON.stringify(mergedManifest);
  const manifestRoot = keccak256(stringToHex(manifestJson));
  console.log("manifest root:", manifestRoot);

  const dryRun = process.env.DRY_RUN === "1";
  if (dryRun) {
    console.log("\nDRY_RUN=1, would anchor at epoch", newEpoch);
    return;
  }

  // 8. Call treasury.finalizeEpoch
  const acceptedIds = [newPlacement.id] as readonly `0x${string}`[];
  const rejectedIds: readonly `0x${string}`[] = [];

  console.log("\ncalling treasury.finalizeEpoch...");
  const finalizeTx = await wallet.writeContract({
    address: treasury,
    abi: finalizeAbi,
    functionName: "finalizeEpoch",
    args: [newEpoch, manifestRoot as `0x${string}`, cid, acceptedIds, rejectedIds],
  });
  console.log("finalizeEpoch tx:", finalizeTx);
  await publicClient.waitForTransactionReceipt({ hash: finalizeTx });

  // 9. Anchor in manifest store
  console.log("calling manifestStore.anchor...");
  const anchorTx = await wallet.writeContract({
    address: manifestStoreAddr,
    abi: loreBoardManifestStoreAbi,
    functionName: "anchor",
    args: [newEpoch, manifestRoot as `0x${string}`, cid],
  });
  console.log("anchor tx:", anchorTx);
  await publicClient.waitForTransactionReceipt({ hash: anchorTx });

  // 10. Verify
  const verifyLatest = await publicClient.readContract({
    address: manifestStoreAddr,
    abi: loreBoardManifestStoreAbi,
    functionName: "latest",
  });
  const [vEpoch, vRoot, vCid] = verifyLatest as [bigint, string, string];
  console.log("\nverification:");
  console.log("  latest epoch:", Number(vEpoch));
  console.log("  latest root:", vRoot);
  console.log("  latest cid:", vCid);
  console.log("\ndone. board should now show", mergedPlacements.length, "placements.");
}

main().catch((err) => {
  console.error("fatal:", err);
  process.exit(1);
});
