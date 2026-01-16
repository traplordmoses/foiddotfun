import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname !== "/") return NextResponse.next();

  const enteredCookie = request.cookies.get("foid_entered");
  if (!enteredCookie) {
    return NextResponse.redirect(new URL("/enter", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/",
};
