import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const { supabaseAdmin } = await import("@/lib/supabase/client");
    const url = new URL(req.url);
    const stato = url.searchParams.get("stato") || "";
    const search = url.searchParams.get("search") || "";
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "20");
    const from = (page - 1) * limit;

    let query = supabaseAdmin
      .from("proposte_offerta")
      .select("id, codice_redenzione, stato, prezzo_corrente, prezzo_proposto, risparmio_stimato, email_contatto, created_at, clienti(nome, cognome, codice_fiscale), offerta_proposta", { count: "exact" })
      .order("created_at", { ascending: false });

    if (stato) query = query.eq("stato", stato);
    if (search) {
      query = query.or(`codice_redenzione.ilike.%${search}%,email_contatto.ilike.%${search}%`);
    }

    const { data, error, count } = await query.range(from, from + limit - 1);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ data, total: count ?? 0, page, limit });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Errore" }, { status: 500 });
  }
}