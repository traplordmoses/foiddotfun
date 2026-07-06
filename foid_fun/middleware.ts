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

  // Redirect to /enter only if user hasn't entered before (no cookie).
  // The query string rides along so desktop deep links (/?apps=pray,board
  // — multi-window plan, Stage C) survive the boot: /enter hands the same
  // params back to the shell as its destination.
  const enteredCookie = request.cookies.get("foid_entered");
  if (!enteredCookie) {
    const enterUrl = new URL("/enter", request.url);
    enterUrl.search = request.nextUrl.search;
    return NextResponse.redirect(enterUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/((?!_next|api|favicon.ico|robots.txt|sitemap.xml).*)"],
};
