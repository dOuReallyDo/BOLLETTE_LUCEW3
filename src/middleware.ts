import { NextResponse, type NextRequest } from "next/server";

// Two server-side password gates (same model as the other projects):
//  - PUBLIC site ("/", "/proposal", public APIs)  → SITE_PASSWORD
//  - ADMIN area ("/admin/*")                        → ADMIN_PASSWORD
// Cookies hold the SHA-256 of the password (never the password), HttpOnly.
const ADMIN_COOKIE = "admin_session";
const SITE_COOKIE = "site_session";

async function sha256hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Login pages and login APIs are always reachable.
  if (
    pathname === "/admin/login" ||
    pathname === "/admin/api/login" ||
    pathname === "/entra" ||
    pathname === "/api/site-login"
  ) {
    return NextResponse.next();
  }

  // ── ADMIN area → ADMIN_PASSWORD ──────────────────────────────
  if (pathname.startsWith("/admin")) {
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

  // ── PUBLIC area → SITE_PASSWORD ──────────────────────────────
  const sitePassword = (process.env.SITE_PASSWORD || "").trim();
  const siteExpected = sitePassword ? await sha256hex(sitePassword) : "";
  if (!siteExpected || request.cookies.get(SITE_COOKIE)?.value !== siteExpected) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/entra", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Match everything except Next internals and static asset files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico|txt|xml)$).*)"],
};
