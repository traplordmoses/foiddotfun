"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toIpfsHttpUrl } from "@/lib/ipfsUrl";
import { shouldFetchOnce } from "@/lib/requestGuard";

export interface Placement {
  id: string;
  placementId: string;
  epoch: number;
  x: number;
  y: number;
  w: number;
  h: number;
  bidPerCellWei: string;
  cidHash: string;
  cid: string | null;
  imageUrl: string | null;
  title: string | null;
  registeredAt: number | null;
  voteEndsAt: number | null;
  isVotable: boolean;
  status: "canonized" | "voting" | "rejected" | "proposed" | "expired";
  votes?: { yes: number; total: number };
}

/* ── Helpers ──────────────────────────────────────────────────────── */

const toNumberOrNull = (value: unknown): number | null => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

/** Derive Placement.status from swipe proposal fields */
function deriveSwipeStatus(p: {
  finalized: boolean;
  approved: boolean;
  votingEndsAt: number;
}): Placement["status"] {
  if (p.finalized && p.approved) return "canonized";
  if (p.finalized && !p.approved) return "rejected";
  const now = Math.floor(Date.now() / 1000);
  if (!p.finalized && p.votingEndsAt > now) return "voting";
  if (!p.finalized && p.votingEndsAt <= now) return "expired";
  return "proposed";
}

/* ── Hook ─────────────────────────────────────────────────────────── */

export function useUserPlacements(address: `0x${string}` | undefined) {
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  const controllerRef = useRef<AbortController | null>(null);

  /** Normalize canonized placements from /api/proposals */
  const normalizeProposals = useCallback((json: unknown): Placement[] => {
    const proposals = (json && typeof json === "object" && "proposals" in json ? json.proposals : []) as unknown[];
    return proposals.map((item) => {
      const p = item as Record<string, unknown>;
      const cid =
        typeof p.cid === "string" && p.cid
          ? p.cid
          : typeof p.cidHash === "string" && p.cidHash
          ? p.cidHash
          : null;
      const imageUrl = toIpfsHttpUrl(cid ?? (p.imageUrl as string | null) ?? null);
      const placementId = typeof p.placementId === "string" && p.placementId ? p.placementId : (p.id as string);

      return {
        id: p.id as string,
        placementId,
        epoch: Number((p.epochSubmitted ?? p.epoch) ?? 0),
        x: Number((p.rect as Record<string, unknown> | undefined)?.x ?? p.x ?? 0),
        y: Number((p.rect as Record<string, unknown> | undefined)?.y ?? p.y ?? 0),
        w: Number((p.rect as Record<string, unknown> | undefined)?.w ?? p.w ?? 0),
        h: Number((p.rect as Record<string, unknown> | undefined)?.h ?? p.h ?? 0),
        bidPerCellWei: String(p.bidPerCellWei ?? "0"),
        cidHash: String(p.cidHash ?? ""),
        cid,
        imageUrl,
        registeredAt: toNumberOrNull((p.registeredAt ?? p.time) ?? null),
        voteEndsAt: toNumberOrNull(p.voteEndsAt ?? null),
        title: (p.title as string | null) ?? null,
        isVotable: Boolean(p.isVotable),
        status: (p.status ?? "canonized") as Placement["status"],
        votes:
          p.yes != null && p.no != null
            ? { yes: Number(p.yes), total: Number(p.yes) + Number(p.no) }
            : undefined,
      };
    });
  }, []);

  /** Normalize swipe proposals from /api/swipe/proposals, filtered to this user */
  const normalizeSwipeProposals = useCallback(
    (json: unknown, ownerAddress: string): Placement[] => {
      const proposals = (json && typeof json === "object" && "proposals" in json ? json.proposals : []) as unknown[];
      const owner = ownerAddress.toLowerCase();

      return proposals
        .filter((item) => {
          const p = item as Record<string, unknown>;
          return (p.proposer as string | undefined)?.toLowerCase() === owner;
        })
        .map((item) => {
          const p = item as Record<string, unknown>;
          const cid = typeof p.ipfsCid === "string" && p.ipfsCid ? p.ipfsCid.replace("ipfs://", "") : null;
          const imageUrl = toIpfsHttpUrl(cid ?? (p.imageUrl as string | null) ?? null);
          const forCount = Number(p.forCount ?? 0);
          const againstCount = Number(p.againstCount ?? 0);
          const votingEndsAt = Number(p.votingEndsAt ?? 0);
          const finalized = Boolean(p.finalized);
          const approved = Boolean(p.approved);
          const status = deriveSwipeStatus({ finalized, approved, votingEndsAt });

          return {
            id: `swipe-${p.id}`,
            placementId: String(p.placementId ?? p.id),
            epoch: 0,
            x: Number(p.gridX ?? 0),
            y: Number(p.gridY ?? 0),
            w: Number(p.gridW ?? 0),
            h: Number(p.gridH ?? 0),
            bidPerCellWei: "0",
            cidHash: "",
            cid,
            imageUrl,
            registeredAt: toNumberOrNull(p.createdAt ?? null),
            voteEndsAt: votingEndsAt > 0 ? votingEndsAt : null,
            title: (p.name as string | null) ?? null,
            isVotable: status === "voting",
            status,
            votes: { yes: forCount, total: forCount + againstCount },
          };
        });
    },
    [],
  );

  const fetchPlacements = useCallback(async () => {
    if (!address) {
      setPlacements([]);
      setIsLoading(false);
      return;
    }

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setIsLoading(true);
    setHasFetched(true);

    try {
      // Fetch both endpoints in parallel — either can fail independently
      const [canonizedResult, swipeResult] = await Promise.allSettled([
        fetch(`/api/proposals?owner=${address}`, {
          cache: "no-store",
          signal: controller.signal,
        }).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`proposals ${r.status}`)))),
        fetch("/api/swipe/proposals", {
          cache: "no-store",
          signal: controller.signal,
        }).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`swipe ${r.status}`)))),
      ]);

      if (controller.signal.aborted) return;

      // Parse canonized placements (the source of truth for finalized+approved)
      const canonized =
        canonizedResult.status === "fulfilled" ? normalizeProposals(canonizedResult.value) : [];

      // Parse swipe proposals (voting lifecycle data, filtered to this user)
      const swipe =
        swipeResult.status === "fulfilled" ? normalizeSwipeProposals(swipeResult.value, address) : [];

      // Deduplicate: canonized placements win over finalized+approved swipe proposals
      // (canonized has richer placement-specific data like exact coordinates)
      const canonizedCids = new Set(canonized.map((p) => p.cid).filter(Boolean));
      const deduped = swipe.filter((sp) => {
        // Keep swipe entries that aren't already represented as canonized placements
        if (sp.status === "canonized" && sp.cid && canonizedCids.has(sp.cid)) return false;
        return true;
      });

      const merged = [...canonized, ...deduped];
      // Sort: newest first (by registeredAt), then by status priority
      merged.sort((a, b) => (b.registeredAt ?? 0) - (a.registeredAt ?? 0));

      setPlacements(merged);
    } catch (error) {
      if (controller.signal.aborted) return;
      console.error("useUserPlacements fetch failed:", error);
      setPlacements([]);
    } finally {
      if (controller.signal.aborted) return;
      setIsLoading(false);
    }
  }, [address, normalizeProposals, normalizeSwipeProposals]);

  const refresh = useCallback(async () => {
    await fetchPlacements();
  }, [fetchPlacements]);

  useEffect(() => {
    if (!address) {
      setPlacements([]);
      setIsLoading(false);
      setHasFetched(false);
      return;
    }

    // Check guard only if we've already fetched (prevents spam on rapid re-renders)
    const guardKey = `user-placements:init:${address}`;
    if (hasFetched && !shouldFetchOnce(guardKey, 10_000)) {
      return;
    }

    void fetchPlacements();

    return () => {
      controllerRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  return { placements, isLoading, hasFetched, refresh };
}
