import { NextRequest, NextResponse } from "next/server";

const COOKIE = "admin_session";

// POST /admin/api/login — check the shared password, set the session cookie.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const password = typeof body?.password === "string" ? body.password : "";
  const expected = process.env.ADMIN_PASSWORD || "";

  if (!expected || password !== expected) {
    return NextResponse.json({ error: "Password non valida" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, expected, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 12 * 60 * 60, // 12h
  });
  return res;
}

// DELETE /admin/api/login — logout (clear the cookie).
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
