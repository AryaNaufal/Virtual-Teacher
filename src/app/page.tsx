"use client";
import Link from "next/link";
import { AGENTS } from "@/lib/agents";
import { useOffice } from "@/store/office";
import { useTasks } from "@/store/tasks";
import { useData } from "@/store/data";

export default function Dashboard() {
  const history = useOffice((s) => s.history);
  const tasks = useTasks((s) => s.tasks);
  const data = useData();
  const inProgress = tasks.filter((t) => t.status === "pending" || t.status === "in_progress").length;
  const approval = tasks.filter((t) => t.status === "needs_approval").length;
  const done = tasks.filter((t) => t.status === "completed").length;
  const recent = AGENTS.flatMap((a) => history[a.id].map((h) => ({ ...h, who: a.name })))
    .sort((x, y) => y.at - x.at)
    .slice(0, 8);
  const totalTasks = tasks.length;

  const cards: [string, string, string][] = [
    ["Total siswa", String(data.students.length), ""],
    ["Total kelas", String(data.classes.length), ""],
    ["Mata pelajaran", String(data.subjects.length), ""],
    ["Total pekerjaan AI", String(totalTasks), "Sesi ini"],
    ["Selesai", String(done), ""],
    ["Dalam proses", String(inProgress), ""],
    ["Menunggu persetujuan", String(approval), ""],
  ];
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Selamat datang, Director</h1>
      <p className="mb-6 text-sm text-slate-500">Ringkasan kantor AI Anda.</p>
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {cards.map(([l, v, n]) => (
          <div key={l} className="rounded-2xl border border-[var(--line)] bg-white p-5">
            <div className="text-xs text-slate-500">{l}</div>
            <div className="mt-1 text-3xl font-bold text-[var(--green-d)]">{v}</div>
            <div className="text-[11px] text-slate-400">{n}</div>
          </div>
        ))}
        <Link href="/office" className="rounded-2xl bg-[#1f6b4a] p-5 text-white hover:bg-[#0f3d2b]">
          <div className="text-xs text-white/70">Virtual Office</div>
          <div className="mt-1 text-lg font-bold">Masuk kantor 3D →</div>
        </Link>
      </div>
      <h2 className="mb-3 mt-8 font-bold">Aktivitas terbaru</h2>
      <div className="rounded-2xl border border-[var(--line)] bg-white p-2">
        {recent.length === 0 && <p className="p-4 text-sm text-slate-400">Belum ada aktivitas. Berikan tugas ke AI di Virtual Office.</p>}
        {recent.map((r) => (
          <div key={r.id} className="border-b px-4 py-2 text-sm last:border-0"><b>{r.who}</b> — {r.text}</div>
        ))}
      </div>
    </div>
  );
}
