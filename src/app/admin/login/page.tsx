"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error } = await supabaseBrowser.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/admin/dashboard");
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1a1a2e] to-[#16213e] flex items-center justify-center p-4">
      <div className="bg-white/10 backdrop-blur rounded-2xl p-8 w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-4xl mb-2">🔒</div>
          <h1 className="text-white text-2xl font-bold">Admin Dashboard</h1>
          <p className="text-gray-400 text-sm mt-1">Luce & Gas POC — Accesso riservato</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-gray-400 text-xs block mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-white/10 text-white border border-gray-600 rounded-lg px-3 py-2.5 text-sm focus:border-[#FF6B00] focus:outline-none"
              placeholder="admin@example.com"
              required
            />
          </div>
          <div>
            <label className="text-gray-400 text-xs block mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-white/10 text-white border border-gray-600 rounded-lg px-3 py-2.5 text-sm focus:border-[#FF6B00] focus:outline-none"
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <div className="bg-red-500/20 border border-red-400/30 text-red-300 p-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#FF6B00] hover:bg-[#FF8C42] text-white font-bold py-3 rounded-xl transition-all text-lg disabled:opacity-50"
          >
            {loading ? "Accesso in corso…" : "Accedi"}
          </button>
        </form>

        <p className="text-gray-500 text-xs text-center mt-6">
          Accesso riservato agli amministratori del sistema.
        </p>
      </div>
    </div>
  );
}