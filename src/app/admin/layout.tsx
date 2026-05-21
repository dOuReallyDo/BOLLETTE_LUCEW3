"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { useTheme } from "@/lib/theme";

const navItems = [
  { href: "/admin/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/admin/clienti", label: "Clienti", icon: "👤" },
  { href: "/admin/bollette", label: "Bollette", icon: "📄" },
  { href: "/admin/proposte", label: "Proposte", icon: "📋" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, toggle: toggleTheme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    // Skip auth check for login page
    if (pathname === "/admin/login" || pathname === "/admin") {
      setLoading(false);
      return;
    }
    supabaseBrowser.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push("/admin/login");
      } else {
        setAuthed(true);
      }
      setLoading(false);
    });
  }, [pathname, router]);

  // Login page renders without sidebar
  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  // Redirect /admin to /admin/dashboard
  if (pathname === "/admin") {
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#1a1a2e] to-[#16213e] flex items-center justify-center">
        <div className="text-white text-lg">Caricamento…</div>
      </div>
    );
  }

  if (!authed) {
    return null;
  }

  const handleLogout = async () => {
    await supabaseBrowser.auth.signOut();
    router.push("/admin/login");
  };

  return (
    <div data-theme={theme} className="min-h-screen flex" style={{
      background: theme === "light"
        ? "linear-gradient(to bottom, var(--bg-primary), var(--bg-secondary))"
        : undefined
    }}>
      {/* Sidebar */}
      <aside className={`w-56 border-r flex flex-col fixed h-full transition-colors ${
        theme === "light"
          ? "bg-white border-gray-200"
          : "bg-[#111827] border-white/10"
      }`}>
        <div className={`p-4 border-b ${theme === "light" ? "border-gray-200" : "border-white/10"}`}>
          <Link href="/admin/dashboard" className="block">
            <h1 className="text-[#FF6B00] font-bold text-lg">Luce & Gas</h1>
            <p className={`text-xs ${theme === "light" ? "text-gray-400" : "text-gray-500"}`}>Admin Dashboard</p>
          </Link>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                pathname === item.href
                  ? "bg-[#FF6B00]/20 text-[#FF6B00] font-semibold"
                  : theme === "light"
                    ? "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                    : "text-gray-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className={`p-3 border-t flex items-center gap-2 ${theme === "light" ? "border-gray-200" : "border-white/10"}`}>
          <button
            onClick={toggleTheme}
            className={`flex-1 flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
              theme === "light"
                ? "text-gray-500 hover:bg-gray-100"
                : "text-gray-400 hover:bg-white/5"
            }`}
            title={theme === "dark" ? "Tema chiaro" : "Tema scuro"}
          >
            <span className="text-lg">{theme === "dark" ? "☀️" : "🌙"}</span>
            {theme === "dark" ? "Chiaro" : "Scuro"}
          </button>
          <button
            onClick={handleLogout}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
              theme === "light"
                ? "text-gray-500 hover:bg-gray-100 hover:text-red-500"
                : "text-gray-400 hover:bg-white/5 hover:text-red-400"
            }`}
          >
            <span className="text-lg">🚪</span>
            Esci
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className={`admin-view ml-56 flex-1 p-6 min-h-screen transition-colors ${
        theme === "light" ? "bg-[#f5f5f7]" : ""
      }`}>
        {children}
      </main>
    </div>
  );
}