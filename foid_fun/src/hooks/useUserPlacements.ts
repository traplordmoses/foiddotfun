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

export function useUserPlacements(address: `0x${string}` | undefined) {
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  const controllerRef = useRef<AbortController | null>(null);

  const toNumberOrNull = (value: unknown): number | null => {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  };

  const normalizeProposals = useCallback((json: unknown): Placement[] => {
    const proposals = (json && typeof json === "object" && "proposals" in json ? json.proposals : []) as unknown[];
    const mapped: Placement[] = proposals.map((item) => {
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
        status: (p.status ?? "voting") as Placement["status"],
        votes:
          p.yes != null && p.no != null
            ? { yes: Number(p.yes), total: Number(p.yes) + Number(p.no) }
            : undefined,
      };
    });

    mapped.sort((a, b) => b.epoch - a.epoch);
    return mapped;
  }, []);

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
      const res = await fetch(`/api/proposals?owner=${address}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!res.ok) {
        throw new Error(`proposals ${res.status}`);
      }

      const json = await res.json();
      if (controller.signal.aborted) return;

      const mapped = normalizeProposals(json);
      setPlacements(mapped);
    } catch (error) {
      if (controller.signal.aborted) return;
      console.error("useUserPlacements api failed:", error);
      setPlacements([]);
    } finally {
      if (controller.signal.aborted) return;
      setIsLoading(false);
    }
  }, [address, normalizeProposals]);

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

    const guardKey = `user-placements:init:${address}`;
    if (!shouldFetchOnce(guardKey, 25_000)) {
      return;
    }

    void fetchPlacements();

    return () => {
      controllerRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  // Reset hasFetched when address changes
  useEffect(() => {
    setHasFetched(false);
  }, [address]);

  return { placements, isLoading, hasFetched, refresh };
}
