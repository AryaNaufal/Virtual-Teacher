import { NextResponse } from "next/server";
import { currentSession } from "@/lib/auth/server";

export async function GET() {
  const s = await currentSession();
  if (!s) return NextResponse.json({ user: null }, { status: 401 });
  return NextResponse.json({ user: { id: s.uid, email: s.email, name: s.name } });
}
