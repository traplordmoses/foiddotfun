import { TILE, type Rect } from "@/lib/grid";
import { snapDown } from "@/lib/boardCoordinates";

// ============================================================================
// CONSTANTS
// ============================================================================

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const MAX_DIMENSION = 4096; // Max width or height in pixels
export const MAX_CELLS_PER_RECT = Number(
  process.env.NEXT_PUBLIC_MAX_CELLS_PER_RECT ?? process.env.MAX_CELLS_PER_RECT ?? "400"
);

// ============================================================================
// IMAGE SIZE DETECTION
// ============================================================================

/**
 * Get image dimensions from a File
 * Uses createImageBitmap if available (faster), falls back to Image element
 *
 * @param file - Image file to measure
 * @returns Promise resolving to { w: width, h: height }
 */
export async function getImageSize(file: File): Promise<{ w: number; h: number }> {
  // Try createImageBitmap first (faster, modern browsers)
  try {
    const createBitmap =
      typeof createImageBitmap === "function" ? createImageBitmap : null;
    const bmp = createBitmap ? await createBitmap(file) : null;
    if (bmp) {
      const w = bmp.width;
      const h = bmp.height;
      bmp.close?.();
      return { w, h };
    }
  } catch {
    // Fall through to Image element fallback
  }

  // Fallback: Use Image element
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    return { w: img.naturalWidth, h: img.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ============================================================================
// IMAGE VALIDATION
// ============================================================================

export type ImageValidationError =
  | "file-too-large"
  | "dimension-too-large"
  | "invalid-dimensions"
  | "unsupported-type";

/**
 * Validate an image file before processing
 *
 * @param file - File to validate
 * @param maxFileSize - Maximum file size in bytes (default: MAX_FILE_SIZE)
 * @param maxDimension - Maximum width/height in pixels (default: MAX_DIMENSION)
 * @returns null if valid, or error type string if invalid
 */
export async function validateImageFile(
  file: File,
  maxFileSize = MAX_FILE_SIZE,
  maxDimension = MAX_DIMENSION
): Promise<ImageValidationError | null> {
  // Check file size
  if (file.size > maxFileSize) {
    return "file-too-large";
  }

  // Check image type (browser validation)
  if (!file.type.startsWith("image/")) {
    return "unsupported-type";
  }

  // Check dimensions
  try {
    const { w, h } = await getImageSize(file);

    if (w <= 0 || h <= 0) {
      return "invalid-dimensions";
    }

    if (w > maxDimension || h > maxDimension) {
      return "dimension-too-large";
    }

    return null; // Valid!
  } catch {
    return "invalid-dimensions";
  }
}

// ============================================================================
// RECT MANIPULATION
// ============================================================================

/**
 * Cap a rect to maximum number of cells
 * Maintains aspect ratio while reducing to fit maxCells
 *
 * @param r - Input rect
 * @param maxCells - Maximum number of cells allowed
 * @returns Rect capped to maxCells (or smaller)
 */
export function capRectToMaxCells(r: Rect, maxCells: number): Rect {
  let w = snapDown(r.w);
  let h = snapDown(r.h);
  const cells = Math.max(1, Math.floor((w / TILE) * (h / TILE)));

  if (cells <= maxCells) {
    return { ...r, w, h };
  }

  // Scale down to fit maxCells
  const scale = Math.sqrt(maxCells / cells);
  w = snapDown(w * scale);
  h = snapDown(h * scale);

  // Ensure minimum tile size
  if (w < TILE) w = TILE;
  if (h < TILE) h = TILE;

  // Iteratively reduce if still too large
  while (Math.floor((w / TILE) * (h / TILE)) > maxCells) {
    if (w >= h) {
      w = snapDown(w - TILE);
    } else {
      h = snapDown(h - TILE);
    }
    if (w < TILE) w = TILE;
    if (h < TILE) h = TILE;
  }

  return { ...r, w, h };
}

// ============================================================================
// IMAGE DOWNSCALING
// ============================================================================

/**
 * Downscale an image file to fit within maxCells
 * Uses canvas to resize and re-encode as JPEG
 *
 * @param file - Original image file
 * @param maxCells - Maximum number of cells allowed
 * @param tileSize - Size of one tile in pixels (default: TILE)
 * @returns Promise resolving to downscaled File
 */
export async function downscaleToMaxCells(
  file: File,
  maxCells: number,
  tileSize = TILE
): Promise<File> {
  const url = URL.createObjectURL(file);

  // Load image
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = url;
  });

  try {
    const { naturalWidth: w0, naturalHeight: h0 } = img;
    const maxPx = maxCells * tileSize * tileSize;

    // No downscaling needed
    if (w0 * h0 <= maxPx) {
      return file;
    }

    // Calculate new dimensions
    const scale = Math.sqrt(maxPx / (w0 * h0));
    const w1 = Math.max(tileSize, Math.floor(w0 * scale));
    const h1 = Math.max(tileSize, Math.floor(h0 * scale));

    // Create canvas and draw resized image
    const canvas = document.createElement("canvas");
    canvas.width = w1;
    canvas.height = h1;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, w1, h1);

    // Convert to blob
    const blob: Blob = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b || new Blob()), "image/jpeg", 0.9)
    );

    // Return as File
    return new File(
      [blob],
      file.name.replace(/\.(png|jpg|jpeg)$/i, ".resized.jpg"),
      { type: "image/jpeg" }
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
