import { ogCard, OG_SIZE } from "@/lib/ogCard";

export const runtime = "nodejs";
export const revalidate = 86400;
export const alt = "Vote on FOID.FUN";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return ogCard({
    kicker: "VOTE.EXE",
    title: "swipe on culture",
    subtitle: "approve or reject what goes on the board. streaks weigh your vote up to 5x.",
    accent: "#a78bfa",
  });
}
