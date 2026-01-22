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
