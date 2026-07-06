// src/stores/chatAppStore.ts
// CHAT.EXE visibility — the loreboard chat as a dock app. The dock's Chat
// tile toggles it; the window's close orb closes it. Escape never closes
// (it's a chat, not a modal). Position memory stays inside ChatApp.
import { create } from "zustand";

type ChatAppStore = {
  open: boolean;
  toggle: () => void;
  close: () => void;
};

export const useChatAppStore = create<ChatAppStore>((set) => ({
  open: false,
  toggle: () => set((s) => ({ open: !s.open })),
  close: () => set({ open: false }),
}));
