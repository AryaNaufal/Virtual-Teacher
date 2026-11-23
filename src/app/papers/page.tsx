"use client";
import { useState } from "react";
import { PaperChecker } from "@/components/PaperChecker";
import { useData } from "@/store/data";
import { Empty, Page, inputCls } from "@/components/ui";

export default function PapersPage() {
  const { classes, students } = useData();
  const [classId, setClassId] = useState("");
  const cid = classId || classes[0]?.id || "";

  if (classes.length === 0 || students.length === 0)
    return <Page title="Korektor Paper"><Empty>Tambahkan kelas di menu Classes dan siswanya di menu Students dahulu, lalu kembali ke sini untuk mengoreksi paper.</Empty></Page>;

  return (
    <Page title="Korektor Paper" sub="Koreksi paper (makalah) siswa dengan rubrik: adil, konsisten, dan selalu menunggu persetujuan Anda.">
      <div className="mb-4 flex items-center gap-2 text-sm">
        Kelas <select value={cid} onChange={(e) => setClassId(e.target.value)} className={inputCls}>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      </div>
      <PaperChecker key={cid} classId={cid} />
    </Page>
  );
}
