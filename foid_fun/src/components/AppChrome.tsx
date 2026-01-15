"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import Nav from "@/components/Nav";
import { ConnectBar } from "@/components/ConnectBar";

export default function AppChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isLanding = pathname === "/";

  if (isLanding) return <>{children}</>;

  return (
    <div className="relative z-10 pt-[env(safe-area-inset-top)]">
      <Nav />
      <div className="mx-auto max-w-7xl px-4">
        <ConnectBar />
        {children}
      </div>
    </div>
  );
}
