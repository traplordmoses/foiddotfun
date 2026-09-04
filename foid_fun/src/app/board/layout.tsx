import type { ReactNode } from "react";

export const metadata = {
  title: "Loreboard",
  description:
    "The permanent community canvas. Propose an image for 0.001 ETH, the community votes for 72 hours, winners are placed onchain forever.",
};

// Prevent static generation — WalletConnect needs browser APIs (indexedDB)
export const dynamic = "force-dynamic";

export default function BoardLayout({ children }: { children: ReactNode }) {
  return children;
}
