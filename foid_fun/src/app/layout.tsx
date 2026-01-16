import "./globals.css";
import type { ReactNode } from "react";
import { JetBrains_Mono } from "next/font/google";
import { Providers } from "@/providers";
import AnimatedBackground from "@/components/AnimatedBackground";
import FloatingElements from "@/components/FloatingElements";
import SfxInitializer from "@/components/SfxInitializer";
import FairyDustCursor from "@/components/FairyDustCursor";

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

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className="h-full">
      <head>
        <link rel="manifest" href="/site.webmanifest" />
        <meta name="theme-color" content="#0e0f2b" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className={`relative h-full min-h-screen font-secondary ${jetbrainsMono.variable}`}>
        <AnimatedBackground />
        <FloatingElements />
        <div className="scene-tint" />
        <Providers>
          <SfxInitializer />
          <FairyDustCursor />
          {children}
        </Providers>
      </body>
    </html>
  );
}
