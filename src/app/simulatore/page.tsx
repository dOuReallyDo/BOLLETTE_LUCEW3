"use client";

import { useRef, useState } from "react";

// Consumer savings simulator — WINDTRE LUCE&GAS look & feel (conformed to the
// simulatore-bolletta-w3 POC). Reuses the existing /api/extract backend
// (Gemini + pdf2json) instead of client-side parsing.
//
// This is Fase A (graphic conformance) + upload/extraction. Charts (recharts),
// full savings model and lead capture land in the next increment.

type BillData = Record<string, unknown>;

function num(obj: BillData | null, ...keys: string[]): number | null {
  if (!obj) return null;
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "number" && isFinite(v)) return v;
  }
  // also look one level into "fornitura"
  const f = obj["fornitura"];
  if (f && typeof f === "object") {
    for (const k of keys) {
      const v = (f as BillData)[k];
      if (typeof v === "number" && isFinite(v)) return v;
    }
  }
  return null;
}

const euro = (n: number | null) =>
  n == null ? "—" : n.toLocaleString("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

type Kind = "luce" | "gas";

export default function SimulatorePage() {
  const [files, setFiles] = useState<Record<Kind, File | null>>({ luce: null, gas: null });
  const [privacy, setPrivacy] = useState(false);
  const [isWindtre, setIsWindtre] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Record<Kind, BillData | null> | null>(null);

  const inputs = { luce: useRef<HTMLInputElement>(null), gas: useRef<HTMLInputElement>(null) };

  const canSubmit = (files.luce || files.gas) && privacy && !loading;

  async function extract(file: File): Promise<BillData> {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/extract", { method: "POST", body: fd });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error || "Errore di analisi");
    return (json.data ?? json) as BillData;
  }

  async function handleAnalyze() {
    if (!canSubmit) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const out: Record<Kind, BillData | null> = { luce: null, gas: null };
      for (const kind of ["luce", "gas"] as Kind[]) {
        const f = files[kind];
        if (f) out[kind] = await extract(f);
      }
      setResult(out);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore durante l'analisi delle bollette");
    } finally {
      setLoading(false);
    }
  }

  // Rough savings teaser (placeholder until the full tariff model is wired):
  // a conservative % on the detected annual/period totals. Clearly labelled.
  const totLuce = result ? num(result.luce, "totale_bolletta", "totale_da_pagare") : null;
  const totGas = result ? num(result.gas, "totale_bolletta", "totale_da_pagare") : null;
  const totAttuale = (totLuce ?? 0) + (totGas ?? 0);
  const baseRate = isWindtre ? 0.2 : 0.15;
  const risparmioStimato = totAttuale > 0 ? Math.round(totAttuale * baseRate) : null;

  return (
    <main className="windtre min-h-screen">
      {/* Top bar */}
      <header className="border-b border-black/5 bg-white/80 backdrop-blur sticky top-0 z-20">
        <div className="mx-auto max-w-5xl px-5 h-16 flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <span className="text-[#ea580c] font-extrabold tracking-tight text-xl">WINDTRE</span>
            <span className="font-semibold text-[#0f172a]">LUCE<span className="text-[#00a9e0]">&amp;</span>GAS</span>
          </div>
          <span className="text-xs text-[var(--w3-muted)] hidden sm:block">Simulatore di risparmio</span>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-5 pt-12 pb-6 text-center">
        <span className="inline-block text-xs font-semibold uppercase tracking-wide text-[#ea580c] bg-[#fff7ed] rounded-full px-3 py-1 mb-4">
          Gratis · in alcuni secondi
        </span>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight">
          Scopri quanto puoi <span className="text-[#ea580c]">risparmiare</span>
          <br className="hidden sm:block" /> con le tariffe WINDTRE LUCE&amp;GAS
        </h1>
        <p className="mt-3 text-[var(--w3-muted)] max-w-xl mx-auto">
          Carica le tue bollette di luce e gas: analizziamo i consumi e calcoliamo il tuo
          risparmio potenziale con una tariffa trasparente.
        </p>
      </section>

      {/* Upload card */}
      <section className="mx-auto max-w-5xl px-5 pb-16">
        <div className="rounded-2xl border border-black/5 shadow-[0_10px_40px_rgba(0,0,0,0.06)] bg-white p-5 sm:p-7">
          <div className="grid sm:grid-cols-2 gap-4">
            {(["luce", "gas"] as Kind[]).map((kind) => {
              const isLuce = kind === "luce";
              const f = files[kind];
              return (
                <div key={kind} className="rounded-xl border border-black/10 overflow-hidden">
                  <div className={`${isLuce ? "w3-grad-luce" : "w3-grad-gas"} px-4 py-3 text-white flex items-center gap-2`}>
                    <span className="text-lg">{isLuce ? "⚡" : "🔥"}</span>
                    <span className="font-semibold">Bolletta {isLuce ? "LUCE" : "GAS"}</span>
                  </div>
                  <div className="p-4">
                    <input
                      ref={inputs[kind]}
                      type="file"
                      accept="application/pdf,image/*"
                      className="hidden"
                      onChange={(e) => setFiles((s) => ({ ...s, [kind]: e.target.files?.[0] ?? null }))}
                    />
                    {!f ? (
                      <button
                        onClick={() => inputs[kind].current?.click()}
                        className="w-full rounded-lg border-2 border-dashed border-black/15 hover:border-[#00a9e0] py-7 text-sm text-[var(--w3-muted)] transition-colors"
                      >
                        + Apri bolletta {isLuce ? "Luce" : "Gas"}
                        <span className="block text-xs mt-1 opacity-70">PDF o immagine</span>
                      </button>
                    ) : (
                      <div className="flex items-center justify-between rounded-lg bg-[#f0fdf4] border border-[#7bc043]/30 px-3 py-3">
                        <span className="text-sm truncate">📄 {f.name}</span>
                        <button
                          onClick={() => setFiles((s) => ({ ...s, [kind]: null }))}
                          className="text-xs text-[#dc2626] font-semibold ml-3 shrink-0"
                        >
                          Rimuovi
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Consents */}
          <div className="mt-5 space-y-2">
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={privacy} onChange={(e) => setPrivacy(e.target.checked)} className="mt-0.5 accent-[#ea580c]" />
              <span>
                Caricando i file accetti la nostra{" "}
                <a href="#" className="text-[#ea580c] underline">informativa privacy</a>.
              </span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={isWindtre} onChange={(e) => setIsWindtre(e.target.checked)} className="accent-[#ea580c]" />
              <span>Sono già <b>Cliente WINDTRE</b> (Mobile / Fibra) — sconto dedicato</span>
            </label>
          </div>

          {error && (
            <div className="mt-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">{error}</div>
          )}

          <button
            onClick={handleAnalyze}
            disabled={!canSubmit}
            className="mt-5 w-full w3-grad-brand text-white font-bold text-lg py-3.5 rounded-xl shadow-sm transition-all disabled:opacity-50"
          >
            {loading ? "Analizziamo i tuoi consumi…" : "Calcola il tuo risparmio"}
          </button>
          {!privacy && (files.luce || files.gas) && (
            <p className="text-xs text-[#dc2626] mt-2 text-center">Devi accettare l&apos;informativa privacy.</p>
          )}
        </div>

        {/* Result */}
        {result && (
          <div className="mt-8">
            <div className="rounded-2xl w3-grad-brand text-white p-6 text-center shadow-[0_10px_40px_rgba(249,115,22,0.25)]">
              <p className="text-sm/relaxed opacity-90">Risparmio annuo stimato</p>
              <p className="text-5xl font-extrabold mt-1">{risparmioStimato != null ? euro(risparmioStimato) : "—"}</p>
              <p className="text-xs opacity-80 mt-2">
                Stima indicativa{isWindtre ? " (sconto Cliente WINDTRE incluso)" : ""} · calcolo dettagliato in arrivo
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4 mt-4">
              {(["luce", "gas"] as Kind[]).map((kind) => {
                const d = result[kind];
                if (!d) return null;
                const consumo = num(d, "consumo_annuo", "consumo_fatturato");
                const totale = num(d, "totale_bolletta", "totale_da_pagare");
                const isLuce = kind === "luce";
                return (
                  <div key={kind} className="rounded-xl border border-black/10 p-4">
                    <div className="flex items-center gap-2 font-semibold mb-3">
                      <span>{isLuce ? "⚡" : "🔥"}</span>
                      <span>{isLuce ? "Energia Elettrica" : "Gas Naturale"}</span>
                      <span className="ml-auto text-xs text-[#16a34a]">✓ analizzata</span>
                    </div>
                    <dl className="text-sm space-y-1.5">
                      <div className="flex justify-between">
                        <dt className="text-[var(--w3-muted)]">Consumo annuo</dt>
                        <dd className="font-medium">{consumo != null ? `${consumo.toLocaleString("it-IT")} ${isLuce ? "kWh" : "Smc"}` : "—"}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-[var(--w3-muted)]">Totale bolletta</dt>
                        <dd className="font-medium">{euro(totale)}</dd>
                      </div>
                    </dl>
                  </div>
                );
              })}
            </div>

            {/* Conversion CTA */}
            <div className="mt-6 text-center">
              <button className="w3-grad-brand text-white font-bold px-8 py-3.5 rounded-xl shadow-sm">
                Attiva l&apos;Offerta Online!
              </button>
              <p className="text-xs text-[var(--w3-muted)] mt-2">Attivazione rapida senza interruzioni</p>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
