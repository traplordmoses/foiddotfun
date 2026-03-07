/**
 * Convert any browser-readable image (HEIC, WebP, GIF, BMP, etc.)
 * to JPEG via canvas. Works on mobile Safari, Chrome, Firefox.
 */
export async function convertToJpeg(file: File, quality = 0.92): Promise<File> {
  // Already JPEG — skip conversion
  if (file.type === "image/jpeg") return file;

  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  // White background (for transparent PNGs)
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Conversion failed"))),
      "image/jpeg",
      quality,
    );
  });

  const name = file.name.replace(/\.[^.]+$/, ".jpg");
  return new File([blob], name, { type: "image/jpeg" });
}
