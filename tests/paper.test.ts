import { describe, expect, it } from "vitest";
import { DEFAULT_GRADING, DEFAULT_RUBRIC, PaperCheck, buildRecap, parsePaperResult, predicateOf, quoteInPaper, recapCsv, scoreOf, trimWords } from "@/lib/paper";
import { planWithRules } from "@/lib/router";

const PAPER = "Desain antarmuka yang baik mengutamakan konsistensi, umpan balik yang jelas, dan hierarki visual. Menurut saya, prinsip proximity membantu pengguna memahami hubungan antar elemen dengan cepat. ".repeat(4);
const good = (over: Record<string, unknown> = {}) => ({
  kriteria: DEFAULT_RUBRIC.map((c) => ({ id: c.id, level: 3, alasan: "Cukup tepat.", kutipan: "prinsip proximity membantu pengguna memahami hubungan antar elemen" })),
  kesalahan: [{ jenis: "ejaan", deskripsi: "Penulisan 'di pakai' berulang.", kategori: "Ejaan Berulang" }],
  kelengkapan: [{ butir: "Ada pendahuluan", ada: true, catatan: "" }],
  keaslian: { perlu_dicek: false, catatan: "" }, ragu: [], umpan_balik: "Bagus sekali.", ...over,
});

describe("rubrik dan nilai", () => {
  it("bobot bawaan berjumlah 100 dan level dikonversi ke bobot (4=100%, 3=75%, 2=50%, 1=25%)", () => {
    expect(DEFAULT_RUBRIC.reduce((s, c) => s + c.weight, 0)).toBe(100);
    const all = (l: number) => Object.fromEntries(DEFAULT_RUBRIC.map((c) => [c.id, l]));
    expect(scoreOf(DEFAULT_RUBRIC, all(4))).toBe(100);
    expect(scoreOf(DEFAULT_RUBRIC, all(3))).toBe(75);
    expect(scoreOf(DEFAULT_RUBRIC, all(2))).toBe(50);
    expect(scoreOf(DEFAULT_RUBRIC, { ...all(4), sumber: 1 })).toBe(92.5); // 90 + bobot 10 × 25%
  });
  it("kriteria belum dinilai → null (tidak menebak); bobot ≠ 100 dinormalisasi", () => {
    expect(scoreOf(DEFAULT_RUBRIC, { isi: 4 })).toBeNull();
    expect(scoreOf([{ id: "a", name: "A", weight: 50, desc: "" }, { id: "b", name: "B", weight: 50, desc: "" }], { a: 4, b: 2 })).toBe(75);
    expect(scoreOf([{ id: "a", name: "A", weight: 10, desc: "" }], { a: 4 })).toBe(100);
  });
  it("predikat: A ≥ 90, B ≥ 80, C ≥ 70, selebihnya D", () => {
    const p = (n: number) => predicateOf(n, DEFAULT_GRADING);
    expect([p(100), p(90), p(89.9), p(80), p(79.9), p(70), p(69.9), p(0)]).toEqual(["A", "A", "B", "B", "C", "C", "D", "D"]);
  });
  it("umpan balik dipotong maksimal 80 kata", () => {
    const long = Array.from({ length: 120 }, (_, i) => `kata${i}`).join(" ");
    expect(trimWords(long, 80).replace("…", "").trim().split(/\s+/)).toHaveLength(80);
    expect(trimWords("singkat saja", 80)).toBe("singkat saja");
  });
});

describe("validasi keluaran AI (tidak menebak)", () => {
  it("hasil lengkap: skor dihitung aplikasi, bukan AI; kutipan terbukti dipertahankan", () => {
    const r = parsePaperResult({ ...good(), skor: 100 }, PAPER, DEFAULT_RUBRIC, DEFAULT_GRADING);
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.score).toBe(75); expect(r.grade).toBe("C"); expect(r.criteria[0].quoteOk).toBe(true); expect(r.mistakes[0].category).toBe("ejaan berulang"); }
  });
  it("kutipan karangan AI dibuang", () => {
    const r = parsePaperResult(good({ kriteria: DEFAULT_RUBRIC.map((c) => ({ id: c.id, level: 4, alasan: "x", kutipan: "kalimat yang tidak pernah ada di paper siswa" })) }), PAPER, DEFAULT_RUBRIC, DEFAULT_GRADING);
    expect(r.ok && r.criteria.every((c) => c.quote === "" && !c.quoteOk)).toBe(true);
    expect(quoteInPaper("prinsip proximity membantu pengguna", PAPER)).toBe(true);
    expect(quoteInPaper("tidak ada", PAPER)).toBe(false);
  });
  it("kriteria hilang / paper tidak terbaca → perlu dicek manual", () => {
    const missing = parsePaperResult(good({ kriteria: good().kriteria.slice(0, 3) }), PAPER, DEFAULT_RUBRIC, DEFAULT_GRADING);
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.reason).toMatch(/Bahasa dan penulisan.*Sumber/);
    expect(parsePaperResult({ tidak_terbaca: true, alasan_tidak_terbaca: "Terpotong" }, PAPER, DEFAULT_RUBRIC, DEFAULT_GRADING)).toMatchObject({ ok: false, reason: "Terpotong" });
    expect(parsePaperResult(null, PAPER, DEFAULT_RUBRIC, DEFAULT_GRADING).ok).toBe(false);
    expect(parsePaperResult(good({ umpan_balik: "" }), PAPER, DEFAULT_RUBRIC, DEFAULT_GRADING).ok).toBe(false);
  });
  it("ragu antara dua level → dipaksa ke yang lebih rendah dan dicatat", () => {
    const r = parsePaperResult(good({ ragu: [{ id: "isi", antara: [3, 2], alasan: "Antara baik dan cukup" }] }), PAPER, DEFAULT_RUBRIC, DEFAULT_GRADING);
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.criteria.find((c) => c.id === "isi")!.level).toBe(2); expect(r.doubts).toHaveLength(1); }
  });
  it("keaslian: ditandai [PERLU DICEK GURU] secara netral; level di luar 1–4 dianggap tidak dinilai", () => {
    const r = parsePaperResult(good({ keaslian: { perlu_dicek: true, catatan: "Paragraf 3 bergaya sangat berbeda." } }), PAPER, DEFAULT_RUBRIC, DEFAULT_GRADING);
    expect(r.ok && r.originality.flag && r.originality.note.startsWith("[PERLU DICEK GURU]")).toBe(true);
    const bad = parsePaperResult(good({ kriteria: DEFAULT_RUBRIC.map((c) => ({ id: c.id, level: 9, alasan: "x", kutipan: "" })) }), PAPER, DEFAULT_RUBRIC, DEFAULT_GRADING);
    expect(bad.ok).toBe(false);
  });
});

describe("rekap kelas", () => {
  const roster = [{ id: "1", name: "Budi" }, { id: "2", name: "Ani" }, { id: "3", name: "Citra" }, { id: "4", name: "Dedi" }];
  const item = (studentId: string, over: object) => ({ id: studentId, studentId, submittedOn: "2026-11-20", late: false, status: "graded" as const, chars: 900, ...over });
  const check: PaperCheck = {
    id: "p", classId: "c", title: "T", requirements: "", due: "2026-11-21", rubric: DEFAULT_RUBRIC, grading: DEFAULT_GRADING,
    items: [
      item("1", { score: 92, mistakes: [{ kind: "ejaan", text: "a", category: "ejaan berulang" }, { kind: "x", text: "b", category: "tanpa referensi" }] }),
      item("2", { score: 74, late: true, mistakes: [{ kind: "ejaan", text: "a", category: "ejaan berulang" }], originality: { flag: true, note: "x" } }),
      item("3", { status: "manual", manualReason: "file kosong" }),
    ],
  };
  it("urut nama, rata-rata hanya dari yang bernilai, belum mengumpulkan, 3 kesalahan terbanyak", () => {
    const r = buildRecap(check, roster);
    expect(r.rows.map((x) => x.name)).toEqual(["Ani", "Budi", "Citra"]);
    expect(r.rows[0]).toMatchObject({ score: 74, grade: "C" });
    expect(r.rows[0].note).toMatch(/terlambat.*PERLU DICEK GURU/);
    expect(r.rows[2]).toMatchObject({ score: null, grade: "–" });
    expect(r.rows[2].note).toMatch(/perlu dicek manual: file kosong/);
    expect(r.average).toBe(83);
    expect(r.missing).toEqual(["Dedi"]);
    expect(r.topMistakes).toEqual([{ category: "ejaan berulang", count: 2 }, { category: "tanpa referensi", count: 1 }]);
  });
  it("CSV: BOM, header, tanda kutip di-escape", () => {
    const csv = recapCsv({ rows: [{ name: 'Si "Budi"', score: 80, grade: "B", note: "a, b" }], average: 80, missing: [], topMistakes: [] });
    expect(csv.startsWith('﻿"Nama","Nilai","Predikat","Catatan"')).toBe(true);
    expect(csv).toContain('"Si ""Budi"""');
  });
});

describe("perutean Command Center", () => {
  it('"koreksi paper" ke Korektor Paper, bukan Citra; "koreksi esai" tetap ke Citra', () => {
    expect(planWithRules("Tolong koreksi paper siswa XI DKV").map((t) => t.agentId)).toEqual(["paper"]);
    expect(planWithRules("koreksi makalah kelas XII DKVB").map((t) => t.agentId)).toEqual(["paper"]);
    expect(planWithRules("koreksi esai kelas XI DKV").map((t) => t.agentId)).toContain("checker");
    expect(planWithRules("koreksi esai kelas XI DKV").map((t) => t.agentId)).not.toContain("paper");
  });
});
