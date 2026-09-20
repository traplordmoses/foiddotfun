import sharp from "sharp";

// One decoder at a time; no extra libvips cache alongside the proxy's byte LRU.
sharp.cache(false);
sharp.concurrency(1);
let tail: Promise<void> = Promise.resolve();
let queued = 0;

export async function imageThumbnail(bytes: Uint8Array, width: number | undefined, height: number | undefined) {
  if (queued >= 8) throw new Error("Thumbnail queue full");
  queued++;
  const previous = tail;
  let release!: () => void;
  tail = new Promise<void>((resolve) => { release = resolve; });
  await previous;
  try {
    const output = await sharp(bytes, { limitInputPixels: 16_000_000, sequentialRead: true, failOn: "warning" })
      .rotate()
      .resize({ width: width ?? 1280, height: height ?? 1280, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80, effort: 2 })
      .timeout({ seconds: 5 })
      .toBuffer();
    return { bytes: new Uint8Array(output), contentType: "image/webp" };
  } finally {
    queued--;
    release();
  }
}
