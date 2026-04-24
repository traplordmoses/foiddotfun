import { TILE, type Rect } from "@/lib/grid";
import {
  VIRTUAL_CANVAS_W,
  VIRTUAL_CANVAS_H,
  worldToContractRect,
  clampWorldRect,
  WORLD_MAX_X,
  WORLD_MAX_Y,
} from "@/lib/boardSpace";

// ============================================================================
// CONSTANTS
// ============================================================================

export const GRID_MULTIPLIER = 1;
export const STAGE_CANVAS_W = VIRTUAL_CANVAS_W * GRID_MULTIPLIER;
export const STAGE_CANVAS_H = VIRTUAL_CANVAS_H * GRID_MULTIPLIER;
export const STAGE_PAD_X = (STAGE_CANVAS_W - VIRTUAL_CANVAS_W) / 2;
export const STAGE_PAD_Y = (STAGE_CANVAS_H - VIRTUAL_CANVAS_H) / 2;
export const GRID_RADIUS_X = Math.floor(WORLD_MAX_X / TILE);
export const GRID_RADIUS_Y = Math.floor(WORLD_MAX_Y / TILE);

// Zoom limits - extended for infinite feel
export const MIN_SCALE = 0.02;
export const MAX_SCALE = 50;

// ============================================================================
// COORDINATE TRANSFORMATIONS
// ============================================================================

/**
 * Convert world coordinates to stage coordinates (with padding)
 *
 * @param rect - World coordinate rect
 * @returns Stage coordinate rect (with padding applied)
 */
export function toStageRect(rect: Rect): Rect {
  const boardRect = worldToContractRect(rect);
  return {
    x: boardRect.x + STAGE_PAD_X,
    y: boardRect.y + STAGE_PAD_Y,
    w: boardRect.w,
    h: boardRect.h,
  };
}

/**
 * Snap a value down to the nearest TILE multiple (floor)
 * Ensures minimum of 1 TILE
 *
 * @param v - Value to snap
 * @returns Snapped value (minimum TILE)
 */
export function snapDown(v: number): number {
  return Math.max(TILE, Math.floor(v / TILE) * TILE);
}

/**
 * Clamp a rect to the canvas bounds
 * Uses world coordinate clamping from boardSpace
 *
 * @param rect - Rect to clamp
 * @returns Clamped rect within canvas bounds
 */
export function clampToCanvas(rect: Rect): Rect {
  return clampWorldRect(rect);
}

/**
 * Calculate bounds rect from a list of rects
 * Useful for zooming to fit multiple placements
 *
 * @param rects - Array of rects to calculate bounds for
 * @returns Bounding rect containing all input rects, or null if empty
 */
export function getBoundsFromRects(rects: Rect[]): Rect | null {
  if (!rects.length) return null;

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const rect of rects) {
    minX = Math.min(minX, rect.x);
    minY = Math.min(minY, rect.y);
    maxX = Math.max(maxX, rect.x + rect.w);
    maxY = Math.max(maxY, rect.y + rect.h);
  }

  return {
    x: minX,
    y: minY,
    w: Math.max(0, maxX - minX),
    h: Math.max(0, maxY - minY),
  };
}
