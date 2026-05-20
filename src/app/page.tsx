"use client";

import { useState, useCallback, useEffect } from "react";
import type { ValidatedBillData } from "@/lib/extraction/validation";
import jsPDF from "jspdf";

type Step = "upload" | "processing" | "confirm" | "contact" | "proposal";

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
      sconto_mese?: number | null;
      dettagli_costo?: {
        prezzo_energia_mensile: number;
        ccv_mensile: number;
        sconto_mese: number;
        trasporto_mensile: number;
        oneri_mensile: number;
        iva_totale: number;
      } | null;
    };
    nome: string;
    cognome: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [consensoTrattamento, setConsensoTrattamento] = useState(false);
  const [consensoMarketing, setConsensoMarketing] = useState(false);
  const [consensoProfilazione, setConsensoProfilazione] = useState(false);
  const [confirmedDownload, setConfirmedDownload] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Timer during processing
  useEffect(() => {
    if (step !== "processing") {
      setElapsedSeconds(0);
      return;
    }
    const interval = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [step]);

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
      setContactEmail(result.data.cliente?.email_contatto_bolletta || "");
      setContactPhone(result.data.cliente?.telefono || "");
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
          contact: {
            email: contactEmail || undefined,
            telefono: contactPhone || undefined,
          },
          gdpr: {
            consenso_trattamento: consensoTrattamento,
            consenso_marketing: consensoMarketing,
            consenso_profilazione: consensoProfilazione,
            consenso_at: consensoTrattamento ? new Date().toISOString() : undefined,
          },
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

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 18;
    const contentW = pageW - margin * 2;
    let y = 0;

    // ── Header ──────────────────────────────────────────────
    doc.setFillColor(255, 107, 0);
    doc.rect(0, 0, pageW, 38, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("Luce & Gas POC", margin, 18);
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(`Proposta personalizzata per ${p.nome} ${p.cognome}`, margin, 30);
    y = 48;

    // ── Confronto costi ─────────────────────────────────────
    doc.setTextColor(26, 26, 46);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Oggi paghi", margin, y);
    doc.text("Con FornitoreA paghi", margin + contentW / 2 + 4, y);
    y += 2;
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, margin + contentW, y);
    y += 8;

    // Price cards side by side
    const cardW = contentW / 2 - 2;
    // Red card
    doc.setFillColor(254, 242, 242);
    doc.roundedRect(margin, y - 3, cardW, 24, 3, 3, "F");
    doc.setTextColor(220, 38, 38);
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text(`\u20AC${p.prezzo_corrente.toFixed(2)}/mese`, margin + 4, y + 10);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text(`${p.offerta.fornitore_attuale} \u2014 ${p.offerta.offerta_attuale}`, margin + 4, y + 17);

    // Green card
    const card2X = margin + cardW + 4;
    doc.setFillColor(240, 253, 244);
    doc.roundedRect(card2X, y - 3, cardW, 24, 3, 3, "F");
    doc.setTextColor(22, 163, 74);
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text(`\u20AC${p.prezzo_proposto.toFixed(2)}/mese`, card2X + 4, y + 10);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text(p.offerta.nome, card2X + 4, y + 17);
    y += 28;

    // ── Risparmio ──────────────────────────────────────────
    doc.setFillColor(255, 247, 237);
    doc.setDrawColor(255, 107, 0);
    doc.roundedRect(margin, y, contentW, 22, 3, 3, "FD");
    doc.setTextColor(255, 107, 0);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Risparmio stimato", pageW / 2, y + 9, { align: "center" });
    doc.setFontSize(24);
    doc.text(`\u20AC${p.risparmio_stimato.toFixed(2)}/mese`, pageW / 2, y + 18, { align: "center" });
    y += 30;

    // ── Dettagli offerta ───────────────────────────────────
    doc.setTextColor(26, 26, 46);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Dettagli offerta", margin, y);
    y += 2;
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, margin + contentW, y);
    y += 7;

    const detailRows: [string, string][] = [
      ["Offerta", p.offerta.nome],
      ["Tipo fornitura", tipo],
      ["POD/PDR", d.fornitura.codice_punto],
      ["Indirizzo", `${d.fornitura.indirizzo_fornitura || ""}, ${d.fornitura.comune || ""} (${d.fornitura.provincia || ""})`],
      ["Fornitore attuale", p.offerta.fornitore_attuale],
      ["Offerta attuale", p.offerta.offerta_attuale],
      ["Consumo annuo", `${d.bolletta.consumo_annuo || ""} ${d.bolletta.unita_consumo || ""}`],
    ];
    if (p.offerta.tipo_prezzo) detailRows.push(["Prezzo", p.offerta.tipo_prezzo]);
    if (p.offerta.indice_riferimento) detailRows.push(["Indice", p.offerta.indice_riferimento]);
    if (p.offerta.ccv_mensile != null) detailRows.push(["CCV mensile", `\u20AC${p.offerta.ccv_mensile.toFixed(2)}/mese`]);
    if (p.offerta.sconto_mese != null && p.offerta.sconto_mese > 0) detailRows.push(["Sconto multiservice", `\u2212\u20AC${p.offerta.sconto_mese.toFixed(2)}/mese`]);

    doc.setFontSize(9);
    detailRows.forEach(([label, value]) => {
      doc.setFont("helvetica", "normal");
      doc.setTextColor(107, 114, 128);
      doc.text(label, margin, y);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(26, 26, 46);
      doc.text(value, margin + contentW, y, { align: "right" });
      y += 5.5;
    });
    y += 5;

    // ── Dettaglio costi stimati ────────────────────────────
    if (p.offerta.dettagli_costo) {
      const dc = p.offerta.dettagli_costo;
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(26, 26, 46);
      doc.text("Dettaglio costi stimati", margin, y);
      y += 2;
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, y, margin + contentW, y);
      y += 7;

      const costRows: [string, string][] = [
        ["Quota energia", `\u20AC${dc.prezzo_energia_mensile.toFixed(2)}/mese`],
        ["CCV (commercializzazione)", `\u20AC${dc.ccv_mensile.toFixed(2)}/mese`],
      ];
      if (dc.sconto_mese > 0) {
        costRows.push(["Sconto multiservice", `\u2212\u20AC${dc.sconto_mese.toFixed(2)}/mese`]);
      }
      costRows.push(
        ["Trasporto e gestione", `\u20AC${dc.trasporto_mensile.toFixed(2)}/mese`],
        ["Oneri di sistema", `\u20AC${dc.oneri_mensile.toFixed(2)}/mese`],
        ["IVA", `\u20AC${dc.iva_totale.toFixed(2)}/mese`],
      );

      doc.setFontSize(9);
      costRows.forEach(([label, value]) => {
        doc.setFont("helvetica", "normal");
        doc.setTextColor(107, 114, 128);
        doc.text(label, margin, y);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(26, 26, 46);
        doc.text(value, margin + contentW, y, { align: "right" });
        y += 5.5;
      });

      // Total line
      y += 1;
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, y, margin + contentW, y);
      y += 6;
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(26, 26, 46);
      doc.text("Totale stimato", margin, y);
      doc.setTextColor(22, 163, 74);
      doc.text(`\u20AC${p.prezzo_proposto.toFixed(2)}/mese`, margin + contentW, y, { align: "right" });
      y += 10;
    }

    // ── Codice personale ───────────────────────────────────
    doc.setFillColor(26, 26, 46);
    doc.roundedRect(margin, y, contentW, 24, 3, 3, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("Codice personale della proposta", pageW / 2, y + 8, { align: "center" });
    doc.setFontSize(28);
    doc.setFont("helvetica", "bold");
    doc.text(p.codice_redenzione, pageW / 2, y + 19, { align: "center" });
    y += 34;

    // ── Footer ─────────────────────────────────────────────
    doc.setTextColor(156, 163, 175);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    const footerLines = [
      "Luce&Gas POC \u2014 Dimostrativo interno \u2014 Proposta non vincolante",
      "Codice valido per 30 giorni",
    ];
    footerLines.forEach((line, i) => {
      doc.text(line, pageW / 2, y + i * 4.5, { align: "center" });
    });

    doc.save(`proposta-fornitorea-${p.codice_redenzione}.pdf`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1a1a2e] to-[#16213e]">
      {/* Header */}
      <header className="bg-[#FF6B00] py-5 px-6 shadow-lg">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <div>
            <h1 className="text-white font-bold text-xl leading-tight">Luce & Gas POC</h1>
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
              <p className="text-gray-300 text-sm mb-4">
                Analizziamo i dati per trovare l&apos;offerta migliore per te
              </p>
              <p className="text-[#FF6B00] text-2xl font-mono font-bold">
                {elapsedSeconds}s
              </p>
              <p className="text-gray-500 text-xs mt-1">
                Tempo di elaborazione stimato: ~15 secondi
              </p>
              <div className="max-w-sm mx-auto mt-4">
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#FF6B00] to-[#FF8C42] rounded-full transition-all duration-1000"
                    style={{ width: `${Math.min(100, Math.round((elapsedSeconds / 15) * 100))}%` }}
                  />
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
              onClick={() => setStep("contact")}
              className="w-full bg-[#FF6B00] hover:bg-[#FF8C42] text-white font-bold py-4 rounded-xl transition-all text-lg"
            >
              Continua →
            </button>
          </div>
        )}

        {/* Step 3b: Contact + GDPR */}
        {step === "contact" && (
          <div className="bg-white/10 backdrop-blur rounded-2xl p-8">
            <h2 className="text-white text-xl font-bold mb-2">
              I tuoi dati di contatto
            </h2>
            <p className="text-gray-300 text-sm mb-6">
              Per inviarti la proposta personalizzata servono i tuoi recapiti. I dati saranno trattati nel rispetto del GDPR.
            </p>

            {/* Contatti */}
            <div className="bg-white/5 rounded-xl p-5 mb-4">
              <h3 className="text-[#FF6B00] font-semibold mb-3">📧 Recapiti</h3>
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Email *</label>
                  <input
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="nome@email.it"
                    className="w-full bg-white/10 text-white border border-gray-600 rounded-lg px-3 py-2 text-sm focus:border-[#FF6B00] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Telefono</label>
                  <input
                    type="tel"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="+39 3XX XXX XXXX"
                    className="w-full bg-white/10 text-white border border-gray-600 rounded-lg px-3 py-2 text-sm focus:border-[#FF6B00] focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Consensi GDPR */}
            <div className="bg-white/5 rounded-xl p-5 mb-6">
              <h3 className="text-[#FF6B00] font-semibold mb-3">🔒 Privacy e consensi</h3>
              <div className="space-y-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consensoTrattamento}
                    onChange={(e) => setConsensoTrattamento(e.target.checked)}
                    className="mt-1 w-5 h-5 rounded border-gray-600 bg-white/10 text-[#FF6B00] focus:ring-[#FF6B00] focus:ring-offset-0 flex-shrink-0"
                  />
                  <span className="text-white text-sm">
                    <strong>Trattamento dati *</strong> — Acconsento al trattamento dei miei dati personali per la elaborazione della proposta commerciale, ai sensi dell&apos;art. 6 GDPR. Obbligatorio per procedere.
                  </span>
                </label>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consensoMarketing}
                    onChange={(e) => setConsensoMarketing(e.target.checked)}
                    className="mt-1 w-5 h-5 rounded border-gray-600 bg-white/10 text-[#FF6B00] focus:ring-[#FF6B00] focus:ring-offset-0 flex-shrink-0"
                  />
                  <span className="text-gray-300 text-sm">
                    <strong>Comunicazioni commerciali</strong> — Acconsento a ricevere comunicazioni commerciali su offerte e promozioni, ai sensi dell&apos;art. 7 GDPR. Facoltativo.
                  </span>
                </label>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consensoProfilazione}
                    onChange={(e) => setConsensoProfilazione(e.target.checked)}
                    className="mt-1 w-5 h-5 rounded border-gray-600 bg-white/10 text-[#FF6B00] focus:ring-[#FF6B00] focus:ring-offset-0 flex-shrink-0"
                  />
                  <span className="text-gray-300 text-sm">
                    <strong>Profilazione</strong> — Acconsento alla profilazione dei miei dati per ricevere proposte personalizzate, ai sensi dell&apos;art. 7 GDPR. Facoltativo.
                  </span>
                </label>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep("confirm")}
                className="flex-1 bg-white/10 hover:bg-white/20 text-white font-bold py-4 rounded-xl transition-all text-lg border border-white/20"
              >
                ← Indietro
              </button>
              <button
                onClick={handleConfirm}
                disabled={saving || !consensoTrattamento || !contactEmail.trim()}
                className="flex-2 bg-[#FF6B00] hover:bg-[#FF8C42] text-white font-bold py-4 rounded-xl transition-all text-lg disabled:opacity-50"
              >
                {saving ? "Calcolo proposta…" : "Vedi la tua proposta →"}
              </button>
            </div>

            {!consensoTrattamento && (
              <p className="text-red-400 text-xs mt-3 text-center">
                Il consenso al trattamento dei dati è obbligatorio per procedere.
              </p>
            )}
            {!contactEmail.trim() && (
              <p className="text-red-400 text-xs mt-1 text-center">
                L&apos;indirizzo email è obbligatorio.
              </p>
            )}
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
                {proposal.offerta.sconto_mese != null && proposal.offerta.sconto_mese > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Sconto multiservice</span>
                    <span className="text-green-400">−€{proposal.offerta.sconto_mese.toFixed(2)}/mese</span>
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
                  {proposal.offerta.dettagli_costo.sconto_mese > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Sconto multiservice</span>
                      <span className="text-green-400">−€{proposal.offerta.dettagli_costo.sconto_mese.toFixed(2)}/mese</span>
                    </div>
                  )}
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

            {/* Confirm to download */}
            {!confirmedDownload ? (
              <button
                onClick={() => setConfirmedDownload(true)}
                className="w-full bg-[#FF6B00] hover:bg-[#FF8C42] text-white font-bold py-4 rounded-xl transition-all text-lg"
              >
                Conferma per scaricare la proposta e essere ricontattato
              </button>
            ) : (
              <div className="space-y-3">
                <p className="text-green-400 text-sm text-center">✓ Grazie! La tua richiesta è stata registrata.</p>
                <button
                  onClick={downloadPDF}
                  className="w-full bg-white/10 hover:bg-white/20 text-white font-bold py-4 rounded-xl transition-all text-lg border border-white/20"
                >
                  📥 Scarica la proposta in PDF
                </button>
              </div>
            )}
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