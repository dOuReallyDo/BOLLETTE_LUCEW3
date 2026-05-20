"use client";

import { useState, useCallback } from "react";
import type { ValidatedBillData } from "@/lib/extraction/validation";
import jsPDF from "jspdf";

type Step = "upload" | "processing" | "confirm" | "proposal";

export default function Home() {
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [extractedData, setExtractedData] = useState<ValidatedBillData | null>(null);
  const [editedData, setEditedData] = useState<ValidatedBillData | null>(null);
  const [storagePath, setStoragePath] = useState("");
  const [error, setError] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [proposal, setProposal] = useState<{
    codice_fiscale: string;
    codice_redenzione: string;
    prezzo_corrente: number;
    prezzo_proposto: number;
    risparmio_stimato: number;
    offerta: {
      nome: string;
      tipo: string;
      fornitore_attuale: string;
      offerta_attuale: string;
      tipo_prezzo?: string | null;
      indice_riferimento?: string | null;
      ccv_mensile?: number | null;
      dettagli_costo?: {
        prezzo_energia_mensile: number;
        ccv_mensile: number;
        trasporto_mensile: number;
        oneri_mensile: number;
        iva_totale: number;
      } | null;
    };
    nome: string;
    cognome: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [userEmail, setUserEmail] = useState("");

  const handleUpload = useCallback(async (f: File) => {
    setFile(f);
    setStep("processing");
    setError("");
    setUploadProgress(0);

    const formData = new FormData();
    formData.append("file", f);

    try {
      const xhr = new XMLHttpRequest();

      const result = await new Promise<{ data: ValidatedBillData; storagePath: string; fileName: string; mimeType: string }>((resolve, reject) => {
        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100);
            setUploadProgress(pct);
          }
        });

        xhr.addEventListener("load", () => {
          try {
            const json = JSON.parse(xhr.responseText);
            if (xhr.status >= 400) {
              reject(new Error(json.error || "Errore durante l'estrazione"));
            } else {
              resolve(json);
            }
          } catch {
            reject(new Error("Risposta non valida dal server"));
          }
        });

        xhr.addEventListener("error", () => reject(new Error("Errore di connessione")));
        xhr.open("POST", "/api/extract");
        xhr.send(formData);
      });

      setExtractedData(result.data);
      setEditedData(result.data);
      setStoragePath(result.storagePath);
      setUserEmail(result.data.cliente?.email_contatto_bolletta || "");
      setStep("confirm");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore durante l'upload");
      setStep("upload");
    }
  }, []);
  const handleConfirm = async () => {
    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: editedData,
          storagePath,
          fileName: file?.name,
          mimeType: file?.type,
          userEmail: "",
        }),
      });
      const json = await res.json();

      if (!res.ok) {
        setError(json.error || "Errore durante il salvataggio");
        setSaving(false);
        return;
      }

      setProposal(json.proposal);
      setStep("proposal");
    } catch {
      setError("Errore di connessione");
    } finally {
      setSaving(false);
    }
  };

  const updateField = (path: string, value: string) => {
    if (!editedData) return;
    const keys = path.split(".");
    const newData = JSON.parse(JSON.stringify(editedData));
    let obj: Record<string, unknown> = newData;
    for (let i = 0; i < keys.length - 1; i++) {
      obj = obj[keys[i]] as Record<string, unknown>;
    }
    obj[keys[keys.length - 1]] = value;
    setEditedData(newData);
  };

  const downloadPDF = () => {
    if (!proposal || !editedData) return;
    const p = proposal;
    const d = editedData;
    const tipo = d.fornitura.tipo_fornitura === "luce" ? "Energia Elettrica" : "Gas Naturale";

    const html = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Proposta FornitoreA Luce & Gas</title>
<style>
  body { font-family: Arial, sans-serif; margin: 40px; color: #1a1a2e; }
  .header { background: linear-gradient(135deg, #FF6B00, #FF8C42); color: white; padding: 30px; border-radius: 12px; margin-bottom: 30px; text-align: center; }
  .header h1 { margin: 0; font-size: 24px; }
  .header p { margin: 5px 0 0; opacity: 0.9; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
  .card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; }
  .card.oggi { background: #fef2f2; border-color: #fca5a5; }
  .card.fornitorea { background: #f0fdf4; border-color: #86efac; }
  .card h3 { margin: 0 0 10px; font-size: 14px; }
  .card .price { font-size: 32px; font-weight: bold; }
  .card.oggi .price { color: #dc2626; }
  .card.fornitorea .price { color: #16a34a; }
  .savings { background: #fff7ed; border: 2px solid #FF6B00; border-radius: 8px; padding: 25px; text-align: center; margin-bottom: 30px; }
  .savings .amount { font-size: 48px; font-weight: bold; color: #FF6B00; }
  .savings .label { font-size: 16px; color: #666; }
  .details { border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 30px; }
  .details h3 { margin: 0 0 15px; }
  .details table { width: 100%; border-collapse: collapse; }
  .details td { padding: 8px 0; border-bottom: 1px solid #f3f4f6; }
  .details td:first-child { color: #6b7280; width: 50%; }
  .details td:last-child { font-weight: 500; text-align: right; }
  .code { background: #1a1a2e; color: white; text-align: center; padding: 20px; border-radius: 8px; margin-top: 30px; }
  .code .label { font-size: 12px; opacity: 0.7; margin-bottom: 5px; }
  .code .value { font-size: 32px; font-weight: bold; letter-spacing: 8px; }
  .footer { text-align: center; margin-top: 40px; color: #9ca3af; font-size: 11px; }
  @media print { body { margin: 20px; } }
</style></head><body>
  <div class="header">
    <h1>FornitoreA Luce & Gas</h1>
    <p>Proposta personalizzata per ${p.nome} ${p.cognome}</p>
  </div>
  <div class="grid">
    <div class="card oggi">
      <h3>Oggi paghi</h3>
      <div class="price">&euro;${p.prezzo_corrente.toFixed(2)}/mese</div>
      <p style="font-size:12px;color:#666">${p.offerta.fornitore_attuale} &mdash; ${p.offerta.offerta_attuale}</p>
    </div>
    <div class="card fornitorea">
      <h3>Con FornitoreA paghi</h3>
      <div class="price">&euro;${p.prezzo_proposto.toFixed(2)}/mese</div>
      <p style="font-size:12px;color:#666">${p.offerta.nome}</p>
    </div>
  </div>
  <div class="savings">
    <div class="label">Risparmio stimato</div>
    <div class="amount">&euro;${p.risparmio_stimato.toFixed(2)}/mese</div>
  </div>
  <div class="details">
    <h3>Dettagli fornitura</h3>
    <table>
      <tr><td>Tipo</td><td>${tipo}</td></tr>
      <tr><td>POD/PDR</td><td>${d.fornitura.codice_punto}</td></tr>
      <tr><td>Indirizzo</td><td>${d.fornitura.indirizzo_fornitura || ""}, ${d.fornitura.comune || ""} (${d.fornitura.provincia || ""})</td></tr>
      <tr><td>Fornitore attuale</td><td>${p.offerta.fornitore_attuale}</td></tr>
      <tr><td>Offerta attuale</td><td>${p.offerta.offerta_attuale}</td></tr>
      <tr><td>Consumo annuo</td><td>${d.bolletta.consumo_annuo || ""} ${d.bolletta.unita_consumo || ""}</td></tr>
    </table>
  </div>
  <div class="code">
    <div class="label">Codice personale della proposta</div>
    <div class="value">${p.codice_redenzione}</div>
  </div>
  <div class="footer">
    FornitoreA Luce&Gas &mdash; POC dimostrativo interno &mdash; Proposta non vincolante<br>
    Codice valido per 30 giorni
  </div>
</body></html>`;

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `proposta-fornitorea-${p.codice_redenzione}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1a1a2e] to-[#16213e]">
      {/* Header */}
      <header className="bg-[#FF6B00] py-5 px-6 shadow-lg">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <img src="/fornitorea-logo.jpg" alt="FornitoreA Luce & Gas" className="h-10 w-auto rounded" />
          <div>
            <h1 className="text-white font-bold text-xl leading-tight">FornitoreA Luce & Gas</h1>
            <p className="text-orange-100 text-xs">Scopri quanto puoi risparmiare</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        {error && (
          <div className="bg-red-500/20 border border-red-400 text-red-200 p-4 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Step 1: Upload */}
        {step === "upload" && (
          <div className="bg-white/10 backdrop-blur rounded-2xl p-8 text-center">
            <h2 className="text-white text-2xl font-bold mb-2">
              Carica la tua bolletta
            </h2>
            <p className="text-gray-300 mb-8">
              Carica il PDF o una foto della tua bolletta luce o gas e scopri quanto puoi risparmiare
            </p>
            <label
              className={`block border-2 border-dashed rounded-xl p-12 cursor-pointer transition-all ${
                dragActive
                  ? "border-[#FF6B00] bg-[#FF6B00]/10"
                  : "border-gray-500 hover:border-[#FF6B00] hover:bg-white/5"
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragActive(false);
                if (e.dataTransfer.files[0]) handleUpload(e.dataTransfer.files[0]);
              }}
            >
              <input
                type="file"
                accept=".pdf,image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
              />
              <div className="text-5xl mb-4">📄</div>
              <p className="text-white font-semibold mb-1">
                Trascina qui la tua bolletta
              </p>
              <p className="text-gray-400 text-sm">
                oppure clicca per selezionare un file (PDF, JPG, PNG)
              </p>
            </label>
            <p className="text-gray-500 text-xs mt-6">
              I tuoi dati sono al sicuro — usati solo per preparare la proposta
            </p>
          </div>
        )}

        {/* Step 2: Processing */}
        {step === "processing" && (
          <div className="bg-white/10 backdrop-blur rounded-2xl p-12 text-center">
            <div className="mb-8">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-[#FF6B00]/20 flex items-center justify-center">
                <svg className="w-10 h-10 text-[#FF6B00] animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h2 className="text-white text-xl font-bold mb-2">
                Sto leggendo la tua bolletta…
              </h2>
              <p className="text-gray-300 text-sm mb-8">
                Analizziamo i dati per trovare l&apos;offerta migliore per te
              </p>
              <div className="max-w-sm mx-auto">
                <div className="flex justify-between text-xs text-gray-400 mb-2">
                  <span>Caricamento</span>
                  <span>Analisi in corso</span>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-[#FF6B00] to-[#FF8C42] rounded-full animate-progress" />
                </div>
                <div className="mt-4 flex items-center justify-center gap-2 text-gray-400 text-xs">
                  <span className="inline-block w-1.5 h-1.5 bg-[#FF6B00] rounded-full animate-bounce" style={{animationDelay: "0ms"}} />
                  <span className="inline-block w-1.5 h-1.5 bg-[#FF6B00] rounded-full animate-bounce" style={{animationDelay: "150ms"}} />
                  <span className="inline-block w-1.5 h-1.5 bg-[#FF6B00] rounded-full animate-bounce" style={{animationDelay: "300ms"}} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Confirm data */}
        {step === "confirm" && editedData && (
          <div className="bg-white/10 backdrop-blur rounded-2xl p-8">
            <h2 className="text-white text-xl font-bold mb-6">
              Conferma i tuoi dati
            </h2>
            <p className="text-gray-300 text-sm mb-6">
              Abbiamo estratto questi dati dalla bolletta. Controllali e correggi se necessario.
            </p>

            {/* Cliente */}
            <div className="bg-white/5 rounded-xl p-5 mb-4">
              <h3 className="text-[#FF6B00] font-semibold mb-3">👤 Intestatario</h3>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Nome" value={editedData.cliente.nome} onChange={(v) => updateField("cliente.nome", v)} />
                <Field label="Cognome" value={editedData.cliente.cognome} onChange={(v) => updateField("cliente.cognome", v)} />
                <Field label="Codice Fiscale" value={editedData.cliente.codice_fiscale} onChange={(v) => updateField("cliente.codice_fiscale", v)} />
              </div>
            </div>

            {/* Fornitura */}
            <div className="bg-white/5 rounded-xl p-5 mb-4">
              <h3 className="text-[#FF6B00] font-semibold mb-3">🏡 Fornitura</h3>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Tipo" value={editedData.fornitura.tipo_fornitura} onChange={(v) => updateField("fornitura.tipo_fornitura", v)} />
                <Field label={editedData.fornitura.tipo_punto} value={editedData.fornitura.codice_punto} onChange={(v) => updateField("fornitura.codice_punto", v)} />
                <Field label="Indirizzo" value={editedData.fornitura.indirizzo_fornitura || ""} onChange={(v) => updateField("fornitura.indirizzo_fornitura", v)} />
                <Field label="Comune" value={editedData.fornitura.comune || ""} onChange={(v) => updateField("fornitura.comune", v)} />
              </div>
            </div>

            {/* Contratto */}
            <div className="bg-white/5 rounded-xl p-5 mb-4">
              <h3 className="text-[#FF6B00] font-semibold mb-3">📋 Contratto attuale</h3>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Fornitore" value={editedData.contratto.brand_commerciale || ""} onChange={(v) => updateField("contratto.brand_commerciale", v)} />
                <Field label="Offerta" value={editedData.contratto.nome_offerta || ""} onChange={(v) => updateField("contratto.nome_offerta", v)} />
                <Field label="Prezzo" value={editedData.contratto.tipo_prezzo || ""} onChange={(v) => updateField("contratto.tipo_prezzo", v)} />
              </div>
            </div>

            {/* Bolletta */}
            <div className="bg-white/5 rounded-xl p-5 mb-6">
              <h3 className="text-[#FF6B00] font-semibold mb-3">💰 Bolletta</h3>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Totale da pagare" value={`€ ${editedData.bolletta.totale_da_pagare}`} disabled />
                <Field label="Scadenza" value={editedData.bolletta.data_scadenza_pagamento || ""} onChange={(v) => updateField("bolletta.data_scadenza_pagamento", v)} />
                <Field label="Consumo" value={`${editedData.bolletta.consumo_fatturato || ""} ${editedData.bolletta.unita_consumo || ""}`} disabled />
                <Field label="Tipo bolletta" value={editedData.bolletta.tipo_bolletta} onChange={(v) => updateField("bolletta.tipo_bolletta", v)} />
              </div>
            </div>

            <button
              onClick={handleConfirm}
              disabled={saving}
              className="w-full bg-[#FF6B00] hover:bg-[#FF8C42] text-white font-bold py-4 rounded-xl transition-all text-lg disabled:opacity-50"
            >
              {saving ? "Calcolo proposta…" : "Vedi la tua proposta →"}
            </button>
          </div>
        )}

        {/* Step 4: Proposal */}
        {step === "proposal" && proposal && editedData && (
          <div className="bg-white/10 backdrop-blur rounded-2xl p-8">
            <h2 className="text-white text-2xl font-bold mb-2">
              {proposal.nome}, ecco la tua offerta! 🎉
            </h2>
            <p className="text-gray-300 mb-8">
              Risparmio stimato sulla tua fornitura {editedData.fornitura.tipo_fornitura}
            </p>

            {/* Current vs Proposed */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="bg-red-500/10 border border-red-400/30 rounded-xl p-5 text-center">
                <p className="text-red-300 text-sm mb-1">Oggi paghi</p>
                <p className="text-red-400 text-3xl font-bold">
                  €{proposal.prezzo_corrente.toFixed(2)}
                </p>
                <p className="text-gray-500 text-xs mt-1">
                  {proposal.offerta.fornitore_attuale} — {proposal.offerta.offerta_attuale}
                </p>
              </div>
              <div className="bg-green-500/10 border border-green-400/30 rounded-xl p-5 text-center">
                <p className="text-green-300 text-sm mb-1">Con FornitoreA paghi</p>
                <p className="text-green-400 text-3xl font-bold">
                  €{proposal.prezzo_proposto.toFixed(2)}
                </p>
                <p className="text-gray-500 text-xs mt-1">{proposal.offerta.nome}</p>
              </div>
            </div>

            {/* Savings */}
            <div className="bg-[#FF6B00]/20 border border-[#FF6B00]/40 rounded-xl p-6 text-center mb-8">
              <p className="text-[#FF6B00] text-lg font-semibold">Risparmio stimato</p>
              <p className="text-[#FF6B00] text-5xl font-bold mt-2">
                €{proposal.risparmio_stimato.toFixed(2)}/mese
              </p>
            </div>

            {/* Offer details */}
            <div className="bg-white/5 rounded-xl p-5 mb-6">
              <h3 className="text-white font-semibold mb-3">Dettagli offerta</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Offerta</span>
                  <span className="text-white font-semibold">{proposal.offerta.nome}</span>
                </div>
                {proposal.offerta.tipo_prezzo && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Prezzo</span>
                    <span className="text-white capitalize">{proposal.offerta.tipo_prezzo}</span>
                  </div>
                )}
                {proposal.offerta.indice_riferimento && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Indice</span>
                    <span className="text-white">{proposal.offerta.indice_riferimento}</span>
                  </div>
                )}
                {proposal.offerta.ccv_mensile != null && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">CCV mensile</span>
                    <span className="text-white">€{proposal.offerta.ccv_mensile.toFixed(2)}/mese</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-400">Tipo fornitura</span>
                  <span className="text-white">{proposal.offerta.tipo === "luce" ? "Energia elettrica" : "Gas naturale"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">POD/PDR</span>
                  <span className="text-white">{editedData.fornitura.codice_punto}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Consumo annuo</span>
                  <span className="text-white">{editedData.bolletta.consumo_annuo} {editedData.bolletta.unita_consumo}</span>
                </div>
              </div>
            </div>

            {/* Cost breakdown */}
            {proposal.offerta.dettagli_costo && (
              <div className="bg-white/5 rounded-xl p-5 mb-6">
                <h3 className="text-white font-semibold mb-3">Dettaglio costi stimati</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Quota energia</span>
                    <span className="text-white">€{proposal.offerta.dettagli_costo.prezzo_energia_mensile.toFixed(2)}/mese</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">CCV (commercializzazione)</span>
                    <span className="text-white">€{proposal.offerta.dettagli_costo.ccv_mensile.toFixed(2)}/mese</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Trasporto e gestione</span>
                    <span className="text-white">€{proposal.offerta.dettagli_costo.trasporto_mensile.toFixed(2)}/mese</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Oneri di sistema</span>
                    <span className="text-white">€{proposal.offerta.dettagli_costo.oneri_mensile.toFixed(2)}/mese</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">IVA</span>
                    <span className="text-white">€{proposal.offerta.dettagli_costo.iva_totale.toFixed(2)}/mese</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-white/10">
                    <span className="text-white font-semibold">Totale stimato</span>
                    <span className="text-green-400 font-bold text-lg">€{proposal.prezzo_proposto.toFixed(2)}/mese</span>
                  </div>
                </div>
              </div>
            )}

            {/* Personal code */}
            <div className="bg-[#1a1a2e] border border-white/20 rounded-xl p-6 text-center mb-8">
              <p className="text-gray-400 text-sm mb-2">Il tuo codice personale</p>
              <p className="text-[#FF6B00] text-4xl font-mono tracking-[0.3em] font-bold">
                {proposal.codice_redenzione}
              </p>
              <p className="text-gray-500 text-xs mt-2">Valido per 30 giorni — identificativo univoco della tua proposta</p>
            </div>

            {/* Download */}
            <button
              onClick={downloadPDF}
              className="w-full bg-white/10 hover:bg-white/20 text-white font-bold py-4 rounded-xl transition-all text-lg border border-white/20 mb-4"
            >
              📥 Scarica la proposta
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="text-gray-400 text-xs block mb-1">{label}</label>
      <input
        type="text"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.value)}
        className={`w-full bg-white/10 text-white border border-gray-600 rounded-lg px-3 py-2 text-sm ${
          disabled ? "opacity-60" : "focus:border-[#FF6B00] focus:outline-none"
        }`}
      />
    </div>
  );
}