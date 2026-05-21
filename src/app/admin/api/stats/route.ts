import { NextResponse } from "next/server";

export async function GET() {
  try {
    const { supabaseAdmin } = await import("@/lib/supabase/client");

    const [clienti, bollette, proposte, proposteAccettate, recentBollette] = await Promise.all([
      supabaseAdmin.from("clienti").select("codice_fiscale", { count: "exact", head: true }),
      supabaseAdmin.from("bollette").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("proposte_offerta").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("proposte_offerta").select("id", { count: "exact", head: true }).eq("stato", "accettata"),
      supabaseAdmin
        .from("bollette")
        .select("numero_fattura, totale_da_pagare, tipo_bolletta, created_at, clienti(nome, cognome, codice_fiscale)")
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    return NextResponse.json({
      clienti_count: clienti.count ?? 0,
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