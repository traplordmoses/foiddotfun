import { TILE, type Rect } from "@/lib/grid";

const WORLD_RADIUS_TILES = 1024; // ±1024 tiles from genesis (65536×65536 world)
const WORLD_RADIUS = WORLD_RADIUS_TILES * TILE;

export const VIRTUAL_CANVAS_W = WORLD_RADIUS * 2;
export const VIRTUAL_CANVAS_H = WORLD_RADIUS * 2;

// Frozen at the original 128-tile offset (4096) — existing placements were
// stored on-chain with `contractX = worldX + 4096`. Deriving this from the
// expanded WORLD_RADIUS would shift every existing placement by ~28k px.
// See commit 6861059 for the world-radius expansion that broke this.
const LEGACY_OFFSET = 128 * TILE;
export const BOARD_OFFSET_X = LEGACY_OFFSET;
export const BOARD_OFFSET_Y = LEGACY_OFFSET;

export const WORLD_MIN_X = -WORLD_RADIUS;
export const WORLD_MIN_Y = -WORLD_RADIUS;
export const WORLD_MAX_X = WORLD_RADIUS;
export const WORLD_MAX_Y = WORLD_RADIUS;

export function worldToContractRect(r: Rect): Rect {
  return {
    x: r.x + BOARD_OFFSET_X,
    y: r.y + BOARD_OFFSET_Y,
    w: r.w,
    h: r.h,
  };
}

export function contractToWorldRect(r: Rect): Rect {
  return {
    x: r.x - BOARD_OFFSET_X,
    y: r.y - BOARD_OFFSET_Y,
    w: r.w,
    h: r.h,
  };
}

export function clampWorldRect(r: Rect): Rect {
  const w = Math.max(TILE, Math.min(r.w, VIRTUAL_CANVAS_W));
  const h = Math.max(TILE, Math.min(r.h, VIRTUAL_CANVAS_H));

  const minX = WORLD_MIN_X;
  const minY = WORLD_MIN_Y;
  const maxX = WORLD_MAX_X;
  const maxY = WORLD_MAX_Y;

  const maxLeft = maxX - w;
  const maxTop = maxY - h;

  const x = Math.max(minX, Math.min(r.x, maxLeft));
  const y = Math.max(minY, Math.min(r.y, maxTop));

  return { x, y, w, h };
}
