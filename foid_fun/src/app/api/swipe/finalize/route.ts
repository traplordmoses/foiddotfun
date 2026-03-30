import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, createWalletClient, http, type Hash } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { LOREBOARD_ABI } from "@/lib/contracts/abis/loreboard";
import { CONTRACTS, RPC_URL, CHAIN_CONFIG } from "@/lib/contracts/addresses";

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

    return NextResponse.json({
      total: proposalCount,
      finalized: finalized.length,
      failed: failed.length,
      results,
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
