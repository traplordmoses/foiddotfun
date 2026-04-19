"use client";

import { showPrayerSuccess } from "@/effects/PrayerSuccess";
import type { Personalization } from "@/effects/placementPersonalization";

export function celebrateTransaction(txHash?: string, nextAllowedAt?: number) {
  if (typeof window === "undefined") return;
  const run = () => showPrayerSuccess(txHash, { duration: 6500, nextAllowedAt });
  if ("requestAnimationFrame" in window) {
    window.requestAnimationFrame(run);
  } else {
    run();
  }
}

export function celebratePlacement(opts: {
  itemName: string;
  txHash: string;
  proposalId: number | null;
  previewUrl: string;
  ipfsCid?: string;
  personalization?: Personalization;
}) {
  if (typeof window === "undefined") return;
  import("@/effects/PlacementCelebration").then(({ showPlacementCelebration }) => {
    window.requestAnimationFrame(() => showPlacementCelebration(opts));
  });
}
