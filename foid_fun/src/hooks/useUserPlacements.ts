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
  status: "canonized" | "voting" | "rejected";
  votes?: { yes: number; total: number };
}

export function useUserPlacements(address: `0x${string}` | undefined) {
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const controllerRef = useRef<AbortController | null>(null);

  const toNumberOrNull = (value: unknown): number | null => {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  };

  const normalizeProposals = useCallback((json: any): Placement[] => {
    const proposals = (json?.proposals ?? []) as any[];
    const mapped: Placement[] = proposals.map((p) => {
      const cid =
        typeof p.cid === "string" && p.cid
          ? p.cid
          : typeof p.cidHash === "string" && p.cidHash
          ? p.cidHash
          : null;
      const imageUrl = toIpfsHttpUrl(cid ?? p.imageUrl ?? null);

      const placementId = typeof p.placementId === "string" && p.placementId ? p.placementId : p.id;

      return {
        id: p.id,
        placementId,
        epoch: Number(p.epochSubmitted ?? p.epoch ?? 0),
        x: Number(p.rect?.x ?? p.x ?? 0),
        y: Number(p.rect?.y ?? p.y ?? 0),
        w: Number(p.rect?.w ?? p.w ?? 0),
        h: Number(p.rect?.h ?? p.h ?? 0),
        bidPerCellWei: String(p.bidPerCellWei ?? "0"),
        cidHash: String(p.cidHash ?? ""),
        cid,
        imageUrl,
        registeredAt: toNumberOrNull(p.registeredAt ?? p.time ?? null),
        voteEndsAt: toNumberOrNull(p.voteEndsAt ?? null),
        title: p.title ?? null,
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
  }, [address, fetchPlacements]);

  return { placements, isLoading, refresh };
}
