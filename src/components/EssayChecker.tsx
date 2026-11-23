"use client";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { EssayItem, useData } from "@/store/data";
import { fmt } from "@/lib/calc";
import { pick } from "@/lib/table";
import { BATCH_SIZE, chunk } from "@/lib/essay";
import { Card, FileImport, btn2Cls, btnCls, inputCls } from "@/components/ui";

const STATUS: Record<EssayItem["status"], { t: string; cls: string }> = {
  pending: { t: "Belum dinilai", cls: "text-slate-500" },
  recommended: { t: "Rekomendasi AI", cls: "text-amber-600" },
  approved: { t: "Disetujui", cls: "text-emerald-700" },
  error: { t: "Gagal", cls: "text-red-600" },
};

export function EssayChecker({ classId }: { classId: string }) {
  const { students, essays, addEssay, removeEssay, upsertEssayItems, patchEssayItem, addGrade, addSubject, classes } = useData();
  const [title, setTitle] = useState("");
  const [question, setQuestion] = useState("");
  const [rubric, setRubric] = useState("");
  const [err, setErr] = useState("");
  const [pickId, setPickId] = useState("");
  const [sid, setSid] = useState("");
  const [ans, setAns] = useState("");
  const [busy, setBusy] = useState(false);
  const [aiErr, setAiErr] = useState("");

  const list = essays.filter((e) => e.classId === classId);
  const essay = list.find((e) => e.id === pickId) ?? list[0];
  const roster = students.filter((s) => s.classId === classId);
  const nameOf = (id: string) => students.find((s) => s.id === id)?.name ?? "?";

  async function gradeAll() {
    if (!essay) return;
    setBusy(true); setAiErr("");
    // Beberapa esai per permintaan: pertanyaan dan rubrik dikirim sekali per batch, sehingga RPM dan TPM turun.
    const pending = essay.items.filter((i) => i.status === "pending" || i.status === "error");
    for (const batch of chunk(pending, BATCH_SIZE)) {
      const fail = (msg: string, ids = batch.map((b) => b.studentId)) => ids.forEach((id) => patchEssayItem(essay.id, id, { status: "error", error: msg }));
      try {
        const res = await fetch("/api/grade-essay", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: essay.question, rubric: essay.rubric, answers: batch.map((b) => ({ id: b.studentId, answer: b.answer })) }),
        });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) {
          fail(d.error ?? `HTTP ${res.status}`);
          if (res.status === 503 || res.status === 401) { setAiErr(d.error ?? "Tidak diizinkan."); break; } // gagal permanen: hentikan
          continue;
        }
        const got = new Set<string>();
        for (const r of (d.results ?? []) as { id: string; score: number; feedback: string }[]) {
          got.add(r.id);
          patchEssayItem(essay.id, r.id, { status: "recommended", score: r.score, feedback: r.feedback, error: undefined });
        }
        fail("AI tidak mengembalikan hasil untuk siswa ini. Coba lagi.", batch.map((b) => b.studentId).filter((id) => !got.has(id)));
      } catch {
        fail("Jaringan gagal");
      }
    }
    setBusy(false);
  }

  function approve(it: EssayItem) {
    if (!essay || it.score === undefined) return;
    addGrade({ studentId: it.studentId, subjectId: addSubject("Umum"), type: "tugas", title: essay.title, score: it.score });
    patchEssayItem(essay.id, it.studentId, { status: "approved", approvedScore: it.score });
  }

  return (
    <Card className="mb-4 space-y-3">
      <h2 className="font-bold">Koreksi esai berbasis rubrik (Citra · AI Checker)</h2>
      <p className="text-xs text-slate-500">AI hanya memberi rekomendasi nilai dan umpan balik. Anda bisa mengubah skor sebelum menyetujui; nilai baru masuk ke Grades setelah disetujui.</p>

      <form
        className="grid gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim() || !question.trim() || !rubric.trim()) return setErr("Judul, pertanyaan, dan rubrik wajib diisi.");
          setPickId(addEssay({ classId, title: title.trim(), question: question.trim(), rubric: rubric.trim() }));
          setTitle(""); setQuestion(""); setRubric(""); setErr("");
        }}
      >
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Judul (mis. Esai Bab 3)" className={inputCls} />
        <textarea value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Pertanyaan esai" rows={2} className={inputCls} />
        <textarea value={rubric} onChange={(e) => setRubric(e.target.value)} placeholder={"Rubrik, mis.\n- Menjelaskan definisi dengan benar (30)\n- Memberi contoh relevan (40)\n- Bahasa runtut (30)"} rows={4} className={inputCls} />
        <div><button className={btnCls}>Buat koreksi esai</button> {err && <span className="ml-2 text-xs text-red-600">{err}</span>}</div>
      </form>

      {list.length > 0 && essay && (
        <div className="space-y-3 border-t pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <select value={essay.id} onChange={(e) => setPickId(e.target.value)} className={inputCls}>{list.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}</select>
            <button className={btn2Cls} onClick={() => confirm("Hapus koreksi esai ini beserta hasilnya?") && removeEssay(essay.id)}><Trash2 size={14} /></button>
            <button className={btnCls} disabled={busy || !essay.items.some((i) => i.status === "pending" || i.status === "error")} onClick={gradeAll}>
              {busy ? "Citra sedang menilai…" : "Nilai dengan AI"}
            </button>
            <button className={btn2Cls} disabled={!essay.items.some((i) => i.status === "recommended")} onClick={() => essay.items.filter((i) => i.status === "recommended").forEach(approve)}>Setujui semua rekomendasi</button>
          </div>
          {aiErr && <p className="text-sm text-red-600">{aiErr}</p>}
          <p className="text-sm"><b>Pertanyaan:</b> {essay.question}</p>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <div className="mb-1 text-xs font-semibold text-slate-500">Tambah jawaban satu siswa</div>
              <div className="flex gap-2">
                <select value={sid} onChange={(e) => setSid(e.target.value)} className={inputCls}><option value="">Siswa…</option>{roster.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
                <button className={btn2Cls} onClick={() => { if (sid && ans.trim()) { upsertEssayItems(essay.id, [{ studentId: sid, answer: ans.trim(), status: "pending" }]); setAns(""); } }}>Simpan jawaban</button>
              </div>
              <textarea value={ans} onChange={(e) => setAns(e.target.value)} rows={3} placeholder="Ketik/tempel jawaban siswa" className={`${inputCls} mt-2 w-full`} />
            </div>
            <FileImport
              label="Impor jawaban (Excel/CSV)"
              hint="Kolom: nis (atau nama) dan jawaban. Jawaban foto/scan: transkripsikan dahulu lewat lampiran di Command Center."
              onRows={(rows) => {
                const items: EssayItem[] = [];
                let bad = 0;
                for (const r of rows) {
                  const nis = pick(r, "nis", "nisn"), nm = pick(r, "nama", "name").toLowerCase();
                  const st = roster.find((s) => (nis && s.nis === nis) || (!nis && s.name.toLowerCase() === nm));
                  const a = pick(r, "jawaban", "answer", "esai");
                  if (!st || !a) { bad++; continue; }
                  items.push({ studentId: st.id, answer: a, status: "pending" });
                }
                upsertEssayItems(essay.id, items);
                return `${items.length} jawaban diimpor, ${bad} baris dilewati.`;
              }}
            />
          </div>

          {essay.items.length > 0 && (
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full text-left text-sm">
                <thead className="border-b text-xs uppercase text-slate-400"><tr><th className="p-2">Siswa</th><th>Jawaban</th><th>Skor</th><th>Umpan balik</th><th>Status</th><th /></tr></thead>
                <tbody>
                  {essay.items.map((it) => (
                    <tr key={it.studentId} className="border-b align-top last:border-0">
                      <td className="p-2 whitespace-nowrap">{nameOf(it.studentId)}</td>
                      <td className="max-w-[240px] p-2"><div className="line-clamp-3 text-xs text-slate-600" title={it.answer}>{it.answer}</div></td>
                      <td className="p-2">
                        {it.status === "recommended" ? (
                          <input type="number" min={0} max={100} value={it.score ?? 0} onChange={(e) => patchEssayItem(essay.id, it.studentId, { score: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })} className={`${inputCls} w-20 py-1`} />
                        ) : fmt(it.status === "approved" ? it.approvedScore : it.score)}
                      </td>
                      <td className="max-w-[260px] p-2 text-xs text-slate-600">{it.feedback ?? it.error ?? "–"}</td>
                      <td className={`p-2 text-xs font-semibold ${STATUS[it.status].cls}`}>{STATUS[it.status].t}</td>
                      <td className="p-2">{it.status === "recommended" && <button className={btn2Cls} onClick={() => approve(it)}>Setujui</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
