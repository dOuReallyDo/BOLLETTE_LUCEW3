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

type SortKey = "nome" | "cognome" | "codice_fiscale" | "created_at";
type SortDir = "asc" | "desc";

export default function AdminClientiPage() {
  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const limit = 20;

  const fetchData = (p: number) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), limit: String(limit) });
    if (search) params.set("search", search);
    fetch(`/admin/api/clienti?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setClienti(data.data || []);
        setTotal(data.total || 0);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(page); }, [page]);

  const handleSearch = () => { setPage(1); fetchData(1); };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const sorted = [...clienti].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    switch (sortKey) {
      case "nome": return dir * a.nome.localeCompare(b.nome);
      case "cognome": return dir * a.cognome.localeCompare(b.cognome);
      case "codice_fiscale": return dir * a.codice_fiscale.localeCompare(b.codice_fiscale);
      case "created_at": return dir * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      default: return 0;
    }
  });

  const totalPages = Math.ceil(total / limit);

  const SortIcon = ({ col }: { col: SortKey }) => (
    <span className="ml-1 text-[10px]">{sortKey === col ? (sortDir === "asc" ? "▲" : "▼") : "△"}</span>
  );

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
      ) : sorted.length === 0 ? (
        <div className="text-gray-500 text-center py-10">Nessun cliente trovato</div>
      ) : (
        <div className="bg-white/5 border border-white/10 rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 text-xs border-b border-white/10">
                <th className="text-left p-3 cursor-pointer hover:text-white" onClick={() => handleSort("codice_fiscale")}>Codice Fiscale <SortIcon col="codice_fiscale" /></th>
                <th className="text-left p-3 cursor-pointer hover:text-white" onClick={() => handleSort("nome")}>Nome <SortIcon col="nome" /></th>
                <th className="text-left p-3 cursor-pointer hover:text-white" onClick={() => handleSort("cognome")}>Cognome <SortIcon col="cognome" /></th>
                <th className="text-left p-3">Email</th>
                <th className="text-center p-3">Forniture</th>
                <th className="text-center p-3">Bollette</th>
                <th className="text-right p-3 cursor-pointer hover:text-white" onClick={() => handleSort("created_at")}>Data <SortIcon col="created_at" /></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((c) => (
                <tr key={c.codice_fiscale} className="border-b border-white/5 hover:bg-white/5">
                  <td className="p-3 text-white font-mono text-xs">{c.codice_fiscale}</td>
                  <td className="p-3 text-white">{c.nome}</td>
                  <td className="p-3 text-white">{c.cognome}</td>
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
          <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="px-3 py-1.5 bg-white/10 text-white rounded-lg text-sm disabled:opacity-30">←</button>
          <span className="text-gray-400 text-sm">{page} / {totalPages}</span>
          <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="px-3 py-1.5 bg-white/10 text-white rounded-lg text-sm disabled:opacity-30">→</button>
        </div>
      )}
    </div>
  );
}