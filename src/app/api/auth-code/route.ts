import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/client";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.json({ error: "Codice mancante" }, { status: 400 });
  }

  // Find proposal by redemption code
  const { data: proposta, error } = await supabaseAdmin
    .from("proposte_offerta")
    .select("*, clienti(nome, cognome, codice_fiscale)")
    .eq("codice_redenzione", code.toUpperCase())
    .single();

  if (error || !proposta) {
    return NextResponse.json({ error: "Codice non valido" }, { status: 404 });
  }

  // Check expiry
  if (new Date(proposta.scade_at) < new Date()) {
    // Mark as expired
    await supabaseAdmin
      .from("proposte_offerta")
      .update({ stato: "scaduta" })
      .eq("id", proposta.id);
    return NextResponse.json({ error: "Codice scaduto" }, { status: 410 });
  }

  // Mark as viewed
  if (proposta.stato === "inviata") {
    await supabaseAdmin
      .from("proposte_offerta")
      .update({ stato: "vista", vista_at: new Date().toISOString() })
      .eq("id", proposta.id);
  }

  return NextResponse.json({ proposta });
}

export async function POST(req: NextRequest) {
  const { code } = await req.json();
  if (!code) {
    return NextResponse.json({ error: "Codice mancante" }, { status: 400 });
  }

  const { data: proposta, error } = await supabaseAdmin
    .from("proposte_offerta")
    .select("*")
    .eq("codice_redenzione", code.toUpperCase())
    .single();

  if (error || !proposta) {
    return NextResponse.json({ error: "Codice non valido" }, { status: 404 });
  }

  if (proposta.stato === "accettata") {
    return NextResponse.json({ error: "Offerta già accettata" }, { status: 409 });
  }

  if (proposta.stato === "scaduta" || new Date(proposta.scade_at) < new Date()) {
    return NextResponse.json({ error: "Codice scaduto" }, { status: 410 });
  }

  // Accept the offer
  const { error: updateErr } = await supabaseAdmin
    .from("proposte_offerta")
    .update({
      stato: "accettata",
      accettata_at: new Date().toISOString(),
    })
    .eq("id", proposta.id);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, proposta_id: proposta.id });
}