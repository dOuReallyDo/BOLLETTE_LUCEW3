import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Lazy clients: on Cloudflare Workers env vars are only available per-request,
// not at module top-level (and an empty key throws at build time). Instantiate
// on first use via a memoized Proxy so call sites (supabase.from(...),
// supabaseAdmin.from(...)) stay unchanged.
function lazyClient(getKey: () => string): SupabaseClient {
  let instance: SupabaseClient | null = null;
  const resolve = (): SupabaseClient =>
    (instance ??= createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, getKey()));
  return new Proxy({} as SupabaseClient, {
    get(_target, prop) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = resolve() as any;
      const value = client[prop];
      return typeof value === "function" ? value.bind(client) : value;
    },
  });
}

// Client-side (anon, RLS-protected)
export const supabase = lazyClient(() => process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

// Server-side admin (bypasses RLS)
export const supabaseAdmin = lazyClient(() => process.env.SUPABASE_SERVICE_ROLE_KEY!);
