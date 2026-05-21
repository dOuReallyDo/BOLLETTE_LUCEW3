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
  clienti: { nome: string; cognome: string; codice_fiscale: string } | null;
  forniture: { tipo_fornitura: string; codice_punto: string } | null;
  contratti: { brand_commerciale: string | null; nome_offerta: string | null } | null;
}

export default function AdminBollettePage() {
  const [bollette, setBollette] = useState<Bolletta[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [tipo, setTipo] = useState("");
  const [loading, setLoading] = useState(true);
  const limit = 20;

  const fetchData = (p: number) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), limit: String(limit) });
    if (tipo) params.set("tipo", tipo);
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

  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      <h1 className="text-white text-2xl font-bold mb-6">Bollette</h1>

      {/* Filters */}
      <div className="flex gap-3 mb-6">
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
        <div className="flex items-center text-gray-400 text-sm">
          {total} risultati
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-gray-400 text-center py-10">Caricamento…</div>
      ) : bollette.length === 0 ? (
        <div className="text-gray-500 text-center py-10">Nessuna bolletta trovata</div>
      ) : (
        <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 text-xs border-b border-white/10">
                <th className="text-left p-3">N° Fattura</th>
                <th className="text-left p-3">Cliente</th>
                <th className="text-left p-3">Fornitore</th>
                <th className="text-left p-3">Tipo</th>
                <th className="text-left p-3">Fornitura</th>
                <th className="text-right p-3">Totale</th>
                <th className="text-right p-3">Data</th>
              </tr>
            </thead>
            <tbody>
              {bollette.map((b) => (
                <tr key={b.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="p-3 text-white font-mono text-xs">{b.numero_fattura || "—"}</td>
                  <td className="p-3 text-white text-xs">{b.clienti ? `${b.clienti.nome} ${b.clienti.cognome}` : "—"}</td>
                  <td className="p-3 text-gray-300 text-xs">{(b.contratti as Record<string, unknown>)?.brand_commerciale as string || "—"}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      b.tipo_bolletta === "periodica" ? "bg-blue-500/20 text-blue-300" :
                      b.tipo_bolletta === "chiusura" ? "bg-red-500/20 text-red-300" :
                      "bg-gray-500/20 text-gray-300"
                    }`}>
                      {b.tipo_bolletta}
                    </span>
                  </td>
                  <td className="p-3 text-gray-300 text-xs">{b.forniture ? `${(b.forniture as Record<string, unknown>).tipo_fornitura}` : "—"}</td>
                  <td className="p-3 text-white text-right">€{(b.totale_da_pagare ?? 0).toFixed(2)}</td>
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