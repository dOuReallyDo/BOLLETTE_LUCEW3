"use client";

import { useState, useCallback } from "react";
import type { ValidatedBillData } from "@/lib/extraction/validation";

type Step = "upload" | "processing" | "confirm" | "email" | "done";

export default function Home() {
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [extractedData, setExtractedData] = useState<ValidatedBillData | null>(null);
  const [editedData, setEditedData] = useState<ValidatedBillData | null>(null);
  const [storagePath, setStoragePath] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [error, setError] = useState("");
  const [code, setCode] = useState("");
  const [dragActive, setDragActive] = useState(false);

  const handleUpload = useCallback(async (f: File) => {
    setFile(f);
    setStep("processing");
    setError("");

    const formData = new FormData();
    formData.append("file", f);

    try {
      const res = await fetch("/api/extract", { method: "POST", body: formData });
      const json = await res.json();

      if (!res.ok) {
        setError(json.error || "Errore durante l'estrazione");
        setStep("upload");
        return;
      }

      setExtractedData(json.data);
      setEditedData(json.data);
      setStoragePath(json.storagePath);
      setUserEmail(json.data.cliente?.email_contatto_bolletta || "");
      setStep("confirm");
    } catch {
      setError("Errore di connessione");
      setStep("upload");
    }
  }, []);

  const handleConfirm = async () => {
    if (!userEmail || !userEmail.includes("@")) {
      setError("Inserisci un'email valida");
      return;
    }

    setStep("email");
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
          userEmail,
        }),
      });
      const json = await res.json();

      if (!res.ok) {
        setError(json.error || "Errore durante il salvataggio");
        setStep("confirm");
        return;
      }

      setCode(json.codice_redenzione);
      setStep("done");
    } catch {
      setError("Errore di connessione");
      setStep("confirm");
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1a1a2e] to-[#16213e]">
      {/* Header */}
      <header className="bg-[#FF6B00] py-5 px-6 shadow-lg">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
            <span className="text-[#FF6B00] font-bold text-lg">W</span>
          </div>
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
            <div className="animate-spin text-6xl mb-6">⚡</div>
            <h2 className="text-white text-xl font-bold mb-2">
              Sto leggendo la tua bolletta…
            </h2>
            <p className="text-gray-300">
              Analizziamo i dati per trovare l&apos;offerta migliore per te
            </p>
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
                <Field label={`${editedData.fornitura.tipo_punto}`} value={editedData.fornitura.codice_punto} onChange={(v) => updateField("fornitura.codice_punto", v)} />
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

            {/* Email input */}
            <div className="bg-[#FF6B00]/20 border border-[#FF6B00]/40 rounded-xl p-5 mb-6">
              <h3 className="text-[#FF6B00] font-semibold mb-3">📧 Dove vuoi ricevere la proposta?</h3>
              {editedData.cliente.email_contatto_bolletta && (
                <p className="text-gray-300 text-sm mb-2">
                  ⚠️ L&apos;email trovata in bolletta ({editedData.cliente.email_contatto_bolletta}) potrebbe non essere la tua. Verifica!
                </p>
              )}
              <input
                type="email"
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
                placeholder="la.tua.email@esempio.it"
                className="w-full bg-white/10 text-white border border-gray-600 rounded-lg px-4 py-3 focus:border-[#FF6B00] focus:outline-none"
              />
            </div>

            <button
              onClick={handleConfirm}
              className="w-full bg-[#FF6B00] hover:bg-[#FF8C42] text-white font-bold py-4 rounded-xl transition-all text-lg"
            >
              Conferma e ricevi la proposta →
            </button>
          </div>
        )}

        {/* Step 4: Email sending */}
        {step === "email" && (
          <div className="bg-white/10 backdrop-blur rounded-2xl p-12 text-center">
            <div className="animate-bounce text-5xl mb-4">📬</div>
            <h2 className="text-white text-xl font-bold mb-2">
              Stiamo preparando la tua proposta…
            </h2>
            <p className="text-gray-300">Un momento e la ricevi via email</p>
          </div>
        )}

        {/* Step 5: Done */}
        {step === "done" && (
          <div className="bg-white/10 backdrop-blur rounded-2xl p-8 text-center">
            <div className="text-6xl mb-4">✅</div>
            <h2 className="text-white text-2xl font-bold mb-2">
              Proposta inviata!
            </h2>
            <p className="text-gray-300 mb-6">
              Controlla la tua email. Il tuo codice personale è:
            </p>
            <div className="bg-[#FF6B00] text-white text-3xl font-mono tracking-[0.5em] py-4 rounded-xl mb-6">
              {code}
            </div>
            <p className="text-gray-400 text-sm">
              Inseriscilo nella pagina per vedere la tua offerta personalizzata.
              Valido per 30 giorni.
            </p>
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