import "./globals.css";
import { ReactNode } from "react";
import { Providers } from "@/providers";
import Nav from "@/components/Nav";
import { ConnectBar } from "@/components/ConnectBar";
import AnimatedBackground from "@/components/AnimatedBackground";
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

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className="h-full">
      <head>
        <link rel="manifest" href="/site.webmanifest" />
        <meta name="theme-color" content="#0e0f2b" />
      </head>
      <body className="relative h-full min-h-screen bg-black">
        <AnimatedBackground />
        <div className="scene-tint" />
        <Providers>
          <SfxInitializer />
          <FairyDustCursor />
          <div className="relative z-10 pt-[env(safe-area-inset-top)]">
            <Nav />
            <div className="mx-auto max-w-7xl px-4">
              <ConnectBar />
              {children}
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
