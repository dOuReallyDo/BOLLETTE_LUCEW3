"use client";

import { useEffect, useState } from "react";

interface Bolletta {
  id: string;
  numero_fattura: string | null;
  tipo_bolletta: string;
  totale_da_pagare: number | null;
  periodo_dal: string | null;
  periodo_al: string | null;
  created_at: string;
  codice_fiscale: string;
  clienti: { nome: string; cognome: string; codice_fiscale: string } | null;
  forniture: { tipo_fornitura: string; codice_punto: string } | null;
  contratti: { brand_commerciale: string | null; nome_offerta: string | null } | null;
  documenti_originali: { nome_file: string | null; mime_type: string | null; storage_path: string | null }[] | null;
}

type SortKey = "numero_fattura" | "totale_da_pagare" | "tipo_bolletta" | "created_at";
type SortDir = "asc" | "desc";

export default function AdminBollettePage() {
  const [bollette, setBollette] = useState<Bolletta[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [tipo, setTipo] = useState("");
  const [minTotale, setMinTotale] = useState("");
  const [maxTotale, setMaxTotale] = useState("");
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [downloading, setDownloading] = useState<string | null>(null);
  const limit = 20;

  const fetchData = (p: number) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), limit: String(limit) });
    if (tipo) params.set("tipo", tipo);
    if (minTotale) params.set("min_totale", minTotale);
    if (maxTotale) params.set("max_totale", maxTotale);
    fetch(`/admin/api/bollette?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setBollette(data.data || []);
        setTotal(data.total || 0);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(page); }, [page, tipo]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sorted = [...bollette].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    switch (sortKey) {
      case "numero_fattura": return dir * ((a.numero_fattura || "").localeCompare(b.numero_fattura || ""));
      case "totale_da_pagare": return dir * ((a.totale_da_pagare ?? 0) - (b.totale_da_pagare ?? 0));
      case "tipo_bolletta": return dir * a.tipo_bolletta.localeCompare(b.tipo_bolletta);
      case "created_at": return dir * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      default: return 0;
    }
  });

  const totalPages = Math.ceil(total / limit);

  const handleDownload = async (storagePath: string, nomeFile: string) => {
    setDownloading(storagePath);
    try {
      const res = await fetch(`/admin/api/download?path=${encodeURIComponent(storagePath)}`);
      const data = await res.json();
      if (data.url) {
        window.open(data.url, "_blank");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setDownloading(null);
    }
  };

  const SortIcon = ({ col }: { col: SortKey }) => (
    <span className="ml-1 text-[10px]">
      {sortKey === col ? (sortDir === "asc" ? "▲" : "▼") : "△"}
    </span>
  );

  return (
    <div>
      <h1 className="text-white text-2xl font-bold mb-6">Bollette</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <select
          value={tipo}
          onChange={(e) => { setTipo(e.target.value); setPage(1); }}
          className="bg-white/10 text-white border border-gray-600 rounded-lg px-3 py-2 text-sm focus:border-[#FF6B00] focus:outline-none"
        >
          <option value="">Tutti i tipi</option>
          <option value="periodica">Periodica</option>
          <option value="chiusura">Chiusura</option>
          <option value="conguaglio">Conguaglio</option>
        </select>
        <input
          type="number"
          value={minTotale}
          onChange={(e) => setMinTotale(e.target.value)}
          placeholder="Min €"
          className="w-24 bg-white/10 text-white border border-gray-600 rounded-lg px-3 py-2 text-sm focus:border-[#FF6B00] focus:outline-none"
        />
        <input
          type="number"
          value={maxTotale}
          onChange={(e) => setMaxTotale(e.target.value)}
          placeholder="Max €"
          className="w-24 bg-white/10 text-white border border-gray-600 rounded-lg px-3 py-2 text-sm focus:border-[#FF6B00] focus:outline-none"
        />
        <button
          onClick={() => { setPage(1); fetchData(1); }}
          className="bg-[#FF6B00] hover:bg-[#FF8C42] text-white font-semibold px-4 py-2 rounded-lg text-sm transition-all"
        >
          Filtra
        </button>
        <div className="flex items-center text-gray-400 text-sm ml-auto">
          {total} risultati
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-gray-400 text-center py-10">Caricamento…</div>
      ) : sorted.length === 0 ? (
        <div className="text-gray-500 text-center py-10">Nessuna bolletta trovata</div>
      ) : (
        <div className="bg-white/5 border border-white/10 rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 text-xs border-b border-white/10">
                <th className="text-left p-3 cursor-pointer hover:text-white" onClick={() => handleSort("numero_fattura")}>N° Fattura <SortIcon col="numero_fattura" /></th>
                <th className="text-left p-3">Cliente</th>
                <th className="text-left p-3">Fornitore</th>
                <th className="text-left p-3 cursor-pointer hover:text-white" onClick={() => handleSort("tipo_bolletta")}>Tipo <SortIcon col="tipo_bolletta" /></th>
                <th className="text-left p-3">Fornitura</th>
                <th className="text-right p-3 cursor-pointer hover:text-white" onClick={() => handleSort("totale_da_pagare")}>Totale <SortIcon col="totale_da_pagare" /></th>
                <th className="text-center p-3">Doc</th>
                <th className="text-right p-3 cursor-pointer hover:text-white" onClick={() => handleSort("created_at")}>Data <SortIcon col="created_at" /></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((b) => (
                <tr key={b.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="p-3 text-white font-mono text-xs">{b.numero_fattura || "—"}</td>
                  <td className="p-3 text-white text-xs">{b.clienti ? `${b.clienti.nome} ${b.clienti.cognome}` : "—"}</td>
                  <td className="p-3 text-gray-300 text-xs">{(b.contratti as Record<string, unknown>)?.brand_commerciale as string || "—"}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      b.tipo_bolletta === "periodica" ? "bg-blue-500/20 text-blue-300" :
                      b.tipo_bolletta === "chiusura" ? "bg-red-500/20 text-red-300" :
                      "bg-gray-500/20 text-gray-300"
                    }`}>{b.tipo_bolletta}</span>
                  </td>
                  <td className="p-3 text-gray-300 text-xs">{b.forniture ? `${(b.forniture as Record<string, unknown>).tipo_fornitura}` : "—"}</td>
                  <td className="p-3 text-white text-right">€{(b.totale_da_pagare ?? 0).toFixed(2)}</td>
                  <td className="p-3 text-center">
                    {(() => {
                      const doc = b.documenti_originali?.[0];
                      if (!doc?.storage_path) return <span className="text-gray-600">—</span>;
                      return (
                        <button
                          onClick={() => handleDownload(doc.storage_path!, doc.nome_file || "documento")}
                          disabled={downloading === doc.storage_path}
                          className="text-[#FF6B00] hover:text-[#FF8C42] text-sm disabled:opacity-50"
                          title={doc.nome_file || "Scarica documento"}
                        >
                          {downloading === doc.storage_path ? "⏳" : "📎"}
                        </button>
                      );
                    })()}
                  </td>
                  <td className="p-3 text-gray-400 text-right text-xs">{new Date(b.created_at).toLocaleDateString("it-IT")}</td>
                </tr>
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