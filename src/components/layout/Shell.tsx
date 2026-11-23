"use client";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { useSyncStatus } from "./Hydrator";
import { dbEnabled } from "@/lib/dbmode";

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const sync = useSyncStatus((s) => s.state);
  if (path === "/login") return <>{children}</>;
  // Mencegah pengeditan sebelum data dari server selesai dimuat (kalau tidak, hasil muat bisa menimpa ketikan).
  const loading = dbEnabled && (sync === "off" || sync === "loading");
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="relative flex-1 overflow-y-auto">
        {children}
        {loading && (
          <div className="absolute inset-0 z-50 grid place-items-center bg-white/80 text-sm text-slate-600">Memuat data dari server…</div>
        )}
      </main>
    </div>
  );
}
