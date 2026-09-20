import { expect, it } from "vitest";
import sharp from "sharp";
import { imageThumbnail } from "@/lib/imageThumbnail";

it("produces a smaller WebP with preserved aspect ratio", async () => {
  const source = await sharp({ create: { width: 1200, height: 600, channels: 3, background: "#4689ab" } }).png().toBuffer();
  const output = await imageThumbnail(source, 256, undefined);
  const metadata = await sharp(output.bytes).metadata();
  expect(metadata).toMatchObject({ format: "webp", width: 256, height: 128 });
  expect(output.bytes.byteLength).toBeLessThan(source.byteLength);
});

it("rejects images beyond the decoder pixel limit and releases the queue", async () => {
  const oversized = await sharp({ create: { width: 4096, height: 4096, channels: 3, background: "#4689ab" } }).png().toBuffer();
  await expect(imageThumbnail(oversized, 128, undefined)).rejects.toThrow(/pixel limit/i);
  const small = await sharp({ create: { width: 32, height: 16, channels: 3, background: "white" } }).png().toBuffer();
  const recovered = await imageThumbnail(small, 128, undefined);
  expect(await sharp(recovered.bytes).metadata()).toMatchObject({ width: 32, height: 16 });
});
