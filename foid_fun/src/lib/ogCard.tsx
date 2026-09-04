// src/lib/ogCard.tsx
// Shared 1200x630 share card for the site and each app route. Palette and
// wordmark mirror tokens.css so a link to any FOID page reads as FOID in an
// X, Farcaster, iMessage or Telegram preview. Satori rules apply: every
// <div> declares display flex, no CSS variables, no external images.
import { ImageResponse } from "next/og";
import { loadOgFonts } from "@/lib/ogFont";

export const OG_SIZE = { width: 1200, height: 630 } as const;

export type OgCardInput = {
  /** Small mono line above the title, e.g. "FOID_MOMMY_TERMINAL.EXE". */
  kicker: string;
  title: string;
  subtitle: string;
  /** Accent hue for the ring + kicker. */
  accent?: string;
};

export async function ogCard({
  kicker,
  title,
  subtitle,
  accent = "#74ffeb",
}: OgCardInput): Promise<ImageResponse> {
  const fonts = await loadOgFonts();
  const family = fonts ? "Inter" : "sans-serif";

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: OG_SIZE.width,
          height: OG_SIZE.height,
          background:
            "linear-gradient(135deg, #061a3a 0%, #0e2b5c 45%, #180a38 100%)",
          color: "#ffffff",
          fontFamily: family,
          position: "relative",
        }}
      >
        {/* sea glow */}
        <div
          style={{
            display: "flex",
            position: "absolute",
            left: -120,
            top: -160,
            width: 620,
            height: 620,
            borderRadius: 9999,
            background: "rgba(96, 196, 255, 0.28)",
            filter: "blur(80px)",
          }}
        />
        <div
          style={{
            display: "flex",
            position: "absolute",
            right: -80,
            bottom: -200,
            width: 560,
            height: 560,
            borderRadius: 9999,
            background: "rgba(244, 114, 182, 0.22)",
            filter: "blur(90px)",
          }}
        />
        {/* sigil ring */}
        <div
          style={{
            display: "flex",
            position: "absolute",
            right: 96,
            top: 150,
            width: 300,
            height: 300,
            borderRadius: 9999,
            border: `6px solid ${accent}`,
            boxShadow: `0 0 60px ${accent}55`,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              width: 210,
              height: 210,
              borderRadius: 9999,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.25)",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 96,
              fontWeight: 700,
              letterSpacing: -4,
            }}
          >
            F
          </div>
        </div>
        {/* copy */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "0 88px",
            width: 760,
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 22,
              letterSpacing: 6,
              color: accent,
              textTransform: "uppercase",
            }}
          >
            {kicker}
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 22,
              fontSize: 76,
              fontWeight: 700,
              lineHeight: 1.02,
              letterSpacing: -2,
            }}
          >
            {title}
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 26,
              fontSize: 28,
              lineHeight: 1.35,
              color: "rgba(255,255,255,0.78)",
            }}
          >
            {subtitle}
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 44,
              fontSize: 22,
              letterSpacing: 4,
              color: "rgba(255,255,255,0.55)",
            }}
          >
            FOID.FUN · FLUENT L2
          </div>
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      fonts: fonts
        ? [
            { name: "Inter", data: fonts.regular, weight: 400, style: "normal" },
            { name: "Inter", data: fonts.bold, weight: 700, style: "normal" },
          ]
        : undefined,
    },
  );
}
