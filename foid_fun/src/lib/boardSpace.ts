import { TILE, type Rect } from "@/lib/grid";

const WORLD_RADIUS_TILES = 128; // ±128 tiles from genesis
const WORLD_RADIUS = WORLD_RADIUS_TILES * TILE;

export const VIRTUAL_CANVAS_W = WORLD_RADIUS * 2;
export const VIRTUAL_CANVAS_H = WORLD_RADIUS * 2;

export const BOARD_OFFSET_X = VIRTUAL_CANVAS_W / 2;
export const BOARD_OFFSET_Y = VIRTUAL_CANVAS_H / 2;

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
  let w = Math.max(TILE, Math.min(r.w, VIRTUAL_CANVAS_W));
  let h = Math.max(TILE, Math.min(r.h, VIRTUAL_CANVAS_H));

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
