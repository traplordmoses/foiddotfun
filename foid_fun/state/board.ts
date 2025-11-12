// /src/state/board.ts
import { create } from "zustand";
import type { Rect } from "@/lib/grid";

const BASE = BigInt(process.env.NEXT_PUBLIC_BASE_FEE_PER_CELL_WEI ?? "0");
type FitMode = "contain" | "cover";

export type PendingItem = {
  id: string;
  name: string;
  mime: "image/png" | "image/jpeg";
  width: number;
  height: number;
  rect: Rect;
  cells: number;
  tipPerCellWei: bigint;
  totalWei: bigint;
  previewUrl: string;
  cid?: string;
  fitMode: FitMode;
};

type AddPendingInput = Omit<PendingItem, "id" | "totalWei" | "fitMode"> & { id?: string; fitMode?: FitMode };

type BoardState = {
  pending: PendingItem[];
  addPending: (item: AddPendingInput) => PendingItem;
  removePending: (id: string) => void;
  clearAll: () => void;
  setTipFor: (id: string, tipWei: bigint) => void;
  setFitMode: (id: string, mode: FitMode) => void;
  setRect: (id: string, rect: Rect) => void;
  setCidFor: (id: string, cid: string) => void;
};

function totalWei(cells: number, tip: bigint) {
  const per = BASE + (tip >= 0n ? tip : 0n);
  return BigInt(cells) * per;
}

function uid() {
  try { if (typeof crypto !== "undefined" && (crypto as any).randomUUID) return (crypto as any).randomUUID(); } catch {}
  return Math.random().toString(36).slice(2);
}

const STORAGE_KEY = "mifoid_pending_v1";

function save(pending: PendingItem[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(pending)); } catch {}
}
function load(): PendingItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export const useBoard = create<BoardState>((set, get) => ({
  pending: typeof window === "undefined" ? [] : load(),

  addPending: (input) => {
    const id = input.id ?? uid();
    const { fitMode = "contain", ...rest } = input;
    const item: PendingItem = { id, fitMode, totalWei: totalWei(input.cells, input.tipPerCellWei), ...rest };
    const next = [...get().pending, item];
    set({ pending: next });
    save(next);
    return item;
  },

  removePending: (id) => {
    const next = get().pending.filter((p) => p.id !== id);
    set({ pending: next }); save(next);
  },

  clearAll: () => { set({ pending: [] }); save([]); },

  setTipFor: (id, tipPerCellWei) => {
    const next = get().pending.map((p) =>
      p.id === id ? { ...p, tipPerCellWei, totalWei: totalWei(p.cells, tipPerCellWei) } : p
    );
    set({ pending: next }); save(next);
  },

  setFitMode: (id, mode) => {
    const next = get().pending.map((p) => (p.id === id ? { ...p, fitMode: mode } : p));
    set({ pending: next }); save(next);
  },

  setRect: (id, rect) => {
    const next = get().pending.map((p) =>
      p.id === id
        ? { ...p, rect, /* cells recompute? keep existing; client already shows cost live */ }
        : p
    );
    set({ pending: next }); save(next);
  },

  setCidFor: (id, cid) => {
    const next = get().pending.map((p) =>
      p.id === id ? { ...p, cid } : p
    );
    set({ pending: next });
    save(next);
  },
}));
