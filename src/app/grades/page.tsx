"use client";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { GradeType, useData } from "@/store/data";
import { GRADE_LABEL, WEIGHTS, fmt, weightedFinal } from "@/lib/calc";
import { pick } from "@/lib/table";
import { Card, Empty, FileImport, Page, btn2Cls, btnCls, inputCls } from "@/components/ui";

const TYPES = Object.keys(WEIGHTS) as GradeType[];
const toType = (v: string): GradeType | null => {
  const t = v.trim().toLowerCase();
  return t.startsWith("tug") ? "tugas" : t.startsWith("uj") || t.startsWith("uas") || t.startsWith("uts") ? "ujian" : t.startsWith("prak") ? "praktik" : null;
};

export default function GradesPage() {
  const { classes, subjects, students, grades, finals, addGrade, removeGrade, addSubject, approveFinal } = useData();
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [sid, setSid] = useState("");
  const [type, setType] = useState<GradeType>("tugas");
  const [title, setTitle] = useState("");
  const [score, setScore] = useState("");
  const [err, setErr] = useState("");
  const cid = classId || classes[0]?.id || "";
  const subj = subjectId || subjects[0]?.id || "";
  const list = students.filter((s) => s.classId === cid);

  if (classes.length === 0 || subjects.length === 0)
    return <Page title="Grades"><Empty>Tambahkan kelas dan mata pelajaran dahulu di menu Classes, lalu siswa di menu Students.</Empty></Page>;

  const rows = list.map((s) => {
    const g = grades.filter((x) => x.studentId === s.id && x.subjectId === subj);
    const w = weightedFinal(g);
    const fin = finals.find((f) => f.studentId === s.id && f.subjectId === subj);
    return { s, g, ...w, fin };
  });
  const approvable = rows.filter((r) => r.final !== null && r.fin?.score !== r.final);

  return (
    <Page title="Grades" sub={`Nilai akhir = Tugas ${WEIGHTS.tugas * 100}% + Ujian ${WEIGHTS.ujian * 100}% + Praktik ${WEIGHTS.praktik * 100}% (bobot dinormalisasi bila jenis tertentu belum ada). Nilai dari AI hanya rekomendasi sampai Anda setujui.`}>
      <div className="mb-4 flex flex-wrap gap-3">
        <select value={cid} onChange={(e) => setClassId(e.target.value)} className={inputCls}>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <select value={subj} onChange={(e) => setSubjectId(e.target.value)} className={inputCls}>{subjects.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-2 font-bold">Input nilai</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const n = Number(score);
              if (!sid) return setErr("Pilih siswa.");
              if (score === "" || !Number.isFinite(n) || n < 0 || n > 100) return setErr("Nilai harus 0–100.");
              addGrade({ studentId: sid, subjectId: subj, type, title: title.trim() || GRADE_LABEL[type], score: n });
              setErr(""); setScore("");
            }}
            className="flex flex-wrap gap-2"
          >
            <select value={sid} onChange={(e) => setSid(e.target.value)} className={inputCls}><option value="">Siswa…</option>{list.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
            <select value={type} onChange={(e) => setType(e.target.value as GradeType)} className={inputCls}>{TYPES.map((t) => <option key={t} value={t}>{GRADE_LABEL[t]}</option>)}</select>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Judul (opsional)" className={`${inputCls} w-36`} />
            <input value={score} onChange={(e) => setScore(e.target.value)} placeholder="0–100" inputMode="decimal" className={`${inputCls} w-24`} />
            <button className={btnCls}>Simpan</button>
          </form>
          {err && <p className="mt-1 text-xs text-red-600">{err}</p>}
        </Card>
        <Card>
          <h2 className="mb-2 font-bold">Impor nilai</h2>
          <FileImport
            label="Impor Excel/CSV"
            hint="Kolom: nis, mapel, jenis (tugas/ujian/praktik), nilai, judul (opsional). Mapel baru dibuat otomatis."
            onRows={(rows) => {
              let ok = 0, bad = 0;
              for (const r of rows) {
                const st = students.find((s) => s.nis && s.nis === pick(r, "nis", "nisn"));
                const t = toType(pick(r, "jenis", "tipe", "type"));
                const n = Number(pick(r, "nilai", "score").replace(",", "."));
                const sn = pick(r, "mapel", "mata pelajaran");
                if (!st || !t || !Number.isFinite(n) || n < 0 || n > 100) { bad++; continue; }
                addGrade({ studentId: st.id, subjectId: sn ? addSubject(sn) : subj, type: t, title: pick(r, "judul", "title") || GRADE_LABEL[t], score: n });
                ok++;
              }
              return `${ok} nilai diimpor, ${bad} baris dilewati.`;
            }}
          />
        </Card>
      </div>

      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-bold">Rekap nilai</h2>
        <button disabled={!approvable.length} onClick={() => approvable.forEach((r) => approveFinal({ studentId: r.s.id, subjectId: subj, score: r.final! }))} className={btnCls}>
          Setujui {approvable.length} nilai akhir
        </button>
      </div>
      {list.length === 0 ? <Empty>Kelas ini belum memiliki siswa.</Empty> : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b text-xs uppercase text-slate-400">
              <tr><th className="p-3">Siswa</th>{TYPES.map((t) => <th key={t}>{GRADE_LABEL[t]}</th>)}<th>Rekomendasi</th><th>Nilai final</th><th /></tr>
            </thead>
            <tbody>
              {rows.map(({ s, g, perType, final, fin }) => (
                <tr key={s.id} className="border-b align-top last:border-0">
                  <td className="p-3">{s.name}
                    <div className="mt-1 flex flex-wrap gap-1">{g.map((x) => (
                      <span key={x.id} className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 text-[11px]">{x.title}: {fmt(x.score)}
                        <button onClick={() => removeGrade(x.id)} className="text-slate-400 hover:text-red-600"><Trash2 size={10} /></button></span>))}</div>
                  </td>
                  {TYPES.map((t) => <td key={t} className="pt-3">{fmt(perType[t])}</td>)}
                  <td className="pt-3 font-semibold">{fmt(final)}</td>
                  <td className="pt-3">{fin ? <span className={fin.score === final ? "text-emerald-700" : "text-amber-600"}>{fmt(fin.score)}{fin.score !== final && " (usang)"}</span> : "–"}</td>
                  <td className="pr-3 pt-2">{final !== null && fin?.score !== final && <button onClick={() => approveFinal({ studentId: s.id, subjectId: subj, score: final })} className={btn2Cls}>Setujui</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </Page>
  );
}
