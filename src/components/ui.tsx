"use client";
import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { Row, readTable } from "@/lib/table";

export function Page({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">{title}</h1>
      {sub && <p className="mb-5 text-sm text-slate-500">{sub}</p>}
      {children}
    </div>
  );
}

export const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`rounded-2xl border border-[var(--line)] bg-white p-4 ${className}`}>{children}</div>
);

export const inputCls = "rounded-lg border px-3 py-2 text-sm outline-none focus:border-emerald-500";
export const btnCls = "rounded-lg bg-[#1f6b4a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0f3d2b] disabled:opacity-40";
export const btn2Cls = "rounded-lg border px-3 py-2 text-sm hover:bg-slate-50";

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">{children}</div>;
}

export function FileImport({ label, hint, onRows }: { label: string; hint: string; onRows: (rows: Row[]) => string | void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <div>
      <input
        ref={ref} type="file" accept=".csv,.xlsx" hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          try {
            const rows = await readTable(f);
            setMsg({ ok: true, text: onRows(rows) || `${rows.length} baris dibaca.` });
          } catch (err) {
            setMsg({ ok: false, text: (err as Error).message });
          }
        }}
      />
      <button onClick={() => ref.current?.click()} className={`${btn2Cls} flex items-center gap-2`}><Upload size={15} /> {label}</button>
      <p className="mt-1 text-[11px] text-slate-400">{hint}</p>
      {msg && <p className={`mt-1 text-xs ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{msg.text}</p>}
    </div>
  );
}
