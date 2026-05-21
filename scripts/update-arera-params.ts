#!/usr/bin/env tsx
/**
 * update-arera-params.ts — Aggiorna i parametri ARERA/GME nel DB
 * 
 * Fonte: GME (Gestore Mercati Energetici) — mercatioelettrico.org
 * PUN: media mensile del Prezzo Unico Nazionale (elettricità)
 * PSV: media mensile del Prezzo di Scambio Virtuale (gas)
 * 
 * Periodicità ARERA/GME: i dati mensili sono disponibili entro i primi 5 giorni del mese successivo
 * Schedule consigliato: giorno 6 di ogni mese (cron: "0 6 6 * *")
 * 
 * Utilizzo:
 *   npx tsx scripts/update-arera-params.ts          # aggiornamento da GME API
 *   npx tsx scripts/update-arera-params.ts --fallback  # usa valori hardcoded come fallback
 */

import { createClient } from "@supabase/supabase-js";

// Config da env
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ── GME API endpoints ───────────────────────────────────────────────
// Il GME pubblica i dati tramite API REST e download CSV
// PUN: https://gme.mercatoelettrico.org/GmeWebApi/ApiDatiStorico/GetDatiStorico?tipoDato=PUN
// PSV: https://gme.mercatoelettrico.org/GmeWebApi/ApiDatiStorico/GetDatiStorico?tipoDato=PSV
// 
// Nota: il GME richiede accettazione condizioni — l'API potrebbe richiedere session cookie
// In alternativa, usare i feed ARERA che ripubblica i dati 

const GME_PUN_URL = "https://gme.mercatoelettrico.org/GmeWebApi/ApiDatiStorico/GetDatiStorico";
const GME_PSV_URL = "https://gme.mercatoelettrico.org/GmeWebApi/ApiDatiStorico/GetDatiStorico";

// ── ARERA Open Data (fallback) ──────────────────────────────────────
// ARERA pubblica i dati sul portale "Dati e Statistiche"
// URL: https://www.arera.it/it/dati/elettricita.htm
// I dati sono disponibili anche in formato CSV/JSON tramite API aperte

const ARERA_DATA_URL = "https://www.arera.it/allegati/dati/elettricita/pun_mensile.json";

interface MonthlyPrice {
  month: string; // YYYY-MM
  value: number; // €/kWh or €/Smc
}

/**
 * Fetch PUN mensile dal GME
 * Il GME pubblica i dati storici con cadenza giornaliera
 * Calcoliamo la media del mese precedente
 */
async function fetchPUNFromGME(): Promise<MonthlyPrice | null> {
  try {
    const now = new Date();
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const mese = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, "0")}`;
    
    // Tenta API GME
    const res = await fetch(`${GME_PUN_URL}?tipoDato=PUN&mese=${mese}`, {
      headers: { "Accept": "application/json" },
      signal: AbortSignal.timeout(10000),
    });
    
    if (!res.ok) {
      console.log(`GME API non disponibile (status ${res.status}), provo fallback...`);
      return null;
    }
    
    const data = await res.json();
    // La struttura varia — adattare in base alla risposta effettiva
    if (data?.media_mensile) {
      return { month: mese, value: data.media_mensile / 1000 }; // GME pubblica in €/MWh
    }
    
    return null;
  } catch (e) {
    console.log("Errore fetch PUN GME:", e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * Fetch PSV mensile dal GME
 */
async function fetchPSVFromGME(): Promise<MonthlyPrice | null> {
  try {
    const now = new Date();
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const mese = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, "0")}`;
    
    const res = await fetch(`${GME_PSV_URL}?tipoDato=PSV&mese=${mese}`, {
      headers: { "Accept": "application/json" },
      signal: AbortSignal.timeout(10000),
    });
    
    if (!res.ok) return null;
    
    const data = await res.json();
    if (data?.media_mensile) {
      return { month: mese, value: data.media_mensile }; // PSV già in €/Smc
    }
    
    return null;
  } catch (e) {
    console.log("Errore fetch PSV GME:", e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * Scrape PUN dalla homepage GME (dato giornaliero visibile)
 * Calcola la media dei prezzi giornalieri dell'ultimo mese
 */
async function fetchPUNFromGMEHomepage(): Promise<MonthlyPrice | null> {
  try {
    // La homepage del GME mostra il PUN del giorno in €/MWh
    // Per la media mensile servirebbe scansionare ogni giorno o usare i report
    // Questa è una soluzione semplificata che prende il valore corrente
    const res = await fetch("https://gme.mercatoelettrico.org/", {
      signal: AbortSignal.timeout(10000),
    });
    
    if (!res.ok) return null;
    
    const html = await res.text();
    // Parse PUN Index GME dal HTML
    const punMatch = html.match(/PUN Index GME[^0-9]*([0-9]+[,\.][0-9]+)/);
    if (punMatch) {
      const punMWh = parseFloat(punMatch[1].replace(",", "."));
      const punKWh = punMWh / 1000;
      const now = new Date();
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      return { month, value: punKWh };
    }
    
    return null;
  } catch (e) {
    console.log("Errore scrape GME:", e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * Valori fallback hardcoded — aggiornati manualmente quando le API non sono disponibili
 * Ultimo aggiornamento: 22/05/2026 da GME
 */
const FALLBACK_PUN = { month: "2026-05", value: 0.1112 }; // €/kWh (GME: 111.24 €/MWh)
const FALLBACK_PSV = { month: "2026-05", value: 0.43 };  // €/Smc

async function main() {
  const useFallback = process.argv.includes("--fallback");
  
  let punData: MonthlyPrice | null = null;
  let psvData: MonthlyPrice | null = null;
  
  if (!useFallback) {
    console.log("🔄 Tentativo fetch PUN/PSV da GME...");
    [punData, psvData] = await Promise.all([
      fetchPUNFromGME().catch(() => null),
      fetchPSVFromGME().catch(() => null),
    ]);
    
    // Se API GME fallisce, prova lo scrape della homepage
    if (!punData) {
      console.log("🔄 API GME non disponibile, provo homepage scrape...");
      punData = await fetchPUNFromGMEHomepage();
    }
  }
  
  // Applica fallback se necessario
  if (!punData) {
    console.log("⚠️ Uso valori fallback PUN");
    punData = FALLBACK_PUN;
  }
  if (!psvData) {
    console.log("⚠️ Uso valori fallback PSV");
    psvData = FALLBACK_PSV;
  }
  
  // Inserisci/aggiorna nel DB
  const mese = punData.month;
  
  console.log(`📊 Aggiornamento parametri ARERA per ${mese}:`);
  console.log(`   PUN: ${punData.value.toFixed(4)} €/kWh`);
  console.log(`   PSV: ${psvData.value.toFixed(4)} €/Smc`);
  
  // Upsert per luce
  const { error: errLuce } = await supabase
    .from("parametri_arera")
    .upsert({
      mese_riferimento: mese,
      commodity: "luce",
      pun_mensile: punData.value,
      fonte: "GME",
      aggiornato_at: new Date().toISOString(),
    }, { onConflict: "mese_riferimento,commodity" });
  
  if (errLuce) console.error("❌ Errore inserimento PUN:", errLuce.message);
  else console.log("✅ PUN inserito/aggiornato");
  
  // Upsert per gas
  const { error: errGas } = await supabase
    .from("parametri_arera")
    .upsert({
      mese_riferimento: mese,
      commodity: "gas",
      psv_mensile: psvData.value,
      fonte: "GME",
      aggiornato_at: new Date().toISOString(),
    }, { onConflict: "mese_riferimento,commodity" });
  
  if (errGas) console.error("❌ Errore inserimento PSV:", errGas.message);
  else console.log("✅ PSV inserito/aggiornato");
  
  console.log("🎉 Aggiornamento parametri ARERA completato");
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});