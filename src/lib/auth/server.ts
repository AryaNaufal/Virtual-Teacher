import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { dbEnabled } from "../dbmode";
import { COOKIE, Session, readSession } from "./session";

export async function currentSession(): Promise<Session | null> {
  return readSession((await cookies()).get(COOKIE)?.value);
}

/** Untuk API route: bila database aktif, wajib login (melindungi biaya AI & data). Mode lokal: lolos. */
export async function requireUser(): Promise<{ ok: true; session: Session | null } | { ok: false; res: NextResponse }> {
  if (!dbEnabled) return { ok: true, session: null };
  const session = await currentSession();
  if (!session) return { ok: false, res: NextResponse.json({ error: "Silakan login terlebih dahulu." }, { status: 401 }) };
  return { ok: true, session };
}

export const cookieOpts = (maxAge: number) => ({ httpOnly: true, sameSite: "lax" as const, path: "/", maxAge, secure: process.env.COOKIE_SECURE === "1" });
