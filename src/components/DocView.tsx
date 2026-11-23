"use client";
import { useState } from "react";
import { GeneratedDoc, exportDocx, exportPdf, exportXlsx } from "@/lib/docs";
import { btn2Cls } from "@/components/ui";

export function DocActions({ doc }: { doc: GeneratedDoc }) {
  const [err, setErr] = useState("");
  const run = (fn: (d: GeneratedDoc) => Promise<void>) => async () => {
    try { setErr(""); await fn(doc); } catch (e) { setErr((e as Error).message); }
  };
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <button onClick={run(exportPdf)} className={btn2Cls}>Unduh PDF</button>
        <button onClick={run(exportXlsx)} className={btn2Cls}>Unduh Excel</button>
        <button onClick={run(exportDocx)} className={btn2Cls}>Unduh Word</button>
      </div>
      {err && <p className="mt-1 text-xs text-red-600">Gagal ekspor: {err}</p>}
    </div>
  );
}

export function DocBody({ doc }: { doc: Pick<GeneratedDoc, "content" | "table"> }) {
  return (
    <div className="max-h-[60vh] overflow-y-auto rounded-xl bg-slate-50 p-4 text-sm">
      <pre className="whitespace-pre-wrap font-sans">{doc.content}</pre>
      {doc.table && (
        <table className="mt-3 w-full text-left text-xs">
          <thead className="border-b text-slate-500"><tr>{doc.table.head.map((h) => <th key={h} className="p-1.5">{h}</th>)}</tr></thead>
          <tbody>{doc.table.rows.map((r, i) => <tr key={i} className="border-b last:border-0">{r.map((c, j) => <td key={j} className="p-1.5">{c}</td>)}</tr>)}</tbody>
        </table>
      )}
    </div>
  );
}
