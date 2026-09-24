import "./tokens.css";
import "./globals.css";
import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { Fraunces, IBM_Plex_Sans, JetBrains_Mono, Sora } from "next/font/google";
import AppRuntime from "@/components/AppRuntime";
import AnimatedBackground from "@/components/AnimatedBackground";
import FloatingElements from "@/components/FloatingElements";
import { SkyTint } from "@/components/SkyTint";
import StyledJsxRegistry from "@/app/StyledJsxRegistry";
import { JsonLd } from "@/components/seo/JsonLd";
import { ORG_ID, SAME_AS, SITE_DESCRIPTION, SITE_NAME, SITE_URL, WEBSITE_ID } from "@/lib/site";

// Site-wide metadata. Per-route titles, descriptions and share cards come
// from routeMetadata() in each route's layout; the card images themselves
// are served by /api/og/card/[app] (one route, not one bundle per page).
export const metadata: Metadata = {
  metadataBase: new URL("https://foid.fun"),
  title: {
    default: "FOID.FUN",
    template: "%s | FOID.FUN",
  },
  description:
    "Pray daily with Foid Mommy, vote on culture, and build the permanent internet collage. FOID OS runs on Fluent.",
  applicationName: "FOID.FUN",
  appleWebApp: {
    capable: true,
    title: "FOID",
    statusBarStyle: "black-translucent",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-32.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon-16.png", type: "image/png", sizes: "16x16" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
    shortcut: "/favicon.ico",
  },
  manifest: "/manifest.json",
  openGraph: {
    title: "FOID.FUN",
    description:
      "Pray daily, vote on culture, build the permanent internet collage. An onchain cultural canvas governed by the people who show up.",
    url: "https://foid.fun",
    siteName: "FOID Foundation",
    type: "website",
    locale: "en_US",
    images: [{ url: "/api/og/card/site", width: 1200, height: 630, alt: "FOID.FUN" }],
  },
  twitter: {
    card: "summary_large_image",
    site: "@foidfun",
    title: "FOID.FUN",
    description:
      "Pray daily, vote on culture, build the permanent internet collage.",
    images: ["/api/og/card/site"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: "#030b12",
};

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-terminal",
  fallback: ["ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas"],
});

const displayFont = Sora({
  preload: false,
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
  weight: ["500", "600", "700"],
});

const bodyFont = IBM_Plex_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-body",
  weight: ["400", "500", "600"],
});

const serifFont = Fraunces({
  preload: false,
  subsets: ["latin"],
  display: "swap",
  variable: "--font-serif",
  weight: ["400", "500"],
  style: ["normal", "italic"],
});

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`h-full overflow-hidden ${displayFont.variable} ${bodyFont.variable} ${jetbrainsMono.variable} ${serifFont.variable}`}
    >
      <head>
        {/* Preconnect hints for IPFS gateways — the /board route loads
            placement images directly from whichever gateway is currently
            fastest (see src/lib/ipfsGatewayCache.ts). Preconnect opens
            TLS + DNS ahead of the first request so the hero image on
            the initial board render doesn't wait on handshake. */}
        <link rel="preconnect" href="https://gateway.pinata.cloud" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://gateway.pinata.cloud" />
        <link rel="dns-prefetch" href="https://ipfs.io" />
        <link rel="dns-prefetch" href="https://dweb.link" />
        <link rel="dns-prefetch" href="https://w3s.link" />
        <link rel="dns-prefetch" href="https://4everland.io" />
      </head>
  <body className="relative h-full min-h-screen overflow-hidden font-secondary" suppressHydrationWarning>
    {/* Who FOID is, for search engines and AI answer engines. Per-page
        entities (docs, placements) add their own blocks. */}
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "Organization",
            "@id": ORG_ID,
            name: SITE_NAME,
            alternateName: ["FOID", "foid.fun"],
            url: `${SITE_URL}/`,
            logo: `${SITE_URL}/icons/512.png`,
            description: SITE_DESCRIPTION,
            sameAs: SAME_AS,
          },
          {
            "@type": "WebSite",
            "@id": WEBSITE_ID,
            name: SITE_NAME,
            alternateName: "FOID.FUN",
            url: `${SITE_URL}/`,
            inLanguage: "en",
            publisher: { "@id": ORG_ID },
          },
        ],
      }}
    />
    <StyledJsxRegistry>
      <AnimatedBackground />
      <FloatingElements />
      <div className="scene-tint" />
      <SkyTint />
      <div className="app-viewport"><AppRuntime>{children}</AppRuntime></div>
    </StyledJsxRegistry>
  </body>
</html>
  );
}
