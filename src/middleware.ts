import { NextResponse, type NextRequest } from "next/server";

// Single shared-password gate for the /admin area (config dashboard).
// The public site ("/", "/proposal", public APIs) stays open. The admin
// password lives in ADMIN_PASSWORD (env, server-side). The cookie holds the
// SHA-256 of the password (never the password itself) and is HttpOnly.
const COOKIE = "admin_session";

async function sha256hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always reachable without auth: the login page and the login API.
  if (pathname === "/admin/login" || pathname === "/admin/api/login") {
    return NextResponse.next();
  }

  // Everything else under /admin (pages AND data APIs) requires the password.
  if (pathname.startsWith("/admin")) {
    const password = process.env.ADMIN_PASSWORD || "";
    const cookie = request.cookies.get(COOKIE)?.value;
    const expected = password ? await sha256hex(password) : "";
    if (!expected || cookie !== expected) {
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
