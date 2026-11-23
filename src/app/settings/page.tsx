"use client";
import { useEffect, useState } from "react";
import { useData } from "@/store/data";
import { useTasks } from "@/store/tasks";
import { dbEnabled } from "@/lib/dbmode";
import { AGENTS } from "@/lib/agents";
import { wipeLocal, useSyncStatus } from "@/components/layout/Hydrator";
import { Card, Page, btn2Cls } from "@/components/ui";

export default function SettingsPage() {
  const sync = useSyncStatus();
  const [ai, setAi] = useState<{ label: string; model: string; visionModel: string; host: string; configured: boolean; brains?: Record<string, string[]> } | null>(null);
  useEffect(() => {
    fetch("/api/ai-status").then((r) => (r.ok ? r.json() : null)).then(setAi).catch(() => setAi(null));
  }, []);
  const d = useData();
  const tasks = useTasks((s) => s.tasks);

  return (
    <Page title="Settings" sub="Penyimpanan data, cadangan, dan status koneksi.">
      <div className="grid max-w-3xl gap-4">
        <Card>
          <h2 className="mb-1 font-bold">Model AI</h2>
          {!ai ? <p className="text-sm text-slate-500">Memeriksa…</p> : ai.configured ? (
            <p className="text-sm text-slate-600">Aktif: <b>{ai.label}</b> · model <code className="rounded bg-slate-100 px-1">{ai.model}</code>{ai.visionModel !== ai.model && <> (gambar: <code className="rounded bg-slate-100 px-1">{ai.visionModel}</code>)</>} · {ai.host}</p>
          ) : (
            <p className="text-sm text-amber-700">Belum ada kunci AI. Perintah memakai aturan kata kunci; materi, soal, esai, dan baca gambar belum aktif. Isi <code>OPENAI_API_KEY</code>, <code>GEMINI_API_KEY</code>, atau <code>ANTHROPIC_API_KEY</code> di .env.local lalu restart server.</p>
          )}
          {ai?.configured && ai.brains && (
            <div className="mt-3">
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Otak tiap karyawan</h3>
              <ul className="divide-y rounded-lg border text-sm">
                {AGENTS.map((a) => {
                  const chain = ai.brains?.[a.id];
                  return (
                    <li key={a.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-3 py-1.5">
                      <span className="w-20 shrink-0 font-medium">{a.name}</span>
                      {chain ? (
                        <span className="min-w-0 flex-1 break-words text-xs">
                          {chain.map((m, i) => <span key={m}>{i > 0 && <span className="text-slate-300"> → </span>}<code className={`rounded px-1 ${i === 0 ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-500"}`}>{m}</code></span>)}
                        </span>
                      ) : <span className="text-xs text-slate-400">tanpa AI (menghitung langsung dari data)</span>}
                    </li>
                  );
                })}
              </ul>
              <p className="mt-1 text-xs text-slate-400">Model pertama dicoba lebih dulu; bila sibuk atau kuota habis, otomatis pindah ke model berikutnya.</p>
            </div>
          )}
          <p className="mt-2 text-xs text-slate-400">Penyedia dipilih otomatis dari .env.local (atur AI_PROVIDER bila ada lebih dari satu kunci). Lihat README.</p>
        </Card>
        <Card>
          <h2 className="mb-1 font-bold">Penyimpanan</h2>
          <p className="text-sm text-slate-600">
            {dbEnabled
              ? `Terhubung ke database MySQL (${sync.email ?? "belum login"}). Status: ${sync.state}.`
              : "Mode lokal: data tersimpan di browser ini saja. Ikuti README untuk mengaktifkan database MySQL (login + sinkronisasi + penyimpanan berkas)."}
          </p>
          <p className="mt-1 text-xs text-slate-400">{d.students.length} siswa · {d.classes.length} kelas · {d.docs.length} dokumen · {tasks.length} tugas</p>
        </Card>
        <Card>
          <h2 className="mb-1 font-bold">Cadangan data</h2>
          <p className="mb-2 text-sm text-slate-600">Unduh seluruh data (siswa, absensi, nilai, arsip, tugas) sebagai file JSON. File berisi data siswa yang bersifat privat; simpan di tempat aman.</p>
          <button
            className={btn2Cls}
            onClick={() => {
              const { classes, subjects, students, attendance, grades, finals, quizzes, submissions, docs, files, essays, papers } = useData.getState();
              const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), classes, subjects, students, attendance, grades, finals, quizzes, submissions, docs, files, essays, papers, tasks }, null, 2)], { type: "application/json" });
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = `ai-teacher-office-backup-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
            }}
          >Unduh cadangan JSON</button>
        </Card>
        {!dbEnabled && (
          <Card>
            <h2 className="mb-1 font-bold text-red-700">Hapus semua data lokal</h2>
            <p className="mb-2 text-sm text-slate-600">Menghapus semua data di browser ini. Tidak dapat dibatalkan; unduh cadangan dahulu.</p>
            <button className="rounded-lg border border-red-300 px-3 py-2 text-sm text-red-700 hover:bg-red-50" onClick={() => confirm("Hapus SEMUA data di browser ini? Tindakan ini tidak dapat dibatalkan.") && wipeLocal()}>Hapus semua data</button>
          </Card>
        )}
      </div>
    </Page>
  );
}
