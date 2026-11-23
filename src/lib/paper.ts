/** Logika murni Korektor Paper: rubrik, hitung nilai dari level, validasi keluaran AI, dan rekap kelas. Tanpa akses jaringan/DB agar bisa dites. */

export interface Criterion { id: string; name: string; weight: number; desc: string }
export interface Grading { A: number; B: number; C: number } // batas bawah nilai untuk predikat A/B/C; di bawah C = D
export type Level = 1 | 2 | 3 | 4;

export const DEFAULT_RUBRIC: Criterion[] = [
  { id: "isi", name: "Isi dan pemahaman materi", weight: 35, desc: "Ketepatan konsep, kedalaman, contoh relevan" },
  { id: "struktur", name: "Struktur dan sistematika", weight: 20, desc: "Pendahuluan, isi, penutup, alur logis" },
  { id: "analisis", name: "Analisis dan pendapat sendiri", weight: 20, desc: "Argumen, keterkaitan dengan praktik UI/UX" },
  { id: "bahasa", name: "Bahasa dan penulisan", weight: 15, desc: "Ejaan (PUEBI), kalimat efektif, kerapian" },
  { id: "sumber", name: "Sumber dan referensi", weight: 10, desc: "Ada sumber, cara mengutip benar" },
];
export const DEFAULT_GRADING: Grading = { A: 90, B: 80, C: 70 };
export const LEVEL_LABEL: Record<Level, string> = { 4: "Sangat baik", 3: "Baik", 2: "Cukup", 1: "Perlu bimbingan" };
export const MIN_CHARS = 300;       // di bawah ini paper dianggap tidak terbaca/tidak lengkap
export const MAX_CHARS = 60000;     // batas bacaan penuh; lebih panjang → perlu dicek manual (tidak menebak dari potongan)
export const FEEDBACK_MAX_WORDS = 80;

export interface CriterionResult { id: string; level: Level; reason: string; quote: string; quoteOk: boolean }
export interface Mistake { kind: string; text: string; category: string }
export interface PaperItem {
  id: string; studentId: string; submittedOn: string; late: boolean;
  status: "pending" | "graded" | "manual" | "approved" | "error";
  text?: string; chars: number; // teks hanya disimpan sampai dinilai (privasi + ukuran)
  criteria?: CriterionResult[]; mistakes?: Mistake[]; completeness?: { item: string; ok: boolean; note: string }[];
  originality?: { flag: boolean; note: string }; doubts?: { id: string; reason: string }[];
  feedback?: string; score?: number; grade?: string; manualReason?: string; error?: string; approvedScore?: number;
  // untuk draf balasan Kiko
  identity?: PaperIdentity; summary?: string; improvements?: string[]; subject?: string; senderName?: string; senderEmail?: string;
}
export interface PaperIdentity { name: string; nis: string; className: string; school: string; title: string }
export interface PaperCheck { id: string; classId: string; title: string; requirements: string; due: string; rubric: Criterion[]; grading: Grading; items: PaperItem[] }

export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
export const totalWeight = (r: Criterion[]) => r.reduce((s, c) => s + (Number(c.weight) || 0), 0);

/** Nilai = Σ bobot × level/4 (level 4 = bobot penuh, 3 = 75%, 2 = 50%, 1 = 25%), dinormalisasi ke 100 bila total bobot ≠ 100. null bila ada kriteria belum dinilai. */
export function scoreOf(rubric: Criterion[], levels: Record<string, number | undefined>): number | null {
  const tw = totalWeight(rubric);
  if (!tw) return null;
  let s = 0;
  for (const c of rubric) {
    const l = levels[c.id];
    if (!l || l < 1 || l > 4) return null;
    s += (c.weight * l) / 4;
  }
  return Math.round((s / tw) * 1000) / 10;
}

export const predicateOf = (score: number, g: Grading) => (score >= g.A ? "A" : score >= g.B ? "B" : score >= g.C ? "C" : "D");

export function trimWords(text: string, max: number): string {
  const w = text.trim().split(/\s+/).filter(Boolean);
  return w.length <= max ? text.trim() : `${w.slice(0, max).join(" ").replace(/[,;:\-–]+$/, "")}…`;
}

const norm = (s: string) => s.toLowerCase().replace(/[“”"'‘’]/g, "").replace(/\s+/g, " ").trim();
/** Kutipan dianggap terbukti bila (sebagian awalnya) benar-benar ada di paper. */
export function quoteInPaper(quote: string, paper: string): boolean {
  const q = norm(quote).replace(/…|\.\.\.$/g, "").trim();
  if (q.length < 8) return false;
  const p = norm(paper);
  return p.includes(q) || p.includes(q.slice(0, Math.min(q.length, 40)));
}

export type ParsedPaper =
  | { ok: true; identity: PaperIdentity; summary: string; improvements: string[]; criteria: CriterionResult[]; mistakes: Mistake[]; completeness: NonNullable<PaperItem["completeness"]>; originality: NonNullable<PaperItem["originality"]>; doubts: NonNullable<PaperItem["doubts"]>; feedback: string; score: number; grade: string }
  | { ok: false; manual: true; reason: string };

/**
 * Memvalidasi keluaran AI terhadap rubrik. Prinsip: tidak menebak. Kriteria yang tidak dinilai → "perlu dicek manual".
 * Bila AI ragu antara dua level, level dipaksa ke yang lebih rendah. Kutipan yang tidak ditemukan di paper dibuang.
 */
export function parsePaperResult(raw: unknown, paper: string, rubric: Criterion[], grading: Grading): ParsedPaper {
  const o = (raw ?? {}) as Record<string, unknown>;
  const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
  const str = (v: unknown, max = 400) => (typeof v === "string" ? v.trim().slice(0, max) : "");

  if (o.tidak_terbaca === true) return { ok: false, manual: true, reason: str(o.alasan_tidak_terbaca) || "Paper tidak terbaca atau tidak lengkap; perlu dicek manual." };

  const doubts = arr<{ id?: unknown; antara?: unknown; alasan?: unknown }>(o.ragu).flatMap((d) => {
    const id = str(d.id, 40), between = arr<number>(d.antara).map(Number).filter((n) => n >= 1 && n <= 4);
    return id && between.length ? [{ id, min: Math.min(...between), reason: str(d.alasan, 200) }] : [];
  });

  const byId = new Map(arr<{ id?: unknown; level?: unknown; alasan?: unknown; kutipan?: unknown }>(o.kriteria).map((k) => [str(k.id, 40), k]));
  const criteria: CriterionResult[] = [];
  const missing: string[] = [];
  for (const c of rubric) {
    const k = byId.get(c.id);
    let level = Math.round(Number(k?.level));
    if (!k || !(level >= 1 && level <= 4)) { missing.push(c.name); continue; }
    const d = doubts.find((x) => x.id === c.id);
    if (d) level = Math.min(level, d.min); // ragu → pilih yang lebih rendah
    const quote = str(k.kutipan, 300);
    criteria.push({ id: c.id, level: level as Level, reason: str(k.alasan, 300), quote: quote && quoteInPaper(quote, paper) ? quote : "", quoteOk: !!quote && quoteInPaper(quote, paper) });
  }
  if (missing.length) return { ok: false, manual: true, reason: `AI tidak menilai kriteria: ${missing.join(", ")}. Perlu dicek manual.` };

  const score = scoreOf(rubric, Object.fromEntries(criteria.map((c) => [c.id, c.level])));
  if (score === null) return { ok: false, manual: true, reason: "Bobot rubrik tidak valid; perlu dicek manual." };

  const feedback = trimWords(str(o.umpan_balik, 1200), FEEDBACK_MAX_WORDS);
  if (!feedback) return { ok: false, manual: true, reason: "AI tidak menghasilkan umpan balik; perlu dicek manual." };

  const orig = (o.keaslian ?? {}) as { perlu_dicek?: unknown; catatan?: unknown };
  const flag = orig.perlu_dicek === true;
  const note = str(orig.catatan, 400);
  const id = (o.identitas ?? {}) as Record<string, unknown>;
  return {
    ok: true, criteria, feedback,
    identity: { name: str(id.nama, 120), nis: str(id.nis, 40), className: str(id.kelas, 40), school: str(id.sekolah, 120), title: str(id.judul, 200) },
    summary: str(o.ringkasan, 300),
    improvements: arr<unknown>(o.perbaikan).map((x) => str(x, 250)).filter(Boolean).slice(0, 3), score, grade: predicateOf(score, grading),
    mistakes: arr<{ jenis?: unknown; deskripsi?: unknown; kategori?: unknown }>(o.kesalahan).slice(0, 8)
      .map((m) => ({ kind: str(m.jenis, 30) || "lainnya", text: str(m.deskripsi, 250), category: str(m.kategori, 40).toLowerCase() || "lainnya" })).filter((m) => m.text),
    completeness: arr<{ butir?: unknown; ada?: unknown; catatan?: unknown }>(o.kelengkapan).slice(0, 12).map((x) => ({ item: str(x.butir, 120), ok: x.ada === true, note: str(x.catatan, 160) })).filter((x) => x.item),
    originality: { flag, note: flag ? `[PERLU DICEK GURU] ${note}`.trim() : note },
    doubts: doubts.map((d) => ({ id: d.id, reason: d.reason })),
  };
}

// ── rekap kelas ───────────────────────────────────────────────────────────────────────────────────────────
export interface RecapRow { name: string; score: number | null; grade: string; note: string }
export interface Recap { rows: RecapRow[]; average: number | null; missing: string[]; topMistakes: { category: string; count: number }[] }

export function buildRecap(check: PaperCheck, roster: { id: string; name: string }[]): Recap {
  const rows: RecapRow[] = [];
  const counts = new Map<string, number>();
  for (const it of check.items) {
    const name = roster.find((s) => s.id === it.studentId)?.name ?? "?";
    const score = it.status === "approved" ? it.approvedScore ?? it.score ?? null : it.status === "graded" ? it.score ?? null : null;
    const notes: string[] = [];
    if (it.late) notes.push("terlambat");
    if (it.status === "manual") notes.push(`perlu dicek manual${it.manualReason ? `: ${it.manualReason}` : ""}`);
    if (it.status === "error") notes.push("belum berhasil dinilai");
    if (it.status === "pending") notes.push("belum dinilai");
    if (it.originality?.flag) notes.push("keaslian: PERLU DICEK GURU");
    if (it.doubts?.length) notes.push("ada keraguan level (diambil yang lebih rendah)");
    rows.push({ name, score, grade: score === null ? "–" : predicateOf(score, check.grading), note: notes.join("; ") });
    for (const m of it.mistakes ?? []) counts.set(m.category, (counts.get(m.category) ?? 0) + 1);
  }
  rows.sort((a, b) => a.name.localeCompare(b.name, "id"));
  const scored = rows.filter((r) => r.score !== null) as (RecapRow & { score: number })[];
  const submitted = new Set(check.items.map((i) => i.studentId));
  return {
    rows,
    average: scored.length ? Math.round((scored.reduce((s, r) => s + r.score, 0) / scored.length) * 10) / 10 : null,
    missing: roster.filter((s) => !submitted.has(s.id)).map((s) => s.name).sort((a, b) => a.localeCompare(b, "id")),
    topMistakes: [...counts].map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count || a.category.localeCompare(b.category)).slice(0, 3),
  };
}

const csvCell = (v: string | number | null) => `"${String(v ?? "").replace(/"/g, '""')}"`;
export const recapCsv = (r: Recap) =>
  "﻿" + [["Nama", "Nilai", "Predikat", "Catatan"], ...r.rows.map((x) => [x.name, x.score ?? "", x.grade, x.note])].map((row) => row.map(csvCell).join(",")).join("\r\n");

/** Teks hasil satu paper (dipakai Command Center); format mengikuti rancangan keluaran: tabel kriteria + total + umpan balik. */
export function formatPaperText(title: string, p: Extract<ParsedPaper, { ok: true }>, rubric: Criterion[]): string {
  const rows = rubric.map((c) => { const r = p.criteria.find((x) => x.id === c.id)!; return `| ${c.name} | ${c.weight} | ${r.level} (${LEVEL_LABEL[r.level]}) | ${Math.round(((c.weight * r.level) / 4) * 10) / 10} | ${r.reason}${r.quote ? ` — “${r.quote}”` : ""} |`; });
  return [
    `Paper: ${title}`,
    "| Kriteria | Bobot | Level | Nilai | Alasan |", "|---|---|---|---|---|", ...rows,
    `Total: ${p.score} · Predikat ${p.grade} (rekomendasi, belum final; setujui di menu Korektor Paper)`,
    ...(p.mistakes.length ? ["Kesalahan penting:", ...p.mistakes.map((m) => `- ${m.text}`)] : []),
    ...(p.originality.note ? [`Keaslian: ${p.originality.note}`] : []),
    `Umpan balik untuk siswa: ${p.feedback}`,
    "Lanjut ke paper berikutnya, revisi nilai, atau buat rekap?",
  ].join("\n");
}

/** Klien untuk /api/grade-paper. */
export type GradeResponse = { manual: true; reason: string } | (Extract<ParsedPaper, { ok: true }> & { manual?: false; model?: string });
export async function requestGradePaper(body: { paper: string; topic: string; requirements: string; rubric: Criterion[]; grading: Grading }): Promise<GradeResponse> {
  const res = await fetch("/api/grade-paper", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.error ?? `Gagal menilai paper (HTTP ${res.status})`);
  return d as GradeResponse;
}
