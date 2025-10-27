import "./globals.css";
import { ReactNode } from "react";
import { Providers } from "@/providers";
import Nav from "@/components/Nav";
import { ConnectBar } from "@/components/ConnectBar";
import AmbientFX from "@/components/AmbientFX";

export const metadata = {
  title: "wFOID Control Panel",
  description: "Interact with wFOID, Bridge, and Registry on Fluent Testnet",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="relative">
        {/* ambient moving background */}
        <AmbientFX />
        {/* tint overlay (tweak opacity as you like) */}
        <div className="fixed inset-0 -z-10 bg-neutral-900/70" />
        {/* app */}
        <Providers>
          <div className="pt-[env(safe-area-inset-top)]">
            <Nav />
            <div className="mx-auto max-w-6xl px-4">
              <ConnectBar />
              {children}
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
