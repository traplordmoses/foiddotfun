"use client";

import { useCallback, useRef } from "react";

// ---------------------------------------------------------------------------
// Shadow votes — stored in localStorage when a user votes while disconnected.
// Entries expire after 5 minutes so they can be replayed on connect.
// ---------------------------------------------------------------------------

export type ShadowVote = {
  proposalId: number;
  approve: boolean;
  timestamp: number;
};

const STORAGE_KEY = "foid-shadow-votes";
const REPLAY_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

function readStore(): ShadowVote[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ShadowVote[];
  } catch {
    return [];
  }
}

function writeStore(votes: ShadowVote[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(votes));
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

export function useShadowVotes() {
  const storeRef = useRef<ShadowVote[]>(readStore());

  /** Add a shadow vote */
  const addShadowVote = useCallback((proposalId: number, approve: boolean) => {
    const vote: ShadowVote = { proposalId, approve, timestamp: Date.now() };
    // Replace if already voted on this proposal
    storeRef.current = [
      ...storeRef.current.filter((v) => v.proposalId !== proposalId),
      vote,
    ];
    writeStore(storeRef.current);
  }, []);

  /** Get replayable shadow votes (within the 5-min window) */
  const getReplayableVotes = useCallback((): ShadowVote[] => {
    const cutoff = Date.now() - REPLAY_WINDOW_MS;
    return storeRef.current.filter((v) => v.timestamp > cutoff);
  }, []);

  /** Clear all shadow votes (after replay or dismissal) */
  const clearShadowVotes = useCallback(() => {
    storeRef.current = [];
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  }, []);

  return { addShadowVote, getReplayableVotes, clearShadowVotes };
}
