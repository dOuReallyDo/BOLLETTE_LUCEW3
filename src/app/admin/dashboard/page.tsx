"use client";

import { useEffect, useState } from "react";

interface Stats {
  clienti_count: number;
  bollette_count: number;
  proposte_count: number;
  accettate_count: number;
  recent: Array<{
    numero_fattura: string | null;
    totale_da_pagare: number | null;
    tipo_bolletta: string;
    created_at: string;
    clienti: { nome: string; cognome: string; codice_fiscale: string } | null;
  }>;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/admin/api/stats")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setStats(data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-white text-center py-20">Caricamento…</div>;

  if (!stats) return <div className="text-red-400 text-center py-20">Errore nel caricamento dati</div>;

  const cards = [
    { label: "Clienti", value: stats.clienti_count, icon: "👤", color: "from-blue-500/20 to-blue-600/10" },
    { label: "Bollette", value: stats.bollette_count, icon: "📄", color: "from-green-500/20 to-green-600/10" },
    { label: "Proposte", value: stats.proposte_count, icon: "📋", color: "from-[#FF6B00]/20 to-orange-600/10" },
    { label: "Accettate", value: stats.accettate_count, icon: "✅", color: "from-emerald-500/20 to-emerald-600/10" },
  ];

  return (
    <div>
      <h1 className="text-white text-2xl font-bold mb-6">Dashboard</h1>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map((card) => (
          <div key={card.label} className={`bg-gradient-to-br ${card.color} border border-white/10 rounded-xl p-5`}>
            <div className="text-3xl mb-2">{card.icon}</div>
            <p className="text-gray-400 text-xs">{card.label}</p>
            <p className="text-white text-3xl font-bold">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Recent bollette */}
      <div className="bg-white/5 border border-white/10 rounded-xl">
        <div className="p-4 border-b border-white/10">
          <h2 className="text-white font-semibold">Ultime bollette caricate</h2>
        </div>
        {stats.recent.length === 0 ? (
          <p className="text-gray-500 text-sm p-4">Nessuna bolletta ancora</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 text-xs border-b border-white/5">
                  <th className="text-left p-3">Cliente</th>
                  <th className="text-left p-3">N° Fattura</th>
                  <th className="text-left p-3">Tipo</th>
                  <th className="text-right p-3">Totale</th>
                  <th className="text-right p-3">Data</th>
                </tr>
              </thead>
              <tbody>
                {stats.recent.map((b, i) => (
                  <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                    <td className="p-3 text-white">
                      {b.clienti ? `${b.clienti.nome} ${b.clienti.cognome}` : "—"}
                    </td>
                    <td className="p-3 text-gray-300 font-mono text-xs">{b.numero_fattura || "—"}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        b.tipo_bolletta === "periodica" ? "bg-blue-500/20 text-blue-300" :
                        b.tipo_bolletta === "chiusura" ? "bg-red-500/20 text-red-300" :
                        "bg-gray-500/20 text-gray-300"
                      }`}>
                        {b.tipo_bolletta}
                      </span>
                    </td>
                    <td className="p-3 text-white text-right">€{(b.totale_da_pagare ?? 0).toFixed(2)}</td>
                    <td className="p-3 text-gray-400 text-right text-xs">
                      {new Date(b.created_at).toLocaleDateString("it-IT")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}