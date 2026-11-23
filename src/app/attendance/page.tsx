"use client";
import { useMemo, useState } from "react";
import clsx from "clsx";
import { AttStatus, useData } from "@/store/data";
import { ATT_LABEL, attendanceSummary, inMonth } from "@/lib/calc";
import { importAttendance } from "@/lib/importers";
import { Card, Empty, FileImport, Page, inputCls } from "@/components/ui";

const ORDER: (AttStatus | null)[] = ["H", "S", "I", "A", null];
const COLOR: Record<AttStatus, string> = { H: "bg-emerald-100 text-emerald-800", S: "bg-amber-100 text-amber-800", I: "bg-blue-100 text-blue-800", A: "bg-red-100 text-red-800" };

export default function AttendancePage() {
  const { classes, students, attendance, setAttendance } = useData();
  const [classId, setClassId] = useState("");
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const cid = classId || classes[0]?.id || "";
  const list = students.filter((s) => s.classId === cid);
  const days = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    return Array.from({ length: new Date(y, m, 0).getDate() }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`);
  }, [month]);
  const rec = (sid: string, d: string) => attendance.find((a) => a.studentId === sid && a.date === d)?.status ?? null;
  const classSummary = attendanceSummary(attendance.filter((a) => list.some((s) => s.id === a.studentId) && inMonth(a.date, month)));

  return (
    <Page title="Attendance" sub="Klik sel untuk mengubah: Hadir → Sakit → Izin → Alfa → kosong. Rekap dihitung otomatis.">
      {classes.length === 0 ? <Empty>Tambahkan kelas dan siswa dahulu di menu Classes / Students.</Empty> : (
        <>
          <div className="mb-4 flex flex-wrap items-start gap-4">
            <select value={cid} onChange={(e) => setClassId(e.target.value)} className={inputCls}>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            <input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className={inputCls} />
            <FileImport
              label="Impor absensi"
              hint="Kolom: nis (atau nama), tanggal (YYYY-MM-DD), status (H/S/I/A atau Hadir/Sakit/Izin/Alfa)."
              onRows={(rows) => {
                const r = importAttendance(rows);
                return `${r.ok} catatan diimpor, ${r.bad} baris dilewati (siswa tidak ditemukan / format salah).`;
              }}
            />
          </div>

          {list.length === 0 ? <Empty>Kelas ini belum memiliki siswa.</Empty> : (
            <>
              <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
                {(["H", "S", "I", "A"] as AttStatus[]).map((k) => (
                  <Card key={k}><div className="text-xs text-slate-500">{ATT_LABEL[k]}</div><div className="text-2xl font-bold">{classSummary[k]}</div></Card>
                ))}
                <Card><div className="text-xs text-slate-500">% Kehadiran kelas</div><div className="text-2xl font-bold text-[var(--green-d)]">{classSummary.total ? `${classSummary.pct}%` : "–"}</div></Card>
              </div>

              <Card className="overflow-x-auto p-0">
                <table className="text-xs">
                  <thead className="border-b text-slate-400">
                    <tr>
                      <th className="sticky left-0 bg-white p-2 text-left">Siswa</th>
                      {days.map((d) => <th key={d} className="px-0.5 text-center font-normal">{d.slice(8)}</th>)}
                      {["H", "S", "I", "A", "%"].map((h) => <th key={h} className="px-2 text-center font-bold">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((s) => {
                      const sum = attendanceSummary(attendance.filter((a) => a.studentId === s.id && inMonth(a.date, month)));
                      return (
                        <tr key={s.id} className="border-b last:border-0">
                          <td className="sticky left-0 whitespace-nowrap bg-white p-2 text-sm">{s.name}</td>
                          {days.map((d) => {
                            const v = rec(s.id, d);
                            return (
                              <td key={d} className="p-0.5">
                                <button onClick={() => setAttendance(s.id, d, ORDER[(ORDER.indexOf(v) + 1) % ORDER.length])}
                                  className={clsx("h-6 w-6 rounded text-[11px] font-bold", v ? COLOR[v] : "bg-slate-50 text-slate-300 hover:bg-slate-100")}>{v ?? "·"}</button>
                              </td>
                            );
                          })}
                          <td className="px-2 text-center">{sum.H}</td><td className="px-2 text-center">{sum.S}</td><td className="px-2 text-center">{sum.I}</td><td className="px-2 text-center">{sum.A}</td>
                          <td className="px-2 text-center font-bold">{sum.total ? `${sum.pct}%` : "–"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Card>
            </>
          )}
        </>
      )}
    </Page>
  );
}
