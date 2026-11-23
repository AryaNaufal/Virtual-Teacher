import { useData } from "@/store/data";
import { attendanceSummary, fmt, inMonth, weightedFinal } from "./calc";
import type { DocTable } from "./docs";

/** Laporan akademik dari data nyata: kehadiran bulan terpilih + nilai (final disetujui, atau rekomendasi bila belum). */
export function buildAcademicReport(classId: string, month: string, subjectId?: string) {
  const { classes, students, attendance, grades, finals, subjects } = useData.getState();
  const cls = classes.find((c) => c.id === classId);
  if (!cls) return null;
  const st = students.filter((s) => s.classId === classId);
  if (!st.length) return null;
  const subj = subjects.find((s) => s.id === subjectId);

  let pendingApproval = 0;
  const rows: string[][] = st.map((s, i) => {
    const att = attendanceSummary(attendance.filter((a) => a.studentId === s.id && inMonth(a.date, month)));
    const g = grades.filter((x) => x.studentId === s.id && (!subj || x.subjectId === subj.id));
    const rec = subj ? weightedFinal(g).final : null;
    const fin = subj ? finals.find((f) => f.studentId === s.id && f.subjectId === subj.id) : undefined;
    let nilai = "–";
    if (fin && fin.score === rec) nilai = fmt(fin.score);
    else if (rec !== null) { nilai = `${fmt(rec)}*`; pendingApproval++; }
    return [String(i + 1), s.name, s.nis || "–", String(att.H), String(att.S), String(att.I), String(att.A), att.total ? `${att.pct}%` : "–", nilai];
  });

  const all = attendanceSummary(attendance.filter((a) => st.some((s) => s.id === a.studentId) && inMonth(a.date, month)));
  const table: DocTable = { head: ["No", "Nama", "NIS", "H", "S", "I", "A", "% Hadir", "Nilai"], rows };
  const content = [
    `# Laporan Akademik Kelas ${cls.name}`,
    `Periode absensi: ${month}${subj ? ` · Mata pelajaran: ${subj.name}` : " · Semua mata pelajaran"}`,
    `Jumlah siswa: ${st.length}. Kehadiran kelas: ${all.total ? all.pct + "%" : "belum ada data absensi"}.`,
    pendingApproval ? `Catatan: ${pendingApproval} nilai bertanda * adalah rekomendasi yang belum disetujui guru.` : "Semua nilai yang tampil telah disetujui guru.",
    ...(subj ? [] : ["Kolom Nilai kosong bila tidak memilih satu mata pelajaran."]),
  ].join("\n");

  return { cls, subj, content, table, title: `Laporan Akademik ${cls.name} ${month}${subj ? " " + subj.name : ""}` };
}
