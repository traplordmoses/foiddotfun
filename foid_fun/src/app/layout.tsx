import "./globals.css";
import { ReactNode } from "react";
import { Providers } from "@/providers";
import Nav from "@/components/Nav";
import { ConnectBar } from "@/components/ConnectBar";
import AnimatedBackground from "@/components/AnimatedBackground";

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
          <div className="pt-[env(safe-area-inset-top)]">
            <Nav />
            <div className="mx-auto max-w-6xl px-4">
              <ConnectBar />
              {children}
              <footer className="mt-12 pb-12">
                <div className="foid-glass rounded-3xl px-6 py-6 text-center">
                  <a
                    href="https://x.com/foidfun"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-foid inline-flex items-center gap-2 text-sm uppercase tracking-[0.32em]"
                  >
                    X / @foidfun -&gt;
                  </a>
                </div>
              </footer>
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
