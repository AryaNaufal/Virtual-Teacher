import { AGENTS } from "./agents";

export type Priority = "low" | "normal" | "high";
export interface PlannedTask { agentId: string; title: string; priority: Priority }

/** Aturan kata kunci (fallback tanpa OpenAI). Urutan = prioritas penyebutan eksplisit "AI X". */
const RULES: { agentId: string; words: string[] }[] = [
  { agentId: "attendance", words: ["absen", "kehadiran", "hadir", "alfa", "izin", "sakit"] },
  { agentId: "paper", words: ["paper", "makalah"] },
  { agentId: "checker", words: ["koreksi", "periksa jawaban", "kunci jawaban", "rubrik", "lembar jawaban", "checker"] },
  { agentId: "grading", words: ["nilai", "rata-rata", "rekap nilai", "grading", "ranking"] },
  { agentId: "assignment", words: ["soal", "kuis", "quiz", "tugas praktik", "pilihan ganda", "esai", "assignment"] },
  { agentId: "content", words: ["materi", "modul", "rangkuman", "presentasi", "ppt", "content"] },
  { agentId: "reporting", words: ["laporan", "report", "perkembangan", "rapor"] },
  { agentId: "archivist", words: ["arsip", "simpan dokumen", "cari dokumen", "archivist"] },
  { agentId: "administrator", words: ["data siswa", "data kelas", "mata pelajaran", "administrasi", "administrator"] },
];

export function detectPriority(text: string): Priority {
  const t = text.toLowerCase();
  if (/(urgent|segera|penting|hari ini|secepatnya)/.test(t)) return "high";
  if (/(santai|nanti|tidak buru)/.test(t)) return "low";
  return "normal";
}

export function planWithRules(message: string): PlannedTask[] {
  const t = message.toLowerCase();
  const priority = detectPriority(t);
  const hit: string[] = [];

  // Sebutan eksplisit: "AI Grading", "AI Content", dst.
  for (const a of AGENTS) {
    const key = a.title.toLowerCase().replace("ai ", "").split(" ")[0];
    if (a.id !== "manager" && new RegExp(`\\bai\\s+${key}`).test(t)) hit.push(a.id);
  }
  for (const r of RULES) if (r.words.some((w) => t.includes(w))) hit.push(r.agentId);
  // Koreksi/soal lebih spesifik daripada "nilai"; hindari ganda saat ada koreksi.
  const uniq = [...new Set(hit)];
  const noChecker = uniq.includes("paper") && !/esai|essay|jawaban/.test(t) ? uniq.filter((x) => x !== "checker") : uniq; // "koreksi paper" bukan koreksi esai
  const final = noChecker.includes("checker") || noChecker.includes("paper") ? noChecker.filter((x) => x !== "grading" || /rata-rata|rekap/.test(t)) : noChecker;
  const clean = message.trim().replace(/\s+/g, " ");
  return final.slice(0, 4).map((agentId) => ({ agentId, title: clean.length > 90 ? clean.slice(0, 87) + "…" : clean, priority }));
}

/** Tugas yang menyangkut keputusan akademik wajib persetujuan guru. */
export const NEEDS_APPROVAL_AGENTS = new Set(["grading", "checker", "paper", "reporting", "attendance"]);
