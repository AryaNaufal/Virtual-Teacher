/** Baca CSV / XLSX di browser menjadi baris objek (kunci huruf kecil). Validasi tipe & ukuran file. */
export const MAX_BYTES = 5 * 1024 * 1024;
export type Row = Record<string, string>;

export function parseCsv(text: string): string[][] {
  const delim = (text.split("\n")[0].match(/;/g)?.length ?? 0) > (text.split("\n")[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [], cur = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === delim) { row.push(cur); cur = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cur); cur = "";
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
    } else cur += c;
  }
  row.push(cur);
  if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}

export async function readTable(file: File): Promise<Row[]> {
  if (file.size > MAX_BYTES) throw new Error("Ukuran file maksimal 5 MB.");
  const ext = file.name.split(".").pop()?.toLowerCase();
  let grid: string[][];
  if (ext === "csv") {
    grid = parseCsv((await file.text()).replace(/^﻿/, ""));
  } else if (ext === "xlsx") {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await file.arrayBuffer());
    const ws = wb.worksheets[0];
    if (!ws) throw new Error("File Excel kosong.");
    grid = [];
    ws.eachRow((r) => {
      const vals = (r.values as unknown[]).slice(1).map((v) => {
        if (v instanceof Date) return v.toISOString().slice(0, 10);
        if (v && typeof v === "object" && "text" in (v as object)) return String((v as { text: unknown }).text);
        if (v && typeof v === "object" && "result" in (v as object)) return String((v as { result: unknown }).result);
        return v == null ? "" : String(v);
      });
      grid.push(vals);
    });
  } else {
    throw new Error("Format harus .csv atau .xlsx (format .xls lama belum didukung; simpan ulang sebagai .xlsx).");
  }
  if (grid.length < 2) throw new Error("File tidak berisi data (minimal header + 1 baris).");
  const head = grid[0].map((h) => h.trim().toLowerCase());
  return grid.slice(1).map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? "").trim()])));
}

export const pick = (r: Row, ...keys: string[]) => {
  for (const k of keys) if (r[k] !== undefined && r[k] !== "") return r[k];
  return "";
};
