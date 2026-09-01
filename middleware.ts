import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/session";

const PUBLIC_PATHS = ["/login", "/api/auth", "/manifest.json", "/sw.js", "/offline.html"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public paths, static assets, and Next.js internals
  if (
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.match(/\.(ico|png|jpg|svg|css|js|woff2?)$/)
  ) {
    return NextResponse.next();
  }

  // If no AUTH_PASSWORD_HASH set, skip auth entirely (dev mode)
  if (!process.env.AUTH_PASSWORD_HASH) {
    return NextResponse.next();
  }

  // Task agent credentials are verified, scoped, and resolved to an actor by
  // the task API itself. No other API accepts this bearer-token path.
  if (
    (pathname === "/api/tasks" || pathname.startsWith("/api/tasks/")) &&
    /^Bearer /i.test(req.headers.get("authorization") ?? "")
  ) {
    return NextResponse.next();
  }

  const session = req.cookies.get("gutter-session")?.value;
  if (!(await verifySessionToken(session))) {
    // API routes get 401, pages get redirected
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
