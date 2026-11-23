"use client";
import { useState } from "react";
import { useData } from "@/store/data";
import { buildAcademicReport } from "@/lib/reports";
import { GeneratedDoc } from "@/lib/docs";
import { DocActions, DocBody } from "@/components/DocView";
import { Card, Empty, Page, btnCls, inputCls } from "@/components/ui";

export default function ReportsPage() {
  const { classes, subjects, docs, addDoc } = useData();
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [doc, setDoc] = useState<GeneratedDoc | null>(null);
  const [err, setErr] = useState("");
  const cid = classId || classes[0]?.id || "";

  if (classes.length === 0) return <Page title="Reports"><Empty>Tambahkan kelas, siswa, absensi, dan nilai dahulu.</Empty></Page>;

  return (
    <Page title="Reports — AI Reporting" sub="Rani menggabungkan absensi dan nilai menjadi laporan akademik. Dihitung dari data Anda; nilai bertanda * belum disetujui.">
      <Card className="mb-4">
        <div className="flex flex-wrap gap-2">
          <select value={cid} onChange={(e) => setClassId(e.target.value)} className={inputCls}>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className={inputCls}><option value="">Semua mapel (tanpa nilai)</option>{subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
          <input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className={inputCls} />
          <button
            className={btnCls}
            onClick={() => {
              const r = buildAcademicReport(cid, month, subjectId || undefined);
              if (!r) return setErr("Kelas ini belum memiliki siswa.");
              setErr("");
              setDoc(addDoc({ title: r.title, kind: "laporan", agentId: "reporting", classId: cid, subject: r.subj?.name, content: r.content, table: r.table }));
            }}
          >Buat laporan</button>
        </div>
        {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
      </Card>
      {doc && (
        <Card className="mb-4 space-y-3">
          <div className="font-bold">{doc.title} <span className="text-xs font-normal text-slate-400">· tersimpan di arsip</span></div>
          <DocBody doc={doc} />
          <DocActions doc={doc} />
        </Card>
      )}
      <p className="text-xs text-slate-400">{docs.filter((d) => d.kind === "laporan").length} laporan di arsip.</p>
    </Page>
  );
}
