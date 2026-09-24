// Home route. A server wrapper so the first HTML matches the visitor:
// phones and crawlers get the launcher window rendered on the server (real
// headline, links and copy for search engines and AI answer agents, and a
// headline that paints before any JavaScript runs); desktop browsers get
// the FOID OS shell, which is client-only. src/app/HomeClient.tsx has the
// UI.
import type { Metadata } from "next";
import { headers } from "next/headers";
import HomeClient from "./HomeClient";
import { isCrawler, isPhone } from "@/lib/userAgent";
import { routeMetadata } from "@/lib/routeMetadata";

const TITLE = "FOID Foundation · The Internet's Permanent Memory";
const DESCRIPTION =
  "A community canvas for memes and culture, onchain. Pray daily with Foid Mommy, vote on what stays on the Loreboard, and earn up to 5x voting power.";

export const metadata: Metadata = routeMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: "/",
  card: "site",
  absoluteTitle: true,
});

export default function HomePage() {
  const requestHeaders = headers();
  const userAgent = requestHeaders.get("user-agent");
  const crawler = isCrawler(userAgent);
  const phone = isPhone(userAgent, requestHeaders.get("sec-ch-ua-mobile"));
  return <HomeClient crawler={crawler} initialNarrow={crawler || phone} />;
}
