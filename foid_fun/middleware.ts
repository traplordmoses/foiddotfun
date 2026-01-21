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
  if (isLikelyServerAction(request)) {
    return NextResponse.json(
      {
        error: "stale-action",
        message: "This action is not available. Refresh the page and try again.",
      },
      {
        status: 409,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }

  if (request.nextUrl.pathname !== "/") return NextResponse.next();

  const enteredCookie = request.cookies.get("foid_entered");
  if (!enteredCookie) {
    return NextResponse.redirect(new URL("/enter", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/((?!_next|api|favicon.ico|robots.txt|sitemap.xml).*)"],
};
