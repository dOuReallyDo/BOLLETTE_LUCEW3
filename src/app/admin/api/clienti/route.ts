import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const { supabaseAdmin } = await import("@/lib/supabase/client");
    const url = new URL(req.url);
    const search = url.searchParams.get("search") || "";
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "20");
    const from = (page - 1) * limit;

    let query = supabaseAdmin
      .from("clienti")
      .select("codice_fiscale, nome, cognome, email, email_contatto_bolletta, telefono, created_at, forniture(count), bollette(count)", { count: "exact" });

    if (search) {
      query = query.or(`codice_fiscale.ilike.%${search}%,nome.ilike.%${search}%,cognome.ilike.%${search}%`);
    }

    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .range(from, from + limit - 1);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ data, total: count ?? 0, page, limit });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Errore" }, { status: 500 });
  }
}