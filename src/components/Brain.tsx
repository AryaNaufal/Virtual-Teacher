"use client";
import { modelParts, useBrains } from "@/lib/useBrains";

/** "Otak" (model AI) satu karyawan: model utama lalu cadangan. `compact` = ringkas untuk kartu daftar. */
export function Brain({ agentId, name, compact = false }: { agentId: string; name: string; compact?: boolean }) {
  const info = useBrains();
  const chain = info?.brains[agentId];
  if (!info) return <span className="text-xs text-slate-400">Memeriksa…</span>;
  if (!chain) return <span className="text-xs text-slate-500">Tanpa model AI. {name} menghitung langsung dari data (pasti dan tanpa biaya).</span>;
  if (!info.configured) return <span className="text-xs text-amber-700">Belum ada kunci AI; memakai aturan kata kunci. Isi kunci di .env.local.</span>;
  return (
    <ol className="space-y-1.5">
      {chain.map((m, i) => {
        const p = modelParts(m);
        return (
          <li key={m} className="flex items-baseline gap-2" title={m}>
            <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${i === 0 ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-500"}`}>{i === 0 ? "UTAMA" : `CADANGAN ${i}`}</span>
            <span className="min-w-0 break-words font-mono text-xs">{p.name}{p.vendor && <span className="text-slate-400"> · {p.vendor}</span>}{p.free && <span className="ml-1 rounded bg-sky-100 px-1 font-sans text-[10px] font-semibold text-sky-700">gratis</span>}</span>
          </li>
        );
      })}
      {!compact && <li className="pt-1 text-[11px] leading-snug text-slate-400">via {info.label}. Bila model utama sibuk, otomatis pindah ke cadangan.</li>}
    </ol>
  );
}
