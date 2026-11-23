import { describe, expect, it } from "vitest";
import { attendanceSummary, weightedFinal } from "@/lib/calc";
import { planWithRules } from "@/lib/router";
import { parseBlocks } from "@/lib/docs";
import { parseCsv } from "@/lib/table";
import { normStatus } from "@/lib/importers";
import { aiConfig } from "@/lib/ai";

describe("kalkulasi", () => {
  it("rekap absensi menghitung persentase", () => {
    const s = attendanceSummary([
      { studentId: "a", date: "2026-11-01", status: "H" },
      { studentId: "a", date: "2026-11-02", status: "S" },
      { studentId: "a", date: "2026-11-03", status: "A" },
      { studentId: "a", date: "2026-11-04", status: "H" },
    ]);
    expect(s).toMatchObject({ H: 2, S: 1, I: 0, A: 1, total: 4, pct: 50 });
  });

  it("nilai akhir berbobot dan dinormalisasi bila jenis kosong", () => {
    const g = (type: "tugas" | "ujian" | "praktik", score: number) => ({ id: type, studentId: "a", subjectId: "s", type, title: type, score });
    expect(weightedFinal([g("tugas", 80), g("ujian", 90), g("praktik", 70)]).final).toBe(81); // .3*80+.4*90+.3*70
    expect(weightedFinal([g("tugas", 80), g("ujian", 90)]).final).toBe(85.7);
    expect(weightedFinal([]).final).toBeNull();
  });
});

describe("router kata kunci", () => {
  it("memetakan instruksi ke agen yang tepat", () => {
    expect(planWithRules("Tolong rekap absensi kelas 10A bulan November").map((p) => p.agentId)).toEqual(["attendance"]);
    expect(planWithRules("AI Grading, hitung nilai rata-rata siswa kelas 11B").map((p) => p.agentId)).toEqual(["grading"]);
    expect(planWithRules("AI Content, buatkan materi Excel dan 20 soal pilihan ganda").map((p) => p.agentId).sort()).toEqual(["assignment", "content"]);
    expect(planWithRules("halo apa kabar")).toEqual([]);
  });
  it("mendeteksi prioritas", () => {
    expect(planWithRules("segera rekap absensi")[0].priority).toBe("high");
  });
});

describe("konfigurasi AI", () => {
  it("memakai AI_* lebih dulu, lalu OPENAI_*, lalu default OpenAI", () => {
    const keys = ["AI_API_KEY", "AI_BASE_URL", "AI_MODEL", "OPENAI_API_KEY", "OPENAI_MODEL"] as const;
    const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
    try {
      keys.forEach((k) => delete process.env[k]);
      expect(aiConfig()).toMatchObject({ key: "", url: "https://api.openai.com/v1/chat/completions", model: "gpt-4o-mini" });
      process.env.OPENAI_API_KEY = "lama";
      expect(aiConfig().key).toBe("lama");
      process.env.AI_API_KEY = "baru";
      process.env.AI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/";
      process.env.AI_MODEL = "gemini-2.5-flash";
      expect(aiConfig()).toMatchObject({ key: "baru", url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", model: "gemini-2.5-flash", visionModel: "gemini-2.5-flash" });
    } finally {
      keys.forEach((k) => (saved[k] === undefined ? delete process.env[k] : (process.env[k] = saved[k])));
    }
  });
});

describe("parser", () => {
  it("CSV: kutipan, titik koma, baris kosong", () => {
    expect(parseCsv('nama;nis\n"Budi; Jr";1\n\nSiti;2\n')).toEqual([["nama", "nis"], ["Budi; Jr", "1"], ["Siti", "2"]]);
  });
  it("status absensi", () => {
    expect(["Hadir", "s", "IJIN", "alpa", "x"].map(normStatus)).toEqual(["H", "S", "I", "A", null]);
  });
  it("blok dokumen", () => {
    expect(parseBlocks("# Judul\n- **butir**\nteks")).toEqual([{ t: "h1", text: "Judul" }, { t: "li", text: "butir" }, { t: "p", text: "teks" }]);
  });
});
