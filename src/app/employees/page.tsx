"use client";
import { useRouter } from "next/navigation";
import { AGENTS, STATUS_META } from "@/lib/agents";
import { useOffice } from "@/store/office";
import { Brain } from "@/components/Brain";

export default function Page() {
  const router = useRouter();
  const statuses = useOffice((s) => s.statuses);
  const select = useOffice((s) => s.select);
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">AI Employees</h1>
      <p className="mb-6 text-sm text-slate-500">Klik kartu untuk melihat pekerja di kantor. "Otak" adalah model AI yang dipakai tiap karyawan (utama, lalu cadangan bila sibuk).</p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {AGENTS.map((a) => (
          <div key={a.id} role="link" tabIndex={0} onClick={() => { select(a.id); router.push("/office"); }} onKeyDown={(ev) => { if (ev.key === "Enter") { select(a.id); router.push("/office"); } }}
            className="cursor-pointer rounded-2xl border border-[var(--line)] bg-white p-5 text-left transition hover:shadow-md">
            <div className="flex items-center justify-between gap-2">
              <div className="font-bold">{a.name} <span className="font-normal text-slate-500">· {a.title}</span></div>
              <span className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white" style={{ background: STATUS_META[statuses[a.id]].color }}>
                {STATUS_META[statuses[a.id]].label}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-600">{a.description}</p>
            <div className="mt-2 text-xs text-slate-400">{a.room}</div>
            <h2 className="mt-3 text-[11px] font-bold uppercase tracking-wide text-slate-400">Otak (model AI)</h2>
            <div className="mt-1.5"><Brain agentId={a.id} name={a.name} compact /></div>
          </div>
        ))}
      </div>
    </div>
  );
}
