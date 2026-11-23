import { useData } from "@/store/data";
import { Row, readTable } from "./table";
import { dbEnabled } from "./dbmode";

export const ACCEPT = ".xlsx,.csv,.pdf,.docx,.pptx,.jpg,.jpeg,.png";
const MAX = 8 * 1024 * 1024;

export interface Processed { name: string; text: string; rows?: Row[]; note?: string }

/** Validasi, baca isi (tabel di browser; PDF/DOCX/PPTX/gambar via /api/extract), dan simpan salinan ke Storage bila Supabase aktif. */
export async function processUpload(file: File): Promise<Processed> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (/^(doc|ppt|xls)$/.test(ext)) throw new Error("Format lama (.doc/.ppt/.xls) tidak didukung. Simpan ulang sebagai .docx/.pptx/.xlsx.");
  if (!ACCEPT.split(",").includes("." + ext)) throw new Error("Tipe berkas tidak didukung. Gunakan Excel/CSV, PDF, DOCX, PPTX, JPG, atau PNG.");
  if (file.size > MAX) throw new Error("Ukuran berkas maksimal 8 MB.");
  if (file.size === 0) throw new Error("Berkas kosong.");

  let path: string | null = null;
  if (dbEnabled) {
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/files", { method: "POST", body: fd });
      if (res.ok) path = (await res.json()).path ?? null;
    } catch { /* penyimpanan opsional; ekstraksi tetap jalan */ }
  }

  let out: Processed;
  if (ext === "csv" || ext === "xlsx") {
    const rows = await readTable(file);
    const head = Object.keys(rows[0]);
    const text = [head.join(" | "), ...rows.map((r) => head.map((h) => r[h]).join(" | "))].join("\n").slice(0, 20000);
    out = { name: file.name, text, rows };
  } else {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/extract", { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? `Gagal membaca berkas (HTTP ${res.status})`);
    out = { name: file.name, text: data.text, note: data.truncated ? "Teks dipotong pada 20.000 karakter." : undefined };
  }
  useData.getState().addFile({ name: file.name, size: file.size, mime: file.type || ext, path });
  return out;
}
