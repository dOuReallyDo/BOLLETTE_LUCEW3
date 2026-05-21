"use client";

import { useEffect, useState } from "react";

interface Cliente {
  codice_fiscale: string;
  nome: string;
  cognome: string;
  email: string | null;
  email_contatto_bolletta: string | null;
  telefono: string | null;
  created_at: string;
  forniture: { count: number }[];
  bollette: { count: number }[];
}

export default function AdminClientiPage() {
  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const limit = 20;

  const fetchData = (p: number, s: string) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), limit: String(limit) });
    if (s) params.set("search", s);
    fetch(`/admin/api/clienti?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setClienti(data.data || []);
        setTotal(data.total || 0);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(page, search); }, [page]);

  const handleSearch = () => { setPage(1); fetchData(1, search); };

  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      <h1 className="text-white text-2xl font-bold mb-6">Clienti</h1>

      {/* Search */}
      <div className="flex gap-3 mb-6">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="Cerca per CF, nome o cognome…"
          className="flex-1 bg-white/10 text-white border border-gray-600 rounded-lg px-3 py-2 text-sm focus:border-[#FF6B00] focus:outline-none"
        />
        <button onClick={handleSearch} className="bg-[#FF6B00] hover:bg-[#FF8C42] text-white font-semibold px-4 py-2 rounded-lg text-sm transition-all">
          Cerca
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-gray-400 text-center py-10">Caricamento…</div>
      ) : clienti.length === 0 ? (
        <div className="text-gray-500 text-center py-10">Nessun cliente trovato</div>
      ) : (
        <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 text-xs border-b border-white/10">
                <th className="text-left p-3">Codice Fiscale</th>
                <th className="text-left p-3">Nome</th>
                <th className="text-left p-3">Email</th>
                <th className="text-center p-3">Forniture</th>
                <th className="text-center p-3">Bollette</th>
                <th className="text-right p-3">Data</th>
              </tr>
            </thead>
            <tbody>
              {clienti.map((c) => (
                <tr
                  key={c.codice_fiscale}
                  className="border-b border-white/5 hover:bg-white/5 cursor-pointer"
                  onClick={() => setExpanded(expanded === c.codice_fiscale ? null : c.codice_fiscale)}
                >
                  <td className="p-3 text-white font-mono text-xs">{c.codice_fiscale}</td>
                  <td className="p-3 text-white">{c.nome} {c.cognome}</td>
                  <td className="p-3 text-gray-300 text-xs">{c.email_contatto_bolletta || c.email || "—"}</td>
                  <td className="p-3 text-center text-white">{c.forniture?.[0]?.count ?? 0}</td>
                  <td className="p-3 text-center text-white">{c.bollette?.[0]?.count ?? 0}</td>
                  <td className="p-3 text-gray-400 text-right text-xs">{new Date(c.created_at).toLocaleDateString("it-IT")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-4">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 bg-white/10 text-white rounded-lg text-sm disabled:opacity-30"
          >←</button>
          <span className="text-gray-400 text-sm">{page} / {totalPages}</span>
          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 bg-white/10 text-white rounded-lg text-sm disabled:opacity-30"
          >→</button>
        </div>
      )}
    </div>
  );
}