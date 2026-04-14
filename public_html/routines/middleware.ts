import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Admin routes require admin role
  if (pathname.startsWith("/admin")) {
    if (!req.auth?.user) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    if ((req.auth.user as { role: string }).role !== "admin") {
      return NextResponse.redirect(new URL("/", req.url));
    }
  }

  // Main app routes require authentication
  if (
    pathname.startsWith("/today") ||
    pathname.startsWith("/learn") ||
    pathname.startsWith("/archive") ||
    pathname.startsWith("/profile")
  ) {
    if (!req.auth?.user) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/admin/:path*",
    "/today/:path*",
    "/learn/:path*",
    "/archive/:path*",
    "/profile/:path*",
  ],
};
