"use client";

import React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";
import toast from "react-hot-toast";
import type { Placement } from "@/hooks/useUserPlacements";

/* ── Types ───────────────────────────────────────────────────────── */

interface VoteEvent {
  id: string;
  voter: string;
  approve: boolean;
  weight: string;
  timestamp: number;
  txHash: string;
  proposalId: string;
}

/* ── ENS cache (session-level) ───────────────────────────────────── */

const ensCache = new Map<string, string | null>();

// Mainnet client just for ENS resolution
const mainnetClient = createPublicClient({
  chain: mainnet,
  transport: http("https://cloudflare-eth.com"),
});

async function resolveEns(address: string): Promise<string | null> {
  const key = address.toLowerCase();
  if (ensCache.has(key)) return ensCache.get(key) ?? null;

  try {
    const name = await mainnetClient.getEnsName({
      address: key as `0x${string}`,
    });
    ensCache.set(key, name);
    return name;
  } catch {
    ensCache.set(key, null);
    return null;
  }
}

function truncateAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

/* ── localStorage seen-votes tracker ─────────────────────────────── */

const SEEN_KEY_PREFIX = "foid_seen_votes_";

function getSeenVoteIds(address: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(`${SEEN_KEY_PREFIX}${address.toLowerCase()}`);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function saveSeenVoteIds(address: string, ids: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    // Keep only the most recent 500 to avoid localStorage bloat
    const arr = [...ids].slice(-500);
    localStorage.setItem(`${SEEN_KEY_PREFIX}${address.toLowerCase()}`, JSON.stringify(arr));
  } catch { /* quota */ }
}

/* ── Hook ─────────────────────────────────────────────────────────── */

/**
 * Polls for new votes on the user's active proposals and fires
 * toast notifications with ENS-resolved voter names.
 */
export function useVoteAlerts(
  address: `0x${string}` | undefined,
  placements: Placement[],
) {
  const [lastPoll, setLastPoll] = useState(0);
  const seenRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);

  // Get proposal IDs for active voting proposals
  const votingProposalIds = placements
    .filter((p) => p.status === "voting" && p.placementId)
    .map((p) => p.placementId);

  // Initialize seen set from localStorage
  useEffect(() => {
    if (!address) return;
    seenRef.current = getSeenVoteIds(address);
    initializedRef.current = true;
  }, [address]);

  const checkNewVotes = useCallback(async () => {
    if (!address || votingProposalIds.length === 0) return;

    try {
      const sinceParam = lastPoll > 0 ? `&since=${lastPoll - 60}` : "";
      const res = await fetch(
        `/api/votes/on-proposals?ids=${votingProposalIds.join(",")}${sinceParam}`,
      );
      if (!res.ok) return;

      const data = await res.json();
      const votes: VoteEvent[] = data.votes ?? [];

      // Filter out own votes and already-seen votes
      const newVotes = votes.filter(
        (v) =>
          v.voter.toLowerCase() !== address.toLowerCase() &&
          !seenRef.current.has(v.id),
      );

      // Fire toast for each new vote (max 3 at a time to avoid spam)
      for (const vote of newVotes.slice(0, 3)) {
        seenRef.current.add(vote.id);

        // Resolve ENS name (non-blocking — toast fires with address, updates if ENS found)
        const ensName = await resolveEns(vote.voter);
        const displayName = ensName ?? truncateAddress(vote.voter);
        const direction = vote.approve ? "FOR" : "AGAINST";

        toast(
          (t) =>
            React.createElement(
              "div",
              { style: { display: "flex", alignItems: "center", gap: "8px", width: "100%" } },
              React.createElement(
                "span",
                { style: { flex: 1, minWidth: 0 } },
                `\u{1F5F3}\uFE0F ${displayName} voted ${direction} your placement`,
              ),
              React.createElement(
                "button",
                {
                  onClick: () => toast.dismiss(t.id),
                  style: {
                    background: "rgba(255,255,255,0.1)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    borderRadius: "6px",
                    color: "rgba(255,255,255,0.6)",
                    cursor: "pointer",
                    fontSize: "12px",
                    lineHeight: 1,
                    padding: "3px 6px",
                    flexShrink: 0,
                  },
                },
                "\u2715",
              ),
            ),
          {
            duration: 8000,
            style: {
              fontFamily: "var(--font-mono, monospace)",
              fontSize: "11px",
              letterSpacing: "0.04em",
            },
          },
        );
      }

      // Mark all fetched votes as seen (not just the ones we toasted)
      for (const v of votes) {
        seenRef.current.add(v.id);
      }
      saveSeenVoteIds(address, seenRef.current);
      setLastPoll(Math.floor(Date.now() / 1000));
    } catch {
      // Silently fail — non-critical feature
    }
  }, [address, votingProposalIds, lastPoll]);

  // Poll every 60 seconds when there are active voting proposals
  useEffect(() => {
    if (!address || votingProposalIds.length === 0 || !initializedRef.current) return;

    // Initial check
    checkNewVotes();

    const interval = setInterval(checkNewVotes, 60_000);

    const handleVisibility = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        checkNewVotes();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, votingProposalIds.join(",")]);
}
