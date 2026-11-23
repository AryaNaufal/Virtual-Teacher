import { NextResponse } from "next/server";
import { cookieOpts } from "@/lib/auth/server";
import { COOKIE } from "@/lib/auth/session";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, "", cookieOpts(0));
  return res;
}
