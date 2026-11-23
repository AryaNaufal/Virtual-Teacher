import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/server";
import { chat, describeAIError } from "@/lib/ai";

export const runtime = "nodejs";

const SYSTEM: Record<string, string> = {
  content:
    "Kamu AI Content Creator untuk guru Indonesia. Tulis dalam Bahasa Indonesia, sesuai jenjang yang diminta, dengan format markdown sederhana: '# Judul', '## Subjudul', daftar dengan '- ', dan paragraf. Jangan gunakan tabel markdown.",
  assignment:
    "Kamu AI Assignment Creator untuk guru Indonesia. Tulis dalam Bahasa Indonesia dengan markdown sederhana ('# ', '## ', '- ', paragraf). Untuk soal pilihan ganda: nomori soal, beri opsi A–D (satu per baris diawali '- A. '), lalu setelah semua soal tulis bagian '## Kunci dan Pembahasan' dengan tingkat pembahasan sesuai permintaan pengguna (tanpa pembahasan: hanya daftar kunci per nomor; singkat: maksimal satu kalimat per nomor; lengkap: penjelasan rinci). Jangan menulis pengantar atau penutup yang tidak diminta. Paling akhir, tulis satu baris persis berformat 'KUNCI: ABCD...' (huruf jawaban berurutan tanpa spasi) hanya jika soalnya pilihan ganda.",
};

const TIMEOUT_MS = 170000;

export async function POST(req: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.res;

  let kind = "", prompt = "";
  try {
    const b = await req.json();
    kind = String(b.kind);
    prompt = typeof b.prompt === "string" ? b.prompt.trim() : "";
  } catch { /* abaikan */ }
  if (!SYSTEM[kind] || !prompt || prompt.length > 20000) {
    return NextResponse.json({ error: "Permintaan tidak valid." }, { status: 400 });
  }
  try {
    const res = await chat({ agent: kind, system: SYSTEM[kind], messages: [{ role: "user", content: prompt }], timeoutMs: TIMEOUT_MS });
    if (!res.text.trim()) return NextResponse.json({ error: "Respons AI kosong." }, { status: 502 });
    return NextResponse.json({ text: res.text });
  } catch (e) {
    const d = describeAIError(e, TIMEOUT_MS / 1000);
    return NextResponse.json({ error: d.message }, { status: d.status });
  }
}
