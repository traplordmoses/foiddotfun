import "./globals.css";
import type { ReactNode } from "react";
import { IBM_Plex_Sans, JetBrains_Mono, Sora } from "next/font/google";
import { Providers } from "@/providers";
import AnimatedBackground from "@/components/AnimatedBackground";
import FloatingElements from "@/components/FloatingElements";
import SfxInitializer from "@/components/SfxInitializer";
import SoundToggle from "@/components/SoundToggle";
import { ClientLayout } from "@/components/ClientLayout";

// app/layout.tsx (or wherever your metadata lives)
export const metadata = {
  title: "FOID.FUN",
  description: "Pray with Foid Mommy daily, on Foid.Fun",
  icons: {
    icon: [
      { url: "/favicon.ico" },                                  // multi-size .ico
      { url: "/favicon-32.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon-16.png", type: "image/png", sizes: "16x16" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }], // rename favicon-180.png → apple-touch-icon.png
    shortcut: "/favicon.ico",
  },
  manifest: "/site.webmanifest", // optional, if you use a PWA manifest
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

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`h-full overflow-hidden ${displayFont.variable} ${bodyFont.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        <link rel="manifest" href="/site.webmanifest" />
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
        <SoundToggle />
        <ClientLayout />
        {children}
      </div>
    </Providers>
  </body>
</html>
  );
}
