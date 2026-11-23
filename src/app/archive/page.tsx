"use client";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { useData } from "@/store/data";
import { KIND_LABEL, DocKind } from "@/lib/docs";
import { DocActions, DocBody } from "@/components/DocView";
import { Card, Empty, Page, inputCls } from "@/components/ui";

export default function ArchivePage() {
  const { docs, classes, subjects, removeDoc, files, removeFile } = useData();
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<"all" | DocKind>("all");
  const [classId, setClassId] = useState("all");
  const [subject, setSubject] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const list = docs.filter((d) =>
    (kind === "all" || d.kind === kind) && (classId === "all" || d.classId === classId) && (subject === "all" || d.subject === subject) &&
    (!q.trim() || `${d.title} ${d.content}`.toLowerCase().includes(q.trim().toLowerCase())));
  const open = docs.find((d) => d.id === openId);

  return (
    <Page title="Document Archive" sub="Arsip hasil kerja AI (AI Archivist). Cari dan saring berdasarkan jenis, kelas, atau mata pelajaran.">
      <div className="mb-4 flex flex-wrap gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari judul atau isi…" className={`${inputCls} min-w-[220px] flex-1`} />
        <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className={inputCls}><option value="all">Semua jenis</option>{(Object.keys(KIND_LABEL) as DocKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}</select>
        <select value={classId} onChange={(e) => setClassId(e.target.value)} className={inputCls}><option value="all">Semua kelas</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <select value={subject} onChange={(e) => setSubject(e.target.value)} className={inputCls}><option value="all">Semua mapel</option>{subjects.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}</select>
      </div>
      {files.length > 0 && (
        <Card className="mb-4">
          <h2 className="mb-2 font-bold">Berkas yang diunggah</h2>
          <ul className="divide-y text-sm">
            {files.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-2 py-2">
                <span className="truncate">{f.name} <span className="text-xs text-slate-400">· {(f.size / 1024).toFixed(0)} KB · {new Date(f.createdAt).toLocaleDateString("id-ID")}{f.path ? "" : " · hanya dibaca (tidak disimpan)"}</span></span>
                <span className="flex gap-2">
                  {f.path && <button className="text-xs text-emerald-700 hover:underline" onClick={() => window.open(`/api/files?path=${encodeURIComponent(f.path!)}`, "_blank")}>Buka</button>}
                  <button onClick={() => confirm("Hapus catatan berkas ini?") && removeFile(f.id)} className="text-slate-400 hover:text-red-600"><Trash2 size={14} /></button>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {docs.length === 0 ? <Empty>Arsip kosong. Dokumen dari Materials, Assignments, Reports, atau perintah AI akan muncul di sini.</Empty> : list.length === 0 ? <Empty>Tidak ada dokumen yang cocok.</Empty> : (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            {list.map((d) => (
              <button key={d.id} onClick={() => setOpenId(d.id)} className={`block w-full rounded-xl border bg-white p-3 text-left hover:shadow ${openId === d.id ? "border-emerald-500" : "border-[var(--line)]"}`}>
                <div className="font-semibold">{d.title}</div>
                <div className="text-xs text-slate-500">{KIND_LABEL[d.kind]} · {classes.find((c) => c.id === d.classId)?.name ?? "Tanpa kelas"} · {d.subject ?? "Tanpa mapel"} · {new Date(d.createdAt).toLocaleString("id-ID")}</div>
              </button>
            ))}
          </div>
          {open && (
            <Card className="space-y-3 self-start">
              <div className="flex items-start justify-between gap-2">
                <div className="font-bold">{open.title}</div>
                <button onClick={() => { if (confirm("Hapus dokumen dari arsip?")) { removeDoc(open.id); setOpenId(null); } }} className="text-slate-400 hover:text-red-600"><Trash2 size={16} /></button>
              </div>
              <DocBody doc={open} />
              <DocActions doc={open} />
            </Card>
          )}
        </div>
      )}
    </Page>
  );
}
