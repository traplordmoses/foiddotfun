import { ogCard, OG_SIZE } from "@/lib/ogCard";

export const runtime = "nodejs";
export const revalidate = 86400;
export const alt = "FOID.FUN";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return ogCard({
    kicker: "FOID OS",
    title: "the internet's permanent memory",
    subtitle: "pray daily. vote on culture. build the permanent internet collage.",
    accent: "#74ffeb",
  });
}
