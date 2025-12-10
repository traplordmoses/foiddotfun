import { NextResponse } from "next/server";
import {
  fluentPublicClient,
  configureEpochOnChain,
  registerPendingPlacementOnChain,
} from "@/lib/loreboardVotingAdmin";
import {
  LOREBOARD_VOTING_ADDRESS,
  loreboardVotingAbi,
} from "@/contracts/loreboardVoting";

export async function POST(req: Request) {
  try {
    const { epochId, placementId } = await req.json();

    if (epochId === undefined || !placementId) {
      return NextResponse.json(
        { ok: false, error: "Missing epochId or placementId" },
        { status: 400 }
      );
    }

    const epoch = BigInt(epochId);
    const placement = placementId as `0x${string}`;

    const [startsAt, endsAt, finalized] = await fluentPublicClient.readContract({
      address: LOREBOARD_VOTING_ADDRESS,
      abi: loreboardVotingAbi,
      functionName: "getEpochConfig",
      args: [epoch],
    });

    if (startsAt === 0n && endsAt === 0n) {
      const now = BigInt(Math.floor(Date.now() / 1000));
      const votingStartsAt = now - 60n;
      const votingEndsAt = now + 3n * 24n * 60n * 60n;

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
