import { ogCard, OG_SIZE } from "@/lib/ogCard";

export const runtime = "nodejs";
export const revalidate = 86400;
export const alt = "About FOID";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return ogCard({
    kicker: "ABOUT.EXE",
    title: "how foid works",
    subtitle: "prayer, loreboard, vote. the docs, the contracts, the roadmap.",
    accent: "#34d399",
  });
}
