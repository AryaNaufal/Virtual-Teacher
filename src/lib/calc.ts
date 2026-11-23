import type { AttRecord, AttStatus, Grade, GradeType, Student } from "@/store/data";

export const WEIGHTS: Record<GradeType, number> = { tugas: 0.3, ujian: 0.4, praktik: 0.3 };
export const GRADE_LABEL: Record<GradeType, string> = { tugas: "Tugas", ujian: "Ujian", praktik: "Praktik" };
export const ATT_LABEL: Record<AttStatus, string> = { H: "Hadir", S: "Sakit", I: "Izin", A: "Alfa" };

export interface AttSummary { H: number; S: number; I: number; A: number; total: number; pct: number }

export function attendanceSummary(records: AttRecord[]): AttSummary {
  const s = { H: 0, S: 0, I: 0, A: 0 };
  for (const r of records) s[r.status]++;
  const total = records.length;
  return { ...s, total, pct: total ? Math.round((s.H / total) * 1000) / 10 : 0 };
}

export const inMonth = (date: string, month: string) => date.startsWith(month); // month = YYYY-MM

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** Rata-rata per jenis, lalu nilai akhir berbobot dari jenis yang tersedia (bobot dinormalisasi). */
export function weightedFinal(grades: Grade[]): { perType: Partial<Record<GradeType, number>>; final: number | null } {
  const perType: Partial<Record<GradeType, number>> = {};
  let sum = 0, w = 0;
  (Object.keys(WEIGHTS) as GradeType[]).forEach((t) => {
    const a = avg(grades.filter((g) => g.type === t).map((g) => g.score));
    if (a !== null) { perType[t] = a; sum += a * WEIGHTS[t]; w += WEIGHTS[t]; }
  });
  return { perType, final: w ? Math.round((sum / w) * 10) / 10 : null };
}

export function classAverage(students: Student[], grades: Grade[], subjectId?: string): number | null {
  const finals = students
    .map((s) => weightedFinal(grades.filter((g) => g.studentId === s.id && (!subjectId || g.subjectId === subjectId))).final)
    .filter((x): x is number => x !== null);
  const a = avg(finals);
  return a === null ? null : Math.round(a * 10) / 10;
}

export const fmt = (n: number | null | undefined) => (n === null || n === undefined ? "–" : n.toFixed(1).replace(/\.0$/, ""));
