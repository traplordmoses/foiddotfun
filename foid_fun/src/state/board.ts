// src/state/board.ts
// Zustand store for pending (pre-submission) board placements.
// Items persist across page reloads via localStorage (except File blobs).

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Rect } from "@/lib/grid";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PendingItem {
  /** Unique ID (auto-generated on add) */
  id: string;
  /** Original file name */
  name: string;
  /** MIME type */
  mime: "image/png" | "image/jpeg";
  /** Original image width */
  width: number;
  /** Original image height */
  height: number;
  /** Current grid-snapped rect on the board */
  rect: Rect;
  /** Cell count (derived from rect, kept for convenience) */
  cells: number;
  /** Extra tip per cell in wei */
  tipPerCellWei: bigint;
  /** Object URL for preview (not persisted) */
  previewUrl: string;
  /** The actual File object (not persisted) */
  file?: File;
  /** IPFS CID after upload */
  cid?: string;
  /** Fit mode for rendering */
  fitMode?: "contain" | "cover" | "fill";
}

// Serializable subset (File and previewUrl can't survive localStorage)
type PersistedItem = Omit<PendingItem, "file" | "previewUrl" | "tipPerCellWei"> & {
  tipPerCellWei: string; // bigint → string for JSON
};

// ─── Store ───────────────────────────────────────────────────────────────────

interface BoardState {
  pending: PendingItem[];
  addPending: (item: Omit<PendingItem, "id">) => void;
  removePending: (id: string) => void;
  setRect: (id: string, rect: Rect) => void;
  clearAll: () => void;
  setCidFor: (id: string, cid: string) => void;
}

let nextId = 0;
function genId(): string {
  return `pending-${Date.now()}-${++nextId}`;
}

export const useBoard = create<BoardState>()(
  persist(
    (set) => ({
      pending: [],

      addPending: (item) =>
        set((state) => ({
          pending: [...state.pending, { ...item, id: genId() }],
        })),

      removePending: (id) =>
        set((state) => {
          // Revoke the item's blob URL on removal so we don't leak memory
          // across long sessions. The celebration is handed a stable data
          // URL by useProposalSubmit, so revoking here is safe even
          // mid-celebration. See audit note P1-7.
          const target = state.pending.find((p) => p.id === id);
          if (target?.previewUrl?.startsWith("blob:")) {
            try {
              URL.revokeObjectURL(target.previewUrl);
            } catch {
              /* ignore */
            }
          }
          return { pending: state.pending.filter((p) => p.id !== id) };
        }),

      setRect: (id, rect) =>
        set((state) => ({
          pending: state.pending.map((p) =>
            p.id === id ? { ...p, rect } : p
          ),
        })),

      clearAll: () =>
        set((state) => {
          // Revoke preview URLs to free memory
          state.pending.forEach((p) => {
            try { URL.revokeObjectURL(p.previewUrl); } catch { /* ignore */ }
          });
          return { pending: [] };
        }),

      setCidFor: (id, cid) =>
        set((state) => ({
          pending: state.pending.map((p) =>
            p.id === id ? { ...p, cid } : p
          ),
        })),
    }),
    {
      name: "foid-board-pending",
      // Custom serialization: File objects & blob URLs can't be persisted
      storage: {
        getItem: (name) => {
          try {
            const raw = localStorage.getItem(name);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (parsed?.state?.pending) {
              // Restore bigint from string and mark items as non-renderable
              // (File + previewUrl are lost on reload — user must re-add images)
              parsed.state.pending = (parsed.state.pending as PersistedItem[])
                .map((item) => ({
                  ...item,
                  tipPerCellWei: BigInt(item.tipPerCellWei || "0"),
                  previewUrl: "", // lost on reload
                  file: undefined,
                }))
                // Filter out items without preview (they can't render)
                .filter((item: PendingItem) => !!item.cid); // keep only items with CIDs (already uploaded)
            }
            return parsed;
          } catch {
            return null;
          }
        },
        setItem: (name, value) => {
          try {
            const clone = JSON.parse(JSON.stringify(value, (_, v) =>
              typeof v === "bigint" ? v.toString() : v
            ));
            // Strip non-serializable fields
            if (clone?.state?.pending) {
              clone.state.pending = clone.state.pending.map(
                (item: PendingItem & { tipPerCellWei: string | bigint }) => ({
                  id: item.id,
                  name: item.name,
                  mime: item.mime,
                  width: item.width,
                  height: item.height,
                  rect: item.rect,
                  cells: item.cells,
                  tipPerCellWei: String(item.tipPerCellWei),
                  cid: item.cid,
                  fitMode: item.fitMode,
                })
              );
            }
            localStorage.setItem(name, JSON.stringify(clone));
          } catch { /* ignore storage errors */ }
        },
        removeItem: (name) => {
          try { localStorage.removeItem(name); } catch { /* ignore */ }
        },
      },
    }
  )
);
