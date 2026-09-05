import type { ReactNode } from "react";
import { routeMetadata } from "@/lib/routeMetadata";

const MINIAPP_EMBED = JSON.stringify({
  version: "1",
  imageUrl: "https://foid.fun/api/og/card/pray",
  button: {
    title: "pray with foid mommy",
    action: {
      type: "launch_miniapp",
      name: "FOID",
      url: "https://foid.fun/pray?miniapp=1",
      splashImageUrl: "https://foid.fun/icons/192.png",
      splashBackgroundColor: "#0e0f2b",
    },
  },
});

export const metadata = routeMetadata({
  title: "Pray with Foid Mommy",
  description:
    "A daily onchain ritual. Tell Foid Mommy how you feel, keep your streak, and earn up to 5x voting power on the Loreboard.",
  path: "/pray",
  card: "pray",
  // Farcaster / Base App rich embed (audit G3): a cast linking /pray renders
  // a launch button instead of a plain link.
  other: { "fc:miniapp": MINIAPP_EMBED },
});

export default function PrayLayout({ children }: { children: ReactNode }) {
  return children;
}
