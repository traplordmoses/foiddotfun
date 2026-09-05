import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

function isLikelyServerAction(request: NextRequest) {
  if (request.method !== "POST") return false;
  if (request.headers.get("next-action")) return true;

  const contentType = request.headers.get("content-type") ?? "";
  return (
    contentType.startsWith("application/x-www-form-urlencoded") ||
    contentType.startsWith("multipart/form-data")
  );
}

export function middleware(request: NextRequest) {
  if (request.method === "POST") {
    return NextResponse.json(
      {
        error: isLikelyServerAction(request) ? "stale-action" : "post-not-allowed",
        message: "This request is not supported. Refresh the page and try again.",
      },
      {
        status: isLikelyServerAction(request) ? 409 : 405,
        headers: {
          "Cache-Control": "no-store",
          Allow: "GET, HEAD, OPTIONS",
        },
      }
    );
  }

  if (request.nextUrl.pathname !== "/") return NextResponse.next();

  // Redirect to /enter only if this device hasn't booted before (no
  // cookie). The query string rides along so desktop deep links
  // (/?apps=pray,board — multi-window plan, Stage C) survive the boot:
  // /enter hands the same params back to the shell as its destination.
  //
  // Phones skip the boot entirely (audit P7): the payoff of the ceremony is
  // the desktop with windows, which does not exist under 1024px, so on a
  // phone it only delayed the launcher. The client gate agrees (DesktopGate
  // never bounces narrow viewports), this just saves the round trip.
  const ua = request.headers.get("user-agent") ?? "";
  const chMobile = request.headers.get("sec-ch-ua-mobile");
  const isPhone = chMobile === "?1" || /Mobi|Android|iPhone|iPod/i.test(ua);
  // Crawlers and link-preview fetchers (Google, X, Discord, Telegram,
  // Farcaster clients, Slack, iMessage) never carry the cookie; bouncing
  // them to the boot screen would hide the homepage and its share card.
  const isBot =
    /bot|crawl|spider|slurp|facebookexternalhit|twitterbot|discordbot|telegrambot|whatsapp|linkedinbot|slackbot|embedly|pinterest|warpcast|farcaster|applebot|duckduckbot|baiduspider|yandex/i.test(ua);
  const enteredCookie = request.cookies.get("foid_entered");
  if (!enteredCookie && !isPhone && !isBot) {
    const enterUrl = new URL("/enter", request.url);
    enterUrl.search = request.nextUrl.search;
    return NextResponse.redirect(enterUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/((?!_next|api|favicon.ico|robots.txt|sitemap.xml).*)"],
};
