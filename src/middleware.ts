import { NextResponse, type NextRequest } from "next/server";
import { COOKIE, readSession } from "@/lib/auth/session";
import { dbEnabled } from "@/lib/dbmode";

/** Dengan database aktif, semua halaman butuh login (API route memeriksa sesinya sendiri). */
export async function middleware(req: NextRequest) {
  if (!dbEnabled) return NextResponse.next();
  const session = await readSession(req.cookies.get(COOKIE)?.value);
  const isLogin = req.nextUrl.pathname === "/login";
  const isApi = req.nextUrl.pathname.startsWith("/api/");

  if (!session && !isLogin && !isApi) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  if (session && isLogin) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
