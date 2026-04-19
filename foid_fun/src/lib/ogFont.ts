// /src/lib/ogFont.ts
// Lazy-fetches Inter font weights for the OG card generator and caches the
// result in module scope so we pay the GitHub round-trip once per lambda
// instance. The returned buffers are consumed by `fonts: [...]` on
// ImageResponse.
//
// Fetched from the `rsms/inter` upstream — a CC-BY license, commonly used
// with next/og in the @vercel/og examples. We only need the basic Latin
// subset for the card; the woff2 → unicode fallback handled automatically.

const INTER_REGULAR = "https://cdn.jsdelivr.net/npm/@fontsource/inter@5.0.16/files/inter-latin-400-normal.woff";
const INTER_BOLD = "https://cdn.jsdelivr.net/npm/@fontsource/inter@5.0.16/files/inter-latin-700-normal.woff";

let cached: { regular: ArrayBuffer; bold: ArrayBuffer } | null = null;
let inflight: Promise<{ regular: ArrayBuffer; bold: ArrayBuffer } | null> | null = null;

async function fetchOnce(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url, {
      next: { revalidate: 60 * 60 * 24 * 7 }, // a week is more than enough
    });
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    return null;
  }
}

export async function loadOgFonts(): Promise<{ regular: ArrayBuffer; bold: ArrayBuffer } | null> {
  if (cached) return cached;
  if (inflight) return inflight;
  inflight = (async () => {
    const [regular, bold] = await Promise.all([fetchOnce(INTER_REGULAR), fetchOnce(INTER_BOLD)]);
    if (!regular || !bold) {
      inflight = null;
      return null;
    }
    cached = { regular, bold };
    inflight = null;
    return cached;
  })();
  return inflight;
}
