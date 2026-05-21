"use client";

import { useEffect, useState } from "react";

interface Proposta {
  id: string;
  codice_redenzione: string;
  stato: string;
  prezzo_corrente: number;
  prezzo_proposto: number;
  risparmio_stimato: number;
  email_contatto: string | null;
  created_at: string;
  clienti: { nome: string; cognome: string; codice_fiscale: string } | null;
  offerta_proposta: Record<string, unknown> | null;
}

const statoColors: Record<string, string> = {
  inviata: "bg-yellow-500/20 text-yellow-300",
  vista: "bg-blue-500/20 text-blue-300",
  accettata: "bg-green-500/20 text-green-300",
  scaduta: "bg-gray-500/20 text-gray-400",
};

export default function AdminPropostePage() {
  const [proposte, setProposte] = useState<Proposta[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [stato, setStato] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const limit = 20;

  const fetchData = (p: number, s: string, q: string) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), limit: String(limit) });
    if (s) params.set("stato", s);
    if (q) params.set("search", q);
    fetch(`/admin/api/proposte?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setProposte(data.data || []);
        setTotal(data.total || 0);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(page, stato, search); }, [page, stato]);

  const handleSearch = () => { setPage(1); fetchData(1, stato, search); };
  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      <h1 className="text-white text-2xl font-bold mb-6">Proposte</h1>

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="Cerca codice o email…"
          className="flex-1 bg-white/10 text-white border border-gray-600 rounded-lg px-3 py-2 text-sm focus:border-[#FF6B00] focus:outline-none"
        />
        <select
          value={stato}
          onChange={(e) => { setStato(e.target.value); setPage(1); }}
          className="bg-white/10 text-white border border-gray-600 rounded-lg px-3 py-2 text-sm focus:border-[#FF6B00] focus:outline-none"
        >
          <option value="">Tutti gli stati</option>
          <option value="inviata">Inviata</option>
          <option value="vista">Vista</option>
          <option value="accettata">Accettata</option>
          <option value="scaduta">Scaduta</option>
        </select>
        <button onClick={handleSearch} className="bg-[#FF6B00] hover:bg-[#FF8C42] text-white font-semibold px-4 py-2 rounded-lg text-sm transition-all">
          Cerca
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-gray-400 text-center py-10">Caricamento…</div>
      ) : proposte.length === 0 ? (
        <div className="text-gray-500 text-center py-10">Nessuna proposta trovata</div>
      ) : (
        <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 text-xs border-b border-white/10">
                <th className="text-left p-3">Codice</th>
                <th className="text-left p-3">Cliente</th>
                <th className="text-left p-3">Stato</th>
                <th className="text-right p-3">Risparmio</th>
                <th className="text-left p-3">Email</th>
                <th className="text-right p-3">Data</th>
              </tr>
            </thead>
            <tbody>
              {proposte.map((p) => (
                <>
                  <tr
                    key={p.id}
                    className="border-b border-white/5 hover:bg-white/5 cursor-pointer"
                    onClick={() => setExpanded(expanded === p.id ? null : p.id)}
                  >
                    <td className="p-3 text-[#FF6B00] font-mono font-bold tracking-wider">{p.codice_redenzione}</td>
                    <td className="p-3 text-white text-xs">{p.clienti ? `${p.clienti.nome} ${p.clienti.cognome}` : "—"}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-xs ${statoColors[p.stato] || "bg-gray-500/20 text-gray-300"}`}>
                        {p.stato}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      {p.risparmio_stimato > 0 ? (
                        <span className="text-green-400">€{p.risparmio_stimato.toFixed(2)}/mese</span>
                      ) : (
                        <span className="text-gray-500">—</span>
                      )}
                    </td>
                    <td className="p-3 text-gray-300 text-xs">{p.email_contatto || "—"}</td>
                    <td className="p-3 text-gray-400 text-right text-xs">{new Date(p.created_at).toLocaleDateString("it-IT")}</td>
                  </tr>
                  {expanded === p.id && p.offerta_proposta && (
                    <tr key={`${p.id}-detail`}>
                      <td colSpan={6} className="p-4 bg-white/5">
                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                          <div><span className="text-gray-400">Attuale:</span> <span className="text-white">€{p.prezzo_corrente.toFixed(2)}/mese</span></div>
                          <div><span className="text-gray-400">Proposto:</span> <span className="text-white">€{p.prezzo_proposto.toFixed(2)}/mese</span></div>
                          <div><span className="text-gray-400">Offerta:</span> <span className="text-white">{(p.offerta_proposta as Record<string, unknown>)?.nome as string || "—"}</span></div>
                          <div><span className="text-gray-400">Fornitore attuale:</span> <span className="text-white">{(p.offerta_proposta as Record<string, unknown>)?.fornitore_attuale as string || "—"}</span></div>
                          <div><span className="text-gray-400">Offerta attuale:</span> <span className="text-white">{(p.offerta_proposta as Record<string, unknown>)?.offerta_attuale as string || "—"}</span></div>
                          <div><span className="text-gray-400">Cannot beat:</span> <span className={(p.offerta_proposta as Record<string, unknown>)?.cannot_beat ? "text-yellow-400" : "text-gray-500"}>{(p.offerta_proposta as Record<string, unknown>)?.cannot_beat ? "Sì" : "No"}</span></div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-4">
          <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="px-3 py-1.5 bg-white/10 text-white rounded-lg text-sm disabled:opacity-30">←</button>
          <span className="text-gray-400 text-sm">{page} / {totalPages}</span>
          <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="px-3 py-1.5 bg-white/10 text-white rounded-lg text-sm disabled:opacity-30">→</button>
        </div>
      )}
    </div>
  );
}