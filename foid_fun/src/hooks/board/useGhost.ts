// /src/hooks/board/useGhost.ts
// The drop-ghost: tracks the rect + status shown while a user drags an image
// over the canvas. Debounced at ~60fps to keep pointer events smooth.
"use client";

import { useCallback, useRef, useState } from "react";
import type React from "react";
import { TILE, snapRect, rectCells, hasOverlap, isTouching, type Rect } from "@/lib/grid";
import { sniffImageType, mimeFromType } from "@/lib/image";
import { MAX_CELLS_PER_RECT } from "@/lib/boardImages";
import { getImageSize } from "@/lib/board";

export type DropPos = { x: number; y: number };
export type GhostStatus = "ok" | "overlap" | "oversize" | "invalid" | "not-touching";

export type Ghost = {
  rect: Rect;
  cells: number;
  status: GhostStatus;
  totalWei: bigint;
};

type DragMeta = { w: number; h: number; mime: "image/png" | "image/jpeg" | null };

export type UseGhostInput = {
  /** Everything already occupying cells on the board (canonized + voting + pending). */
  occupiedRects: Rect[];
  /** Already-pending rects (separate so "must touch" works across full set). */
  pendingRects: Rect[];
  /**
   * Flat submission fee (wei) charged per placement. The contract charges a
   * flat fee per propose() call, regardless of cell count — there is no
   * per-cell fee. The ghost label surfaces this so the number the user sees
   * always matches the number the wallet will sign.
   */
  submissionFeeWei: bigint;
};

export type UseGhostReturn = {
  ghost: Ghost | null;
  setGhost: (g: Ghost | null) => void;
  primeGhostMetaFromEvent: (e: React.DragEvent) => Promise<DragMeta | null>;
  refreshGhostAt: (pos: DropPos) => void;
  debouncedRefreshGhost: (pos: DropPos) => void;
  clearGhostMeta: () => void;
};

export function useGhost(input: UseGhostInput): UseGhostReturn {
  const { occupiedRects, pendingRects, submissionFeeWei } = input;
  const [ghost, setGhost] = useState<Ghost | null>(null);
  const ghostMetaRef = useRef<DragMeta | null>(null);
  const debounceRef = useRef<number | null>(null);

  const primeGhostMetaFromEvent = useCallback(
    async (e: React.DragEvent): Promise<DragMeta | null> => {
      if (ghostMetaRef.current) return ghostMetaRef.current;
      const items = e.dataTransfer?.items;
      if (!items?.length) return null;
      let file: File | null = null;
      for (const it of Array.from(items)) {
        if (it.kind === "file") {
          file = it.getAsFile();
          if (file) break;
        }
      }
      if (!file) return null;
      const kind = await sniffImageType(file);
      const mime = kind ? mimeFromType(kind) : null;
      if (!mime) {
        ghostMetaRef.current = { w: TILE, h: TILE, mime: null };
        return ghostMetaRef.current;
      }
      const { w, h } = await getImageSize(file);
      ghostMetaRef.current = { w, h, mime };
      return ghostMetaRef.current;
    },
    []
  );

  const refreshGhostAt = useCallback(
    (pos: DropPos) => {
      const meta = ghostMetaRef.current;
      if (!meta) {
        setGhost(null);
        return;
      }
      if (!meta.mime) {
        setGhost({
          rect: snapRect({ x: pos.x, y: pos.y, w: TILE, h: TILE }),
          cells: 1,
          status: "invalid",
          totalWei: 0n,
        });
        return;
      }
      const rect = snapRect({ x: pos.x, y: pos.y, w: meta.w, h: meta.h });
      const cells = rectCells(rect);
      let status: GhostStatus = "ok";
      if (cells > MAX_CELLS_PER_RECT) {
        status = "oversize";
      } else if (
        hasOverlap(rect, occupiedRects) ||
        hasOverlap(rect, pendingRects)
      ) {
        status = "overlap";
      } else if (!isTouching(rect, [...occupiedRects, ...pendingRects])) {
        status = "not-touching";
      }
      setGhost({
        rect,
        cells,
        // Flat fee per placement — see note on UseGhostInput.submissionFeeWei.
        status,
        totalWei: submissionFeeWei,
      });
    },
    [occupiedRects, pendingRects, submissionFeeWei]
  );

  const debouncedRefreshGhost = useCallback(
    (pos: DropPos) => {
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current);
      }
      debounceRef.current = window.setTimeout(() => {
        refreshGhostAt(pos);
        debounceRef.current = null;
      }, 16); // ~60fps
    },
    [refreshGhostAt]
  );

  const clearGhostMeta = useCallback(() => {
    ghostMetaRef.current = null;
  }, []);

  return {
    ghost,
    setGhost,
    primeGhostMetaFromEvent,
    refreshGhostAt,
    debouncedRefreshGhost,
    clearGhostMeta,
  };
}
