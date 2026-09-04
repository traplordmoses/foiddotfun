import { ogCard, OG_SIZE } from "@/lib/ogCard";

export const runtime = "nodejs";
export const revalidate = 86400;
export const alt = "The FOID Loreboard";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return ogCard({
    kicker: "MIFOID_LOREBOARD.APP",
    title: "the loreboard",
    subtitle: "a permanent canvas the community votes onto, one placement at a time.",
    accent: "#f472b6",
  });
}
