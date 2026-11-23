import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { cookieOpts } from "@/lib/auth/server";
import { COOKIE, signSession } from "@/lib/auth/session";
import { dbEnabled } from "@/lib/dbmode";
import { pool } from "@/lib/db/pool";

export const runtime = "nodejs";
const tries = new Map<string, { n: number; t: number }>();

export async function POST(req: NextRequest) {
  if (!dbEnabled) return NextResponse.json({ error: "Database belum diaktifkan." }, { status: 400 });
  const { email, password } = await req.json().catch(() => ({}));
  const mail = String(email ?? "").trim().toLowerCase();
  const key = `${req.headers.get("x-forwarded-for") ?? "local"}|${mail}`;
  const rec = tries.get(key);
  if (rec && Date.now() - rec.t < 60_000 && rec.n >= 8) return NextResponse.json({ error: "Terlalu banyak percobaan. Coba lagi semenit lagi." }, { status: 429 });
  try {
    const [rows] = await pool().query("SELECT id, email, full_name, password_hash FROM users WHERE email = ? LIMIT 1", [mail]);
    const u = (rows as { id: number; email: string; full_name: string; password_hash: string }[])[0];
    if (!u || !(await bcrypt.compare(String(password ?? ""), u.password_hash))) {
      tries.set(key, { n: rec && Date.now() - rec.t < 60_000 ? rec.n + 1 : 1, t: rec && Date.now() - rec.t < 60_000 ? rec.t : Date.now() });
      return NextResponse.json({ error: "Email atau kata sandi salah." }, { status: 401 });
    }
    tries.delete(key);
    const res = NextResponse.json({ user: { id: u.id, email: u.email, name: u.full_name } });
    res.cookies.set(COOKIE, await signSession({ uid: u.id, email: u.email, name: u.full_name }), cookieOpts(14 * 86400));
    return res;
  } catch (e) {
    return NextResponse.json({ error: `Gagal menghubungi database: ${(e as Error).message}` }, { status: 500 });
  }
}
