// src/hooks/useBoardAnalytics.ts
//
// Imperative analytics surface for the board funnel. Every returned callback
// is a stable ref so call-sites can list it in effect deps without paying
// re-render cost. Timing math lives here in per-hook refs (pickedAt,
// requestedAt keyed by item id) so call-sites never reach for Date.now().
//
// When NEXT_PUBLIC_POSTHOG_KEY is missing or DNT is on, every method
// no-ops — the underlying track() handles the guard. This hook only adds
// property shaping + timing.

import { useCallback, useMemo, useRef } from "react";
import { track } from "@/lib/analytics";

type CelebrationVariant = string;

export interface BoardAnalytics {
  // Lifecycle
  trackBoardLoaded: (props?: {
    placementCount?: number;
    votingCount?: number;
  }) => void;

  // Propose / paint flow
  trackProposeClicked: (props?: { source?: string }) => void;
  trackPaintOpened: (props?: { source?: string }) => void;
  trackPaintConfirmed: (props?: { itemCount?: number }) => void;

  // Review / batch flow
  trackReviewOpened: (props?: { itemCount?: number }) => void;
  trackReviewConfirmed: (props?: { itemCount?: number }) => void;

  // Signature timing — call when the user is prompted, then confirmed /
  // rejected. msSinceRequested is computed from the ref map.
  trackSignatureRequested: (id: string) => void;
  trackSignatureConfirmed: (
    id: string,
    reasonOrProps?: string | Record<string, unknown>,
  ) => void;
  trackSignatureRejected: (id: string, reason?: string) => void;

  // Placement engraved — msSincePicked = time from markItemPicked to this
  // call. Falls back to null when picked time is missing.
  trackPlacementEngraved: (
    id: string,
    reasonOrProps?: string | Record<string, unknown>,
  ) => void;

  // Celebration / share
  trackCelebrationShown: (
    proposalId: string,
    variant: CelebrationVariant,
  ) => void;
  trackCelebrationShared: (proposalId: string) => void;

  // γ funnel events — wired from γ's existing call sites
  trackRetroModeTriggered: (props?: Record<string, unknown>) => void;
  trackOnboardingCompleted: (props?: Record<string, unknown>) => void;
  trackOnboardingSkipped: (props?: Record<string, unknown>) => void;

  // Bookkeeping — call from the paint-confirm handler so subsequent
  // trackPlacementEngraved(id) can compute msSincePicked.
  markItemPicked: (id: string) => void;
}

export function useBoardAnalytics(): BoardAnalytics {
  const pickedAtRef = useRef<Map<string, number>>(new Map());
  const requestedAtRef = useRef<Map<string, number>>(new Map());

  const markItemPicked = useCallback((id: string) => {
    pickedAtRef.current.set(id, Date.now());
  }, []);

  const trackBoardLoaded = useCallback<BoardAnalytics["trackBoardLoaded"]>(
    (props) => {
      track("board_loaded", {
        placement_count: props?.placementCount ?? 0,
        voting_count: props?.votingCount ?? 0,
      });
    },
    [],
  );

  const trackProposeClicked = useCallback<BoardAnalytics["trackProposeClicked"]>(
    (props) => {
      track("board_propose_clicked", { source: props?.source ?? "unknown" });
    },
    [],
  );

  const trackPaintOpened = useCallback<BoardAnalytics["trackPaintOpened"]>(
    (props) => {
      track("board_paint_opened", { source: props?.source ?? "unknown" });
    },
    [],
  );

  const trackPaintConfirmed = useCallback<BoardAnalytics["trackPaintConfirmed"]>(
    (props) => {
      track("board_paint_confirmed", { item_count: props?.itemCount ?? 0 });
    },
    [],
  );

  const trackReviewOpened = useCallback<BoardAnalytics["trackReviewOpened"]>(
    (props) => {
      track("board_review_opened", { item_count: props?.itemCount ?? 0 });
    },
    [],
  );

  const trackReviewConfirmed = useCallback<BoardAnalytics["trackReviewConfirmed"]>(
    (props) => {
      track("board_review_confirmed", { item_count: props?.itemCount ?? 0 });
    },
    [],
  );

  const trackSignatureRequested = useCallback((id: string) => {
    requestedAtRef.current.set(id, Date.now());
    track("board_signature_requested", { item_id: id });
  }, []);

  const trackSignatureConfirmed = useCallback<BoardAnalytics["trackSignatureConfirmed"]>(
    (id, reasonOrProps) => {
      const requestedAt = requestedAtRef.current.get(id);
      const msSinceRequested = requestedAt ? Date.now() - requestedAt : null;
      const extra =
        typeof reasonOrProps === "string"
          ? { reason: reasonOrProps }
          : reasonOrProps ?? {};
      track("board_signature_confirmed", {
        item_id: id,
        ms_since_requested: msSinceRequested,
        ...extra,
      });
    },
    [],
  );

  const trackSignatureRejected = useCallback<BoardAnalytics["trackSignatureRejected"]>(
    (id, reason) => {
      const requestedAt = requestedAtRef.current.get(id);
      const msSinceRequested = requestedAt ? Date.now() - requestedAt : null;
      requestedAtRef.current.delete(id);
      track("board_signature_rejected", {
        item_id: id,
        ms_since_requested: msSinceRequested,
        reason: reason ?? "unknown",
      });
    },
    [],
  );

  const trackPlacementEngraved = useCallback<BoardAnalytics["trackPlacementEngraved"]>(
    (id, reasonOrProps) => {
      const pickedAt = pickedAtRef.current.get(id);
      const msSincePicked = pickedAt ? Date.now() - pickedAt : null;
      pickedAtRef.current.delete(id);
      requestedAtRef.current.delete(id);
      const extra =
        typeof reasonOrProps === "string"
          ? { reason: reasonOrProps }
          : reasonOrProps ?? {};
      track("board_placement_engraved", {
        item_id: id,
        ms_since_picked: msSincePicked,
        ...extra,
      });
    },
    [],
  );

  const trackCelebrationShown = useCallback(
    (proposalId: string, variant: CelebrationVariant) => {
      track("board_celebration_shown", {
        proposal_id: proposalId,
        variant,
      });
    },
    [],
  );

  const trackCelebrationShared = useCallback((proposalId: string) => {
    track("board_celebration_shared", { proposal_id: proposalId });
  }, []);

  const trackRetroModeTriggered = useCallback<BoardAnalytics["trackRetroModeTriggered"]>(
    (props) => {
      track("retro_mode_triggered", props);
    },
    [],
  );

  const trackOnboardingCompleted = useCallback<BoardAnalytics["trackOnboardingCompleted"]>(
    (props) => {
      track("onboarding_completed", props);
    },
    [],
  );

  const trackOnboardingSkipped = useCallback<BoardAnalytics["trackOnboardingSkipped"]>(
    (props) => {
      track("onboarding_skipped", props);
    },
    [],
  );

  return useMemo<BoardAnalytics>(
    () => ({
      trackBoardLoaded,
      trackProposeClicked,
      trackPaintOpened,
      trackPaintConfirmed,
      trackReviewOpened,
      trackReviewConfirmed,
      trackSignatureRequested,
      trackSignatureConfirmed,
      trackSignatureRejected,
      trackPlacementEngraved,
      trackCelebrationShown,
      trackCelebrationShared,
      trackRetroModeTriggered,
      trackOnboardingCompleted,
      trackOnboardingSkipped,
      markItemPicked,
    }),
    [
      trackBoardLoaded,
      trackProposeClicked,
      trackPaintOpened,
      trackPaintConfirmed,
      trackReviewOpened,
      trackReviewConfirmed,
      trackSignatureRequested,
      trackSignatureConfirmed,
      trackSignatureRejected,
      trackPlacementEngraved,
      trackCelebrationShown,
      trackCelebrationShared,
      trackRetroModeTriggered,
      trackOnboardingCompleted,
      trackOnboardingSkipped,
      markItemPicked,
    ],
  );
}
