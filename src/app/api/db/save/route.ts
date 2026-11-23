import { NextRequest, NextResponse } from "next/server";
import { currentSession } from "@/lib/auth/server";
import { pool } from "@/lib/db/pool";
import { TABLE_BY_NAME, TABLES } from "@/lib/db/tables";

export const runtime = "nodejs";
type Row = Record<string, unknown>;
interface Change { table: string; upserts?: Row[]; deletes?: Row[] }

/**
 * Menyimpan semua perubahan dalam SATU transaksi: upsert maju (urutan FK), lalu hapus mundur.
 * owner_id selalu diambil dari sesi, tidak pernah dari klien; baris milik orang lain tidak bisa ditimpa.
 */
export async function POST(req: NextRequest) {
  const s = await currentSession();
  if (!s) return NextResponse.json({ error: "Silakan login terlebih dahulu." }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { changes?: Change[] } | null;
  if (!body?.changes || !Array.isArray(body.changes)) return NextResponse.json({ error: "Format permintaan tidak valid." }, { status: 400 });
  for (const c of body.changes) if (!TABLE_BY_NAME[c.table]) return NextResponse.json({ error: `Tabel tidak dikenal: ${c.table}` }, { status: 400 });

  const order = (c: Change) => TABLES.findIndex((t) => t.name === c.table);
  const forward = [...body.changes].sort((a, b) => order(a) - order(b));
  const conn = await pool().getConnection();
  try {
    await conn.beginTransaction();
    for (const c of forward) {
      const t = TABLE_BY_NAME[c.table], rows = c.upserts ?? [];
      if (!rows.length) continue;
      const upd = t.cols.filter((x) => !t.pk.includes(x));
      for (let i = 0; i < rows.length; i += 300) {
        const vals = rows.slice(i, i + 300).map((r) => [s.uid, ...t.cols.map((col) => {
          const v = r[col] ?? null;
          return t.json?.includes(col) && v !== null ? JSON.stringify(v) : v;
        })]);
        const cols = ["owner_id", ...t.cols].map((x) => `\`${x}\``).join(",");
        const onDup = upd.map((x) => `\`${x}\`=IF(\`owner_id\`=VALUES(\`owner_id\`),VALUES(\`${x}\`),\`${x}\`)`).join(",");
        await conn.query(`INSERT INTO \`${t.name}\` (${cols}) VALUES ? ${onDup ? `ON DUPLICATE KEY UPDATE ${onDup}` : "ON DUPLICATE KEY UPDATE owner_id=owner_id"}`, [vals]);
      }
    }
    for (const c of [...forward].reverse()) {
      const t = TABLE_BY_NAME[c.table];
      for (const k of c.deletes ?? []) {
        if (!t.pk.every((p) => k[p] != null)) continue;
        await conn.query(`DELETE FROM \`${t.name}\` WHERE owner_id = ? AND ${t.pk.map((p) => `\`${p}\` = ?`).join(" AND ")}`, [s.uid, ...t.pk.map((p) => k[p])]);
      }
    }
    await conn.commit();
    return NextResponse.json({ ok: true });
  } catch (e) {
    await conn.rollback().catch(() => {});
    return NextResponse.json({ error: `Gagal menyimpan: ${(e as Error).message}` }, { status: 500 });
  } finally {
    conn.release();
  }
}
