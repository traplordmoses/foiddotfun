// /lib/image.ts

export type ImageType = "png" | "jpg";

/**
 * Read the first N bytes of a Blob/ArrayBuffer/Uint8Array.
 */
async function readHead(
  src: Blob | ArrayBuffer | Uint8Array,
  n: number
): Promise<Uint8Array> {
  try {
    if (src instanceof Blob) {
      const buf = await src.slice(0, n).arrayBuffer();
      return new Uint8Array(buf);
    }
    if (src instanceof ArrayBuffer) {
      return new Uint8Array(src.slice(0, n));
    }
    // Uint8Array
    return src.subarray(0, n);
  } catch {
    return new Uint8Array(0);
  }
}

/**
 * Magic-byte checks:
 * - PNG:  89 50 4E 47 0D 0A 1A 0A
 * - JPEG: FF D8 FF (then marker, e.g., E0/E1/DB/etc.)
 */
export async function sniffImageType(
  src: Blob | ArrayBuffer | Uint8Array
): Promise<ImageType | null> {
  const bytes = await readHead(src, 12);
  if (bytes.length < 3) return null;

  // PNG
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "png";
  }

  // JPEG (SOI + marker)
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "jpg";
  }

  return null;
}

/** Convenience helpers */
export function mimeFromType(t: ImageType): "image/png" | "image/jpeg" {
  return t === "png" ? "image/png" : "image/jpeg";
}

export async function isSupportedImage(
  src: Blob | ArrayBuffer | Uint8Array
): Promise<boolean> {
  return (await sniffImageType(src)) !== null;
}
