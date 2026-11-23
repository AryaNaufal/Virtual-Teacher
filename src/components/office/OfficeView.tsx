"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { ArrowLeft, MessageSquare, Moon, Sun, Sunrise, Sunset } from "lucide-react";
import { AGENTS, STATUS_META } from "@/lib/agents";
import { useOffice } from "@/store/office";
import { ProfilePanel } from "./ProfilePanel";
import { useSim } from "@/lib/sim/store";

const loading = () => <div className="grid h-full place-items-center text-slate-500">Memuat kantor…</div>;
const Office2D = dynamic(() => import("./OfficeCanvas"), { ssr: false, loading });
const Office3D = dynamic(() => import("../office3d/Scene3D"), { ssr: false, loading });
type Mode = "2d" | "3d";

/** Jam kantor = jam dunia nyata (hanya tampilan, tanpa kontrol). */
function ClockChip() {
  const clock = useSim((s) => s.view?.clock);
  if (!clock) return null;
  const h = Number(clock.slice(0, 2)), Icon = h < 5 || h >= 19 ? Moon : h < 9 ? Sunrise : h < 16 ? Sun : Sunset;
  const date = new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "short" });
  return (
    <div className="absolute bottom-3 left-3 z-10 flex items-center gap-2 rounded-2xl bg-slate-900/85 px-3 py-1.5 text-white shadow-lg backdrop-blur select-none">
      <Icon size={15} className={h < 5 || h >= 19 ? "text-indigo-300" : "text-amber-300"} />
      <div className="leading-tight"><div className="font-mono text-sm font-bold">{clock}</div><div className="text-[10px] capitalize text-white/50">{date}</div></div>
    </div>
  );
}

/** Kantor memenuhi layar; kontrol hanya berupa elemen kecil melayang (daftar agen, kembali, instruksi). */
export function OfficeView() {
  const statuses = useOffice((s) => s.statuses);
  const select = useOffice((s) => s.select);
  const selectedId = useOffice((s) => s.selectedId);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.key === "Escape" && !(t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) select(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [select]);

  const [mode, setMode] = useState<Mode>("3d");
  useEffect(() => { try { const m = localStorage.getItem("ai-office-view"); if (m === "2d" || m === "3d") setMode(m); } catch { /* abaikan */ } }, []);
  const pick = (m: Mode) => { setMode(m); try { localStorage.setItem("ai-office-view", m); } catch { /* abaikan */ } };

  const vals = Object.values(statuses);
  const busy = vals.filter((s) => s === "WORKING" || s === "PROCESSING").length;
  const approval = vals.filter((s) => s === "NEEDS_APPROVAL").length;

  return (
    <div className="relative h-full w-full">
      {mode === "3d" ? <Office3D key="3d" /> : <Office2D key="2d" />}

      {/* kiri atas: kembali ke tampilan sebelumnya, hanya saat fokus pada agen */}
      {selectedId && (
        <button onClick={() => select(null)} className="absolute left-3 top-3 z-10 flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-xs font-semibold text-[#1f6b4a] shadow backdrop-blur hover:bg-white">
          <ArrowLeft size={14} /> Kembali <kbd className="rounded bg-slate-100 px-1 text-[10px] font-normal text-slate-500">Esc</kbd>
        </button>
      )}

      {/* atas tengah: agen sebagai chip kecil (klik untuk fokus) */}
      <div className="absolute left-1/2 top-3 z-10 flex max-w-[calc(100%-9rem)] -translate-x-1/2 gap-1 overflow-x-auto rounded-full bg-white/85 p-1 shadow backdrop-blur">
        {AGENTS.map((a) => (
          <button
            key={a.id}
            onClick={() => select(a.id)}
            title={`${a.name} · ${a.title}`}
            className={clsx("flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs transition", selectedId === a.id ? "bg-[#1f6b4a] font-semibold text-white" : "text-slate-700 hover:bg-slate-100")}
          >
            <span className="h-2 w-2 rounded-full" style={{ background: STATUS_META[statuses[a.id]].color }} />
            {a.name}
          </button>
        ))}
      </div>

      {/* kanan atas: pilihan tampilan 2D / 3D */}
      {!selectedId && (
        <div className="absolute right-3 top-3 z-10 flex rounded-full bg-white/85 p-0.5 text-xs font-semibold shadow backdrop-blur">
          {(["3d", "2d"] as Mode[]).map((m) => (
            <button key={m} onClick={() => pick(m)} className={clsx("rounded-full px-3 py-1 uppercase transition", mode === m ? "bg-[#1f6b4a] text-white" : "text-slate-600 hover:bg-slate-100")}>{m}</button>
          ))}
        </div>
      )}

      {/* ringkasan, hanya bila tidak ada panel profil */}
      {!selectedId && (busy > 0 || approval > 0) && (
        <div className="absolute right-3 top-12 z-10 flex gap-1.5 text-xs">
          {busy > 0 && <span className="rounded-full bg-blue-500/90 px-2.5 py-1 font-semibold text-white shadow">{busy} bekerja</span>}
          {approval > 0 && <Link href="/tasks" className="rounded-full bg-red-500/90 px-2.5 py-1 font-semibold text-white shadow">{approval} menunggu persetujuan</Link>}
        </div>
      )}

      {/* bawah tengah: pintu cepat ke Command Center */}
      <Link href="/command" className="absolute bottom-4 right-3 z-10 flex items-center gap-2 rounded-full bg-[#0f3d2b]/90 px-4 py-2 text-sm font-semibold text-white shadow-lg backdrop-blur hover:bg-[#0f3d2b]">
        <MessageSquare size={16} /> Beri instruksi
      </Link>

      {/* bawah kiri: jam dunia nyata */}
      <ClockChip />

      <ProfilePanel />
    </div>
  );
}
