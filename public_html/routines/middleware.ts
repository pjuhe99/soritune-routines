import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Admin routes require admin role. /admin/login itself is the sign-in page
  // and must remain publicly accessible so users can reach it to authenticate.
  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    if (!req.auth?.user) {
      return NextResponse.redirect(new URL("/admin/login", req.url));
    }
    if ((req.auth.user as { role: string }).role !== "admin") {
      return NextResponse.redirect(new URL("/", req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/admin/:path*"],
};
