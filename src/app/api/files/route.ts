import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { currentSession } from "@/lib/auth/server";

export const runtime = "nodejs";
const ROOT = path.join(process.cwd(), "data", "uploads");
const MAX = 8 * 1024 * 1024;

/** Simpan berkas unggahan ke data/uploads/<id guru>/ (hanya untuk pemiliknya). */
export async function POST(req: NextRequest) {
  const s = await currentSession();
  if (!s) return NextResponse.json({ error: "Silakan login terlebih dahulu." }, { status: 401 });
  const file = (await req.formData().catch(() => null))?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Berkas tidak ditemukan." }, { status: 400 });
  if (file.size === 0 || file.size > MAX) return NextResponse.json({ error: "Ukuran berkas tidak valid (maks 8 MB)." }, { status: 400 });
  const safe = file.name.replace(/[^\w.\-]+/g, "_").slice(-80);
  const rel = `${s.uid}/${randomUUID()}-${safe}`;
  await mkdir(path.join(ROOT, String(s.uid)), { recursive: true });
  await writeFile(path.join(ROOT, rel), Buffer.from(await file.arrayBuffer()));
  return NextResponse.json({ path: rel });
}

/** Unduh berkas milik sendiri: GET /api/files?path=<id>/<nama>. */
export async function GET(req: NextRequest) {
  const s = await currentSession();
  if (!s) return NextResponse.json({ error: "Silakan login terlebih dahulu." }, { status: 401 });
  const rel = req.nextUrl.searchParams.get("path") ?? "";
  const full = path.resolve(ROOT, rel);
  if (!rel.startsWith(`${s.uid}/`) || !full.startsWith(path.join(ROOT, String(s.uid)) + path.sep)) return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  try {
    const buf = await readFile(full);
    const name = path.basename(full).replace(/^[0-9a-f-]{36}-/, "");
    return new NextResponse(new Uint8Array(buf), { headers: { "Content-Type": "application/octet-stream", "Content-Disposition": `inline; filename="${encodeURIComponent(name)}"`, "X-Content-Type-Options": "nosniff" } });
  } catch {
    return NextResponse.json({ error: "Berkas tidak ditemukan." }, { status: 404 });
  }
}
