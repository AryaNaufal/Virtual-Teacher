"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import clsx from "clsx";
import { ChevronsLeft, ChevronsRight, LogOut } from "lucide-react";
import { NAV } from "@/lib/nav";
import { dbEnabled } from "@/lib/dbmode";
import { useSyncStatus, wipeLocal } from "./Hydrator";

const RAIL_KEY = "ai-office-rail";

/** Menu minimalis: rail ikon sempit (label muncul saat disorot kursor), bisa dilebarkan lewat tombol di bawah. */
export function Sidebar() {
  const path = usePathname();
  const router = useRouter();
  const sync = useSyncStatus();
  const [open, setOpen] = useState(false);

  useEffect(() => { try { setOpen(localStorage.getItem(RAIL_KEY) === "open"); } catch { /* storage tidak tersedia */ } }, []);
  const toggle = () => setOpen((o) => { const n = !o; try { localStorage.setItem(RAIL_KEY, n ? "open" : "closed"); } catch { /* abaikan */ } return n; });

  const dot = !dbEnabled ? "bg-white/40" : { off: "bg-white/40", loading: "bg-amber-400", saving: "bg-sky-400", synced: "bg-emerald-400", error: "bg-red-400" }[sync.state];
  const dotText = !dbEnabled ? "Mode lokal: data hanya di browser ini" : `${sync.email ?? ""} · ${{ off: "belum tersambung", loading: "memuat data", synced: "tersinkron", saving: "menyimpan", error: "gagal sinkron" }[sync.state]}`;

  return (
    <aside className={clsx("flex shrink-0 flex-col bg-[#0f3d2b] text-white transition-[width] duration-200", open ? "w-52" : "w-14")}>
      <div className="flex h-14 shrink-0 items-center gap-2.5 px-3">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#3ddc97] text-sm font-black text-[#0f3d2b]">AI</div>
        {open && <div className="min-w-0 leading-tight"><div className="truncate text-sm font-bold">Teacher Office</div></div>}
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto overflow-x-hidden px-2 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? path === "/" : path.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              className={clsx("group relative flex h-9 items-center gap-3 rounded-lg px-2.5 text-sm transition", active ? "bg-white/15 font-semibold" : "text-white/70 hover:bg-white/10 hover:text-white")}
            >
              <Icon size={18} className="shrink-0" />
              {open && <span className="truncate">{label}</span>}
              {!open && (
                <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs text-white opacity-0 shadow-lg transition group-hover:opacity-100">
                  {label}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="shrink-0 space-y-0.5 border-t border-white/10 px-2 py-2">
        <div className="group relative flex h-9 items-center gap-3 rounded-lg px-2.5 text-xs text-white/70" title={dotText}>
          <span className={clsx("h-2.5 w-2.5 shrink-0 rounded-full", dot, sync.state === "loading" && dbEnabled && "animate-pulse")} />
          {open && <span className="truncate">{dbEnabled ? sync.email ?? "…" : "Mode lokal"}</span>}
        </div>
        {dbEnabled && (
          <button
            aria-label="Keluar"
            title="Keluar"
            onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); wipeLocal(); localStorage.removeItem("ai-office-owner"); router.replace("/login"); router.refresh(); }}
            className="flex h-9 w-full items-center gap-3 rounded-lg px-2.5 text-sm text-white/70 hover:bg-white/10 hover:text-white"
          >
            <LogOut size={18} className="shrink-0" />{open && <span>Keluar</span>}
          </button>
        )}
        <button aria-label={open ? "Ciutkan menu" : "Lebarkan menu"} title={open ? "Ciutkan menu" : "Lebarkan menu"} onClick={toggle} className="flex h-9 w-full items-center gap-3 rounded-lg px-2.5 text-sm text-white/50 hover:bg-white/10 hover:text-white">
          {open ? <ChevronsLeft size={18} className="shrink-0" /> : <ChevronsRight size={18} className="shrink-0" />}{open && <span>Ciutkan</span>}
        </button>
      </div>
    </aside>
  );
}
