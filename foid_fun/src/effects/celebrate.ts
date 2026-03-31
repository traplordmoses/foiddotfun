"use client";

import { showPrayerSuccess } from "@/effects/PrayerSuccess";

export function celebrateTransaction(txHash?: string) {
  if (typeof window === "undefined") return;
  const run = () => showPrayerSuccess(txHash, { duration: 3800 });
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
}) {
  if (typeof window === "undefined") return;
  import("@/effects/PlacementCelebration").then(({ showPlacementCelebration }) => {
    window.requestAnimationFrame(() => showPlacementCelebration(opts));
  });
}
