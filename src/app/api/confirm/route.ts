import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/client";
import { extractedBillDataSchema, type ValidatedBillData } from "@/lib/extraction/validation";
import { generateRedemptionCode } from "@/lib/email/proposal";
import { sendProposalEmail } from "@/lib/email/send";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { data, storagePath, fileName, mimeType, userEmail } = body as {
      data: ValidatedBillData;
      storagePath: string;
      fileName: string;
      mimeType: string;
      userEmail: string;
    };

    // Re-validate
    const validated = extractedBillDataSchema.parse(data);

    // 1. Upsert cliente
    const { data: cliente, error: clienteErr } = await supabaseAdmin
      .from("clienti")
      .upsert({
        codice_fiscale: validated.cliente.codice_fiscale,
        nome: validated.cliente.nome,
        cognome: validated.cliente.cognome,
        email: userEmail,
        email_contatto_bolletta: validated.cliente.email_contatto_bolletta || null,
        telefono: validated.cliente.telefono || null,
      })
      .select()
      .single();

    if (clienteErr) {
      return NextResponse.json({ error: `Cliente: ${clienteErr.message}` }, { status: 500 });
    }

    // 2. Upsert fornitura (by codice_punto + tipo_punto)
    const { data: fornitura, error: fornErr } = await supabaseAdmin
      .from("forniture")
      .upsert({
        codice_fiscale: validated.cliente.codice_fiscale,
        tipo_punto: validated.fornitura.tipo_punto,
        codice_punto: validated.fornitura.codice_punto,
        tipo_fornitura: validated.fornitura.tipo_fornitura,
        indirizzo_fornitura: validated.fornitura.indirizzo_fornitura || null,
        cap: validated.fornitura.cap || null,
        comune: validated.fornitura.comune || null,
        provincia: validated.fornitura.provincia || null,
        classe_contatore: validated.fornitura.classe_contatore || null,
        matricola_contatore: validated.fornitura.matricola_contatore || null,
        potenza_impegnata_kw: validated.fornitura.potenza_impegnata_kw || null,
        tensione: validated.fornitura.tensione || null,
        codice_remi: validated.fornitura.codice_remi || null,
        pcs: validated.fornitura.pcs || null,
        coeff_correttivo_c: validated.fornitura.coeff_correttivo_c || null,
      }, { onConflict: "codice_punto,tipo_punto" })
      .select()
      .single();

    if (fornErr) {
      return NextResponse.json({ error: `Fornitura: ${fornErr.message}` }, { status: 500 });
    }

    // 3. Insert contratto
    const { data: contratto, error: contrErr } = await supabaseAdmin
      .from("contratti")
      .insert({
        fornitura_id: fornitura.id,
        brand_commerciale: validated.contratto.brand_commerciale || null,
        societa_vendita: validated.contratto.societa_vendita || null,
        piva_venditore: validated.contratto.piva_venditore || null,
        mercato: validated.contratto.mercato || null,
        nome_offerta: validated.contratto.nome_offerta || null,
        codice_offerta: validated.contratto.codice_offerta || null,
        tipo_prezzo: validated.contratto.tipo_prezzo || null,
        indice_riferimento: validated.contratto.indice_riferimento || null,
        data_decorrenza: validated.contratto.data_decorrenza || null,
        data_scadenza_contratto: validated.contratto.data_scadenza_contratto || null,
        penali_recesso: validated.contratto.penali_recesso || false,
        metodo_pagamento: validated.contratto.metodo_pagamento || null,
        codice_utenza: validated.contratto.codice_utenza || null,
      })
      .select()
      .single();

    if (contrErr) {
      return NextResponse.json({ error: `Contratto: ${contrErr.message}` }, { status: 500 });
    }

    // 4. Insert bolletta
    const { data: bolletta, error: bolErr } = await supabaseAdmin
      .from("bollette")
      .insert({
        codice_fiscale: validated.cliente.codice_fiscale,
        fornitura_id: fornitura.id,
        contratto_id: contratto.id,
        numero_fattura: validated.bolletta.numero_fattura || null,
        tipo_bolletta: validated.bolletta.tipo_bolletta,
        data_emissione: validated.bolletta.data_emissione || null,
        periodo_dal: validated.bolletta.periodo_dal || null,
        periodo_al: validated.bolletta.periodo_al || null,
        consumo_fatturato: validated.bolletta.consumo_fatturato || null,
        unita_consumo: validated.bolletta.unita_consumo || null,
        consumo_annuo: validated.bolletta.consumo_annuo || null,
        totale_bolletta: validated.bolletta.totale_bolletta || null,
        totale_da_pagare: validated.bolletta.totale_da_pagare,
        data_scadenza_pagamento: validated.bolletta.data_scadenza_pagamento || null,
        stato_pagamenti: validated.bolletta.stato_pagamenti || null,
      })
      .select()
      .single();

    if (bolErr) {
      return NextResponse.json({ error: `Bolletta: ${bolErr.message}` }, { status: 500 });
    }

    // 5. Insert voci costo
    if (validated.voci_costo?.length) {
      const voci = validated.voci_costo.map((v) => ({
        bolletta_id: bolletta.id,
        ...v,
      }));
      const { error: vociErr } = await supabaseAdmin.from("bolletta_voci_costo").insert(voci);
      if (vociErr) console.error("Voci costo error:", vociErr);
    }

    // 6. Insert letture
    if (validated.letture?.length) {
      const letture = validated.letture.map((l) => ({
        bolletta_id: bolletta.id,
        ...l,
      }));
      const { error: lettErr } = await supabaseAdmin.from("bolletta_letture").insert(letture);
      if (lettErr) console.error("Letture error:", lettErr);
    }

    // 7. Insert consumi storici
    if (validated.consumi_storici?.length) {
      const consumi = validated.consumi_storici.map((c) => ({
        bolletta_id: bolletta.id,
        ...c,
      }));
      const { error: consErr } = await supabaseAdmin.from("bolletta_consumi_storici").insert(consumi);
      if (consErr) console.error("Consumi storici error:", consErr);
    }

    // 8. Insert documento originale reference
    const hash = crypto.createHash("sha256").update(storagePath).digest("hex");
    await supabaseAdmin.from("documenti_originali").insert({
      bolletta_id: bolletta.id,
      storage_path: storagePath,
      nome_file: fileName,
      mime_type: mimeType,
      hash_sha256: hash,
    });

    // 9. Generate proposal code + send email
    const redemptionCode = generateRedemptionCode();

    // Calculate estimated savings (simplified: 15% of current total for POC)
    const prezzoCorrente = validated.bolletta.totale_da_pagare || 0;
    const risparmioStimato = Math.round(prezzoCorrente * 0.15 * 100) / 100;
    const prezzoProposto = Math.round((prezzoCorrente - risparmioStimato) * 100) / 100;

    const { data: proposta, error: propErr } = await supabaseAdmin
      .from("proposte_offerta")
      .insert({
        codice_fiscale: validated.cliente.codice_fiscale,
        codice_redenzione: redemptionCode,
        offerta_proposta: {
          nome: "FornitoreA Luce&Gas Per Te",
          tipo: validated.fornitura.tipo_fornitura === "luce" ? "energia" : "gas",
          prezzo_corrente: prezzoCorrente,
          prezzo_proposto: prezzoProposto,
          fornitore_attuale: validated.contratto.brand_commerciale || validated.contratto.societa_vendita,
          offerta_attuale: validated.contratto.nome_offerta,
        },
        prezzo_proposto: prezzoProposto,
        risparmio_stimato: risparmioStimato,
        email_inviata_a: userEmail,
      })
      .select()
      .single();

    if (propErr) {
      return NextResponse.json({ error: `Proposta: ${propErr.message}` }, { status: 500 });
    }

    // 10. Send email (non-blocking)
    sendProposalEmail(userEmail, redemptionCode, {
      nome: validated.cliente.nome,
      cognome: validated.cliente.cognome,
      offerta: "FornitoreA Luce&Gas Per Te",
      risparmio: risparmioStimato,
      codice: redemptionCode,
    }).catch((err) => console.error("Email send error:", err));

    return NextResponse.json({
      success: true,
      codice_fiscale: validated.cliente.codice_fiscale,
      bolletta_id: bolletta.id,
      proposta_id: proposta.id,
      codice_redenzione: redemptionCode,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Errore durante il salvataggio";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}