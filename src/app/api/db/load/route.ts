import { NextResponse } from "next/server";
import { currentSession } from "@/lib/auth/server";
import { pool } from "@/lib/db/pool";
import { TABLES } from "@/lib/db/tables";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Seluruh data milik guru yang login, dalam satu permintaan (menggantikan puluhan round-trip). */
export async function GET() {
  const s = await currentSession();
  if (!s) return NextResponse.json({ error: "Silakan login terlebih dahulu." }, { status: 401 });
  try {
    const out: Record<string, Record<string, unknown>[]> = {};
    const results = await Promise.all(TABLES.map((t) => pool().query(`SELECT ${t.cols.map((c) => `\`${c}\``).join(",")} FROM \`${t.name}\` WHERE owner_id = ?`, [s.uid])));
    TABLES.forEach((t, i) => {
      out[t.name] = (results[i][0] as Record<string, unknown>[]).map((r) => {
        for (const c of t.json ?? []) if (typeof r[c] === "string") r[c] = JSON.parse(r[c] as string);
        for (const c of t.num ?? []) if (r[c] != null) r[c] = Number(r[c]);
        return r;
      });
    });
    return NextResponse.json({ tables: out });
  } catch (e) {
    return NextResponse.json({ error: `Gagal membaca database: ${(e as Error).message}` }, { status: 500 });
  }
}
