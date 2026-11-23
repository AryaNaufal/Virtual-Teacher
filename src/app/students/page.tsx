"use client";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { useData } from "@/store/data";
import { pick } from "@/lib/table";
import { Card, Empty, FileImport, Page, btnCls, inputCls } from "@/components/ui";

export default function StudentsPage() {
  const { classes, students, addStudents, removeStudent } = useData();
  const [filter, setFilter] = useState("all");
  const [name, setName] = useState("");
  const [nis, setNis] = useState("");
  const [cls, setCls] = useState("");
  const [err, setErr] = useState("");
  const list = students.filter((s) => filter === "all" || s.classId === filter);

  return (
    <Page title="Students" sub="Data siswa bersifat privat dan hanya tersimpan di perangkat ini sampai database terhubung (Phase 5).">
      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-2 font-bold">Tambah siswa</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim() || !cls.trim()) return setErr("Nama dan kelas wajib diisi.");
              const r = addStudents([{ name, nis, className: cls }]);
              setErr(r.skipped ? "NIS sudah terdaftar." : "");
              if (r.added) { setName(""); setNis(""); }
            }}
            className="flex flex-wrap gap-2"
          >
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama lengkap" className={`${inputCls} min-w-[160px] flex-1`} />
            <input value={nis} onChange={(e) => setNis(e.target.value)} placeholder="NIS" className={`${inputCls} w-28`} />
            <input value={cls} onChange={(e) => setCls(e.target.value)} list="kelas" placeholder="Kelas (mis. 10A)" className={`${inputCls} w-36`} />
            <datalist id="kelas">{classes.map((c) => <option key={c.id} value={c.name} />)}</datalist>
            <button className={btnCls}>Tambah</button>
          </form>
          {err && <p className="mt-1 text-xs text-red-600">{err}</p>}
        </Card>
        <Card>
          <h2 className="mb-2 font-bold">Impor dari Excel/CSV</h2>
          <FileImport
            label="Pilih file (.xlsx / .csv)"
            hint="Kolom: nama, nis, kelas. Baris dengan NIS ganda atau tanpa nama/kelas dilewati."
            onRows={(rows) => {
              const r = addStudents(rows.map((x) => ({ name: pick(x, "nama", "name"), nis: pick(x, "nis", "nisn"), className: pick(x, "kelas", "class") })));
              return `${r.added} siswa ditambahkan, ${r.skipped} dilewati.`;
            }}
          />
        </Card>
      </div>

      <div className="mb-2 flex items-center gap-2 text-sm">
        <span className="text-slate-500">Kelas:</span>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className={inputCls}>
          <option value="all">Semua</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <span className="text-slate-400">{list.length} siswa</span>
      </div>
      {list.length === 0 ? <Empty>Belum ada siswa. Tambah manual atau impor file.</Empty> : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b text-xs uppercase text-slate-400"><tr><th className="p-3">Nama</th><th>NIS</th><th>Kelas</th><th /></tr></thead>
            <tbody>
              {list.map((s) => (
                <tr key={s.id} className="border-b last:border-0">
                  <td className="p-3">{s.name}</td><td>{s.nis || "–"}</td><td>{classes.find((c) => c.id === s.classId)?.name}</td>
                  <td className="pr-3 text-right"><button onClick={() => confirm(`Hapus ${s.name}?`) && removeStudent(s.id)} className="text-slate-400 hover:text-red-600"><Trash2 size={15} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </Page>
  );
}
