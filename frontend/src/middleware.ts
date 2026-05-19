import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Block dev-only routes in production builds. */
export function middleware(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    if (request.nextUrl.pathname === "/theme-preview") {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/theme-preview"],
};
