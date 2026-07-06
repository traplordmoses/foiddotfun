// src/stores/ampStore.ts
// FOID AMP visibility — the deck is a dock app now, not a bottom-edge
// hover reveal. The dock's AMP tile toggles it; the deck's close orb
// closes it. Position memory stays inside CompactMusicPlayer.
import { create } from "zustand";

type AmpStore = {
  open: boolean;
  toggle: () => void;
  close: () => void;
};

export const useAmpStore = create<AmpStore>((set) => ({
  open: false,
  toggle: () => set((s) => ({ open: !s.open })),
  close: () => set({ open: false }),
}));
