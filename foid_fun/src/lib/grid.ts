// /lib/grid.ts

export const TILE = 32 as const;

export type Rect = {
  x: number; // top-left X in pixels
  y: number; // top-left Y in pixels
  w: number; // width in pixels
  h: number; // height in pixels
};

/** Snap a single number down to the TILE grid (floor). */
export function snap(n: number): number {
  return Math.floor(n / TILE) * TILE;
}

/**
 * Snap a rect to the grid:
 * - x,y snap DOWN to the grid
 * - w,h snap UP to the next whole cell so pricing/coverage is consistent
 * - min size is 1 cell
 */
export function snapRect(r: Rect): Rect {
  const x = snap(r.x);
  const y = snap(r.y);
  const wCells = Math.max(1, Math.ceil(r.w / TILE));
  const hCells = Math.max(1, Math.ceil(r.h / TILE));
  return { x, y, w: wCells * TILE, h: hCells * TILE };
}

/** Number of grid cells a rect occupies (ceil on each axis). */
export function rectCells(r: Rect): number {
  const wCells = Math.max(1, Math.ceil(r.w / TILE));
  const hCells = Math.max(1, Math.ceil(r.h / TILE));
  return wCells * hCells;
}

/**
 * True if two rects overlap by area.
 * Touching edges/corners are allowed (NOT considered overlap).
 */
export function overlap(a: Rect, b: Rect): boolean {
  return !(
    a.x + a.w <= b.x || // a is completely left of b
    b.x + b.w <= a.x || // b is completely left of a
    a.y + a.h <= b.y || // a is completely above b
    b.y + b.h <= a.y    // b is completely above a
  );
}

/** Check a candidate against a list of rects. */
export function hasOverlap(candidate: Rect, rects: readonly Rect[]): boolean {
  return rects.some(r => overlap(candidate, r));
}

/** Optional: a handy “cells space” view if you need it later. */
export type CellsRect = { cx: number; cy: number; cw: number; ch: number };
export function toCellsRect(r: Rect): CellsRect {
  return {
    cx: Math.floor(r.x / TILE),
    cy: Math.floor(r.y / TILE),
    cw: Math.max(1, Math.ceil(r.w / TILE)),
    ch: Math.max(1, Math.ceil(r.h / TILE)),
  };
}
