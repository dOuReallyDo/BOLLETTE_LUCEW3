import { NextResponse, type NextRequest } from "next/server";

// Single shared-password gate for the /admin area (config dashboard).
// The public site ("/", "/proposal", public APIs) stays open. The admin
// password lives in ADMIN_PASSWORD (env, server-side); cookie "admin_session"
// is HttpOnly. Same model as the other projects.
const COOKIE = "admin_session";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always reachable without auth: the login page and the login API.
  if (pathname === "/admin/login" || pathname === "/admin/api/login") {
    return NextResponse.next();
  }

  // Everything else under /admin (pages AND data APIs) requires the password.
  if (pathname.startsWith("/admin")) {
    const password = process.env.ADMIN_PASSWORD || "";
    const cookie = request.cookies.get(COOKIE)?.value;
    if (!password || cookie !== password) {
      if (pathname.startsWith("/admin/api/")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
