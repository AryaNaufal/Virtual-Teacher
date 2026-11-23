import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/server";
import { aiStatus } from "@/lib/ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Penyedia & model yang aktif (tanpa kunci), untuk halaman Settings. */
export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.res;
  return NextResponse.json(aiStatus());
}
