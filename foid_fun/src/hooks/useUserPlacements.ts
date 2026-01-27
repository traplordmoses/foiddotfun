"use client";

import { useEffect, useState } from "react";
import { toIpfsHttpUrl } from "@/lib/ipfsUrl";

export interface Placement {
  id: string;
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
  status: "canonized" | "voting" | "rejected";
  votes?: { yes: number; total: number };
}

export function useUserPlacements(address: `0x${string}` | undefined) {
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!address) {
      setIsLoading(false);
      setPlacements([]);
      return;
    }

    let cancelled = false;

    const run = async () => {
      try {
        setIsLoading(true);
        const res = await fetch(`/api/proposals?owner=${address}`, { cache: "no-store" });
        const json = await res.json();

        const proposals = (json.proposals ?? []) as any[];

        const mapped: Placement[] = proposals.map((p) => {
          const cid =
            typeof p.cid === "string" && p.cid
              ? p.cid
              : typeof p.cidHash === "string" && p.cidHash
              ? p.cidHash
              : null;
          const imageUrl = toIpfsHttpUrl(cid ?? p.imageUrl ?? null);

          return {
            id: p.id,
            epoch: Number(p.epochSubmitted ?? p.epoch ?? 0),
            x: Number(p.rect?.x ?? p.x ?? 0),
            y: Number(p.rect?.y ?? p.y ?? 0),
            w: Number(p.rect?.w ?? p.w ?? 0),
            h: Number(p.rect?.h ?? p.h ?? 0),
            bidPerCellWei: String(p.bidPerCellWei ?? "0"),
            cidHash: String(p.cidHash ?? ""),
            cid,
            imageUrl,
            title: p.title ?? null,
            status: (p.status ?? "voting") as Placement["status"],
            votes:
              p.yes != null && p.no != null
                ? { yes: Number(p.yes), total: Number(p.yes) + Number(p.no) }
                : undefined,
          };
        });

        mapped.sort((a, b) => b.epoch - a.epoch);

        if (!cancelled) setPlacements(mapped);
      } catch (e) {
        console.error("useUserPlacements api failed:", e);
        if (!cancelled) setPlacements([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [address]);

  return { placements, isLoading };
}
