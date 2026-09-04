import { ogCard, OG_SIZE } from "@/lib/ogCard";

export const runtime = "nodejs";
export const revalidate = 86400;
export const alt = "FOID Files";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return ogCard({
    kicker: "FILES.EXE",
    title: "the mifoid archive",
    subtitle: "videos, renders and stills the foundation is preserving.",
    accent: "#fbbf24",
  });
}
