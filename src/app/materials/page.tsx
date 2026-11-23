"use client";
import { useState } from "react";
import { useData } from "@/store/data";
import { generateText, titleFromMarkdown } from "@/lib/generate";
import { GeneratedDoc } from "@/lib/docs";
import { DocActions, DocBody } from "@/components/DocView";
import { Card, Page, btnCls, inputCls } from "@/components/ui";

const LEVELS = ["SD", "SMP", "SMA", "SMK", "Perguruan Tinggi", "Pelatihan umum"];
const FORMATS = ["Materi pembelajaran lengkap", "Rangkuman", "Modul ajar", "Kerangka presentasi (slide per slide)"];

export default function MaterialsPage() {
  const { classes, subjects, docs, addDoc } = useData();
  const [topic, setTopic] = useState("");
  const [level, setLevel] = useState("SMA");
  const [format, setFormat] = useState(FORMATS[0]);
  const [classId, setClassId] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [doc, setDoc] = useState<GeneratedDoc | null>(null);
  const recent = docs.filter((d) => d.kind === "materi").slice(0, 5);

  async function make() {
    if (!topic.trim()) return setErr("Tulis topik terlebih dahulu.");
    setBusy(true); setErr(""); setDoc(null);
    try {
      const text = await generateText("content", `Buat ${format.toLowerCase()} tentang: ${topic.trim()}. Jenjang: ${level}.`);
      const subj = subjects.find((s) => topic.toLowerCase().includes(s.name.toLowerCase()))?.name;
      setDoc(addDoc({ title: titleFromMarkdown(text, topic.trim()), kind: "materi", agentId: "content", classId: classId || undefined, subject: subj, content: text }));
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <Page title="Learning Materials — AI Content Creator" sub="Kirana menyusun materi, rangkuman, modul, atau kerangka presentasi. Hasil otomatis tersimpan di Document Archive. Selalu periksa isinya sebelum dipakai mengajar.">
      <Card className="mb-4">
        <div className="flex flex-wrap gap-2">
          <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Topik, mis. Microsoft Excel: rumus dasar" className={`${inputCls} min-w-[260px] flex-1`} />
          <select value={format} onChange={(e) => setFormat(e.target.value)} className={inputCls}>{FORMATS.map((f) => <option key={f}>{f}</option>)}</select>
          <select value={level} onChange={(e) => setLevel(e.target.value)} className={inputCls}>{LEVELS.map((l) => <option key={l}>{l}</option>)}</select>
          <select value={classId} onChange={(e) => setClassId(e.target.value)} className={inputCls}><option value="">Kelas (opsional)</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <button onClick={make} disabled={busy} className={btnCls}>{busy ? "Kirana sedang menulis…" : "Buat materi"}</button>
        </div>
        {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
        <p className="mt-2 text-[11px] text-slate-400">Butuh AI_API_KEY di .env.local. Lampirkan berkas materi lewat Command Center agar dijadikan bahan rujukan.</p>
      </Card>

      {doc && (
        <Card className="mb-4 space-y-3">
          <div className="font-bold">{doc.title}</div>
          <DocBody doc={doc} />
          <DocActions doc={doc} />
        </Card>
      )}
      {recent.length > 0 && (
        <Card>
          <h2 className="mb-2 font-bold">Materi terbaru di arsip</h2>
          <ul className="space-y-1 text-sm">{recent.map((d) => <li key={d.id}>{d.title} <span className="text-xs text-slate-400">· {new Date(d.createdAt).toLocaleDateString("id-ID")}</span></li>)}</ul>
        </Card>
      )}
    </Page>
  );
}
