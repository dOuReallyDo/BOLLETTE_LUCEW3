import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/client";
import { extractedBillDataSchema, type ValidatedBillData } from "@/lib/extraction/validation";
import { generateRedemptionCode } from "@/lib/email/proposal";
import { findBestOfferta, computeMonthlyBillAmount, computeMonthlyConsumption } from "@/lib/offerte/matching";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { data, storagePath, fileName, mimeType, contact, gdpr } = body as {
      data: ValidatedBillData;
      storagePath: string;
      fileName: string;
      mimeType: string;
      contact?: { email?: string; telefono?: string };
      gdpr?: {
        consenso_trattamento: boolean;
        consenso_marketing: boolean;
        consenso_profilazione: boolean;
        consenso_at?: string;
      };
    };

    // Validate GDPR consent
    if (!gdpr?.consenso_trattamento) {
      return NextResponse.json(
        { error: "Il consenso al trattamento dei dati è obbligatorio" },
        { status: 400 }
      );
    }
    if (!contact?.email) {
      return NextResponse.json(
        { error: "L'indirizzo email è obbligatorio" },
        { status: 400 }
      );
    }

    // Re-validate
    const validated = extractedBillDataSchema.parse(data);

    // 1. Upsert cliente
    const { data: cliente, error: clienteErr } = await supabaseAdmin
      .from("clienti")
      .upsert({
        codice_fiscale: validated.cliente.codice_fiscale,
        nome: validated.cliente.nome,
        cognome: validated.cliente.cognome,
        email: contact.email || validated.cliente.email_contatto_bolletta || null,
        email_contatto_bolletta: validated.cliente.email_contatto_bolletta || null,
        telefono: contact.telefono || validated.cliente.telefono || null,
      })
      .select()
      .single();

    if (clienteErr) {
      return NextResponse.json({ error: `Cliente: ${clienteErr.message}` }, { status: 500 });
    }

    // 2. Upsert fornitura
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
        totale_da_pagare: validated.bolletta.totale_da_pagare || null,
        data_scadenza_pagamento: validated.bolletta.data_scadenza_pagamento || null,
        stato_pagamenti: validated.bolletta.stato_pagamenti || null,
      })
      .select()
      .single();

    if (bolErr) {
      return NextResponse.json({ error: `Bolletta: ${bolErr.message}` }, { status: 500 });
    }

    // 5-7. Insert detail records (voci, letture, consumi)
    if (validated.voci_costo?.length) {
      await supabaseAdmin.from("bolletta_voci_costo").insert(
        validated.voci_costo.map((v) => ({ bolletta_id: bolletta.id, ...v }))
      );
    }
    if (validated.letture?.length) {
      await supabaseAdmin.from("bolletta_letture").insert(
        validated.letture.map((l) => ({ bolletta_id: bolletta.id, ...l }))
      );
    }
    if (validated.consumi_storici?.length) {
      await supabaseAdmin.from("bolletta_consumi_storici").insert(
        validated.consumi_storici.map((c) => ({ bolletta_id: bolletta.id, ...c }))
      );
    }

    // 8. Insert documento reference
    const hash = crypto.createHash("sha256").update(storagePath).digest("hex");
    await supabaseAdmin.from("documenti_originali").insert({
      bolletta_id: bolletta.id,
      storage_path: storagePath,
      nome_file: fileName,
      mime_type: mimeType,
      hash_sha256: hash,
    });

    // ── 9. Find best offerta and compute proposal ──────────────
    const commodity = validated.fornitura.tipo_fornitura; // "luce" | "gas"
    const totaleDaPagare = validated.bolletta.totale_da_pagare || 0;
    const costoMensileCorrente = computeMonthlyBillAmount(
      totaleDaPagare,
      validated.bolletta.periodo_dal,
      validated.bolletta.periodo_al
    );
    const consumoMensile = computeMonthlyConsumption(
      validated.bolletta.consumo_annuo,
      validated.bolletta.consumo_fatturato,
      validated.bolletta.periodo_dal,
      validated.bolletta.periodo_al
    );

    const matched = await findBestOfferta(
      commodity,
      consumoMensile,
      costoMensileCorrente,
      validated.contratto.tipo_prezzo
    );

    let prezzoProposto: number;
    let risparmioStimato: number;
    let offertaProposta: Record<string, unknown>;

    if (matched) {
      // Use real offerta data from DB
      prezzoProposto = matched.costo_mensile_stimato;
      risparmioStimato = matched.risparmio_mensile;
      offertaProposta = {
        nome: matched.offerta.nome_offerta,
        tipo: commodity === "luce" ? "energia" : "gas",
        prezzo_corrente: costoMensileCorrente,
        prezzo_proposto: matched.costo_mensile_stimato,
        risparmio_mensile: matched.risparmio_mensile,
        cannot_beat: matched.cannot_beat,
        fornitore_attuale: validated.contratto.brand_commerciale || validated.contratto.societa_vendita || "",
        offerta_attuale: validated.contratto.nome_offerta || "",
        tipo_prezzo: matched.offerta.tipo_prezzo,
        indice_riferimento: matched.offerta.indice_riferimento || null,
        ccv_mensile: matched.offerta.ccv_mensile || null,
        dettagli_costo: matched.dettagli,
        codice_offerta_w3: matched.offerta.codice_offerta || null,
      };
    } else {
      // Fallback: flat 15% discount
      risparmioStimato = Math.round(costoMensileCorrente * 0.15 * 100) / 100;
      prezzoProposto = Math.round((costoMensileCorrente - risparmioStimato) * 100) / 100;
      offertaProposta = {
        nome: "Offerta Per Te",
        tipo: commodity === "luce" ? "energia" : "gas",
        prezzo_corrente: costoMensileCorrente,
        prezzo_proposto: prezzoProposto,
        risparmio_mensile: risparmioStimato,
        fornitore_attuale: validated.contratto.brand_commerciale || validated.contratto.societa_vendita || "",
        offerta_attuale: validated.contratto.nome_offerta || "",
      };
    }

    // 10. Generate proposal
    const redemptionCode = generateRedemptionCode();

    const { data: proposta, error: propErr } = await supabaseAdmin
      .from("proposte_offerta")
      .insert({
        codice_fiscale: validated.cliente.codice_fiscale,
        codice_redenzione: redemptionCode,
        offerta_proposta: offertaProposta,
        prezzo_proposto: prezzoProposto,
        risparmio_stimato: risparmioStimato,
        email_inviata_a: contact.email || validated.cliente.email_contatto_bolletta || null,
        email_contatto: contact.email || null,
        telefono_contatto: contact.telefono || null,
        consenso_trattamento: gdpr.consenso_trattamento,
        consenso_marketing: gdpr.consenso_marketing,
        consenso_profilazione: gdpr.consenso_profilazione,
        consenso_at: gdpr.consenso_at || new Date().toISOString(),
        stato: "inviata",
      })
      .select()
      .single();

    if (propErr) {
      return NextResponse.json({ error: `Proposta: ${propErr.message}` }, { status: 500 });
    }

    // Return proposal data
    return NextResponse.json({
      success: true,
      codice_fiscale: validated.cliente.codice_fiscale,
      bolletta_id: bolletta.id,
      proposta_id: proposta.id,
      proposal: {
        codice_fiscale: validated.cliente.codice_fiscale,
        codice_redenzione: redemptionCode,
        prezzo_corrente: costoMensileCorrente,
        prezzo_proposto: prezzoProposto,
        risparmio_stimato: risparmioStimato,
        nome: validated.cliente.nome,
        cognome: validated.cliente.cognome,
        offerta: {
          nome: (offertaProposta.nome as string) || "Offerta Per Te",
          tipo: commodity === "luce" ? "energia" : "gas",
          cannot_beat: !!offertaProposta.cannot_beat,
          fornitore_attuale: validated.contratto.brand_commerciale || validated.contratto.societa_vendita || "",
          offerta_attuale: validated.contratto.nome_offerta || "",
          tipo_prezzo: matched?.offerta.tipo_prezzo || null,
          indice_riferimento: matched?.offerta.indice_riferimento || null,
          ccv_mensile: matched?.offerta.ccv_mensile || null,
          sconto_mese: (commodity === "luce" ? matched?.offerta.sconto_mese_luce : matched?.offerta.sconto_mese_gas) || null,
          dettagli_costo: matched?.dettagli || null,
        },
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Errore durante il salvataggio";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}