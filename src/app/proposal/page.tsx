"use client";

import { useState } from "react";

interface Proposal {
  id: string;
  codice_redenzione: string;
  offerta_proposta: {
    nome: string;
    tipo: string;
    prezzo_corrente: number;
    prezzo_proposto: number;
    risparmio_mensile?: number;
    fornitore_attuale: string;
    offerta_attuale: string;
    tipo_prezzo?: string;
    indice_riferimento?: string;
    ccv_mensile?: number;
    dettagli_costo?: {
      prezzo_energia_mensile: number;
      ccv_mensile: number;
      trasporto_mensile: number;
      oneri_mensile: number;
      iva_totale: number;
    };
  };
  prezzo_proposto: number;
  risparmio_stimato: number;
  stato: string;
  clienti: {
    nome: string;
    cognome: string;
    codice_fiscale: string;
  };
}

export default function ProposalPage() {
  const [code, setCode] = useState("");
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [accepted, setAccepted] = useState(false);

  const handleLookup = async () => {
    if (!code.trim()) return;
    setLoading(true);
    setError("");
    setProposal(null);
    setAccepted(false);

    try {
      const res = await fetch(`/api/auth-code?code=${encodeURIComponent(code)}`);
      const json = await res.json();

      if (!res.ok) {
        setError(json.error || "Codice non valido");
        return;
      }

      setProposal(json.proposta);
    } catch {
      setError("Errore di connessione");
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!proposal) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: proposal.codice_redenzione }),
      });
      const json = await res.json();

      if (!res.ok) {
        setError(json.error || "Errore durante l'accettazione");
        return;
      }

      setAccepted(true);
    } catch {
      setError("Errore di connessione");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1a1a2e] to-[#16213e]">
      <header className="bg-[#FF6B00] py-5 px-6 shadow-lg">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <img src="/fornitorea-logo.jpg" alt="FornitoreA Luce & Gas" className="h-10 w-auto rounded" />
          <h1 className="text-white font-bold text-xl">FornitoreA Luce & Gas</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        {error && (
          <div className="bg-red-500/20 border border-red-400 text-red-200 p-4 rounded-lg mb-6">
            {error}
          </div>
        )}

        {!proposal && !accepted && (
          <div className="bg-white/10 backdrop-blur rounded-2xl p-8 text-center">
            <h2 className="text-white text-2xl font-bold mb-4">
              Inserisci il tuo codice
            </h2>
            <p className="text-gray-300 mb-6">
              Usa il codice di 6 caratteri che hai ricevuto via email
            </p>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={6}
              placeholder="ABC123"
              className="bg-white/10 text-white text-center text-3xl font-mono tracking-[0.5em] border border-gray-600 rounded-xl px-6 py-4 focus:border-[#FF6B00] focus:outline-none mb-6 w-full max-w-xs mx-auto"
              onKeyDown={(e) => e.key === "Enter" && handleLookup()}
            />
            <button
              onClick={handleLookup}
              disabled={loading || code.length < 6}
              className="bg-[#FF6B00] hover:bg-[#FF8C42] text-white font-bold py-3 px-8 rounded-xl transition-all disabled:opacity-50"
            >
              {loading ? "…" : "Vedi la tua offerta →"}
            </button>
          </div>
        )}

        {proposal && !accepted && (
          <div className="bg-white/10 backdrop-blur rounded-2xl p-8">
            <h2 className="text-white text-2xl font-bold mb-2">
              Ciao {proposal.clienti.nome}! 👋
            </h2>
            <p className="text-gray-300 mb-8">
              Ecco la proposta personalizzata per te
            </p>

            {/* Current vs Proposed */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="bg-red-500/10 border border-red-400/30 rounded-xl p-5 text-center">
                <p className="text-red-300 text-sm mb-1">Oggi paghi</p>
                <p className="text-red-400 text-3xl font-bold">
                  €{proposal.offerta_proposta.prezzo_corrente.toFixed(2)}
                </p>
                <p className="text-gray-500 text-xs mt-1">
                  {proposal.offerta_proposta.fornitore_attuale} — {proposal.offerta_proposta.offerta_attuale}
                </p>
              </div>
              <div className="bg-green-500/10 border border-green-400/30 rounded-xl p-5 text-center">
                <p className="text-green-300 text-sm mb-1">Con FornitoreA paghi</p>
                <p className="text-green-400 text-3xl font-bold">
                  €{proposal.offerta_proposta.prezzo_proposto.toFixed(2)}
                </p>
                <p className="text-gray-500 text-xs mt-1">{proposal.offerta_proposta.nome}</p>
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
                  <span className="text-white font-semibold">{proposal.offerta_proposta.nome}</span>
                </div>
                {proposal.offerta_proposta.tipo_prezzo && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Prezzo</span>
                    <span className="text-white capitalize">{proposal.offerta_proposta.tipo_prezzo}</span>
                  </div>
                )}
                {proposal.offerta_proposta.indice_riferimento && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Indice</span>
                    <span className="text-white">{proposal.offerta_proposta.indice_riferimento}</span>
                  </div>
                )}
                {proposal.offerta_proposta.ccv_mensile != null && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">CCV mensile</span>
                    <span className="text-white">€{proposal.offerta_proposta.ccv_mensile.toFixed(2)}/mese</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-400">Tipo fornitura</span>
                  <span className="text-white">{proposal.offerta_proposta.tipo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Codice proposta</span>
                  <span className="text-white font-mono">{proposal.codice_redenzione}</span>
                </div>
              </div>
            </div>

            {/* Cost breakdown */}
            {proposal.offerta_proposta.dettagli_costo && (
              <div className="bg-white/5 rounded-xl p-5 mb-6">
                <h3 className="text-white font-semibold mb-3">Dettaglio costi stimati</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Quota energia</span>
                    <span className="text-white">€{proposal.offerta_proposta.dettagli_costo.prezzo_energia_mensile.toFixed(2)}/mese</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">CCV (commercializzazione)</span>
                    <span className="text-white">€{proposal.offerta_proposta.dettagli_costo.ccv_mensile.toFixed(2)}/mese</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Trasporto e gestione</span>
                    <span className="text-white">€{proposal.offerta_proposta.dettagli_costo.trasporto_mensile.toFixed(2)}/mese</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Oneri di sistema</span>
                    <span className="text-white">€{proposal.offerta_proposta.dettagli_costo.oneri_mensile.toFixed(2)}/mese</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">IVA</span>
                    <span className="text-white">€{proposal.offerta_proposta.dettagli_costo.iva_totale.toFixed(2)}/mese</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-white/10">
                    <span className="text-white font-semibold">Totale stimato</span>
                    <span className="text-green-400 font-bold text-lg">€{proposal.prezzo_proposto.toFixed(2)}/mese</span>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={handleAccept}
              disabled={loading}
              className="w-full bg-[#FF6B00] hover:bg-[#FF8C42] text-white font-bold py-4 rounded-xl transition-all text-lg disabled:opacity-50"
            >
              {loading ? "…" : "Accetta l'offerta ✓"}
            </button>
          </div>
        )}

        {accepted && (
          <div className="bg-white/10 backdrop-blur rounded-2xl p-12 text-center">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-white text-2xl font-bold mb-2">
              Offerta accettata!
            </h2>
            <p className="text-gray-300 mb-4">
              Grazie {proposal?.clienti.nome}! Ti contatteremo per completare l&apos;attivazione.
            </p>
            <p className="text-gray-500 text-sm">
              Codice: <span className="font-mono text-[#FF6B00]">{proposal?.codice_redenzione}</span>
            </p>
          </div>
        )}
      </main>
    </div>
  );
}