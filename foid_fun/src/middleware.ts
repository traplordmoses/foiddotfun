import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { isCrawler, isPhone as isPhoneUa } from "@/lib/userAgent";
import { isWatchableId } from "@/config/mediaLibrary";

function isLikelyServerAction(request: NextRequest) {
  if (request.method !== "POST") return false;
  if (request.headers.get("next-action")) return true;

  const contentType = request.headers.get("content-type") ?? "";
  return (
    contentType.startsWith("application/x-www-form-urlencoded") ||
    contentType.startsWith("multipart/form-data")
  );
}

function safeDecode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return "";
  }
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

  // /watch/<id> exists only for published episodes and archive films.
  // Anything else is rewritten to a path no route matches, which answers
  // with a real 404. A notFound() inside the page cannot: the root
  // loading.tsx has already committed a 200 by the time the page runs.
  const watch = /^\/watch\/([^/]+)\/?$/.exec(request.nextUrl.pathname);
  if (watch && !isWatchableId(safeDecode(watch[1]))) {
    return NextResponse.rewrite(new URL("/_watch/not-found", request.url));
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
  const isPhone = isPhoneUa(ua, request.headers.get("sec-ch-ua-mobile"));
  // Crawlers, AI answer agents and link-preview fetchers never carry the
  // cookie; bouncing them to the boot screen would hide the homepage and
  // its share card (src/lib/userAgent.ts has the list).
  const isBot = isCrawler(ua);
  const enteredCookie = request.cookies.get("foid_entered");
  if (!enteredCookie && !isPhone && !isBot) {
    const enterUrl = new URL("/enter", request.url);
    enterUrl.search = request.nextUrl.search;
    return NextResponse.redirect(enterUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/((?!_next|api|img/|favicon.ico|robots.txt|sitemap.xml).*)"],
};
