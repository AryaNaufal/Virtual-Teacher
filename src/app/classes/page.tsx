"use client";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { useData } from "@/store/data";
import { Card, Empty, Page, btnCls, inputCls } from "@/components/ui";

function Manager({ title, items, onAdd, onRemove, extra }: {
  title: string; items: { id: string; name: string }[]; onAdd: (n: string) => void; onRemove: (id: string) => void; extra?: (id: string) => string;
}) {
  const [v, setV] = useState("");
  return (
    <Card>
      <h2 className="mb-3 font-bold">{title}</h2>
      <form onSubmit={(e) => { e.preventDefault(); if (v.trim()) { onAdd(v); setV(""); } }} className="mb-3 flex gap-2">
        <input value={v} onChange={(e) => setV(e.target.value)} placeholder={`Tambah ${title.toLowerCase()}…`} className={`${inputCls} flex-1`} />
        <button className={btnCls}>Tambah</button>
      </form>
      {items.length === 0 ? <Empty>Belum ada data.</Empty> : (
        <ul className="divide-y text-sm">
          {items.map((i) => (
            <li key={i.id} className="flex items-center justify-between py-2">
              <span>{i.name} {extra && <span className="text-xs text-slate-400">· {extra(i.id)}</span>}</span>
              <button onClick={() => confirm(`Hapus “${i.name}” beserta data terkait?`) && onRemove(i.id)} className="text-slate-400 hover:text-red-600"><Trash2 size={15} /></button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default function ClassesPage() {
  const { classes, subjects, students, addClass, removeClass, addSubject, removeSubject } = useData();
  return (
    <Page title="Classes & Subjects" sub="Kelas dan mata pelajaran yang Anda ampu. Data tersimpan di perangkat ini (atau di database MySQL bila diaktifkan).">
      <div className="grid gap-4 lg:grid-cols-2">
        <Manager title="Kelas" items={classes} onAdd={addClass} onRemove={removeClass} extra={(id) => `${students.filter((s) => s.classId === id).length} siswa`} />
        <Manager title="Mata Pelajaran" items={subjects} onAdd={addSubject} onRemove={removeSubject} />
      </div>
    </Page>
  );
}
