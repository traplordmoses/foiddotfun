"use client";

import { showAeroToast } from "@/effects/AeroToast";
import { showBlessingBloom } from "@/effects/BlessingBloom";
import { showHoloSticker } from "@/effects/HoloSticker";

type Celebration = (txHash?: string) => void;

const HOLO_STICKER_TEXT = [
  "chain-linked ✧",
  "tx sealed ☆",
  "ledger locked ✦",
  "blessed hash ✧",
];

const CELEBRATIONS: Celebration[] = [
  (hash) => showAeroToast(hash, { position: "center", duration: 2600 }),
  (hash) =>
    showBlessingBloom({
      position: "center",
      duration: 2200,
      message: hash ? `blossomed ${hash.slice(0, 4)}✧` : "blessing bloom ✧",
    }),
  () =>
    showHoloSticker(
      HOLO_STICKER_TEXT[Math.floor(Math.random() * HOLO_STICKER_TEXT.length)],
      { position: "center", duration: 2600 },
    ),
];

let celebrationQueue: Celebration[] = [];

function shuffleInPlace<T>(input: T[]): T[] {
  for (let i = input.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [input[i], input[j]] = [input[j], input[i]];
  }
  return input;
}

function nextCelebration(): Celebration {
  if (celebrationQueue.length === 0) {
    celebrationQueue = shuffleInPlace([...CELEBRATIONS]);
  }
  return celebrationQueue.pop()!;
}

export function celebrateTransaction(txHash?: string) {
  if (typeof window === "undefined") return;
  const run = () => nextCelebration()(txHash);
  if ("requestAnimationFrame" in window) {
    window.requestAnimationFrame(run);
  } else {
    run();
  }
}
