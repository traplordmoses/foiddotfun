// /.well-known/farcaster.json — Farcaster / Base App mini-app manifest
// (audit G3). The accountAssociation block must be signed by the FOID
// Farcaster account: generate it in Warpcast (Settings > Developer > Domains)
// for the domain foid.fun and paste the JSON into the
// FARCASTER_ACCOUNT_ASSOCIATION env var. Until then the manifest serves the
// app metadata without the association, which is enough for embeds to
// render but not for "add app" / notifications.
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const revalidate = 3600;

const SITE = "https://foid.fun";

export async function GET() {
  let accountAssociation: unknown = undefined;
  const raw = process.env.FARCASTER_ACCOUNT_ASSOCIATION;
  if (raw) {
    try {
      accountAssociation = JSON.parse(raw);
    } catch {
      accountAssociation = undefined;
    }
  }
  const manifest = {
    ...(accountAssociation ? { accountAssociation } : {}),
    miniapp: {
      version: "1",
      name: "FOID",
      subtitle: "pray daily, vote on culture",
      description:
        "A daily onchain ritual with Foid Mommy. Keep your streak, earn voting power, and build the permanent internet collage on the Loreboard.",
      iconUrl: `${SITE}/icons/512.png`,
      homeUrl: `${SITE}/pray?miniapp=1`,
      splashImageUrl: `${SITE}/icons/192.png`,
      splashBackgroundColor: "#0e0f2b",
      primaryCategory: "social",
      tags: ["daily", "ritual", "culture", "fluent", "memes"],
      heroImageUrl: `${SITE}/api/og/card/pray`,
      tagline: "the internet's permanent memory",
      ogTitle: "FOID.FUN",
      ogDescription: "Pray daily, vote on culture, build the permanent internet collage.",
      ogImageUrl: `${SITE}/api/og/card/site`,
      screenshotUrls: [`${SITE}/api/og/card/pray`],
      webhookUrl: `${SITE}/api/farcaster/webhook`,
    },
  };
  return NextResponse.json(manifest, {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
