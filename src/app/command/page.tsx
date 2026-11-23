"use client";
import { useEffect, useRef, useState } from "react";
import { Paperclip, Send } from "lucide-react";
import { ACCEPT, Processed, processUpload } from "@/lib/upload";
import { importAttendance, looksLikeAttendance } from "@/lib/importers";
import { useTasks } from "@/store/tasks";
import { StatusBadge, agentOf } from "@/components/tasks/TaskUI";
import type { PlannedTask } from "@/lib/router";

interface Msg { id: string; role: "user" | "manager"; text: string; taskIds?: string[] }

const EXAMPLES = [
  "Tolong rekap absensi kelas 10A bulan November.",
  "AI Grading, hitung nilai rata-rata siswa kelas 11B.",
  "AI Content, buatkan materi Microsoft Excel untuk kelas 10.",
  "AI Assignment, buatkan 20 soal pilihan ganda tentang Microsoft Word.",
  "AI Reporting, buatkan laporan perkembangan akademik siswa.",
];

export default function CommandCenter() {
  const tasks = useTasks((s) => s.tasks);
  const createTasks = useTasks((s) => s.createTasks);
  const approve = useTasks((s) => s.approve);
  const reject = useTasks((s) => s.reject);
  const [msgs, setMsgs] = useState<Msg[]>([
    { id: "hello", role: "manager", text: "Halo, saya Maya, AI Office Manager. Sampaikan instruksi dalam bahasa Indonesia; saya akan membagi pekerjaannya ke AI Specialist yang sesuai." },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [attach, setAttach] = useState<Processed | null>(null);
  const [upErr, setUpErr] = useState("");
  const [upBusy, setUpBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, tasks]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    setInput("");
    setBusy(true);
    const att = attach;
    setAttach(null);
    setMsgs((m) => [...m, { id: crypto.randomUUID(), role: "user", text: att ? `${message}\n📎 ${att.name}` : message }]);
    let importNote = "";
    if (att?.rows && looksLikeAttendance(att.rows)) {
      const r = importAttendance(att.rows);
      importNote = ` Dari berkas ${att.name}: ${r.ok} catatan absensi diimpor${r.bad ? `, ${r.bad} baris dilewati (siswa tidak ditemukan/format salah)` : ""}.`;
    }
    try {
      const res = await fetch("/api/command", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message }) });
      const data = (await res.json()) as { tasks?: PlannedTask[]; source?: string; error?: string };
      if (!res.ok || !data.tasks) throw new Error(data.error ?? "Gagal memproses instruksi");
      if (data.tasks.length === 0) {
        setMsgs((m) => [...m, { id: crypto.randomUUID(), role: "manager", text: "Maaf, saya belum bisa menentukan AI yang cocok. Coba sebut jenis pekerjaannya (absensi, nilai, soal, materi, laporan, arsip) atau nama AI-nya, mis. “AI Grading, …”." }]);
      } else {
        const created = createTasks(data.tasks, { fromCommand: true, attachment: att ? { name: att.name, text: att.text } : undefined });
        const names = created.map((t) => `${agentOf(t.agentId)?.name} (${agentOf(t.agentId)?.title})`).join(", ");
        setMsgs((m) => [...m, {
          id: crypto.randomUUID(), role: "manager", taskIds: created.map((t) => t.id),
          text: `Instruksi dipahami (${data.source === "ai" ? "analisis AI" : "analisis aturan kata kunci"}). Saya delegasikan ke: ${names}. ${importNote} Tugas yang menyangkut keputusan akademik akan meminta persetujuan Anda.`,
        }]);
      }
    } catch (e) {
      setMsgs((m) => [...m, { id: crypto.randomUUID(), role: "manager", text: `Terjadi kesalahan: ${(e as Error).message}` }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-screen flex-col p-8">
      <h1 className="text-2xl font-bold">AI Command Center</h1>
      <p className="mb-4 text-sm text-slate-500">Beri instruksi ke AI Office Manager. Lampirkan berkas dengan ikon klip: absensi Excel/CSV (kolom nis, tanggal, status) diimpor otomatis; PDF/DOCX/PPTX/gambar dibaca sebagai bahan rujukan AI Content dan AI Assignment.</p>

      <div className="flex-1 space-y-3 overflow-y-auto rounded-2xl border border-[var(--line)] bg-white p-4">
        {msgs.map((m) => (
          <div key={m.id} className={m.role === "user" ? "flex justify-end" : "flex"}>
            <div className={m.role === "user" ? "max-w-[75%] rounded-2xl bg-[#1f6b4a] px-4 py-2 text-sm text-white" : "max-w-[85%] rounded-2xl bg-slate-100 px-4 py-2 text-sm"}>
              {m.text}
              {m.taskIds && (
                <div className="mt-2 space-y-2">
                  {m.taskIds.map((id) => {
                    const t = tasks.find((x) => x.id === id);
                    if (!t) return null;
                    return (
                      <div key={id} className="rounded-xl bg-white p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold">{t.id} · {agentOf(t.agentId)?.name}</span>
                          <StatusBadge task={t} />
                        </div>
                        <div className="mt-0.5 text-xs text-slate-500">{t.logs[0]?.text}</div>
                        {t.status === "needs_approval" && (
                          <div className="mt-2 flex gap-2">
                            <button onClick={() => approve(id)} className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white">Setujui</button>
                            <button onClick={() => reject(id)} className="rounded-lg border px-3 py-1 text-xs">Tolak</button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ))}
        {busy && <div className="text-sm text-slate-400">Maya sedang menganalisis…</div>}
        <div ref={end} />
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {EXAMPLES.map((e) => (
          <button key={e} onClick={() => send(e)} className="rounded-full border bg-white px-3 py-1 text-xs text-slate-600 hover:bg-slate-50">{e}</button>
        ))}
      </div>
      {(attach || upErr || upBusy) && (
        <div className="mt-2 text-xs">
          {upBusy && <span className="text-slate-500">Membaca berkas…</span>}
          {upErr && <span className="text-red-600">{upErr}</span>}
          {attach && <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-800">📎 {attach.name} · {attach.text.length.toLocaleString("id-ID")} karakter dibaca{attach.note ? ` · ${attach.note}` : ""} <button onClick={() => setAttach(null)} className="ml-1 font-bold">×</button></span>}
        </div>
      )}
      <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="mt-3 flex gap-2">
        <input ref={fileRef} type="file" hidden accept={ACCEPT} onChange={async (e) => {
          const f = e.target.files?.[0]; e.target.value = "";
          if (!f) return;
          setUpErr(""); setUpBusy(true);
          try { setAttach(await processUpload(f)); } catch (err) { setUpErr((err as Error).message); } finally { setUpBusy(false); }
        }} />
        <button type="button" onClick={() => fileRef.current?.click()} title="Lampirkan berkas (Excel, CSV, PDF, DOCX, PPTX, JPG, PNG)" className="rounded-xl border bg-white px-3 text-slate-600 hover:bg-slate-50"><Paperclip size={16} /></button>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Tulis instruksi…" className="flex-1 rounded-xl border bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500" />
        <button disabled={busy} className="rounded-xl bg-[#1f6b4a] px-5 text-white disabled:opacity-50"><Send size={16} /></button>
      </form>
    </div>
  );
}
