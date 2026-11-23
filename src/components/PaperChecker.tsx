"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Download, FileUp, Mail, Plus, Trash2 } from "lucide-react";
import { useData } from "@/store/data";
import {
  Criterion, DEFAULT_GRADING, DEFAULT_RUBRIC, LEVEL_LABEL, Level, PaperCheck, PaperItem, buildRecap, predicateOf, recapCsv, requestGradePaper, scoreOf, totalWeight,
} from "@/lib/paper";
import { fmt } from "@/lib/calc";
import { DEFAULT_KIKO, Draft, KIKO_RUBRIC, KikoProfile, buildDraft, draftRecapCsv, gmailComposeUrl } from "@/lib/kiko";
import { Card, btn2Cls, btnCls, inputCls } from "@/components/ui";

const STATUS: Record<PaperItem["status"], { t: string; cls: string }> = {
  pending: { t: "Belum dinilai", cls: "bg-slate-100 text-slate-600" },
  graded: { t: "Rekomendasi AI", cls: "bg-amber-100 text-amber-800" },
  manual: { t: "Perlu dicek manual", cls: "bg-red-100 text-red-700" },
  approved: { t: "Disetujui", cls: "bg-emerald-100 text-emerald-800" },
  error: { t: "Gagal", cls: "bg-red-100 text-red-700" },
};
const today = () => new Date().toISOString().slice(0, 10);
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 20) || "k";
const words = (s: string) => s.toLowerCase().replace(/\.[a-z0-9]+$/, "").split(/[^a-z]+/).filter((w) => w.length >= 3);

async function readPaper(file: File): Promise<{ text: string; truncated: boolean }> {
  const fd = new FormData();
  fd.append("file", file); fd.append("max", "paper");
  const res = await fetch("/api/extract", { method: "POST", body: fd });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.error ?? `Gagal membaca berkas (HTTP ${res.status})`);
  return { text: d.text as string, truncated: !!d.truncated };
}

export function PaperChecker({ classId }: { classId: string }) {
  const { students, classes, papers, addPaper, removePaper, upsertPaperItem, patchPaperItem, removePaperItem, addGrade, addSubject } = useData();
  const [title, setTitle] = useState(""), [requirements, setRequirements] = useState(""), [due, setDue] = useState("");
  const [rubric, setRubric] = useState<Criterion[]>(DEFAULT_RUBRIC);
  const [grading, setGrading] = useState(DEFAULT_GRADING);
  const [err, setErr] = useState(""), [pickId, setPickId] = useState("");
  const [sid, setSid] = useState(""), [on, setOn] = useState(today()), [paste, setPaste] = useState("");
  const [busy, setBusy] = useState(""), [msg, setMsg] = useState("");
  const [recap, setRecap] = useState(false);
  const [kiko, setKikoState] = useState<KikoProfile>(DEFAULT_KIKO);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [draftRecap, setDraftRecap] = useState(false);
  useEffect(() => { try { const v = localStorage.getItem("ai-office-kiko"); if (v) setKikoState({ ...DEFAULT_KIKO, ...JSON.parse(v) }); } catch { /* abaikan */ } }, []);
  const setKiko = (k: KikoProfile) => { setKikoState(k); try { localStorage.setItem("ai-office-kiko", JSON.stringify(k)); } catch { /* abaikan */ } };
  const fileRef = useRef<HTMLInputElement>(null), bulkRef = useRef<HTMLInputElement>(null), recapRef = useRef<HTMLDivElement>(null), addRef = useRef<HTMLDivElement>(null);

  const list = papers.filter((p) => p.classId === classId);
  const check = list.find((p) => p.id === pickId) ?? list[0];
  const roster = useMemo(() => students.filter((s) => s.classId === classId), [students, classId]);
  const nameOf = (id: string) => students.find((s) => s.id === id)?.name ?? "?";
  const tw = totalWeight(rubric);

  const mkItem = (studentId: string, submittedOn: string, text: string, status: PaperItem["status"] = "pending", manualReason?: string): PaperItem => ({
    id: crypto.randomUUID(), studentId, submittedOn, late: !!check?.due && submittedOn > check.due, status, text, chars: text.length, manualReason,
  });

  async function addFiles(files: FileList | null, forStudent?: string) {
    if (!check || !files?.length) return;
    setBusy("Membaca berkas…"); setMsg("");
    const skipped: string[] = []; let ok = 0;
    for (const f of Array.from(files)) {
      let st = forStudent ? roster.find((s) => s.id === forStudent) : undefined;
      if (!st) {
        // cocokkan nama berkas dengan nama siswa (≥2 kata nama cocok, atau semua kata bila namanya pendek); harus unik
        const fw = new Set(words(f.name));
        const scored = roster.map((s) => { const t = words(s.name); return { s, hit: t.filter((w) => fw.has(w)).length, need: Math.min(2, t.length) }; }).filter((x) => x.hit >= Math.max(1, x.need));
        const best = Math.max(0, ...scored.map((x) => x.hit));
        const top = scored.filter((x) => x.hit === best);
        st = top.length === 1 ? top[0].s : undefined;
      }
      if (!st) { skipped.push(f.name); continue; }
      if (check.items.some((i) => i.studentId === st!.id)) { skipped.push(`${f.name} (paper ${st.name} sudah ada, tidak dinilai dua kali)`); continue; }
      try {
        const r = await readPaper(f);
        upsertPaperItem(check.id, r.truncated
          ? mkItem(st.id, on, r.text, "manual", "Isi paper lebih panjang dari batas bacaan penuh; perlu dicek manual (tidak dinilai dari potongan).")
          : mkItem(st.id, on, r.text));
        ok++;
      } catch (e) {
        upsertPaperItem(check.id, mkItem(st.id, on, "", "manual", (e as Error).message));
        ok++;
      }
    }
    setBusy("");
    setMsg(`${ok} paper ditambahkan.${skipped.length ? ` Dilewati: ${skipped.join("; ")}. (Berkas yang tidak cocok nama: pilih siswa lalu unggah satuan. Mengganti paper: hapus yang lama dulu.)` : ""}`);
    if (fileRef.current) fileRef.current.value = ""; if (bulkRef.current) bulkRef.current.value = "";
  }

  async function gradeOne(it: PaperItem) {
    if (!check || !it.text) return;
    patchPaperItem(check.id, it.id, { error: undefined });
    try {
      const r = await requestGradePaper({ paper: it.text, topic: check.title, requirements: check.requirements, rubric: check.rubric, grading: check.grading });
      if (r.manual) { patchPaperItem(check.id, it.id, { status: "manual", manualReason: r.reason }); return; }
      patchPaperItem(check.id, it.id, {
        status: "graded", text: undefined, manualReason: undefined, error: undefined, criteria: r.criteria, mistakes: r.mistakes, completeness: r.completeness,
        originality: r.originality, doubts: r.doubts, feedback: r.feedback, score: r.score, grade: r.grade,
        identity: r.identity, summary: r.summary, improvements: r.improvements,
      });
    } catch (e) {
      patchPaperItem(check.id, it.id, { status: "error", error: (e as Error).message });
      throw e;
    }
  }

  async function gradeAll() {
    if (!check) return;
    setMsg("");
    const todo = check.items.filter((i) => (i.status === "pending" || i.status === "error") && i.text);
    for (const [n, it] of todo.entries()) {
      setBusy(`Korektor Paper membaca paper ${n + 1} dari ${todo.length}…`);
      try { await gradeOne(it); } catch (e) { if (/login|kunci|saldo|kuota|401|503/i.test((e as Error).message)) { setMsg((e as Error).message); break; } }
    }
    setBusy("");
  }

  function setLevel(it: PaperItem, id: string, level: Level) {
    if (!check || !it.criteria) return;
    const criteria = it.criteria.map((c) => (c.id === id ? { ...c, level } : c));
    const score = scoreOf(check.rubric, Object.fromEntries(criteria.map((c) => [c.id, c.level]))) ?? it.score;
    patchPaperItem(check.id, it.id, { criteria, score, grade: score === undefined ? it.grade : predicateOf(score, check.grading) });
  }

  function approve(it: PaperItem) {
    if (!check || it.score === undefined) return;
    addGrade({ studentId: it.studentId, subjectId: addSubject("Umum"), type: "tugas", title: check.title, score: it.score });
    patchPaperItem(check.id, it.id, { status: "approved", approvedScore: it.score });
  }

  const r = check ? buildRecap(check, roster) : null;
  const pending = check?.items.filter((i) => (i.status === "pending" || i.status === "error") && i.text).length ?? 0;
  const graded = check?.items.filter((i) => i.status === "graded").length ?? 0;
  const nm = (id: string) => rubric.find((c) => c.id === id)?.name ?? check?.rubric.find((c) => c.id === id)?.name ?? id;

  return (
    <div className="space-y-4">
      <Card className="space-y-2 border-teal-200 bg-teal-50/40">
        <h2 className="font-bold">Korektor Paper sudah aktif</h2>
        <ul className="list-disc pl-5 text-sm text-slate-700">
          <li>Rubrik ({tw} poin): {rubric.map((c) => `${c.name} ${c.weight}`).join(" · ")}.</li>
          <li>Tiap kriteria dinilai level 4/3/2/1 (sangat baik, baik, cukup, perlu bimbingan) lalu dikonversi ke bobot; predikat A ≥ {grading.A}, B ≥ {grading.B}, C ≥ {grading.C}, selebihnya D.</li>
          <li>Hasil hanya rekomendasi: nilai masuk ke Grades setelah Anda setujui. Tidak ada email atau spreadsheet yang diubah tanpa persetujuan.</li>
        </ul>
        <details className="text-xs text-slate-600">
          <summary className="cursor-pointer font-semibold">Profil Kiko untuk draf balasan email (tersimpan di browser ini, tidak dikirim ke AI)</summary>
          <div className="mt-2 grid gap-2 md:grid-cols-3">
            <label>Nama guru<input value={kiko.teacher} onChange={(e) => setKiko({ ...kiko, teacher: e.target.value })} className={`${inputCls} mt-1 w-full py-1`} /></label>
            <label>Peran Kiko<input value={kiko.role} onChange={(e) => setKiko({ ...kiko, role: e.target.value })} className={`${inputCls} mt-1 w-full py-1`} /></label>
            <label>Sekolah (tanda tangan)<input value={kiko.school} onChange={(e) => setKiko({ ...kiko, school: e.target.value })} className={`${inputCls} mt-1 w-full py-1`} /></label>
          </div>
        </details>
        <p className="text-xs text-amber-700">Isi paper dikirim ke model AI pihak ketiga (model gratis dapat menyimpan prompt). Pakai data uji, atau pastikan paper tidak memuat data pribadi sensitif. Teks paper tidak disimpan setelah dinilai; hanya hasilnya.</p>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-bold">1. Tugas dan rubrik</h2>
        <form
          className="grid gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!title.trim()) return setErr("Judul/topik tugas wajib diisi.");
            if (tw <= 0 || rubric.some((c) => !c.name.trim() || !(c.weight > 0))) return setErr("Setiap kriteria butuh nama dan bobot lebih dari 0.");
            setPickId(addPaper({ classId, title: title.trim(), requirements: requirements.trim(), due, rubric, grading }));
            setTitle(""); setRequirements(""); setDue(""); setErr(""); setRecap(false);
          }}
        >
          <div className="grid gap-2 md:grid-cols-[1fr_auto]">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Judul/topik tugas (mis. Prinsip Desain Antarmuka)" className={inputCls} />
            <label className="flex items-center gap-2 text-xs text-slate-500">Tenggat <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className={inputCls} /></label>
          </div>
          <textarea value={requirements} onChange={(e) => setRequirements(e.target.value)} rows={2} placeholder="Ketentuan tugas: jumlah halaman, format, sistematika, dll. (dipakai untuk cek kelengkapan)" className={inputCls} />
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-left text-sm">
              <thead className="border-b text-xs uppercase text-slate-400"><tr><th className="p-2">Kriteria</th><th>Bobot</th><th>Yang dinilai</th><th /></tr></thead>
              <tbody>
                {rubric.map((c, i) => (
                  <tr key={c.id} className="border-b last:border-0">
                    <td className="p-1.5"><input value={c.name} onChange={(e) => setRubric(rubric.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} className={`${inputCls} w-full py-1`} /></td>
                    <td className="p-1.5"><input type="number" min={1} max={100} value={c.weight} onChange={(e) => setRubric(rubric.map((x, j) => (j === i ? { ...x, weight: Number(e.target.value) } : x)))} className={`${inputCls} w-20 py-1`} /></td>
                    <td className="p-1.5"><input value={c.desc} onChange={(e) => setRubric(rubric.map((x, j) => (j === i ? { ...x, desc: e.target.value } : x)))} className={`${inputCls} w-full py-1`} /></td>
                    <td className="p-1.5"><button type="button" disabled={rubric.length < 2} onClick={() => setRubric(rubric.filter((_, j) => j !== i))} className="text-slate-400 hover:text-red-600 disabled:opacity-30"><Trash2 size={14} /></button></td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr><td className="p-2 text-xs text-slate-500">Total bobot</td><td className={`p-2 text-sm font-semibold ${tw === 100 ? "text-emerald-700" : "text-amber-700"}`}>{tw}</td><td colSpan={2} className="p-2 text-xs text-slate-400">{tw === 100 ? "" : "Bukan 100: nilai dinormalisasi ke skala 100."}</td></tr></tfoot>
            </table>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <button type="button" className={btn2Cls} onClick={() => setRubric([...rubric, { id: `${slug("k")}${rubric.length + 1}-${Math.random().toString(36).slice(2, 5)}`, name: "", weight: 10, desc: "" }])}><Plus size={14} className="inline" /> Kriteria</button>
            <button type="button" className={btn2Cls} onClick={() => { setRubric(DEFAULT_RUBRIC); setGrading(DEFAULT_GRADING); }}>Kembalikan rubrik bawaan</button>
            <button type="button" className={btn2Cls} title="4 kriteria × skor 1–4 = maks. 16" onClick={() => setRubric(KIKO_RUBRIC)}>Rubrik Kiko (4 kriteria, maks. 16)</button>
            Batas predikat:
            {(["A", "B", "C"] as const).map((k) => <label key={k} className="flex items-center gap-1">{k} ≥ <input type="number" min={1} max={100} value={grading[k]} onChange={(e) => setGrading({ ...grading, [k]: Number(e.target.value) })} className={`${inputCls} w-16 py-1`} /></label>)}
            <span>(sesuaikan KKTP sekolah)</span>
          </div>
          <div><button className={btnCls}>Buat tugas paper</button> {err && <span className="ml-2 text-xs text-red-600">{err}</span>}</div>
        </form>
      </Card>

      {!check ? (
        <Card><p className="text-sm text-slate-500">Buat tugas paper di atas, lalu kirim paper pertama siswa.</p></Card>
      ) : (
        <>
          <Card className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-bold">2. Kirim paper</h2>
              <select value={check.id} onChange={(e) => { setPickId(e.target.value); setRecap(false); }} className={inputCls}>{list.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select>
              <button className={btn2Cls} title="Hapus tugas ini beserta hasilnya" onClick={() => confirm("Hapus tugas paper ini beserta semua hasilnya?") && removePaper(check.id)}><Trash2 size={14} /></button>
              <span className="text-xs text-slate-500">{check.due ? `Tenggat ${check.due}` : "Tanpa tenggat"} · {check.items.length}/{roster.length} paper masuk</span>
            </div>
            <div ref={addRef} className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-500">Satu paper</div>
                <div className="flex flex-wrap gap-2">
                  <select value={sid} onChange={(e) => setSid(e.target.value)} className={inputCls}><option value="">Siswa…</option>{roster.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
                  <label className="flex items-center gap-1 text-xs text-slate-500">Dikumpulkan <input type="date" value={on} onChange={(e) => setOn(e.target.value)} className={`${inputCls} py-1.5`} /></label>
                </div>
                <div className="flex flex-wrap gap-2">
                  <input ref={fileRef} type="file" accept=".docx,.pdf" className="hidden" onChange={(e) => sid ? addFiles(e.target.files, sid) : setMsg("Pilih siswa dulu.")} />
                  <button className={btn2Cls} disabled={!!busy} onClick={() => (sid ? fileRef.current?.click() : setMsg("Pilih siswa dulu."))}><FileUp size={14} className="mr-1 inline" />Unggah DOCX/PDF</button>
                </div>
                <textarea value={paste} onChange={(e) => setPaste(e.target.value)} rows={3} placeholder="…atau tempel isi paper di sini" className={`${inputCls} w-full`} />
                <button className={btn2Cls} disabled={!sid || !paste.trim()} onClick={() => { if (check.items.some((i) => i.studentId === sid)) return setMsg("Paper siswa ini sudah ada dan tidak dinilai dua kali. Hapus yang lama dulu bila ingin menggantinya."); upsertPaperItem(check.id, mkItem(sid, on, paste.trim())); setPaste(""); setMsg("Paper ditambahkan."); }}>Simpan paper tempelan</button>
              </div>
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-500">Banyak paper sekaligus</div>
                <p className="text-xs text-slate-500">Nama berkas dicocokkan dengan nama siswa (mis. “Budi Santoso - paper.docx”). Yang tidak cocok dilewati dan dilaporkan.</p>
                <input ref={bulkRef} type="file" multiple accept=".docx,.pdf" className="hidden" onChange={(e) => addFiles(e.target.files)} />
                <button className={btn2Cls} disabled={!!busy} onClick={() => bulkRef.current?.click()}><FileUp size={14} className="mr-1 inline" />Pilih banyak berkas</button>
              </div>
            </div>
            {msg && <p className="text-sm text-slate-600">{msg}</p>}
            <div className="flex flex-wrap items-center gap-2 border-t pt-3">
              <button className={btnCls} disabled={!!busy || !pending} onClick={gradeAll}>{busy.startsWith("Korektor") ? busy : `Koreksi ${pending} paper dengan AI`}</button>
              {busy && !busy.startsWith("Korektor") && <span className="text-sm text-slate-500">{busy}</span>}
              <button className={btn2Cls} disabled={!graded} onClick={() => check.items.filter((i) => i.status === "graded").forEach(approve)}>Setujui semua rekomendasi ({graded})</button>
            </div>
          </Card>

          {check.items.map((it) => (
            <Card key={it.id} className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-bold">{nameOf(it.studentId)}</h3>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS[it.status].cls}`}>{STATUS[it.status].t}</span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${it.late ? "bg-orange-100 text-orange-700" : "bg-slate-100 text-slate-500"}`}>{it.late ? "Terlambat" : "Tepat waktu"} · {it.submittedOn}</span>
                <span className="text-xs text-slate-400">{it.chars ? `${it.chars.toLocaleString("id-ID")} karakter dibaca` : ""}</span>
                <span className="flex-1" />
                {it.status === "graded" && it.score !== undefined && <span className="text-xl font-bold">{fmt(it.score)} <span className="text-base text-slate-500">· {it.grade}</span></span>}
                {it.status === "approved" && <span className="text-xl font-bold text-emerald-700">{fmt(it.approvedScore)} <span className="text-base">· {it.score !== undefined ? predicateOf(it.approvedScore ?? it.score, check.grading) : ""}</span></span>}
                <button className="text-slate-400 hover:text-red-600" onClick={() => confirm("Hapus paper ini?") && removePaperItem(check.id, it.id)}><Trash2 size={14} /></button>
              </div>

              {(it.status === "manual" || it.status === "error") && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                  {it.status === "manual" ? `Perlu dicek manual: ${it.manualReason ?? "tidak bisa dinilai."} Tidak ada nilai yang ditebak.` : `Gagal: ${it.error}`}
                  {it.text && it.text.length >= 300 && <button className={`${btn2Cls} ml-3`} onClick={() => gradeOne(it).catch(() => {})}>Coba lagi</button>}
                </div>
              )}

              {it.criteria && (
                <>
                  <div className="overflow-x-auto rounded-xl border">
                    <table className="w-full text-left text-sm">
                      <thead className="border-b text-xs uppercase text-slate-400"><tr><th className="p-2">Kriteria</th><th>Bobot</th><th>Level</th><th>Nilai</th><th>Alasan dan bukti</th></tr></thead>
                      <tbody>
                        {it.criteria.map((c) => {
                          const w = check.rubric.find((x) => x.id === c.id)?.weight ?? 0;
                          return (
                            <tr key={c.id} className="border-b align-top last:border-0">
                              <td className="p-2 text-xs font-medium">{nm(c.id)}</td>
                              <td className="p-2 text-xs">{w}</td>
                              <td className="p-2">
                                {it.status === "graded"
                                  ? <select value={c.level} onChange={(e) => setLevel(it, c.id, Number(e.target.value) as Level)} className={`${inputCls} py-1`}>{([4, 3, 2, 1] as Level[]).map((l) => <option key={l} value={l}>{l} · {LEVEL_LABEL[l]}</option>)}</select>
                                  : <span className="text-xs">{c.level} · {LEVEL_LABEL[c.level]}</span>}
                              </td>
                              <td className="p-2 text-xs">{fmt((w * c.level) / 4)}</td>
                              <td className="max-w-[420px] p-2 text-xs text-slate-600">{c.reason}{c.quote && <div className="mt-1 border-l-2 border-teal-300 pl-2 italic text-slate-500">“{c.quote}”</div>}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1 text-xs">
                      <div className="font-semibold text-slate-500">Kesalahan penting</div>
                      {it.mistakes?.length ? <ul className="list-disc pl-4 text-slate-600">{it.mistakes.map((m, i) => <li key={i}><b>{m.category}</b>: {m.text}</li>)}</ul> : <p className="text-slate-400">Tidak ada yang menonjol.</p>}
                      {!!it.completeness?.length && (
                        <>
                          <div className="pt-2 font-semibold text-slate-500">Kelengkapan sesuai ketentuan</div>
                          <ul className="text-slate-600">{it.completeness.map((c, i) => <li key={i}>{c.ok ? "✔" : "✘"} {c.item}{c.note ? ` — ${c.note}` : ""}</li>)}</ul>
                        </>
                      )}
                      {!!it.doubts?.length && <p className="pt-2 text-amber-700">Ada keraguan antar-level pada: {it.doubts.map((d) => nm(d.id)).join(", ")}. Level yang lebih rendah dipilih; mohon tinjau.</p>}
                    </div>
                    <div className="space-y-2 text-xs">
                      {it.originality?.note && <div className={`rounded-lg p-2 ${it.originality.flag ? "bg-amber-50 text-amber-800" : "bg-slate-50 text-slate-500"}`}><b>Catatan keaslian:</b> {it.originality.note}</div>}
                      <div className="font-semibold text-slate-500">Umpan balik untuk siswa (maks. 80 kata)</div>
                      <textarea disabled={it.status === "approved"} value={it.feedback ?? ""} onChange={(e) => patchPaperItem(check.id, it.id, { feedback: e.target.value })} rows={4} className={`${inputCls} w-full text-xs`} />
                      <div className="flex gap-2">
                        <button className={btn2Cls} onClick={() => navigator.clipboard?.writeText(it.feedback ?? "")}>Salin umpan balik</button>
                        {it.status === "graded" && <button className={btnCls} onClick={() => approve(it)}>Setujui dan masukkan ke Grades</button>}
                      </div>
                    </div>
                  </div>
                </>
              )}
              <DraftPanel
                it={it} check={check} kiko={kiko} studentName={nameOf(it.studentId)} className={classes.find((c) => c.id === check.classId)?.name ?? ""}
                edited={edits[it.id]} setEdited={(v) => setEdits((e) => { const n = { ...e }; if (v === undefined) delete n[it.id]; else n[it.id] = v; return n; })}
                patch={(p) => patchPaperItem(check.id, it.id, p)}
              />
            </Card>
          ))}

          {check.items.length > 0 && !busy && (
            <Card className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">Lanjut ke paper berikutnya, revisi nilai, atau buat rekap?</span>
              <button className={btn2Cls} onClick={() => addRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })}>Paper berikutnya</button>
              <button className={btn2Cls} onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>Revisi nilai (ubah level di tabel)</button>
              <button className={btnCls} onClick={() => { setRecap(true); setTimeout(() => recapRef.current?.scrollIntoView({ behavior: "smooth" }), 50); }}>Buat rekap</button>
            </Card>
          )}

          {check.items.length > 0 && !busy && (
            <Card className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-bold">Draf balasan Kiko</h2>
                <span className="text-xs text-slate-500">Draf ada di tiap paper di atas (buka bagian “Draf balasan Kiko”). Tidak ada email yang dikirim otomatis.</span>
                <span className="flex-1" />
                <button className={btnCls} onClick={() => setDraftRecap(true)}>Tampilkan rekap draf</button>
              </div>
              {draftRecap && (() => {
                const cn = classes.find((c) => c.id === check.classId)?.name ?? "";
                const rows = check.items.map((it) => {
                  const d = buildDraft({ profile: kiko, item: it, rubric: check.rubric, taskTitle: check.title, rosterName: nameOf(it.studentId), rosterClass: cn });
                  return { name: d.identity.name, className: d.identity.className, scoreText: d.scoreText, status: d.status, notes: d.notes.join(" | ") };
                });
                return (
                  <>
                    <div className="overflow-x-auto rounded-xl border">
                      <table className="w-full text-left text-sm">
                        <thead className="border-b text-xs uppercase text-slate-400"><tr><th className="p-2">Nama</th><th>Kelas</th><th>Nilai</th><th>Status draf</th><th>Catatan</th></tr></thead>
                        <tbody>{rows.map((x, i) => <tr key={i} className="border-b align-top last:border-0"><td className="p-2">{x.name}</td><td>{x.className}</td><td>{x.scoreText}</td><td className="text-xs">{x.status}</td><td className="p-2 text-xs text-slate-600">{x.notes}</td></tr>)}</tbody>
                      </table>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">Kirim semua, revisi dulu, atau rekap ke spreadsheet?</span>
                      <button className={btn2Cls} onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>Revisi dulu</button>
                      <button className={btnCls} onClick={() => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([draftRecapCsv(rows)], { type: "text/csv;charset=utf-8" })); a.download = "rekap-draf-kiko.csv"; a.click(); }}>Rekap ke spreadsheet (CSV)</button>
                    </div>
                    <p className="text-xs text-slate-500">“Kirim semua”: aplikasi ini tidak punya akses Gmail, jadi tidak mengirim email. Buka tiap draf lewat tombol “Buka di Gmail” (jendela tulis terisi), periksa, lalu kirim dari Gmail sendiri.</p>
                  </>
                );
              })()}
            </Card>
          )}

          {recap && r && (
            <div ref={recapRef}>
              <Card className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-bold">Rekap kelas: {check.title}</h2>
                  <span className="flex-1" />
                  <button className={btn2Cls} onClick={() => {
                    const a = document.createElement("a");
                    a.href = URL.createObjectURL(new Blob([recapCsv(r)], { type: "text/csv;charset=utf-8" }));
                    a.download = `rekap-paper-${check.title.replace(/[^\w]+/g, "-").slice(0, 40)}.csv`; a.click();
                  }}><Download size={14} className="mr-1 inline" />Unduh CSV (untuk spreadsheet)</button>
                </div>
                <div className="overflow-x-auto rounded-xl border">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b text-xs uppercase text-slate-400"><tr><th className="p-2">Nama</th><th>Nilai</th><th>Predikat</th><th>Catatan</th></tr></thead>
                    <tbody>{r.rows.map((x, i) => <tr key={i} className="border-b last:border-0"><td className="p-2">{x.name}</td><td>{x.score === null ? "–" : fmt(x.score)}</td><td>{x.grade}</td><td className="p-2 text-xs text-slate-600">{x.note}</td></tr>)}</tbody>
                  </table>
                </div>
                <div className="grid gap-3 text-sm md:grid-cols-3">
                  <div><div className="text-xs font-semibold text-slate-500">Rata-rata kelas</div><div className="text-2xl font-bold">{r.average === null ? "–" : fmt(r.average)}</div></div>
                  <div><div className="text-xs font-semibold text-slate-500">Belum mengumpulkan ({r.missing.length})</div><div className="text-xs text-slate-600">{r.missing.join(", ") || "Semua sudah mengumpulkan."}</div></div>
                  <div><div className="text-xs font-semibold text-slate-500">3 kesalahan paling umum (untuk dibahas di kelas)</div>
                    {r.topMistakes.length ? <ol className="list-decimal pl-4 text-xs text-slate-600">{r.topMistakes.map((m) => <li key={m.category}>{m.category} ({m.count} paper)</li>)}</ol> : <div className="text-xs text-slate-400">Belum ada data.</div>}
                  </div>
                </div>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Draf balasan Kiko untuk satu paper: identitas, subjek, isi (bisa diedit), catatan internal, dan tombol salin / buka di Gmail. */
function DraftPanel({ it, check, kiko, studentName, className, edited, setEdited, patch }: {
  it: PaperItem; check: PaperCheck; kiko: KikoProfile; studentName: string; className: string;
  edited: string | undefined; setEdited: (v: string | undefined) => void; patch: (p: Partial<PaperItem>) => void;
}) {
  const d: Draft = useMemo(() => buildDraft({ profile: kiko, item: it, rubric: check.rubric, taskTitle: check.title, rosterName: studentName, rosterClass: className }), [kiko, it, check.rubric, check.title, studentName, className]);
  const body = edited ?? d.body;
  const full = `Subjek: ${d.subject}\n\n${body}`;
  const inp = `${inputCls} w-full py-1 text-xs`;
  return (
    <details className="rounded-xl border bg-slate-50/60 p-3 text-xs">
      <summary className="flex cursor-pointer flex-wrap items-center gap-2 font-semibold text-slate-700"><Mail size={14} /> Draf balasan Kiko <span className={`rounded-full px-2 py-0.5 text-[11px] ${d.kind === "nilai" ? "bg-teal-100 text-teal-800" : "bg-orange-100 text-orange-700"}`}>{d.status}</span></summary>
      <div className="mt-3 space-y-3">
        <div className="grid gap-2 md:grid-cols-3">
          <label>Subjek email asli (opsional)<input value={it.subject ?? ""} onChange={(e) => patch({ subject: e.target.value })} placeholder="XIIDKV3 Paper UI/UX - Quen Sha" className={`${inp} mt-1`} /></label>
          <label>Nama tampilan pengirim (opsional)<input value={it.senderName ?? ""} onChange={(e) => patch({ senderName: e.target.value })} className={`${inp} mt-1`} /></label>
          <label>Email siswa (untuk kolom Kepada)<input value={it.senderEmail ?? ""} onChange={(e) => patch({ senderEmail: e.target.value })} className={`${inp} mt-1`} /></label>
        </div>
        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="w-full text-left">
            <thead className="border-b text-[11px] uppercase text-slate-400"><tr><th className="p-2">Nama</th><th>Kelas</th><th>Sekolah</th><th>Judul paper</th><th>Tgl kirim</th><th>Tepat waktu?</th></tr></thead>
            <tbody><tr><td className="p-2">{d.identity.name}</td><td>{d.identity.className}</td><td>{d.identity.school}</td><td>{d.identity.title}</td><td>{it.submittedOn}</td><td>{it.late ? "Terlambat" : "Ya"}</td></tr></tbody>
          </table>
        </div>
        <div><b>Subjek:</b> {d.subject}</div>
        <textarea value={body} onChange={(e) => setEdited(e.target.value)} rows={Math.min(24, body.split("\n").length + 1)} className={`${inputCls} w-full font-mono text-xs`} />
        {d.notes.length > 0 && (
          <div className="rounded-lg bg-amber-50 p-2 text-amber-800">
            <b>Catatan internal (tidak masuk draf):</b>
            <ul className="list-disc pl-4">{d.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <button className={btn2Cls} onClick={() => navigator.clipboard?.writeText(full)}>Salin draf</button>
          <a className={`${btnCls} inline-block`} href={gmailComposeUrl(it.senderEmail ?? "", d.subject, body)} target="_blank" rel="noopener noreferrer">Buka di Gmail (belum dikirim)</a>
          {edited !== undefined && <button className={btn2Cls} onClick={() => setEdited(undefined)}>Kembalikan teks otomatis</button>}
        </div>
      </div>
    </details>
  );
}
