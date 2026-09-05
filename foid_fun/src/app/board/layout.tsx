import type { ReactNode } from "react";
import { routeMetadata } from "@/lib/routeMetadata";

export const metadata = routeMetadata({
  title: "Loreboard",
  description:
    "The permanent community canvas. Propose an image for 0.001 ETH, the community votes for 72 hours, winners are placed onchain forever.",
  path: "/board",
  card: "board",
});

// Prevent static generation — WalletConnect needs browser APIs (indexedDB)
export const dynamic = "force-dynamic";

export default function BoardLayout({ children }: { children: ReactNode }) {
  return children;
}
