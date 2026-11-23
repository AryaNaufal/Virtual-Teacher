"use client";
import { useState } from "react";
import { X } from "lucide-react";
import clsx from "clsx";
import { useTasks, TaskStatus } from "@/store/tasks";
import { AGENTS } from "@/lib/agents";
import { PRIORITY_LABEL, StatusBadge, agentOf, fmtDate } from "@/components/tasks/TaskUI";

const TABS: { key: "all" | TaskStatus; label: string }[] = [
  { key: "all", label: "All Tasks" },
  { key: "pending", label: "Pending" },
  { key: "in_progress", label: "In Progress" },
  { key: "completed", label: "Completed" },
  { key: "needs_approval", label: "Needs Approval" },
  { key: "failed", label: "Failed" },
];

export default function TasksPage() {
  const { tasks, createTasks, approve, reject, retry, remove, clearFinished } = useTasks();
  const [tab, setTab] = useState<"all" | TaskStatus>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [agentId, setAgentId] = useState("grading");
  const [priority, setPriority] = useState<"low" | "normal" | "high">("normal");

  const list = tasks.filter((t) => tab === "all" || t.status === tab);
  const open = tasks.find((t) => t.id === openId);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Task Management</h1>
      <p className="mb-5 text-sm text-slate-500">Semua pekerjaan AI. Buat tugas langsung di sini, atau lewat Command Center.</p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) return;
          createTasks([{ agentId, title: title.trim(), priority }]);
          setTitle("");
        }}
        className="mb-5 flex flex-wrap gap-2 rounded-2xl border border-[var(--line)] bg-white p-3"
      >
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nama pekerjaan baru…" className="min-w-[220px] flex-1 rounded-lg border px-3 py-2 text-sm outline-none focus:border-emerald-500" />
        <select value={agentId} onChange={(e) => setAgentId(e.target.value)} className="rounded-lg border px-2 text-sm">
          {AGENTS.filter((a) => a.id !== "manager").map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
        </select>
        <select value={priority} onChange={(e) => setPriority(e.target.value as typeof priority)} className="rounded-lg border px-2 text-sm">
          <option value="low">Prioritas rendah</option><option value="normal">Normal</option><option value="high">Tinggi</option>
        </select>
        <button className="rounded-lg bg-[#1f6b4a] px-4 text-sm font-semibold text-white hover:bg-[#0f3d2b]">Buat tugas</button>
      </form>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {TABS.map((t) => {
          const n = t.key === "all" ? tasks.length : tasks.filter((x) => x.status === t.key).length;
          return (
            <button key={t.key} onClick={() => setTab(t.key)} className={clsx("rounded-full px-3 py-1 text-sm", tab === t.key ? "bg-[#0f3d2b] text-white" : "bg-white text-slate-600 hover:bg-slate-100")}>
              {t.label} <span className="opacity-60">{n}</span>
            </button>
          );
        })}
      </div>

      {tasks.some((t) => t.status === "completed" || t.status === "failed") && (
        <button
          onClick={() => { const n = tasks.filter((t) => t.status === "completed" || t.status === "failed").length; if (confirm(`Hapus ${n} tugas yang sudah selesai/gagal? Dokumen hasilnya di arsip tidak ikut terhapus.`)) clearFinished(); }}
          className="mb-2 text-xs text-slate-500 hover:text-red-600 hover:underline"
        >Bersihkan tugas selesai &amp; gagal</button>
      )}
      <div className="overflow-x-auto rounded-2xl border border-[var(--line)] bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b text-xs uppercase text-slate-400">
            <tr><th className="p-3">ID</th><th>Pekerjaan</th><th>AI</th><th>Dibuat</th><th>Deadline</th><th>Prioritas</th><th>Status</th></tr>
          </thead>
          <tbody>
            {list.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-slate-400">Tidak ada tugas.</td></tr>}
            {list.map((t) => (
              <tr key={t.id} onClick={() => setOpenId(t.id)} className="cursor-pointer border-b last:border-0 hover:bg-slate-50">
                <td className="p-3 font-mono text-xs">{t.id}</td>
                <td className="max-w-[320px] truncate">{t.title}</td>
                <td>{agentOf(t.agentId)?.name}</td>
                <td className="text-xs text-slate-500">{fmtDate(t.createdAt)}</td>
                <td className="text-xs text-slate-500">{fmtDate(t.deadline)}</td>
                <td>{PRIORITY_LABEL[t.priority]}</td>
                <td><StatusBadge task={t} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && (
        <aside className="fixed bottom-0 right-0 top-0 z-30 w-[400px] overflow-y-auto border-l bg-white p-6 shadow-2xl">
          <button onClick={() => setOpenId(null)} className="absolute right-4 top-4 rounded p-1 text-slate-400 hover:bg-slate-100"><X size={16} /></button>
          <div className="font-mono text-xs text-slate-400">{open.id}</div>
          <h2 className="mt-1 pr-6 font-bold">{open.title}</h2>
          <div className="mt-2 flex items-center gap-2 text-sm text-slate-600"><StatusBadge task={open} /> {agentOf(open.agentId)?.title}</div>
          <div className="mt-1 text-xs text-slate-400">Deadline {fmtDate(open.deadline)} · Prioritas {PRIORITY_LABEL[open.priority]}</div>

          <h4 className="mt-5 text-xs font-bold uppercase text-slate-400">Hasil pekerjaan</h4>
          <p className="mt-1 rounded-lg bg-slate-50 p-3 text-sm">{open.result ?? "Belum ada hasil."}</p>

          {open.status === "needs_approval" && (
            <div className="mt-3 flex gap-2">
              <button onClick={() => approve(open.id)} className="flex-1 rounded-lg bg-emerald-600 py-2 text-sm font-semibold text-white">Setujui</button>
              <button onClick={() => reject(open.id)} className="flex-1 rounded-lg border py-2 text-sm">Tolak</button>
            </div>
          )}
          {open.status === "failed" && <button onClick={() => retry(open.id)} className="mt-3 w-full rounded-lg border py-2 text-sm">Coba ulang</button>}
          {open.status !== "in_progress" && open.status !== "pending" && (
            <button onClick={() => { if (confirm(`Hapus tugas ${open.id}?`)) { remove(open.id); setOpenId(null); } }} className="mt-2 w-full rounded-lg border border-red-200 py-2 text-sm text-red-600 hover:bg-red-50">Hapus tugas</button>
          )}

          <h4 className="mt-5 text-xs font-bold uppercase text-slate-400">Riwayat aktivitas</h4>
          <ul className="mt-2 space-y-1.5 text-sm">
            {open.logs.map((l, i) => (
              <li key={i} className="rounded-lg bg-slate-50 px-3 py-2"><div>{l.text}</div><div className="text-[11px] text-slate-400">{fmtDate(l.at)}</div></li>
            ))}
          </ul>
        </aside>
      )}
    </div>
  );
}
