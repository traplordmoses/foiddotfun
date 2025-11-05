import "./globals.css";
import { ReactNode } from "react";
import { Providers } from "@/providers";
import Nav from "@/components/Nav";
import { ConnectBar } from "@/components/ConnectBar";
import AnimatedBackground from "@/components/AnimatedBackground";
import SfxInitializer from "@/components/SfxInitializer";
import MusicPanel from "@/components/MusicPanel";
import FairyDustCursor from "@/components/FairyDustCursor";

export const metadata = {
  title: "wFOID Control Panel",
  description: "Interact with wFOID, Bridge, and Registry on Fluent Testnet",
  icons: {
    icon: "/icon.svg",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="relative">
        {/* ambient moving background */}
        <AnimatedBackground />
        {/* tint overlay (tweak opacity as you like) */}
        <div className="scene-tint" />
        {/* app */}
        <Providers>
          <SfxInitializer />
          <FairyDustCursor />
          <div className="pt-[env(safe-area-inset-top)]">
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
