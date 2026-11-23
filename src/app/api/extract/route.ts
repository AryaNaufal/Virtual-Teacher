import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/server";
import { AIError, chat, describeAIError } from "@/lib/ai";

export const runtime = "nodejs";

const MAX = 8 * 1024 * 1024;
const MAX_TEXT = 20000;      // bawaan (lampiran Command Center)
const MAX_TEXT_PAPER = 60000; // paper siswa: dibaca penuh sampai batas ini

type Kind = "pdf" | "docx" | "pptx" | "image";

/** Validasi ekstensi + "magic bytes" agar file yang menyamar ditolak. */
function detect(name: string, b: Uint8Array): Kind | null {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const starts = (...sig: number[]) => sig.every((v, i) => b[i] === v);
  if (ext === "pdf" && starts(0x25, 0x50, 0x44, 0x46)) return "pdf";
  if ((ext === "docx" || ext === "pptx") && starts(0x50, 0x4b, 0x03, 0x04)) return ext;
  if (ext === "png" && starts(0x89, 0x50, 0x4e, 0x47)) return "image";
  if ((ext === "jpg" || ext === "jpeg") && starts(0xff, 0xd8, 0xff)) return "image";
  return null;
}

export async function POST(req: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.res;

  let file: File | null = null, limit = MAX_TEXT;
  try {
    const form = await req.formData(), f = form.get("file");
    if (f instanceof File) file = f;
    if (form.get("max") === "paper") limit = MAX_TEXT_PAPER;
  } catch { /* form tidak valid */ }
  if (!file) return NextResponse.json({ error: "Berkas tidak ditemukan." }, { status: 400 });
  if (file.size > MAX) return NextResponse.json({ error: "Ukuran berkas maksimal 8 MB." }, { status: 413 });
  if (/\.(doc|ppt|xls)$/i.test(file.name))
    return NextResponse.json({ error: "Format lama (.doc/.ppt/.xls) tidak didukung. Simpan ulang sebagai .docx/.pptx/.xlsx." }, { status: 415 });

  const buf = new Uint8Array(await file.arrayBuffer());
  const kind = detect(file.name, buf);
  if (!kind) return NextResponse.json({ error: "Tipe berkas tidak didukung atau isinya tidak cocok dengan ekstensinya (PDF, DOCX, PPTX, JPG, PNG)." }, { status: 415 });

  try {
    let text = "";
    if (kind === "pdf") {
      const { extractText, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(buf);
      text = (await extractText(pdf, { mergePages: true })).text as string;
      if (!text.trim()) return NextResponse.json({ error: "PDF ini tidak berisi teks (kemungkinan hasil scan). Unggah sebagai foto JPG/PNG agar dibaca AI." }, { status: 422 });
    } else if (kind === "docx") {
      const mammoth = await import("mammoth");
      text = (await mammoth.extractRawText({ buffer: Buffer.from(buf) })).value;
    } else if (kind === "pptx") {
      const JSZip = (await import("jszip")).default;
      const zip = await JSZip.loadAsync(buf);
      const slides = Object.keys(zip.files).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a, b) => parseInt(a.replace(/\D/g, "")) - parseInt(b.replace(/\D/g, "")));
      const parts: string[] = [];
      for (const [i, n] of slides.entries()) {
        const xml = await zip.files[n].async("string");
        const t = [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => m[1]).join(" ");
        parts.push(`[Slide ${i + 1}] ${t}`);
      }
      text = parts.join("\n");
    } else {
      const mime = file.name.toLowerCase().endsWith("png") ? "image/png" : "image/jpeg";
      const res = await chat({
        agent: "archivist",
        vision: true,
        timeoutMs: 90000,
        messages: [{ role: "user", content: [
          { type: "text", text: "Transkripsikan seluruh teks pada gambar ini apa adanya (termasuk jawaban siswa bila ini lembar jawaban). Jangan menambah komentar." },
          { type: "image", mime, base64: Buffer.from(buf).toString("base64") },
        ] }],
      });
      text = res.text;
    }
    text = text.replace(/\n{3,}/g, "\n\n").trim();
    if (!text) return NextResponse.json({ error: "Tidak ada teks yang dapat dibaca dari berkas ini." }, { status: 422 });
    return NextResponse.json({ text: text.slice(0, limit), truncated: text.length > limit, chars: text.length });
  } catch (e) {
    if (e instanceof AIError) {
      const d = describeAIError(e, 90);
      return NextResponse.json({ error: d.message }, { status: d.status });
    }
    return NextResponse.json({ error: "Berkas rusak atau tidak dapat dibaca." }, { status: 422 });
  }
}
