import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value }) => supabaseResponse.cookies.set(name, value));
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (request.nextUrl.pathname.startsWith("/admin")) {
    // Allow access to login page and API routes without auth check in middleware
    // (auth is verified client-side in layout + API routes verify session)
    if (
      request.nextUrl.pathname === "/admin/login" ||
      request.nextUrl.pathname.startsWith("/admin/api/")
    ) {
      if (request.nextUrl.pathname === "/admin/login" && user) {
        return NextResponse.redirect(new URL("/admin/dashboard", request.url));
      }
      return supabaseResponse;
    }
    // All other /admin/* routes require auth
    if (!user) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
  }

  return supabaseResponse;
}