/**
 * BillScan POC — Offerta matching & cost estimation (v3 — DB-driven ARERA params)
 *
 * Logic:
 * 1. Fetch latest ARERA params from DB (PUN, PSV, trasporto, oneri, accise, IVA)
 * 2. Query Supabase "offerte" table filtered by commodity (gas/luce) and attivo=true
 * 3. Pick the best matching offerta based on the user's current contract type
 * 4. Estimate the monthly cost using real spread/CCV from the offerta + live ARERA params
 * 5. Apply sconto multiservice if present
 * 6. Compare with the current monthly cost to compute savings
 */

import { supabaseAdmin } from "@/lib/supabase/client";
import type { Offerta } from "@/lib/types/schema";

// ── Fallback defaults (used only if DB has no params yet) ──────────
const DEFAULT_PUN_KWH = 0.1112;    // €/kWh (GME 22/05/2026)
const DEFAULT_PSV_SMC = 0.43;      // €/Smc
const DEFAULT_TRASPORTO_LUCE_KWH = 0.028;
const DEFAULT_TRASPORTO_GAS_SMC = 0.042;
const DEFAULT_FISSA_TRASPORTO_LUCE = 8.50;
const DEFAULT_FISSA_TRASPORTO_GAS = 6.00;
const DEFAULT_ONERI_LUCE_KWH = 0.035;
const DEFAULT_ONERI_GAS_SMC = 0.007;
const DEFAULT_ACCISA_LUCE_KWH = 0.022;
const DEFAULT_ACCISA_GAS_SMC = 0.018;
const DEFAULT_IVA_ENERGIA = 0.10;
const DEFAULT_IVA_ALTRI = 0.22;

// ── ARERA params from DB ────────────────────────────────────────
interface AreraParams {
  pun_kwh: number;
  psv_smc: number;
  trasporto_luce_kwh: number;
  trasporto_gas_smc: number;
  fissa_trasporto_luce: number;
  fissa_trasporto_gas: number;
  oneri_luce_kwh: number;
  oneri_gas_smc: number;
  accisa_luce_kwh: number;
  accisa_gas_smc: number;
  iva_energia: number;
  iva_altri: number;
}

async function getAreraParams(): Promise<AreraParams> {
  try {
    const { data, error } = await supabaseAdmin
      .from("parametri_arera")
      .select("*")
      .order("mese_riferimento", { ascending: false })
      .limit(2);

    if (error || !data || data.length === 0) {
      console.log("⚠️ No ARERA params in DB, using defaults");
      return getDefaults();
    }

    const luceRow = data.find((r: Record<string, unknown>) => r.commodity === "luce");
    const gasRow = data.find((r: Record<string, unknown>) => r.commodity === "gas");
    // Se c'è una riga "comune" con trasporto/oneri/accise, usala; altrimenti prendi dalla riga luce
    const commonRow = data.find((r: Record<string, unknown>) => r.commodity === "comune") || luceRow;

    return {
      pun_kwh: Number(luceRow?.pun_mensile) || DEFAULT_PUN_KWH,
      psv_smc: Number(gasRow?.psv_mensile) || DEFAULT_PSV_SMC,
      trasporto_luce_kwh: Number(commonRow?.trasporto_luce_kwh) || DEFAULT_TRASPORTO_LUCE_KWH,
      trasporto_gas_smc: Number(commonRow?.trasporto_gas_smc) || DEFAULT_TRASPORTO_GAS_SMC,
      fissa_trasporto_luce: Number(commonRow?.quota_fissa_trasporto_luce) || DEFAULT_FISSA_TRASPORTO_LUCE,
      fissa_trasporto_gas: Number(commonRow?.quota_fissa_trasporto_gas) || DEFAULT_FISSA_TRASPORTO_GAS,
      oneri_luce_kwh: Number(commonRow?.oneri_luce_kwh) || DEFAULT_ONERI_LUCE_KWH,
      oneri_gas_smc: Number(commonRow?.oneri_gas_smc) || DEFAULT_ONERI_GAS_SMC,
      accisa_luce_kwh: Number(commonRow?.accisa_luce_kwh) || DEFAULT_ACCISA_LUCE_KWH,
      accisa_gas_smc: Number(commonRow?.accisa_gas_smc) || DEFAULT_ACCISA_GAS_SMC,
      iva_energia: Number(commonRow?.iva_energia) || DEFAULT_IVA_ENERGIA,
      iva_altri: Number(commonRow?.iva_altri) || DEFAULT_IVA_ALTRI,
    };
  } catch {
    return getDefaults();
  }
}

function getDefaults(): AreraParams {
  return {
    pun_kwh: DEFAULT_PUN_KWH,
    psv_smc: DEFAULT_PSV_SMC,
    trasporto_luce_kwh: DEFAULT_TRASPORTO_LUCE_KWH,
    trasporto_gas_smc: DEFAULT_TRASPORTO_GAS_SMC,
    fissa_trasporto_luce: DEFAULT_FISSA_TRASPORTO_LUCE,
    fissa_trasporto_gas: DEFAULT_FISSA_TRASPORTO_GAS,
    oneri_luce_kwh: DEFAULT_ONERI_LUCE_KWH,
    oneri_gas_smc: DEFAULT_ONERI_GAS_SMC,
    accisa_luce_kwh: DEFAULT_ACCISA_LUCE_KWH,
    accisa_gas_smc: DEFAULT_ACCISA_GAS_SMC,
    iva_energia: DEFAULT_IVA_ENERGIA,
    iva_altri: DEFAULT_IVA_ALTRI,
  };
}

export interface MatchedOfferta {
  offerta: Offerta;
  costo_mensile_stimato: number;
  risparmio_mensile: number;
  cannot_beat: boolean;
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
 */
export async function findBestOfferta(
  commodity: "luce" | "gas",
  consumoMensile: number,
  totaleMensileCorrente: number,
  tipoPrezzoCorrente?: string
): Promise<MatchedOfferta | null> {
  // 0. Fetch live ARERA params from DB
  const params = await getAreraParams();

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
    const result = estimateMonthlyCost(offerta, commodity, consumoMensile, params);
    const risparmio = Math.max(0, totaleMensileCorrente - result.costo_mensile_stimato);
    return {
      offerta,
      costo_mensile_stimato: result.costo_mensile_stimato,
      risparmio_mensile: risparmio,
      cannot_beat: result.costo_mensile_stimato >= totaleMensileCorrente,
      dettagli: result.dettagli,
    };
  });

  // 3. Sort by savings desc, prefer multiservice tiebreaker
  const eligible = candidates.filter(
    (c) => c.risparmio_mensile > 0 || c.costo_mensile_stimato <= totaleMensileCorrente
  );

  const pool = eligible.length > 0 ? eligible : candidates;
  pool.sort((a, b) => {
    if (b.risparmio_mensile !== a.risparmio_mensile) {
      return b.risparmio_mensile - a.risparmio_mensile;
    }
    const scontoA = getMonthlyDiscount(a.offerta) || 0;
    const scontoB = getMonthlyDiscount(b.offerta) || 0;
    if (scontoB !== scontoA) return scontoB - scontoA;
    return a.costo_mensile_stimato - b.costo_mensile_stimato;
  });

  const best = pool[0];
  if (eligible.length === 0) {
    best.risparmio_mensile = Math.max(0, totaleMensileCorrente - best.costo_mensile_stimato);
    best.cannot_beat = true;
  }

  return best;
}

function getMonthlyDiscount(offerta: Offerta): number | null {
  if (offerta.commodity === "luce") return offerta.sconto_mese_luce ?? null;
  return offerta.sconto_mese_gas ?? null;
}

/**
 * Estimate the monthly cost using live ARERA params from DB.
 */
function estimateMonthlyCost(
  offerta: Offerta,
  commodity: "luce" | "gas",
  consumoMensile: number,
  params: AreraParams
) {
  const isLuce = commodity === "luce";
  const consumption = Math.max(consumoMensile, 1);

  // ── 1. Quota energia ──────────────────────────────────────
  let prezzoEnergiaPerUnita: number;

  if (offerta.tipo_prezzo === "fisso") {
    prezzoEnergiaPerUnita = isLuce
      ? params.pun_kwh * 1.05
      : params.psv_smc * 1.05;
  } else {
    const spread = isLuce
      ? (offerta.corr_var_lordo_eur_kwh ?? 0)
      : (offerta.corr_var_eur_smc ?? 0);
    prezzoEnergiaPerUnita = (isLuce ? params.pun_kwh : params.psv_smc) + spread;
  }

  const prezzoEnergiaMensile = prezzoEnergiaPerUnita * consumption;

  // ── 2. CCV ─────────────────────────────────────────────────
  const ccvMensile = offerta.ccv_mensile ?? (offerta.ccv_annuo ? offerta.ccv_annuo / 12 : isLuce ? 6.0 : 4.5);

  // ── 3. Trasporto e gestione (from DB) ──────────────────────
  const trasportoMensile = isLuce
    ? params.trasporto_luce_kwh * consumption + params.fissa_trasporto_luce
    : params.trasporto_gas_smc * consumption + params.fissa_trasporto_gas;

  // ── 4. Oneri (from DB) ──────────────────────────────────────
  const oneriMensile = isLuce
    ? params.oneri_luce_kwh * consumption
    : params.oneri_gas_smc * consumption;

  // ── 5. Accise (from DB) ─────────────────────────────────────
  const accisaMensile = isLuce
    ? params.accisa_luce_kwh * consumption
    : params.accisa_gas_smc * consumption;

  // ── 6. IVA (from DB) ────────────────────────────────────────
  const imponibileEnergia = prezzoEnergiaMensile + ccvMensile;
  const ivaEnergia = imponibileEnergia * params.iva_energia;
  const imponibileAltri = trasportoMensile + oneriMensile + accisaMensile;
  const ivaAltri = imponibileAltri * params.iva_altri;
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
    totale_calcolato: 0,
  };

  dettagli.totale_calcolato = Math.max(0, Math.round(
    (dettagli.prezzo_energia_mensile +
     dettagli.ccv_mensile -
     dettagli.sconto_mese +
     dettagli.trasporto_mensile +
     dettagli.oneri_mensile +
     dettagli.accise_mensile +
     dettagli.iva_totale) * 100
  ) / 100);

  return {
    costo_mensile_stimato: dettagli.totale_calcolato,
    dettagli,
  };
}

/**
 * Compute the monthly bill amount from the bolletta data.
 */
export function computeMonthlyBillAmount(
  totaleDaPagare: number,
  periodoDal?: string,
  periodoAl?: string
): number {
  if (!periodoDal || !periodoAl) {
    return Math.round((totaleDaPagare / 2) * 100) / 100;
  }
  const start = new Date(periodoDal);
  const end = new Date(periodoAl);
  const daysDiff = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
  const months = Math.max(daysDiff / 30, 1);
  return Math.round((totaleDaPagare / months) * 100) / 100;
}

/**
 * Compute monthly consumption.
 */
export function computeMonthlyConsumption(
  consumoAnnuo?: number,
  consumoFatturato?: number,
  periodoDal?: string,
  periodoAl?: string
): number {
  if (consumoAnnuo && consumoAnnuo > 0) {
    return Math.round((consumoAnnuo / 12) * 100) / 100;
  }
  if (consumoFatturato && consumoFatturato > 0 && periodoDal && periodoAl) {
    const start = new Date(periodoDal);
    const end = new Date(periodoAl);
    const days = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    const months = Math.max(days / 30, 1);
    return Math.round((consumoFatturato / months) * 100) / 100;
  }
  if (consumoFatturato && consumoFatturato > 0) {
    return Math.round((consumoFatturato / 2) * 100) / 100;
  }
  return 150;
}