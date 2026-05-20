/**
 * BillScan POC — Offerta matching & cost estimation (v2 — Excel May 2026)
 *
 * Logic:
 * 1. Query Supabase "offerte" table filtered by commodity (gas/luce) and attivo=true
 * 2. Pick the best matching offerta based on the user's current contract type
 * 3. Estimate the monthly cost using real spread/CCV from the offerta
 * 4. Apply sconto multiservice if present
 * 5. Compare with the current monthly cost to compute savings
 */

import { supabaseAdmin } from "@/lib/supabase/client";
import type { Offerta } from "@/lib/types/schema";

// ── Reference prices (ARERA PUN/PSV monthly averages for estimation) ──────
// These are the commodity indices used in variable-price offers.
// Updated periodically from ARERA/GME data.
const PUN_MENSILE_KWH = 0.125; // ~€/kWh average PUN (electricity)
const PSV_MENSILE_SMC = 0.45;  // ~€/Smc average PSV (gas)

// ── Quota trasporto & gestione (ARERA) ─────────────────────────────────────
const TRASPORTO_GESTIONE_LUCE_KWH = 0.028; // €/kWh
const TRASPORTO_GESTIONE_GAS_SMC = 0.042; // €/Smc

// ── Quota oneri di sistema ─────────────────────────────────────────────────
const ONERI_LUCE_KWH = 0.035; // €/kWh (approximate for domestic)
const ONERI_GAS_SMC = 0.007;  // €/Smc

// ── VAT ──────────────────────────────────────────────────────────────────────
const IVA_ENERGIA = 0.10; // 10% on energy for domestic
const IVA_ALTRI = 0.22;   // 22% on transport/oneri for domestic

export interface MatchedOfferta {
  offerta: Offerta;
  costo_mensile_stimato: number;
  risparmio_mensile: number;
  dettagli: {
    prezzo_energia_mensile: number;
    ccv_mensile: number;
    sconto_mese: number;
    trasporto_mensile: number;
    oneri_mensile: number;
    accise_mensile: number;
    iva_totale: number;
    totale_calcolato: number;
  };
}

/**
 * Find the best FornitoreA offerta for a given bill and estimate savings.
 *
 * Strategy:
 * - If the user is on a "tutela" contract → offer a PLACET or mercato libero
 * - If the user is on a "variabile" contract → prefer an offer with lower spread
 * - If the user is on a "fisso" contract → offer a "variabile" (typically cheaper)
 * - Always prefer the offer that gives the highest savings
 * - Prefer multiservice discounts (sconto_mese) when available
 *
 * Falls back to the cheapest offer if no savings found.
 */
export async function findBestOfferta(
  commodity: "luce" | "gas",
  consumoMensile: number, // in Smc or kWh
  totaleMensileCorrente: number, // what the user currently pays per month
  tipoPrezzoCorrente?: string, // "fisso" | "variabile" | "monorario" | "tutela"
): Promise<MatchedOfferta | null> {
  // 1. Fetch active offerte for this commodity
  const { data: offerte, error } = await supabaseAdmin
    .from("offerte")
    .select("*")
    .eq("commodity", commodity)
    .eq("attivo", true);

  if (error || !offerte || offerte.length === 0) {
    return null;
  }

  // 2. Score each offer and compute estimated monthly cost
  const candidates: MatchedOfferta[] = offerte.map((offerta: Offerta) => {
    const result = estimateMonthlyCost(offerta, commodity, consumoMensile);
    const risparmio = Math.max(0, totaleMensileCorrente - result.costo_mensile_stimato);
    return {
      offerta,
      costo_mensile_stimato: result.costo_mensile_stimato,
      risparmio_mensile: risparmio,
      dettagli: result.dettagli,
    };
  });

  // 3. Sort by savings desc, then by lowest cost
  // Prefer multiservice (sconto_mese) as tiebreaker
  const eligible = candidates.filter(
    (c) => c.risparmio_mensile > 0 || c.costo_mensile_stimato <= totaleMensileCorrente
  );

  const pool = eligible.length > 0 ? eligible : candidates;

  pool.sort((a, b) => {
    if (b.risparmio_mensile !== a.risparmio_mensile) {
      return b.risparmio_mensile - a.risparmio_mensile;
    }
    // Tiebreaker: prefer offers with multiservice discount
    const scontoA = getMonthlyDiscount(a.offerta) || 0;
    const scontoB = getMonthlyDiscount(b.offerta) || 0;
    if (scontoB !== scontoA) return scontoB - scontoA;
    return a.costo_mensile_stimato - b.costo_mensile_stimato;
  });

  const best = pool[0];
  // Recalculate savings if all offers are more expensive
  if (eligible.length === 0) {
    best.risparmio_mensile = Math.max(0, totaleMensileCorrente - best.costo_mensile_stimato);
  }

  return best;
}

/**
 * Get the monthly discount (sconto multiservice) for an offerta.
 */
function getMonthlyDiscount(offerta: Offerta): number | null {
  if (offerta.commodity === "luce") return offerta.sconto_mese_luce ?? null;
  return offerta.sconto_mese_gas ?? null;
}

/**
 * Estimate the monthly cost for a given offerta and consumption level.
 *
 * Uses real spread from the offerta data (corr_var_lordo_eur_kwh / corr_var_eur_smc)
 * and real CCV (ccv_mensile from the offerte table).
 *
 * Structure of an Italian energy bill (simplified):
 *   1. Quota energia (PUN/PSV + spread × consumo + CCV)
 *   2. Quota trasporto e gestione contatore (ARERA regulated)
 *   3. Quota oneri di sistema (ARERA regulated)
 *   4. Imposte (accise)
 *   5. IVA
 *   6. Sconto multiservice (se presente)
 */
function estimateMonthlyCost(
  offerta: Offerta,
  commodity: "luce" | "gas",
  consumoMensile: number
) {
  const isLuce = commodity === "luce";
  const consumption = Math.max(consumoMensile, 1); // avoid zero

  // ── 1. Quota energia ──────────────────────────────────────
  let prezzoEnergiaPerUnita: number;

  if (offerta.tipo_prezzo === "fisso") {
    // For fixed offers, use a slight premium over variable
    prezzoEnergiaPerUnita = isLuce
      ? PUN_MENSILE_KWH * 1.05
      : PSV_MENSILE_SMC * 1.05;
  } else {
    // variabile or tutela: PUN/PSV + real spread from offerta
    const spread = isLuce
      ? (offerta.corr_var_lordo_eur_kwh ?? 0)
      : (offerta.corr_var_eur_smc ?? 0);
    prezzoEnergiaPerUnita = (isLuce ? PUN_MENSILE_KWH : PSV_MENSILE_SMC) + spread;
  }

  const prezzoEnergiaMensile = prezzoEnergiaPerUnita * consumption;

  // ── 2. CCV (Costi Commercializzazione Vendita) ─────────────
  const ccvMensile = offerta.ccv_mensile ?? (offerta.ccv_annuo ? offerta.ccv_annuo / 12 : isLuce ? 6.0 : 4.5);

  // ── 3. Quota trasporto e gestione ───────────────────────────
  const trasportoMensile = isLuce
    ? TRASPORTO_GESTIONE_LUCE_KWH * consumption + 8.5 // quota fissa ~€8.50/mese
    : TRASPORTO_GESTIONE_GAS_SMC * consumption + 6.0; // quota fissa ~€6.00/mese

  // ── 4. Oneri di sistema ─────────────────────────────────────
  const oneriMensile = isLuce
    ? ONERI_LUCE_KWH * consumption
    : ONERI_GAS_SMC * consumption;

  // ── 5. Accise (semplificate) ────────────────────────────────
  const accisaMensile = isLuce
    ? 0.022 * consumption // ~€0.022/kWh accisa energia
    : 0.018 * consumption; // ~€0.018/Smc accisa gas (sopra soglia minimi)

  // ── 6. IVA ──────────────────────────────────────────────────
  const imponibileEnergia = prezzoEnergiaMensile + ccvMensile;
  const ivaEnergia = imponibileEnergia * IVA_ENERGIA;
  const imponibileAltri = trasportoMensile + oneriMensile + accisaMensile;
  const ivaAltri = imponibileAltri * IVA_ALTRI;
  const ivaTotale = ivaEnergia + ivaAltri;

  // ── 7. Sconto multiservice ──────────────────────────────────
  const scontoMultiservice = getMonthlyDiscount(offerta) ?? 0;

  const dettagli = {
    prezzo_energia_mensile: Math.round(prezzoEnergiaMensile * 100) / 100,
    ccv_mensile: Math.round(ccvMensile * 100) / 100,
    sconto_mese: Math.round(scontoMultiservice * 100) / 100,
    trasporto_mensile: Math.round(trasportoMensile * 100) / 100,
    oneri_mensile: Math.round(oneriMensile * 100) / 100,
    accise_mensile: Math.round(accisaMensile * 100) / 100,
    iva_totale: Math.round(ivaTotale * 100) / 100,
    totale_calcolato: 0, // placeholder, computed below
  };

  // Totale = somma delle righe visibili (lo sconto è già detratto)
  dettagli.totale_calcolato = Math.max(0, Math.round(
    (dettagli.prezzo_energia_mensile +
     dettagli.ccv_mensile -
     dettagli.sconto_mese +
     dettagli.trasporto_mensile +
     dettagli.oneri_mensile +
     dettagli.accise_mensile +
     dettagli.iva_totale) * 100
  ) / 100);

  const costoMensile = dettagli.totale_calcolato;

  return {
    costo_mensile_stimato: costoMensile,
    dettagli,
  };
}

/**
 * Compute the monthly bill amount from the bolletta data.
 * Uses the period to annualize and then monthlyize.
 * Falls back to totale_da_pagare if the period is not available.
 */
export function computeMonthlyBillAmount(
  totaleDaPagare: number,
  periodoDal?: string,
  periodoAl?: string
): number {
  if (!periodoDal || !periodoAl) {
    // Assume bimestral bill (most common in Italy)
    return Math.round((totaleDaPagare / 2) * 100) / 100;
  }

  const start = new Date(periodoDal);
  const end = new Date(periodoAl);
  const daysDiff = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
  const months = Math.max(daysDiff / 30, 1);

  return Math.round((totaleDaPagare / months) * 100) / 100;
}

/**
 * Compute monthly consumption from annual consumption.
 * If only totale_da_pagare and unit are available, estimate from the bill.
 */
export function computeMonthlyConsumption(
  consumoAnnuo?: number,
  consumoFatturato?: number,
  periodoDal?: string,
  periodoAl?: string
): number {
  // Prefer annualized consumption divided by 12
  if (consumoAnnuo && consumoAnnuo > 0) {
    return Math.round((consumoAnnuo / 12) * 100) / 100;
  }

  // Fall back to bill-period consumption monthlyized
  if (consumoFatturato && consumoFatturato > 0 && periodoDal && periodoAl) {
    const start = new Date(periodoDal);
    const end = new Date(periodoAl);
    const days = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    const months = Math.max(days / 30, 1);
    return Math.round((consumoFatturato / months) * 100) / 100;
  }

  // Last resort: assume bimestral
  if (consumoFatturato && consumoFatturato > 0) {
    return Math.round((consumoFatturato / 2) * 100) / 100;
  }

  // Sensible defaults for estimation
  return 150; // 150 kWh/mese (luce) or 30 Smc/mese (gas) average domestic
}