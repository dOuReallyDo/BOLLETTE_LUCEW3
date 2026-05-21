"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/browser";

const navItems = [
  { href: "/admin/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/admin/clienti", label: "Clienti", icon: "👤" },
  { href: "/admin/bollette", label: "Bollette", icon: "📄" },
  { href: "/admin/proposte", label: "Proposte", icon: "📋" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
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
    <div className="min-h-screen bg-gradient-to-b from-[#1a1a2e] to-[#16213e] flex">
      {/* Sidebar */}
      <aside className="w-56 bg-[#111827] border-r border-white/10 flex flex-col fixed h-full">
        <div className="p-4 border-b border-white/10">
          <Link href="/admin/dashboard" className="block">
            <h1 className="text-[#FF6B00] font-bold text-lg">Luce & Gas</h1>
            <p className="text-gray-500 text-xs">Admin Dashboard</p>
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
                  : "text-gray-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t border-white/10">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:bg-white/5 hover:text-red-400 transition-all"
          >
            <span className="text-lg">🚪</span>
            Esci
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="ml-56 flex-1 p-6 min-h-screen">
        {children}
      </main>
    </div>
  );
}