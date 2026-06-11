import { NextResponse, type NextRequest } from "next/server";

// Server-side password gate for the ADMIN area only ("/admin/*") → ADMIN_PASSWORD.
// The public site is open at origin: visitor access is controlled upstream by
// Cloudflare Access (email allowlist) on the public hostname.
// Cookie holds the SHA-256 of the password (never the password), HttpOnly.
const ADMIN_COOKIE = "admin_session";

async function sha256hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Login page and login API are always reachable.
  if (pathname === "/admin/login" || pathname === "/admin/api/login") {
    return NextResponse.next();
  }

  // ── ADMIN area → ADMIN_PASSWORD ──────────────────────────────
  const password = (process.env.ADMIN_PASSWORD || "").trim();
  const expected = password ? await sha256hex(password) : "";
  if (!expected || request.cookies.get(ADMIN_COOKIE)?.value !== expected) {
    if (pathname.startsWith("/admin/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Only the admin area goes through the gate; everything else is public at origin.
  matcher: ["/admin/:path*"],
};
