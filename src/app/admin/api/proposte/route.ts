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

    // NOTE: proposte_offerta has no created_at — use inviata_at as timestamp
    let query = supabaseAdmin
      .from("proposte_offerta")
      .select("id, codice_fiscale, codice_redenzione, stato, prezzo_proposto, risparmio_stimato, email_contatto, email_inviata_a, inviata_at, vista_at, accettata_at, scade_at, consenso_trattamento, consenso_marketing, consenso_profilazione, consenso_at, offerta_proposta, clienti(nome, cognome, codice_fiscale)", { count: "exact" })
      .order("inviata_at", { ascending: false });

    if (stato) query = query.eq("stato", stato);
    if (search) {
      query = query.or(`codice_redenzione.ilike.%${search}%,email_contatto.ilike.%${search}%,email_inviata_a.ilike.%${search}%`);
    }

    const { data, error, count } = await query.range(from, from + limit - 1);

    if (error) {
      console.error("Proposte query error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const enriched = (data || []).map((p: Record<string, unknown>) => ({
      ...p,
      prezzo_corrente: (p.offerta_proposta as Record<string, unknown>)?.prezzo_corrente ?? 0,
      created_at: p.inviata_at, // alias for UI consistency
    }));

    return NextResponse.json({ data: enriched, total: count ?? 0, page, limit });
  } catch (e) {
    console.error("Proposte error:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Errore" }, { status: 500 });
  }
}