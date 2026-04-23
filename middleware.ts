import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = ["/login", "/api/auth", "/manifest.json", "/sw.js", "/offline.html"];

export function middleware(req: NextRequest) {
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

  // Localhost bypass — skip auth for direct local requests
  const forwarded = req.headers.get("x-forwarded-for");
  const clientIp = forwarded ? forwarded.split(",")[0].trim() : undefined;
  const host = req.headers.get("host") ?? "";
  if (clientIp === "127.0.0.1" || clientIp === "::1" || host.startsWith("localhost") || host.startsWith("127.0.0.1") || host.startsWith("[::1]") || host.startsWith("::1")) {
    return NextResponse.next();
  }

  // Check session cookie
  const session = req.cookies.get("gutter-session");

  if (!session?.value || session.value.length !== 64) {
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
