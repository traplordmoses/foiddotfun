import { ogCard, OG_SIZE } from "@/lib/ogCard";

export const runtime = "nodejs";
export const revalidate = 86400;
export const alt = "Pray with Foid Mommy on FOID.FUN";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return ogCard({
    kicker: "FOID_MOMMY_TERMINAL.EXE",
    title: "pray with foid mommy",
    subtitle: "a daily onchain ritual. tell her how you feel, keep the streak, earn your vote.",
    accent: "#6eead8",
  });
}
