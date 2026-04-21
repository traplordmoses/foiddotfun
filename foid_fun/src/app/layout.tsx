import "./tokens.css";
import "./globals.css";
import type { ReactNode } from "react";
import { Fraunces, IBM_Plex_Sans, JetBrains_Mono, Sora } from "next/font/google";
import { Providers } from "@/providers";
import AnimatedBackground from "@/components/AnimatedBackground";
import FloatingElements from "@/components/FloatingElements";
import SfxInitializer from "@/components/SfxInitializer";
import { ClientLayout } from "@/components/ClientLayout";
import { WebVitalsReporter } from "@/app/_vitals";

// app/layout.tsx (or wherever your metadata lives)
export const metadata = {
  title: {
    default: "FOID.FUN",
    template: "%s | FOID.FUN",
  },
  description:
    "Loreboard — a shared, permanent, on-chain cultural canvas. Propose, vote, and build with the community on Foid.Fun",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-32.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon-16.png", type: "image/png", sizes: "16x16" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
    shortcut: "/favicon.ico",
  },
  manifest: "/manifest.json",
  openGraph: {
    title: "FOID.FUN — Loreboard",
    description:
      "A shared, permanent, on-chain cultural canvas governed by the community. Propose images, vote via swipe, and build culture together.",
    url: "https://www.foid.fun",
    siteName: "FOID Foundation",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "FOID.FUN — Loreboard",
    description:
      "On-chain cultural canvas. Propose, vote, build — governed by the community.",
  },
};

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-terminal",
  fallback: ["ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas"],
});

const displayFont = Sora({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
  weight: ["500", "600", "700"],
});

const bodyFont = IBM_Plex_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-body",
  weight: ["400", "500", "600"],
});

const serifFont = Fraunces({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-serif",
  weight: ["400", "500"],
  style: ["normal", "italic"],
});

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`h-full overflow-hidden ${displayFont.variable} ${bodyFont.variable} ${jetbrainsMono.variable} ${serifFont.variable}`}
    >
      <head>
        <link rel="manifest" href="/manifest.json" />
        {/* Preconnect hints for IPFS gateways — the /board route loads
            placement images directly from whichever gateway is currently
            fastest (see src/lib/ipfsGatewayCache.ts). Preconnect opens
            TLS + DNS ahead of the first request so the hero image on
            the initial board render doesn't wait on handshake. */}
        <link rel="preconnect" href="https://gateway.pinata.cloud" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://ipfs.io" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://dweb.link" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://w3s.link" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://4everland.io" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://gateway.pinata.cloud" />
        <link rel="dns-prefetch" href="https://ipfs.io" />
        <link rel="dns-prefetch" href="https://dweb.link" />
        <link rel="dns-prefetch" href="https://w3s.link" />
        <link rel="dns-prefetch" href="https://4everland.io" />
        <meta name="theme-color" content="#0e0f2b" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
  <body className="relative h-full min-h-screen overflow-hidden font-secondary" suppressHydrationWarning>
    <AnimatedBackground />
    <FloatingElements />
    <div className="scene-tint" />
    <Providers>
      <div className="app-viewport">
        <SfxInitializer />
        <ClientLayout />
        <WebVitalsReporter />
        {children}
      </div>
    </Providers>
  </body>
</html>
  );
}
