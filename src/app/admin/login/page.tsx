"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { useTheme } from "@/lib/theme";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { theme } = useTheme();

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
  };

  return (
    <div data-theme={theme} className={`admin-view min-h-screen flex items-center justify-center p-4 ${
      theme === "light"
        ? "bg-gradient-to-b from-[#f5f5f7] to-[#ffffff]"
        : "bg-gradient-to-b from-[#1a1a2e] to-[#16213e]"
    }`}>
      <div className={`backdrop-blur rounded-2xl p-8 w-full max-w-sm ${
        theme === "light" ? "bg-white shadow-lg border border-gray-200" : "bg-white/10"
      }`}>
        <div className="text-center mb-8">
          <div className="text-4xl mb-2">🔒</div>
          <h1 className={`text-2xl font-bold ${theme === "light" ? "text-gray-900" : "text-white"}`}>Admin Dashboard</h1>
          <p className={`text-sm mt-1 ${theme === "light" ? "text-gray-400" : "text-gray-400"}`}>Luce & Gas POC — Accesso riservato</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className={`text-xs block mb-1 ${theme === "light" ? "text-gray-500" : "text-gray-400"}`}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`w-full rounded-lg px-3 py-2.5 text-sm focus:border-[#FF6B00] focus:outline-none ${
                theme === "light"
                  ? "bg-white text-gray-900 border border-gray-300"
                  : "bg-white/10 text-white border border-gray-600"
              }`}
              placeholder="admin@example.com"
              required
            />
          </div>
          <div>
            <label className={`text-xs block mb-1 ${theme === "light" ? "text-gray-500" : "text-gray-400"}`}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`w-full rounded-lg px-3 py-2.5 text-sm focus:border-[#FF6B00] focus:outline-none ${
                theme === "light"
                  ? "bg-white text-gray-900 border border-gray-300"
                  : "bg-white/10 text-white border border-gray-600"
              }`}
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

        <p className={`text-xs text-center mt-6 ${theme === "light" ? "text-gray-400" : "text-gray-500"}`}>
          Accesso riservato agli amministratori del sistema.
        </p>
      </div>
    </div>
  );
}