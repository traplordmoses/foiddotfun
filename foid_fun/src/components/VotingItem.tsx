"use client";

import React, { useMemo, useEffect } from "react";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { usePlacementVotes } from "@/hooks/usePlacementVotes";
import { useVoteOnPlacement } from "@/hooks/useVoteOnPlacement";
import { resolveEpochConfig, currentEpoch } from "@/lib/epoch";
import { formatCountdown } from "@/lib/formatDuration";
import { cidToHttpUrl } from "@/lib/ipfsUrl";
import type { ProposalSummary } from "@/lib/api";
import { TARGET_CHAIN_ID } from "@/lib/chain";

// ============================================================================
// TYPES
// ============================================================================

export type VotingItemProps = {
  proposal: ProposalSummary;
  addStatus: (msg: string, type: "info" | "success" | "error" | "system") => void;
  now: number;
};

// ============================================================================
// HELPERS
// ============================================================================

const isBytes32Hex = (value?: string): value is `0x${string}` =>
  typeof value === "string" && /^0x[0-9a-fA-F]{64}$/.test(value);

const FLUENT_CHAIN_ID = TARGET_CHAIN_ID;

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * Individual voting item for a proposal
 *
 * Features:
 * - Shows proposal thumbnail
 * - Displays cell count and time remaining
 * - Shows yes/no vote counts
 * - Handles vote submission with chain switching
 * - Auto-refetches votes after confirmation
 */
export function VotingItem({ proposal, addStatus, now }: VotingItemProps) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync, isPending: switchingChain } = useSwitchChain();

  // Calculate time remaining
  const computedSecondsLeft = useMemo(() => {
    // If API provides voteEndsAt timestamp, use it directly
    if (proposal.voteEndsAt) {
      const nowSec = Math.floor(now / 1000);
      return Math.max(0, proposal.voteEndsAt - nowSec);
    }
    // Fallback to epoch calculation
    const { enabled, epochSec } = resolveEpochConfig();
    if (!enabled || epochSec <= 0) return null;
    const nowEpoch = currentEpoch();
    const epochsDiff = (proposal.voteEndsAtEpoch ?? 0) - nowEpoch;
    return epochsDiff <= 0 ? 0 : Math.max(0, epochsDiff * epochSec);
  }, [proposal.voteEndsAt, proposal.voteEndsAtEpoch, now]);

  // Determine if proposal is votable
  const hasEpoch = typeof proposal.epochSubmitted === "number";
  const epochCfg = resolveEpochConfig();
  const isVotable = Boolean(proposal.isVotable);
  const isPending =
    (proposal.status === "proposed" || proposal.status === "voting") &&
    epochCfg.enabled &&
    computedSecondsLeft !== null &&
    computedSecondsLeft > 0 &&
    isVotable;

  // Extract placement ID from proposal (check multiple fields for compatibility)
  const placementId = isBytes32Hex(proposal.id)
    ? proposal.id
    : isBytes32Hex(proposal.placementId)
      ? proposal.placementId
      : isBytes32Hex(proposal.chainId)
        ? proposal.chainId
        : undefined;

  const epochId = proposal.epochSubmitted ?? 0;
  const queryEnabled = isPending && hasEpoch && isBytes32Hex(placementId);
  const epochBigInt = BigInt(epochId || 0);

  // Fetch vote counts
  const {
    yes,
    no,
    isLoading: votesLoading,
    refetch: refetchVotes,
  } = usePlacementVotes({
    epochId: epochBigInt,
    placementId: (placementId ?? "0x") as `0x${string}`,
    enabled: queryEnabled,
  });

  // Vote submission hook
  const { vote, isWriting, isConfirming, isConfirmed } = useVoteOnPlacement({
    epochId: epochBigInt,
    placementId,
  });

  // Refetch votes after confirmation
  useEffect(() => {
    if (isConfirmed) {
      void refetchVotes();
    }
  }, [isConfirmed, refetchVotes]);

  // Check if user is on wrong chain
  const wrongChain = Boolean(chainId && chainId !== FLUENT_CHAIN_ID);
  const isVoting = isWriting || isConfirming;
  const canVote =
    isPending &&
    queryEnabled &&
    !!address &&
    isConnected &&
    !isVoting &&
    !votesLoading &&
    !switchingChain;

  // Handle vote submission
  const onVoteClick = async (support: boolean) => {
    if (!queryEnabled || !address) return;

    // Switch chain if needed
    if (wrongChain) {
      try {
        await switchChainAsync?.({ chainId: FLUENT_CHAIN_ID });
      } catch {
        return;
      }
    }

    try {
      addStatus(`Voting ${support ? "YES" : "NO"}...`, "info");
      await vote(support);
      await refetchVotes();
      addStatus("Vote submitted ✓", "success");
    } catch (err) {
      addStatus(`Vote failed: ${(err as Error)?.message || "error"}`, "error");
    }
  };

  // Display vote counts
  const displayYes = queryEnabled ? yes : BigInt(proposal.yes ?? 0);
  const displayNo = queryEnabled ? no : BigInt(proposal.no ?? 0);
  const timeLeftLabel =
    computedSecondsLeft !== null ? formatCountdown(Math.max(0, computedSecondsLeft) * 1000) : "—";

  return (
    <div className="voting-item">
      <div className="voting-item__thumb">
        {proposal.cid && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cidToHttpUrl(proposal.cid)} alt="" loading="lazy" />
          </>
        )}
      </div>
      <div className="voting-item__info">
        <span>{proposal.cells} cells</span>
        <span>{timeLeftLabel}</span>
      </div>
      <span className="voting-item__counts">
        {displayYes.toString()}↑ {displayNo.toString()}↓
      </span>
      <div className="voting-item__btns">
        <button
          onClick={() => onVoteClick(true)}
          disabled={!canVote}
          className="voting-item__yes"
          type="button"
          aria-label={`Vote yes on proposal with ${proposal.cells} cells`}
          title="Vote Yes"
        >
          ✓
        </button>
        <button
          onClick={() => onVoteClick(false)}
          disabled={!canVote}
          className="voting-item__no"
          type="button"
          aria-label={`Vote no on proposal with ${proposal.cells} cells`}
          title="Vote No"
        >
          ✕
        </button>
      </div>
      {!isVotable && <span className="voting-item__status">awaiting registration</span>}
    </div>
  );
}
