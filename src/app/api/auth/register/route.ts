import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { cookieOpts } from "@/lib/auth/server";
import { COOKIE, signSession } from "@/lib/auth/session";
import { dbEnabled } from "@/lib/dbmode";
import { pool } from "@/lib/db/pool";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!dbEnabled) return NextResponse.json({ error: "Database belum diaktifkan." }, { status: 400 });
  const { email, password, name } = await req.json().catch(() => ({}));
  const mail = String(email ?? "").trim().toLowerCase(), pw = String(password ?? ""), full = String(name ?? "").trim().slice(0, 190);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail) || mail.length > 190) return NextResponse.json({ error: "Format email tidak valid." }, { status: 400 });
  if (pw.length < 8) return NextResponse.json({ error: "Kata sandi minimal 8 karakter." }, { status: 400 });
  try {
    const [r] = await pool().query("INSERT INTO users (email, full_name, password_hash, created_at) VALUES (?,?,?,?)", [mail, full, await bcrypt.hash(pw, 10), Date.now()]);
    const id = (r as { insertId: number }).insertId;
    const res = NextResponse.json({ user: { id, email: mail, name: full } });
    res.cookies.set(COOKIE, await signSession({ uid: id, email: mail, name: full }), cookieOpts(14 * 86400));
    return res;
  } catch (e) {
    if ((e as { code?: string }).code === "ER_DUP_ENTRY") return NextResponse.json({ error: "Email sudah terdaftar." }, { status: 409 });
    return NextResponse.json({ error: `Gagal menghubungi database: ${(e as Error).message}` }, { status: 500 });
  }
}
