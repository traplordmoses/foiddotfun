// src/hooks/board/useVisiblePlacements.ts
// Spatial-index-backed viewport virtualization for the loreboard.
//
// Why not just `Array.filter`?
//   The existing `visiblePlaced = useMemo(() => placed.filter(...))` pattern
//   in page.tsx is O(n) per viewport update. At mainnet scale (5k+ placed
//   items) the linear scan dominates every pan tick — even though the
//   *result set* is small (a dozen visible items at normal zoom). A grid
//   bucket collapses queries to O(k) where k = buckets touched by the
//   viewport, usually 4–16.
//
// Why grid bucketing vs. rbush / quadtree?
//   Simpler. No deps. Placements don't move once canonized, so rebuild cost
//   is amortized across many queries. The board world is ~20k world units
//   square; a 256px grid gives 80×80 = 6400 buckets — plenty of headroom.
//   If measurements ever say rbush beats this (unlikely below 50k items),
//   the hook signature stays the same.
//
// Rect convention: (x, y, w, h) in WORLD coordinates (matches `Rect` from
// src/lib/grid.ts). Viewport is also world-space — callers (page.tsx)
// already convert from screen via subscribeViewport.
"use client";

import { useMemo } from "react";
import type { Rect } from "@/lib/grid";

/**
 * Minimum footprint a placement must have to participate in indexing.
 * Anything with `rect` exists in the index under its bucket set.
 */
export type HasRect = { readonly rect: Rect };

/**
 * Accessor that returns the AABB of an item in world coordinates. Allows
 * the hook to virtualize shapes like `SwipeVotingProposal` that carry
 * `x/y/w/h` directly instead of under a `.rect` field.
 */
export type RectAccessor<T> = (item: T) => Rect;

const defaultAccessor = <T extends HasRect>(item: T): Rect => item.rect;

/**
 * World-unit size of one grid bucket. Tuned for typical placements (10–80
 * world units wide); larger buckets reduce query cost but bloat the
 * per-query result set. 256 was chosen empirically: a typical placement
 * spans 1–2 buckets, and the typical viewport spans 4–16 buckets.
 */
const BUCKET_SIZE = 256;

/** Pre-built spatial index. Immutable after construction. */
export type PlacementIndex<T> = {
  readonly buckets: Map<string, T[]>;
  readonly items: readonly T[];
  readonly getRect: RectAccessor<T>;
};

function bucketKey(bx: number, by: number): string {
  return `${bx}|${by}`;
}

function rectToBucketRange(rect: Rect): {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
} {
  return {
    x0: Math.floor(rect.x / BUCKET_SIZE),
    y0: Math.floor(rect.y / BUCKET_SIZE),
    x1: Math.floor((rect.x + rect.w) / BUCKET_SIZE),
    y1: Math.floor((rect.y + rect.h) / BUCKET_SIZE),
  };
}

export function buildIndex<T>(
  items: readonly T[],
  getRect: RectAccessor<T> = defaultAccessor as RectAccessor<T>,
): PlacementIndex<T> {
  const buckets = new Map<string, T[]>();
  for (const item of items) {
    const { x0, y0, x1, y1 } = rectToBucketRange(getRect(item));
    for (let bx = x0; bx <= x1; bx++) {
      for (let by = y0; by <= y1; by++) {
        const key = bucketKey(bx, by);
        let list = buckets.get(key);
        if (!list) {
          list = [];
          buckets.set(key, list);
        }
        list.push(item);
      }
    }
  }
  return { buckets, items, getRect };
}

export type VisibleRect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

/**
 * Query the index for items whose rects intersect `viewport` (with
 * `margin` world-unit padding in every direction). Returns a deduped
 * array preserving the insertion order of the underlying items.
 */
export function queryIndex<T>(
  index: PlacementIndex<T>,
  viewport: VisibleRect,
  margin: number = 200,
): T[] {
  // Inflate viewport by margin to pre-load items just off-screen.
  const inflated: Rect = {
    x: viewport.x - margin,
    y: viewport.y - margin,
    w: viewport.w + margin * 2,
    h: viewport.h + margin * 2,
  };
  const { x0, y0, x1, y1 } = rectToBucketRange(inflated);
  const seen = new Set<T>();
  const result: T[] = [];
  for (let bx = x0; bx <= x1; bx++) {
    for (let by = y0; by <= y1; by++) {
      const bucket = index.buckets.get(bucketKey(bx, by));
      if (!bucket) continue;
      for (const item of bucket) {
        if (seen.has(item)) continue;
        // Final AABB test — the bucket can contain items whose rect
        // overlaps the bucket but not the (inflated) viewport.
        const r = index.getRect(item);
        if (
          r.x < inflated.x + inflated.w &&
          r.x + r.w > inflated.x &&
          r.y < inflated.y + inflated.h &&
          r.y + r.h > inflated.y
        ) {
          seen.add(item);
          result.push(item);
        }
      }
    }
  }
  return result;
}

/**
 * React hook wrapping buildIndex + queryIndex with stable memoization.
 *
 * - Rebuilds the index only when `items` identity changes. Callers should
 *   pass the canonical reference from state; if you `items.filter(...)`
 *   inline you'll pay the rebuild on every render.
 * - Queries whenever the viewport changes. The hook returns `items`
 *   verbatim when `viewport` is null (initial-paint safety net — we'd
 *   rather render everything once than render nothing and SEO a blank).
 */
export function useVisiblePlacements<T extends HasRect>(
  items: readonly T[],
  viewport: VisibleRect | null,
  margin?: number,
): T[];
export function useVisiblePlacements<T>(
  items: readonly T[],
  viewport: VisibleRect | null,
  margin: number | undefined,
  getRect: RectAccessor<T>,
): T[];
export function useVisiblePlacements<T>(
  items: readonly T[],
  viewport: VisibleRect | null,
  margin: number = 200,
  getRect?: RectAccessor<T>,
): T[] {
  const accessor = getRect ?? (defaultAccessor as RectAccessor<T>);
  const index = useMemo(() => buildIndex(items, accessor), [items, accessor]);
  return useMemo(() => {
    if (!viewport) return [...items];
    return queryIndex(index, viewport, margin);
  }, [index, items, viewport, margin]);
}

// Exports for tests — public API of the hook is `useVisiblePlacements`;
// the pure functions are kept exported so unit tests can exercise the
// index without rendering React.
