import { ogCard, OG_SIZE } from "@/lib/ogCard";

export const runtime = "nodejs";
export const revalidate = 86400;
export const alt = "MiFOID";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return ogCard({
    kicker: "MIFOID.EXE",
    title: "3,333 mifoids",
    subtitle: "born, not generated. your key to the ecosystem.",
    accent: "#818cf8",
  });
}
