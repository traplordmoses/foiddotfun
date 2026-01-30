import { NextResponse } from "next/server";
import {
  fluentPublicClient,
  configureEpochOnChain,
  registerPendingPlacementOnChain,
  votingAdminClient,
} from "@/lib/loreboardVotingAdmin";
import {
  LOREBOARD_VOTING_ADDRESS,
  loreboardVotingAbi,
} from "@/contracts/loreboardVoting";

export async function POST(req: Request) {
  try {
    const { epochId, placementId } = await req.json();

    if (epochId === undefined && !placementId) {
      return NextResponse.json(
        { ok: false, error: "Missing placementId" },
        { status: 400 }
      );
    }

    if (epochId === undefined) {
      return NextResponse.json({ ok: true });
    }

    const epoch = BigInt(epochId);
    const placement = placementId as `0x${string}`;

    const boardAdmin = (await fluentPublicClient.readContract({
      address: LOREBOARD_VOTING_ADDRESS,
      abi: loreboardVotingAbi,
      functionName: "boardAdmin",
      args: [],
    })) as `0x${string}`;

    // Admin-only endpoint - regular users should register via their wallet
    // by calling registerPlacement() directly from the frontend
    if (boardAdmin.toLowerCase() !== votingAdminClient.account.address.toLowerCase()) {
      return NextResponse.json(
        {
          ok: false,
          error: "Admin only. Users should register placements via their wallet by calling registerPlacement() directly."
        },
        { status: 403 }
      );
    }

    let startsAt = 0n;
    let endsAt = 0n;
    let finalized = false;
    const epochsBoolAbi = [
      {
        type: "function",
        name: "epochs",
        inputs: [
          {
            name: "",
            type: "uint256",
            internalType: "uint256",
          },
        ],
        outputs: [
          {
            name: "finalized",
            type: "bool",
            internalType: "bool",
          },
        ],
        stateMutability: "view",
      },
    ] as const;
    try {
      [startsAt, endsAt, finalized] = (await fluentPublicClient.readContract({
        address: LOREBOARD_VOTING_ADDRESS,
        abi: loreboardVotingAbi,
        functionName: "getEpochConfig",
        args: [epoch],
      })) as [bigint, bigint, boolean];
    } catch {
      try {
        const epochData = (await fluentPublicClient.readContract({
          address: LOREBOARD_VOTING_ADDRESS,
          abi: loreboardVotingAbi,
          functionName: "epochs",
          args: [epoch],
        })) as unknown;
        if (Array.isArray(epochData)) {
          [startsAt, endsAt, finalized] = epochData as [bigint, bigint, boolean];
        } else if (typeof epochData === "boolean") {
          finalized = epochData;
        }
      } catch {
        finalized = (await fluentPublicClient.readContract({
          address: LOREBOARD_VOTING_ADDRESS,
          abi: epochsBoolAbi,
          functionName: "epochs",
          args: [epoch],
        })) as boolean;
      }
    }

    if (startsAt === 0n && endsAt === 0n) {
      const now = BigInt(Math.floor(Date.now() / 1000));
      const votingStartsAt = now - 60n;
      const votingEndsAt = now + 3n * 24n * 60n * 60n;

      // Admin check already done at the beginning - we can proceed
      const txHash = await configureEpochOnChain(epoch, votingStartsAt, votingEndsAt);
      await fluentPublicClient.waitForTransactionReceipt({ hash: txHash });
    }

    if (!finalized) {
      const isPending = await fluentPublicClient.readContract({
        address: LOREBOARD_VOTING_ADDRESS,
        abi: loreboardVotingAbi,
        functionName: "isPendingPlacement",
        args: [epoch, placement],
      });

      if (!isPending) {
        // Admin check already done at the beginning - we can proceed
        const txHash = await registerPendingPlacementOnChain(epoch, placement);
        await fluentPublicClient.waitForTransactionReceipt({ hash: txHash });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[voting/bootstrap] error", e);
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 }
    );
  }
}
