import { NextResponse } from "next/server";

export async function GET() {
  try {
    const { supabaseAdmin } = await import("@/lib/supabase/client");

    // Count unique CF instead of total rows (same person with different emails = 1 cliente)
    const { data: distinctCF } = await supabaseAdmin
      .from("clienti")
      .select("codice_fiscale");

    const uniqueClients = new Set(distinctCF?.map((r: { codice_fiscale: string }) => r.codice_fiscale) ?? []).size;

    const [bollette, proposte, proposteAccettate, recentBollette] = await Promise.all([
      supabaseAdmin.from("bollette").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("proposte_offerta").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("proposte_offerta").select("id", { count: "exact", head: true }).eq("stato", "accettata"),
      supabaseAdmin
        .from("bollette")
        .select("id, numero_fattura, totale_da_pagare, tipo_bolletta, created_at, codice_fiscale, clienti(nome, cognome, codice_fiscale), documenti_originali(nome_file, mime_type, storage_path)")
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    return NextResponse.json({
      clienti_count: uniqueClients,
      bollette_count: bollette.count ?? 0,
      proposte_count: proposte.count ?? 0,
      accettate_count: proposteAccettate.count ?? 0,
      recent: recentBollette.data ?? [],
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Errore nel recupero statistiche";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}