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
  email_inviata_a: string | null;
  inviata_at: string | null;
  vista_at: string | null;
  accettata_at: string | null;
  scade_at: string | null;
  created_at: string;
  codice_fiscale: string;
  clienti: { nome: string; cognome: string; codice_fiscale: string } | null;
  offerta_proposta: Record<string, unknown> | null;
}

type SortKey = "codice_redenzione" | "stato" | "risparmio_stimato" | "created_at" | "scade_at";
type SortDir = "asc" | "desc";

const statoColors: Record<string, string> = {
  inviata: "bg-yellow-500/20 text-yellow-300",
  vista: "bg-blue-500/20 text-blue-300",
  accettata: "bg-green-500/20 text-green-300",
  scaduta: "bg-gray-500/20 text-gray-400",
};

const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString("it-IT") : "—";
const fmtTime = (d: string | null) => d ? new Date(d).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }) : "—";
const fmtDateTime = (d: string | null) => d ? `${fmtDate(d)} ${fmtTime(d)}` : "—";

export default function AdminPropostePage() {
  const [proposte, setProposte] = useState<Proposta[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [stato, setStato] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
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

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const sorted = [...proposte].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    switch (sortKey) {
      case "codice_redenzione": return dir * a.codice_redenzione.localeCompare(b.codice_redenzione);
      case "stato": return dir * a.stato.localeCompare(b.stato);
      case "risparmio_stimato": return dir * (a.risparmio_stimato - b.risparmio_stimato);
      case "created_at": return dir * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      case "scade_at": return dir * ((a.scade_at ? new Date(a.scade_at).getTime() : 0) - (b.scade_at ? new Date(b.scade_at).getTime() : 0));
      default: return 0;
    }
  });

  const totalPages = Math.ceil(total / limit);

  const SortIcon = ({ col }: { col: SortKey }) => (
    <span className="ml-1 text-[10px]">{sortKey === col ? (sortDir === "asc" ? "▲" : "▼") : "△"}</span>
  );

  return (
    <div>
      <h1 className="text-white text-2xl font-bold mb-6">Proposte</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
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
          className="bg-[#1a1a2e] text-white border border-gray-600 rounded-lg px-3 py-2 text-sm focus:border-[#FF6B00] focus:outline-none"
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
        <div className="flex items-center text-gray-400 text-sm ml-auto">
          {total} risultati
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-gray-400 text-center py-10">Caricamento…</div>
      ) : sorted.length === 0 ? (
        <div className="text-gray-500 text-center py-10">Nessuna proposta trovata</div>
      ) : (
        <div className="bg-white/5 border border-white/10 rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 text-xs border-b border-white/10">
                <th className="text-left p-3 cursor-pointer hover:text-white" onClick={() => handleSort("codice_redenzione")}>Codice <SortIcon col="codice_redenzione" /></th>
                <th className="text-left p-3">Cliente</th>
                <th className="text-left p-3 cursor-pointer hover:text-white" onClick={() => handleSort("stato")}>Stato <SortIcon col="stato" /></th>
                <th className="text-right p-3 cursor-pointer hover:text-white" onClick={() => handleSort("risparmio_stimato")}>Risparmio <SortIcon col="risparmio_stimato" /></th>
                <th className="text-left p-3">Email invio</th>
                <th className="text-center p-3">Mail inviata</th>
                <th className="text-left p-3">Scadenza</th>
                <th className="text-right p-3 cursor-pointer hover:text-white" onClick={() => handleSort("created_at")}>Creata <SortIcon col="created_at" /></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p) => (
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
                        <span className="text-green-400">€{p.risparmio_stimato.toFixed(2)}/m</span>
                      ) : (
                        <span className="text-gray-500">—</span>
                      )}
                    </td>
                    <td className="p-3 text-gray-300 text-xs">{p.email_inviata_a || p.email_contatto || "—"}</td>
                    <td className="p-3 text-center">
                      {p.inviata_at ? (
                        <span className="text-green-400 text-xs">✓ {fmtTime(p.inviata_at)}</span>
                      ) : (
                        <span className="text-red-400 text-xs">✗</span>
                      )}
                    </td>
                    <td className="p-3 text-gray-300 text-xs">{fmtDate(p.scade_at)}</td>
                    <td className="p-3 text-gray-400 text-right text-xs">{fmtDateTime(p.created_at)}</td>
                  </tr>
                  {expanded === p.id && (
                    <tr key={`${p.id}-detail`}>
                      <td colSpan={8} className="p-4 bg-white/5">
                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                          <div><span className="text-gray-400">Prezzo attuale:</span> <span className="text-white">€{p.prezzo_corrente.toFixed(2)}/mese</span></div>
                          <div><span className="text-gray-400">Prezzo proposto:</span> <span className="text-white">€{p.prezzo_proposto.toFixed(2)}/mese</span></div>
                          <div><span className="text-gray-400">Offerta:</span> <span className="text-white">{(p.offerta_proposta as Record<string, unknown>)?.nome as string || "—"}</span></div>
                          <div><span className="text-gray-400">Fornitore attuale:</span> <span className="text-white">{(p.offerta_proposta as Record<string, unknown>)?.fornitore_attuale as string || "—"}</span></div>
                          <div><span className="text-gray-400">Offerta attuale:</span> <span className="text-white">{(p.offerta_proposta as Record<string, unknown>)?.offerta_attuale as string || "—"}</span></div>
                          <div><span className="text-gray-400">Cannot beat:</span> <span className={(p.offerta_proposta as Record<string, unknown>)?.cannot_beat ? "text-yellow-400" : "text-gray-500"}>{(p.offerta_proposta as Record<string, unknown>)?.cannot_beat ? "Sì" : "No"}</span></div>
                          <div><span className="text-gray-400">Email contatto:</span> <span className="text-white">{p.email_contatto || "—"}</span></div>
                          <div><span className="text-gray-400">Mail inviata a:</span> <span className="text-white">{p.email_inviata_a || "—"}</span></div>
                          <div><span className="text-gray-400">Inviata il:</span> <span className="text-white">{fmtDateTime(p.inviata_at)}</span></div>
                          <div><span className="text-gray-400">Vista il:</span> <span className="text-white">{fmtDateTime(p.vista_at)}</span></div>
                          <div><span className="text-gray-400">Accettata il:</span> <span className="text-white">{fmtDateTime(p.accettata_at)}</span></div>
                          <div><span className="text-gray-400">Scade il:</span> <span className="text-white">{fmtDateTime(p.scade_at)}</span></div>
                          <div><span className="text-gray-400">Link proposta:</span> <a href={`/proposal?code=${p.codice_redenzione}`} target="_blank" className="text-[#FF6B00] hover:underline">/proposal?code={p.codice_redenzione}</a></div>
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