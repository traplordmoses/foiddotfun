import type { ReactNode } from "react";

export const metadata = { title: "LOREBOARD" };

// Prevent static generation — WalletConnect needs browser APIs (indexedDB)
export const dynamic = "force-dynamic";

export default function BoardLayout({ children }: { children: ReactNode }) {
  return children;
}
