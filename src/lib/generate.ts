/** Klien untuk /api/generate. Melempar Error dengan pesan yang bisa ditampilkan ke guru. */
export async function generateText(kind: "content" | "assignment", prompt: string): Promise<string> {
  const res = await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, prompt }) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Gagal membuat dokumen (HTTP ${res.status})`);
  return data.text as string;
}

export const titleFromMarkdown = (text: string, fallback: string) => {
  const m = text.match(/^#\s+(.+)$/m);
  return (m?.[1] ?? fallback).slice(0, 100);
};

export const extractKey = (text: string): string[] => {
  const m = text.match(/KUNCI:\s*([A-E]+)/i);
  return m ? m[1].toUpperCase().split("") : [];
};

export const stripKeyLine = (text: string) => text.replace(/^\s*KUNCI:.*$/gim, "").trim();
