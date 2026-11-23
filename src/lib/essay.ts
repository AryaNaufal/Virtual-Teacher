export const BATCH_SIZE = 5; // esai per permintaan AI (rubrik dan pertanyaan hanya dikirim sekali per batch)
export const MAX_BATCH = 8;

export interface EssayResult { id: string; score: number; feedback: string }

/**
 * Memetakan keluaran AI (`{"results":[{id,score,feedback}]}`) ke id yang diminta.
 * Id yang tidak dikembalikan, ganda, tak dikenal, atau berskor tidak valid dicatat di `missing` (tidak pernah diisi tebakan).
 */
export function mapBatchResults(parsed: unknown, ids: string[]): { results: EssayResult[]; missing: string[] } {
  const raw = (parsed as { results?: unknown })?.results;
  const list = Array.isArray(raw) ? raw : [];
  const want = new Set(ids);
  const got = new Map<string, EssayResult>();
  for (const r of list) {
    const x = r as { id?: unknown; score?: unknown; feedback?: unknown };
    const id = String(x?.id ?? "");
    const score = Number(x?.score);
    if (!want.has(id) || got.has(id) || !Number.isFinite(score) || typeof x.feedback !== "string") continue;
    got.set(id, { id, score: Math.min(100, Math.max(0, Math.round(score * 10) / 10)), feedback: x.feedback.slice(0, 1500) });
  }
  return { results: ids.filter((i) => got.has(i)).map((i) => got.get(i)!), missing: ids.filter((i) => !got.has(i)) };
}

export const chunk = <T,>(xs: T[], n: number): T[][] => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));
