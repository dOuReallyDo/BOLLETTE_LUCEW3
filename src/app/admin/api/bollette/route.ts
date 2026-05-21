import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const { supabaseAdmin } = await import("@/lib/supabase/client");
    const url = new URL(req.url);
    const tipo = url.searchParams.get("tipo") || "";
    const fornitore = url.searchParams.get("fornitore") || "";
    const minTotale = parseFloat(url.searchParams.get("min_totale") || "0");
    const maxTotale = parseFloat(url.searchParams.get("max_totale") || "0");
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "20");
    const from = (page - 1) * limit;

    let query = supabaseAdmin
      .from("bollette")
      .select("id, numero_fattura, tipo_bolletta, totale_da_pagare, periodo_dal, periodo_al, created_at, codice_fiscale, clienti(nome, cognome, codice_fiscale), forniture(tipo_fornitura, codice_punto), contratti(brand_commerciale, nome_offerta), documenti_originali(nome_file, mime_type, storage_path)", { count: "exact" })
      .order("created_at", { ascending: false });

    if (tipo) query = query.eq("tipo_bolletta", tipo);
    if (minTotale > 0) query = query.gte("totale_da_pagare", minTotale);
    if (maxTotale > 0) query = query.lte("totale_da_pagare", maxTotale);

    const { data, error, count } = await query.range(from, from + limit - 1);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Client-side filter for fornitore
    const filtered = fornitore
      ? data?.filter((b: Record<string, unknown>) => (b.contratti as Record<string, unknown>)?.brand_commerciale?.toString().toLowerCase().includes(fornitore.toLowerCase()))
      : data;

    return NextResponse.json({ data: filtered, total: count ?? 0, page, limit });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Errore" }, { status: 500 });
  }
}