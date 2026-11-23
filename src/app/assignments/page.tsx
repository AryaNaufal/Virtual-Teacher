"use client";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Submission, useData } from "@/store/data";
import { fmt } from "@/lib/calc";
import { extractKey, generateText, stripKeyLine, titleFromMarkdown } from "@/lib/generate";
import type { GeneratedDoc } from "@/lib/docs";
import { DocActions, DocBody } from "@/components/DocView";
import { EssayChecker } from "@/components/EssayChecker";
import { Row, pick } from "@/lib/table";
import { Card, Empty, FileImport, Page, btn2Cls, btnCls, inputCls } from "@/components/ui";

/** Panjang pembahasan = pengendali terbesar jumlah token keluaran pada pembuatan soal. */
const EXPLAIN_PROMPT = {
  tanpa: "Tanpa pembahasan: cukup daftar kunci jawaban per nomor.",
  singkat: "Pembahasan singkat: maksimal satu kalimat per nomor.",
  lengkap: "Sertakan pembahasan lengkap untuk setiap nomor.",
} as const;

const parseKey =(s: string) => s.toUpperCase().replace(/[^A-E]/g, "").split("");

function answersOf(r: Row): string[] {
  const single = pick(r, "jawaban", "answers", "answer");
  if (single) return /[,;\s]/.test(single) ? single.toUpperCase().split(/[,;\s]+/).filter(Boolean) : single.toUpperCase().split("");
  return Object.keys(r).filter((k) => /^\d+$/.test(k)).sort((a, b) => +a - +b).map((k) => r[k].toUpperCase());
}

export default function AssignmentsPage() {
  const { classes, students, quizzes, submissions, addQuiz, removeQuiz, saveSubmissions, approveSubmission, addGrade, addSubject, addDoc } = useData();
  const [title, setTitle] = useState("");
  const [classId, setClassId] = useState("");
  const [key, setKey] = useState("");
  const [err, setErr] = useState("");
  const [quizId, setQuizId] = useState("");
  const [gTopic, setGTopic] = useState("");
  const [gType, setGType] = useState("pilihan ganda");
  const [gCount, setGCount] = useState("10");
  const [gLevel, setGLevel] = useState("SMA");
  const [gExplain, setGExplain] = useState<keyof typeof EXPLAIN_PROMPT>("singkat");
  const [gBusy, setGBusy] = useState(false);
  const [gErr, setGErr] = useState("");
  const [gDoc, setGDoc] = useState<GeneratedDoc | null>(null);
  const [gKey, setGKey] = useState<string[]>([]);
  const cid = classId || classes[0]?.id || "";
  const quiz = quizzes.find((q) => q.id === quizId) ?? quizzes[0];
  const subs = quiz ? submissions.filter((s) => s.quizId === quiz.id) : [];
  const roster = quiz ? students.filter((s) => s.classId === quiz.classId) : [];

  function grade(quizKey: string[], answers: string[]) {
    const correct = quizKey.reduce((n, k, i) => n + (answers[i] === k ? 1 : 0), 0);
    return { correct, score: Math.round((correct / quizKey.length) * 1000) / 10 };
  }

  return (
    <Page title="Assignments" sub="Buat soal dengan AI, lalu koreksi otomatis jawaban pilihan ganda dari kunci. Skor adalah rekomendasi; nilai baru masuk ke Grades setelah Anda setujui. Esai dikoreksi AI berdasarkan rubrik Anda.">
      {classes.length === 0 ? <Empty>Tambahkan kelas dan siswa dahulu.</Empty> : (
        <>
          <Card className="mb-4 space-y-3">
            <h2 className="font-bold">Buat soal dengan AI (Arga)</h2>
            <div className="flex flex-wrap gap-2">
              <input value={gTopic} onChange={(e) => setGTopic(e.target.value)} placeholder="Topik, mis. Microsoft Word" className={`${inputCls} min-w-[200px] flex-1`} />
              <select value={gType} onChange={(e) => setGType(e.target.value)} className={inputCls}>{["pilihan ganda", "esai", "kuis campuran", "tugas praktik"].map((t) => <option key={t}>{t}</option>)}</select>
              <input value={gCount} onChange={(e) => setGCount(e.target.value)} inputMode="numeric" className={`${inputCls} w-20`} title="Jumlah soal" />
              <select value={gLevel} onChange={(e) => setGLevel(e.target.value)} className={inputCls}>{["SD", "SMP", "SMA", "SMK"].map((t) => <option key={t}>{t}</option>)}</select>
              <select value={gExplain} onChange={(e) => setGExplain(e.target.value as keyof typeof EXPLAIN_PROMPT)} className={inputCls} title="Panjang pembahasan memengaruhi jumlah token">
                <option value="singkat">Pembahasan singkat</option><option value="tanpa">Tanpa pembahasan (hemat)</option><option value="lengkap">Pembahasan lengkap</option>
              </select>
              <button disabled={gBusy} className={btnCls} onClick={async () => {
                const n = Math.min(50, Math.max(1, parseInt(gCount) || 10));
                if (!gTopic.trim()) return setGErr("Tulis topik.");
                setGBusy(true); setGErr(""); setGDoc(null);
                try {
                  const text = await generateText("assignment", `Buat ${n} soal ${gType} tentang ${gTopic.trim()} untuk jenjang ${gLevel}, lengkap dengan kunci jawaban. ${EXPLAIN_PROMPT[gExplain]}`);
                  const k = extractKey(text);
                  const d = addDoc({ title: titleFromMarkdown(text, `Soal ${gTopic.trim()}`), kind: "soal", agentId: "assignment", classId: cid, content: stripKeyLine(text) });
                  setGDoc(d); setGKey(k);
                } catch (e) { setGErr((e as Error).message); } finally { setGBusy(false); }
              }}>{gBusy ? "Arga sedang menyusun…" : "Buat soal"}</button>
            </div>
            {gErr && <p className="text-sm text-red-600">{gErr}</p>}
            {gDoc && (
              <>
                <p className="text-xs text-slate-500">Tersimpan di Document Archive. Periksa kebenaran soal dan kunci sebelum dipakai.</p>
                <DocBody doc={gDoc} />
                <div className="flex flex-wrap items-start gap-3">
                  <DocActions doc={gDoc} />
                  {gKey.length > 0 && (
                    <button className={btn2Cls} onClick={() => { setQuizId(addQuiz({ title: gDoc.title, classId: cid, key: gKey })); setGDoc(null); }}>
                      Jadikan kuis koreksi ({gKey.length} kunci)
                    </button>
                  )}
                </div>
              </>
            )}
          </Card>

          <Card className="mb-4">
            <h2 className="mb-2 font-bold">Buat kuis / ujian PG manual</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const k = parseKey(key);
                if (!title.trim()) return setErr("Judul wajib diisi.");
                if (k.length === 0) return setErr("Kunci jawaban kosong. Tulis huruf A–E, mis. ABCDDACB.");
                const id = addQuiz({ title: title.trim(), classId: cid, key: k });
                setQuizId(id); setTitle(""); setKey(""); setErr("");
              }}
              className="flex flex-wrap gap-2"
            >
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Judul (mis. Kuis Word)" className={`${inputCls} min-w-[180px] flex-1`} />
              <select value={cid} onChange={(e) => setClassId(e.target.value)} className={inputCls}>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
              <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="Kunci: ABCDDACB…" className={`${inputCls} w-56 font-mono`} />
              <button className={btnCls}>Buat</button>
            </form>
            {err && <p className="mt-1 text-xs text-red-600">{err}</p>}
          </Card>

          <EssayChecker classId={cid} />

          {!quiz ? <Empty>Belum ada kuis.</Empty> : (
            <>
              <div className="mb-3 flex flex-wrap items-start gap-3">
                <select value={quiz.id} onChange={(e) => setQuizId(e.target.value)} className={inputCls}>
                  {quizzes.map((q) => <option key={q.id} value={q.id}>{q.title} ({classes.find((c) => c.id === q.classId)?.name})</option>)}
                </select>
                <span className="self-center font-mono text-xs text-slate-500">Kunci ({quiz.key.length} soal): {quiz.key.join("")}</span>
                <button onClick={() => confirm("Hapus kuis dan hasil koreksinya?") && removeQuiz(quiz.id)} className={btn2Cls}><Trash2 size={14} /></button>
                <FileImport
                  label="Impor jawaban siswa"
                  hint="Kolom: nis (atau nama) dan jawaban (mis. ABCD…), atau kolom 1,2,3… per soal. Hasil foto/PDF lembar jawaban (OCR) menyusul."
                  onRows={(rows) => {
                    const out: Submission[] = [];
                    let bad = 0;
                    for (const r of rows) {
                      const nis = pick(r, "nis", "nisn"), nm = pick(r, "nama", "name").toLowerCase();
                      const st = roster.find((s) => (nis && s.nis === nis) || (!nis && s.name.toLowerCase() === nm));
                      const a = answersOf(r);
                      if (!st || a.length === 0) { bad++; continue; }
                      out.push({ quizId: quiz.id, studentId: st.id, answers: a, ...grade(quiz.key, a), status: "recommended" });
                    }
                    saveSubmissions(out);
                    return `${out.length} jawaban dikoreksi, ${bad} baris dilewati (siswa bukan anggota kelas ini / jawaban kosong).`;
                  }}
                />
              </div>

              {subs.length === 0 ? <Empty>Belum ada jawaban yang dikoreksi.</Empty> : (
                <>
                  <div className="mb-2 flex items-center justify-between">
                    <h2 className="font-bold">Hasil koreksi ({subs.length}/{roster.length} siswa)</h2>
                    <button
                      disabled={!subs.some((s) => s.status === "recommended")}
                      onClick={() => subs.filter((s) => s.status === "recommended").forEach((s) => { approveSubmission(quiz.id, s.studentId, s.score); addGrade({ studentId: s.studentId, subjectId: addSubject("Umum"), type: "tugas", title: quiz.title, score: s.score }); })}
                      className={btnCls}
                    >Setujui semua rekomendasi</button>
                  </div>
                  <Card className="overflow-x-auto p-0">
                    <table className="w-full text-left text-sm">
                      <thead className="border-b text-xs uppercase text-slate-400"><tr><th className="p-3">Siswa</th><th>Benar</th><th>Rekomendasi nilai</th><th>Status</th><th /></tr></thead>
                      <tbody>
                        {subs.map((s) => (
                          <tr key={s.studentId} className="border-b last:border-0">
                            <td className="p-3">{students.find((x) => x.id === s.studentId)?.name}</td>
                            <td>{s.correct}/{quiz.key.length}</td><td className="font-semibold">{fmt(s.score)}</td>
                            <td>{s.status === "approved" ? <span className="text-emerald-700">Disetujui ({fmt(s.approvedScore)})</span> : <span className="text-amber-600">Menunggu persetujuan</span>}</td>
                            <td className="pr-3 text-right">{s.status === "recommended" && (
                              <button className={btn2Cls} onClick={() => { approveSubmission(quiz.id, s.studentId, s.score); addGrade({ studentId: s.studentId, subjectId: addSubject("Umum"), type: "tugas", title: quiz.title, score: s.score }); }}>Setujui</button>)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </Card>
                  <p className="mt-2 text-xs text-slate-400">Nilai yang disetujui dicatat di Grades pada mata pelajaran “Umum” (jenis Tugas); pindahkan lewat impor bila perlu.</p>
                </>
              )}
            </>
          )}
        </>
      )}
    </Page>
  );
}
