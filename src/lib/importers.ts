import { AttStatus, useData } from "@/store/data";
import { Row, pick } from "./table";

export const normStatus = (v: string): AttStatus | null => {
  const t = v.trim().toLowerCase();
  if (["h", "hadir", "present"].includes(t)) return "H";
  if (["s", "sakit"].includes(t)) return "S";
  if (["i", "izin", "ijin"].includes(t)) return "I";
  if (["a", "alfa", "alpa", "absen"].includes(t)) return "A";
  return null;
};

export const looksLikeAttendance = (rows: Row[]) => rows.length > 0 && "tanggal" in rows[0] && ("status" in rows[0] || "keterangan" in rows[0]);

export function importAttendance(rows: Row[]) {
  const { students, addAttendanceBulk } = useData.getState();
  const out: { studentId: string; date: string; status: AttStatus }[] = [];
  let bad = 0;
  for (const r of rows) {
    const nis = pick(r, "nis", "nisn"), nm = pick(r, "nama", "name").toLowerCase();
    const st = students.find((s) => (nis && s.nis === nis) || (!nis && s.name.toLowerCase() === nm));
    const status = normStatus(pick(r, "status", "keterangan"));
    const date = pick(r, "tanggal", "date");
    if (!st || !status || !/^\d{4}-\d{2}-\d{2}$/.test(date)) { bad++; continue; }
    out.push({ studentId: st.id, date, status });
  }
  addAttendanceBulk(out);
  return { ok: out.length, bad };
}
