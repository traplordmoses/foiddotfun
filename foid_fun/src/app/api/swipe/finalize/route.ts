import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, createWalletClient, http, type Hash, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { keccak256, stringToHex } from "viem";
import { LOREBOARD_ABI } from "@/lib/contracts/abis/loreboard";
import { LOREBOARD_LIVE_NFT_ABI } from "@/lib/contracts/abis/loreboardLiveNFT";
import { CONTRACTS, RPC_URL, CHAIN_CONFIG } from "@/lib/contracts/addresses";
import { CANONICAL_ADDRESSES } from "@/config/canonical";
import { uploadJSON } from "@/lib/ipfs";
import { ProposalStore, type StoredProposal } from "@/lib/proposalStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const chain = {
  id: CHAIN_CONFIG.id,
  name: CHAIN_CONFIG.name,
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
};

function validateSecret(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${secret}`) return true;

  const cronHeader = request.headers.get("x-cron-secret");
  if (cronHeader === secret) return true;

  return false;
}

type FinalizeResult = {
  proposalId: number;
  status: "finalized" | "failed" | "skipped";
  approved?: boolean;
  weightFor?: string;
  weightAgainst?: string;
  txHash?: string;
  error?: string;
};

export async function POST(request: NextRequest) {
  if (!validateSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const operatorPk = process.env.OPERATOR_PK;
  if (!operatorPk) {
    return NextResponse.json(
      { error: "OPERATOR_PK not configured" },
      { status: 500 }
    );
  }

  const contractAddress = CONTRACTS.SWIPE as `0x${string}`;
  if (!contractAddress) {
    return NextResponse.json(
      { error: "Loreboard contract not configured" },
      { status: 500 }
    );
  }

  try {
    const account = privateKeyToAccount(operatorPk as `0x${string}`);
    const publicClient = createPublicClient({ chain, transport: http(RPC_URL) });
    const walletClient = createWalletClient({
      account,
      chain,
      transport: http(RPC_URL),
    });

    const count = (await publicClient.readContract({
      address: contractAddress,
      abi: LOREBOARD_ABI,
      functionName: "proposalCount",
    })) as bigint;

    const proposalCount = Number(count);
    const now = Math.floor(Date.now() / 1000);
    const results: FinalizeResult[] = [];

    for (let i = 0; i < proposalCount; i++) {
      try {
        const raw = (await publicClient.readContract({
          address: contractAddress,
          abi: LOREBOARD_ABI,
          functionName: "getProposal",
          args: [BigInt(i)],
        })) as {
          finalized: boolean;
          votingEndsAt: bigint;
        };

        if (raw.finalized) continue;
        if (Number(raw.votingEndsAt) > now) continue;

        const [rawFor, rawAgainst] = await Promise.all([
          publicClient.readContract({
            address: contractAddress,
            abi: LOREBOARD_ABI,
            functionName: "voteWeightFor",
            args: [BigInt(i)],
          }) as Promise<bigint>,
          publicClient.readContract({
            address: contractAddress,
            abi: LOREBOARD_ABI,
            functionName: "voteWeightAgainst",
            args: [BigInt(i)],
          }) as Promise<bigint>,
        ]);

        console.log(
          `[finalize] Proposal #${i}: ${rawFor} weightFor, ${rawAgainst} weightAgainst`
        );

        const hash: Hash = await walletClient.writeContract({
          address: contractAddress,
          abi: LOREBOARD_ABI,
          functionName: "finalize",
          args: [BigInt(i)],
        });

        const receipt = await publicClient.waitForTransactionReceipt({
          hash,
          timeout: 60_000,
        });

        // Parse Finalized event from logs
        let approved = false;
        let weightFor = rawFor.toString();
        let weightAgainst = rawAgainst.toString();

        for (const log of receipt.logs) {
          try {
            if (log.topics[0] && log.data && log.topics[1]) {
              const pId = Number(BigInt(log.topics[1]));
              if (pId === i && log.data.length >= 194) {
                approved = BigInt("0x" + log.data.slice(2, 66)) !== 0n;
                weightFor = BigInt("0x" + log.data.slice(66, 130)).toString();
                weightAgainst = BigInt("0x" + log.data.slice(130, 194)).toString();
              }
            }
          } catch {
            // Non-fatal: event parsing failed
          }
        }

        results.push({
          proposalId: i,
          status: "finalized",
          approved,
          weightFor,
          weightAgainst,
          txHash: hash,
        });

        console.log(
          `[finalize] Proposal #${i}: ${approved ? "APPROVED" : "REJECTED"} (for: ${weightFor}, against: ${weightAgainst}) tx: ${hash}`
        );
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error(`[finalize] Proposal #${i} FAILED:`, errorMsg);

        results.push({
          proposalId: i,
          status: "failed",
          error: errorMsg,
        });
      }
    }

    const finalized = results.filter((r) => r.status === "finalized");
    const failed = results.filter((r) => r.status === "failed");
    const approved = finalized.filter((r) => r.approved);

    // ── Manifest anchoring + NFT sync ──
    let manifestCid: string | null = null;
    let manifestTx: string | null = null;
    let nftSyncTx: string | null = null;
    let manifestError: string | null = null;

    if (approved.length > 0) {
      try {
        const TILE = 32;

        // Read placement count (post-finalization — includes newly approved)
        const pCount = (await publicClient.readContract({
          address: contractAddress,
          abi: LOREBOARD_ABI,
          functionName: "placementCount",
        })) as bigint;
        const placementCount = Number(pCount);

        // Read current manifest version + CID
        const [currentVersion, currentCID] = await Promise.all([
          publicClient.readContract({
            address: contractAddress,
            abi: LOREBOARD_ABI,
            functionName: "manifestVersion",
          }) as Promise<bigint>,
          publicClient.readContract({
            address: contractAddress,
            abi: LOREBOARD_ABI,
            functionName: "currentManifestCID",
          }) as Promise<string>,
        ]);

        // Try to fetch existing manifest from IPFS (preserves rich metadata)
        type ManifestPlacement = {
          id: string;
          owner: string;
          cid: string;
          name: string;
          mime: string;
          rect: { x: number; y: number; w: number; h: number };
          cells: number;
          bidPerCellWei: string;
          width: number;
          height: number;
          cidHash?: string;
        };

        let existingPlacements: ManifestPlacement[] = [];
        const IPFS_GATEWAYS = [
          "https://gateway.pinata.cloud/ipfs/",
          "https://ipfs.io/ipfs/",
          "https://cloudflare-ipfs.com/ipfs/",
        ];

        if (currentCID) {
          for (const gw of IPFS_GATEWAYS) {
            try {
              const res = await fetch(`${gw}${currentCID}`, {
                signal: AbortSignal.timeout(15_000),
              });
              if (res.ok) {
                const prev = await res.json();
                existingPlacements = Array.isArray(prev?.placements)
                  ? prev.placements
                  : [];
                console.log(
                  `[finalize] loaded existing manifest: ${existingPlacements.length} placements`
                );
                break;
              }
            } catch {
              /* try next gateway */
            }
          }
        }

        // Build set of existing CIDs for deduplication
        const stripIpfs = (v: string) => v.replace(/^ipfs:\/\//, "").trim();
        const existingCids = new Set(
          existingPlacements.map((p) => stripIpfs(p.cid))
        );

        // Load all stored proposal metadata for enrichment
        let storedProposals: StoredProposal[] = [];
        try {
          storedProposals = ProposalStore.all();
        } catch {
          console.warn("[finalize] ProposalStore unavailable, using defaults");
        }
        const proposalByCid = new Map<string, StoredProposal>();
        for (const sp of storedProposals) {
          if (sp.cid) proposalByCid.set(stripIpfs(sp.cid), sp);
        }

        // Read onchain placements and build entries for new ones
        const newPlacements: ManifestPlacement[] = [];
        for (let i = 0; i < placementCount; i++) {
          const p = (await publicClient.readContract({
            address: contractAddress,
            abi: LOREBOARD_ABI,
            functionName: "getPlacement",
            args: [BigInt(i)],
          })) as {
            proposalId: bigint;
            placer: string;
            ipfsCid: string;
            x: number;
            y: number;
            w: number;
            h: number;
            placedAt: bigint;
            removed: boolean;
          };

          if (p.removed) continue;

          const cleanCid = stripIpfs(p.ipfsCid);
          if (existingCids.has(cleanCid)) continue;

          // Enrich from ProposalStore metadata
          const meta = proposalByCid.get(cleanCid);

          const gridW = Math.abs(p.w);
          const gridH = Math.abs(p.h);
          const cells = Math.floor(gridW / TILE) * Math.floor(gridH / TILE);

          // Deterministic ID: use stored ID or derive from onchain data
          const placementId: string =
            meta?.id ??
            keccak256(
              stringToHex(`v1-placement-${i}-${p.placer}-${cleanCid}`)
            );

          newPlacements.push({
            id: placementId,
            owner: p.placer,
            cid: cleanCid,
            name: meta?.name ?? meta?.filename ?? "",
            mime: meta?.mime ?? "image/png",
            rect: { x: p.x, y: p.y, w: p.w, h: p.h },
            cells: cells || 1,
            bidPerCellWei: meta?.bidPerCellWei?.toString() ?? "0",
            width: meta?.width ?? p.w,
            height: meta?.height ?? p.h,
            ...(meta?.cidHash && { cidHash: meta.cidHash }),
          });
        }

        if (newPlacements.length > 0) {
          console.log(
            `[finalize] adding ${newPlacements.length} new placements to manifest`
          );
        }

        // Merge existing + new, sort by ID for determinism
        const allPlacements = [...existingPlacements, ...newPlacements];
        allPlacements.sort((a, b) =>
          a.id.toLowerCase().localeCompare(b.id.toLowerCase())
        );

        // Compute placementsRoot: keccak256(concat of all bytes32 IDs)
        const toBytes32 = (v: string): Hex =>
          v.startsWith("0x") && v.length === 66
            ? (v as Hex)
            : keccak256(stringToHex(v));
        const idHexes = allPlacements.map((p) => toBytes32(p.id));
        const concatHex = (
          `0x${idHexes.map((h) => h.slice(2)).join("")}` || "0x"
        ) as Hex;
        const placementsRoot = keccak256(concatHex);

        const epoch = Number(currentVersion) + 1;

        const manifest = {
          epoch,
          finalizedAt: Math.floor(Date.now() / 1000),
          placements: allPlacements,
          placementsRoot,
        };

        // Upload manifest to IPFS
        manifestCid = await uploadJSON(
          `loreboard-epoch-${epoch}.manifest.json`,
          manifest
        );
        console.log(`[finalize] manifest uploaded: cid=${manifestCid}`);

        // Anchor manifest onchain via setManifestCID
        const anchorHash: Hash = await walletClient.writeContract({
          address: contractAddress,
          abi: LOREBOARD_ABI,
          functionName: "setManifestCID",
          args: [manifestCid, BigInt(placementCount)],
        });
        await publicClient.waitForTransactionReceipt({
          hash: anchorHash,
          timeout: 60_000,
        });
        manifestTx = anchorHash;
        console.log(`[finalize] manifest anchored: tx=${anchorHash}`);

        // Sync LoreboardLiveNFT
        const nftAddress = CANONICAL_ADDRESSES.loreboardLiveNFT as `0x${string}`;
        if (nftAddress) {
          try {
            const syncHash: Hash = await walletClient.writeContract({
              address: nftAddress,
              abi: LOREBOARD_LIVE_NFT_ABI,
              functionName: "syncLatest",
            });
            await publicClient.waitForTransactionReceipt({
              hash: syncHash,
              timeout: 60_000,
            });
            nftSyncTx = syncHash;
            console.log(`[finalize] NFT synced: tx=${syncHash}`);
          } catch (nftErr) {
            const msg =
              nftErr instanceof Error ? nftErr.message : String(nftErr);
            console.error(`[finalize] NFT sync failed (non-fatal): ${msg}`);
            manifestError = `NFT sync failed: ${msg}`;
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(
          `[finalize] manifest anchoring failed (non-fatal): ${msg}`
        );
        manifestError = msg;
      }
    }

    return NextResponse.json({
      total: proposalCount,
      finalized: finalized.length,
      failed: failed.length,
      results,
      ...(approved.length > 0 && {
        manifest: {
          cid: manifestCid,
          anchorTx: manifestTx,
          nftSyncTx,
          error: manifestError,
        },
      }),
    });
  } catch (error) {
    console.error("[api/swipe/finalize] Error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

/** GET: dry-run showing which proposals are ready to finalize */
export async function GET(request: NextRequest) {
  if (!validateSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contractAddress = CONTRACTS.SWIPE as `0x${string}`;
  if (!contractAddress) {
    return NextResponse.json({ error: "Loreboard contract not configured" }, { status: 500 });
  }

  try {
    const publicClient = createPublicClient({ chain, transport: http(RPC_URL) });
    const count = (await publicClient.readContract({
      address: contractAddress,
      abi: LOREBOARD_ABI,
      functionName: "proposalCount",
    })) as bigint;

    const now = Math.floor(Date.now() / 1000);
    const ready: Array<{
      proposalId: number;
      votingEndsAt: number;
      weightFor: string;
      weightAgainst: string;
    }> = [];

    for (let i = 0; i < Number(count); i++) {
      try {
        const raw = (await publicClient.readContract({
          address: contractAddress,
          abi: LOREBOARD_ABI,
          functionName: "getProposal",
          args: [BigInt(i)],
        })) as {
          finalized: boolean;
          votingEndsAt: bigint;
        };

        if (!raw.finalized && Number(raw.votingEndsAt) < now) {
          const [weightFor, weightAgainst] = await Promise.all([
            publicClient.readContract({
              address: contractAddress,
              abi: LOREBOARD_ABI,
              functionName: "voteWeightFor",
              args: [BigInt(i)],
            }) as Promise<bigint>,
            publicClient.readContract({
              address: contractAddress,
              abi: LOREBOARD_ABI,
              functionName: "voteWeightAgainst",
              args: [BigInt(i)],
            }) as Promise<bigint>,
          ]);
          ready.push({
            proposalId: i,
            votingEndsAt: Number(raw.votingEndsAt),
            weightFor: weightFor.toString(),
            weightAgainst: weightAgainst.toString(),
          });
        }
      } catch {
        // skip
      }
    }

    return NextResponse.json({
      total: Number(count),
      readyToFinalize: ready.length,
      proposals: ready,
    });
  } catch (error) {
    console.error("[api/swipe/finalize] GET error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
