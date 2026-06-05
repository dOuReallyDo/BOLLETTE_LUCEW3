"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Public access gate (WINDTRE LUCE&GAS look). Password-only, server-checked.
export default function EntraPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/site-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data?.error || "Password non valida");
      setLoading(false);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <main className="windtre min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-[#f0fdf4] to-[#ecfdf5]">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl border border-black/5 bg-white shadow-[0_10px_40px_rgba(0,0,0,0.08)] p-8"
      >
        <div className="text-center mb-7">
          <div className="font-extrabold tracking-tight text-3xl lowercase mb-1">
            <span className="text-[#00a9e0]">luce</span>
            <span className="text-[#ea580c] mx-1">&amp;</span>
            <span className="text-[#7bc043]">gas</span>
          </div>
          <p className="text-sm text-[var(--w3-muted)]">Inserisci la password per accedere</p>
        </div>

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoFocus
          required
          className="w-full rounded-xl border border-black/15 px-4 py-3 text-[#0f172a] focus:border-[#ea580c] focus:outline-none mb-3"
        />

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 mb-3">{error}</div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full w3-grad-brand text-white font-bold text-lg py-3 rounded-xl shadow-sm transition-all disabled:opacity-50"
        >
          {loading ? "Verifica…" : "Entra"}
        </button>
      </form>
    </main>
  );
}
