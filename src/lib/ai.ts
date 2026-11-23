/**
 * Lapisan penyedia AI (server saja). Satu antarmuka `chat()` untuk:
 *  - OpenAI            (format chat/completions)
 *  - Google Gemini     (endpoint kompatibel OpenAI)
 *  - Anthropic Claude  (Messages API asli)
 *  - custom            (Groq, OpenRouter, Ollama, dll. — format OpenAI)
 * Penyedia dipilih otomatis dari .env.local; lihat `aiConfig()`.
 */

export type Provider = "openai" | "gemini" | "anthropic" | "custom";

const DEFAULTS: Record<Provider, { base: string; model: string }> = {
  openai: { base: "https://api.openai.com/v1", model: "gpt-4o-mini" },
  gemini: { base: "https://generativelanguage.googleapis.com/v1beta/openai", model: "gemini-3.6-flash" },
  anthropic: { base: "https://api.anthropic.com/v1", model: "claude-haiku-5-5" },
  custom: { base: "", model: "" },
};
const KEY_ENV: Record<Provider, string[]> = {
  openai: ["OPENAI_API_KEY"],
  gemini: ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
  anthropic: ["ANTHROPIC_API_KEY"],
  custom: [],
};
export const PROVIDER_LABEL: Record<Provider, string> = { openai: "OpenAI (ChatGPT)", gemini: "Google Gemini", anthropic: "Anthropic Claude", custom: "Kustom (kompatibel OpenAI)" };

const g = (k: string) => (process.env[k] || "").trim();
const providerFromBase = (base: string): Provider => {
  if (/googleapis\.com/i.test(base)) return "gemini";
  if (/anthropic\.com/i.test(base)) return "anthropic";
  if (!base || /openai\.com/i.test(base)) return "openai";
  return "custom";
};
const firstKey = (p: Provider) => KEY_ENV[p].map(g).find(Boolean) ?? "";

/**
 * Urutan penentuan penyedia:
 *  1. AI_PROVIDER = openai | gemini | anthropic | custom
 *  2. AI_API_KEY terisi → ditebak dari AI_BASE_URL (kompatibel dengan konfigurasi lama)
 *  3. kunci khusus yang ditemukan: OPENAI_API_KEY, lalu GEMINI_API_KEY/GOOGLE_API_KEY, lalu ANTHROPIC_API_KEY
 */
export function aiConfig() {
  const explicit = g("AI_PROVIDER").toLowerCase();
  const baseEnv = g("AI_BASE_URL").replace(/\/+$/, "");
  let provider: Provider;
  if (explicit in DEFAULTS) provider = explicit as Provider;
  else if (g("AI_API_KEY")) provider = providerFromBase(baseEnv);
  else provider = (["openai", "gemini", "anthropic"] as Provider[]).find((p) => firstKey(p)) ?? (baseEnv ? providerFromBase(baseEnv) : "openai");

  const key = firstKey(provider) || g("AI_API_KEY");
  // AI_BASE_URL hanya dipakai bila cocok dengan penyedia terpilih (mencegah sisa konfigurasi lama membelokkan permintaan).
  const base = baseEnv && (provider === "custom" || providerFromBase(baseEnv) === provider) ? baseEnv : DEFAULTS[provider].base;
  const model = g(`${provider.toUpperCase()}_MODEL`) || g("AI_MODEL") || DEFAULTS[provider].model;
  const visionModel = g("AI_VISION_MODEL") || g("OPENAI_VISION_MODEL") || model;

  // Model Gemini 3.x "berpikir" dulu sehingga lambat; "none" mempercepat. AI_REASONING_EFFORT=off untuk mematikan.
  let effort = g("AI_REASONING_EFFORT");
  if (!effort && provider === "gemini") effort = "none";
  if (/^(off|default|-)$/i.test(effort) || provider === "anthropic") effort = "";

  // Jeda minimal antar permintaan (ms) agar tidak menembus batas RPM. Gemini tier gratis ketat, jadi bawaannya 4 detik (~15 RPM).
  const envGap = g("AI_MIN_INTERVAL_MS");
  const minIntervalMs = envGap !== "" && Number.isFinite(Number(envGap)) ? Math.max(0, Number(envGap)) : provider === "gemini" ? 4000 : 0;

  return { provider, key, base, model, visionModel, effort, minIntervalMs, url: provider === "anthropic" ? `${base}/messages` : `${base}/chat/completions` };
}

/** Ringkasan aman (tanpa kunci) untuk ditampilkan di UI. */
export function aiStatus() {
  const c = aiConfig();
  let host = "";
  try { host = new URL(c.base).host; } catch { /* base kosong */ }
  const brains = Object.fromEntries(BRAIN_AGENTS.map((a) => [a, modelChain(c, { agent: a, vision: a === "archivist" })]));
  return { provider: c.provider, label: PROVIDER_LABEL[c.provider], model: c.model, visionModel: c.visionModel, host, configured: Boolean(c.key), brains };
}

// ── Tipe antarmuka ────────────────────────────────────────────────────────────
export type Part = { type: "text"; text: string } | { type: "image"; mime: string; base64: string };
export interface ChatMessage { role: "user" | "assistant"; content: string | Part[] }
export interface ToolDef { name: string; description: string; parameters: Record<string, unknown> }
export interface ChatRequest {
  system?: string;
  messages: ChatMessage[];
  json?: boolean;
  tools?: ToolDef[];
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  vision?: boolean;
  /** Karyawan yang memanggil (id agen). Menentukan "otak": AI_MODEL_<ID> (daftar dipisah koma, dicoba berurutan). */
  agent?: string;
}
export interface ChatResponse { text: string; toolCalls: { name: string; args: Record<string, unknown> }[]; model?: string }

/** Karyawan yang benar-benar memakai AI. Lainnya (absen, nilai, laporan, administrasi) menghitung langsung tanpa model. */
export const BRAIN_AGENTS = ["manager", "content", "assignment", "checker", "paper", "archivist"] as const;

const list = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
/**
 * Urutan model untuk satu permintaan: AI_MODEL_<ID AGEN> → model umum (AI_MODEL / bawaan penyedia) → AI_MODEL_FALLBACKS.
 * Bila model pertama sibuk/habis kuota (429, 503, 404, dst.), model berikutnya dicoba otomatis. Maksimal 4.
 */
export function modelChain(cfg: ReturnType<typeof aiConfig>, req: Pick<ChatRequest, "agent" | "vision">): string[] {
  const own = req.agent ? list(g(`AI_MODEL_${req.agent.toUpperCase()}`)) : [];
  const base = req.vision ? cfg.visionModel : cfg.model;
  return [...new Set([...own, base, ...list(g("AI_MODEL_FALLBACKS"))].filter(Boolean))].slice(0, 4);
}

export class AIError extends Error {
  constructor(public kind: "nokey" | "http" | "timeout" | "network" | "parse", message: string, public status?: number) { super(message); }
}

export const NO_KEY_MESSAGE =
  "Kunci AI belum diatur. Isi salah satu di .env.local: OPENAI_API_KEY, GEMINI_API_KEY, atau ANTHROPIC_API_KEY (atau AI_API_KEY + AI_PROVIDER), lalu restart server.";

export function providerError(status: number, provider?: Provider, detail = ""): string {
  const who = provider ? PROVIDER_LABEL[provider] : "penyedia AI";
  // Saldo/kuota habis datang sebagai 400 (Anthropic) atau 429 (OpenAI insufficient_quota); pesannya harus jelas.
  if (/credit balance|insufficient_quota|exceeded your current quota|billing/i.test(detail))
    return `Saldo kredit atau kuota API ${who} tidak cukup. Tambah kredit di halaman Plans & Billing penyedia (langganan chat seperti Claude.ai/ChatGPT Plus tidak termasuk kredit API).`;
  if (status === 401 || status === 403) return `Kunci AI ditolak oleh ${who}. Periksa nilai kunci di .env.local.`;
  if (status === 404) return `Model atau alamat tidak ditemukan di ${who}. Periksa nama model di .env.local; model lama bisa ditutup untuk pengguna baru.`;
  if (status === 429) return `Batas pemakaian ${who} tercapai. Tunggu sebentar atau kurangi jumlah permintaan.`;
  if (status === 503 || status === 529) return `Model di ${who} sedang kelebihan permintaan. Coba lagi sebentar lagi, atau ganti model.`;
  return `${who} menolak permintaan (HTTP ${status}).`;
}

/** Pesan untuk guru + status HTTP untuk balasan API route. */
export function describeAIError(e: unknown, timeoutSec?: number): { message: string; status: number } {
  if (e instanceof AIError) {
    if (e.kind === "nokey") return { message: NO_KEY_MESSAGE, status: 503 };
    if (e.kind === "timeout") return { message: `Penyedia AI terlalu lama menjawab${timeoutSec ? ` (lebih dari ${timeoutSec} detik)` : ""}. Kurangi jumlah soal atau coba lagi.`, status: 502 };
    return { message: e.message, status: 502 };
  }
  console.error("[ai] galat tak terduga:", e);
  return { message: "Terjadi kesalahan saat memanggil AI.", status: 502 };
}

/** Ambil objek JSON dari teks model (menoleransi pagar kode ```json dan teks pembuka). */
export function parseJsonLoose(text: string): unknown {
  const t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try { return JSON.parse(t); } catch { /* coba potong */ }
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a >= 0 && b > a) return JSON.parse(t.slice(a, b + 1));
  throw new AIError("parse", "Respons AI tidak dapat dibaca sebagai JSON. Coba lagi.");
}

// ── Pemanggilan ───────────────────────────────────────────────────────────────
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Pembatas laju: setiap permintaan memesan "slot" berjarak minimal `gapMs` dari slot sebelumnya (berlaku untuk semua fitur sekaligus). */
let nextSlot = 0;
async function throttle(gapMs: number) {
  if (!gapMs) return;
  const now = Date.now();
  const at = Math.max(now, nextSlot);
  nextSlot = at + gapMs;
  if (at > now) await sleep(at - now);
}
/** Dipakai tes untuk mengosongkan antrean slot. */
export const _resetThrottle = () => { nextSlot = 0; };

async function post(url: string, headers: Record<string, string>, body: unknown, timeoutMs: number, gapMs = 0, attempts = 3): Promise<Response> {
  const signal = AbortSignal.timeout(timeoutMs); // satu batas waktu untuk seluruh percobaan
  for (let i = 0; ; i++) {
    await throttle(gapMs);
    let res: Response;
    try {
      res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body), signal });
    } catch (e) {
      const err = e as { name?: string; message?: string; cause?: { code?: string; message?: string } };
      console.error("[ai] fetch gagal:", err.name, err.message, err.cause?.code ?? err.cause?.message ?? "");
      if (err.name === "TimeoutError" || err.name === "AbortError") throw new AIError("timeout", "timeout");
      // Gangguan jaringan sesaat (DNS/koneksi putus) diulang dengan jeda sebelum menyerah.
      if (i < attempts - 1) { await sleep(1500 * (i + 1)); continue; }
      throw new AIError("network", `Tidak dapat terhubung ke penyedia AI (${err.cause?.code ?? err.message ?? "jaringan"}). Periksa koneksi internet.`);
    }
    const busy = res.status === 503 || res.status === 429 || res.status === 529;
    if (!busy || i >= attempts - 1) return res;
    // Hormati Retry-After bila ada (maks 30 dtk); semua permintaan lain ikut menunggu lewat nextSlot.
    const ra = Number(res.headers.get("retry-after"));
    const wait = Math.min(30000, Number.isFinite(ra) && ra > 0 ? ra * 1000 : 2000 * (i + 1) + 1000);
    nextSlot = Math.max(nextSlot, Date.now() + wait);
    console.warn(`[ai] penyedia sibuk (HTTP ${res.status}), ulangi ${i + 1}/${attempts - 1} setelah ${Math.round(wait / 1000)} dtk`);
    await sleep(wait);
  }
}

const asParts = (c: string | Part[]): Part[] => (typeof c === "string" ? [{ type: "text", text: c }] : c);

async function chatOpenAICompat(cfg: ReturnType<typeof aiConfig>, req: ChatRequest, model: string, attempts: number, withEffort = true, withJson = true): Promise<ChatResponse> {
  const body: Record<string, unknown> = {
    model,
    messages: [
      ...(req.system ? [{ role: "system", content: req.system }] : []),
      ...req.messages.map((m) => ({
        role: m.role,
        content: typeof m.content === "string" ? m.content
          : m.content.map((p) => (p.type === "text" ? { type: "text", text: p.text } : { type: "image_url", image_url: { url: `data:${p.mime};base64,${p.base64}` } })),
      })),
    ],
  };
  if (req.json && withJson) body.response_format = { type: "json_object" };
  if (req.temperature !== undefined) body.temperature = req.temperature;
  if (req.maxTokens) body.max_tokens = req.maxTokens;
  if (req.tools?.length) {
    body.tools = req.tools.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.parameters } }));
    body.tool_choice = "auto";
  }
  const sendEffort = withEffort && cfg.effort;
  if (sendEffort) body.reasoning_effort = cfg.effort;

  const res = await post(cfg.url, { Authorization: `Bearer ${cfg.key}` }, body, req.timeoutMs ?? 60000, cfg.minIntervalMs, attempts);
  if (!res.ok) {
    // Beberapa model (mis. varian lite/gratis) menolak reasoning_effort atau mode JSON: ulangi tanpa parameter itu.
    const detail = await res.text().catch(() => "");
    const paid = /credit|quota|billing/i.test(detail);
    if (res.status === 400 && sendEffort && !paid) return chatOpenAICompat(cfg, req, model, attempts, false, withJson);
    if (res.status === 400 && req.json && withJson && !paid) return chatOpenAICompat(cfg, req, model, attempts, false, false);
    throw new AIError("http", providerError(res.status, cfg.provider, detail), res.status);
  }
  const data = await res.json();
  const msg = data.choices?.[0]?.message;
  const toolCalls = (msg?.tool_calls ?? []).flatMap((c: { function?: { name?: string; arguments?: string } }) => {
    try { return [{ name: String(c.function?.name), args: JSON.parse(c.function?.arguments || "{}") }]; } catch { return []; }
  });
  return { text: typeof msg?.content === "string" ? msg.content : "", toolCalls };
}

async function chatAnthropic(cfg: ReturnType<typeof aiConfig>, req: ChatRequest, model: string, attempts: number): Promise<ChatResponse> {
  const system = [req.system, req.json ? "Balas HANYA dengan satu objek JSON valid, tanpa teks lain dan tanpa pagar kode." : ""].filter(Boolean).join("\n\n");
  const body: Record<string, unknown> = {
    model,
    max_tokens: req.maxTokens ?? 8192,
    ...(system ? { system } : {}),
    messages: req.messages.map((m) => ({
      role: m.role,
      content: asParts(m.content).map((p) => (p.type === "text" ? { type: "text", text: p.text } : { type: "image", source: { type: "base64", media_type: p.mime, data: p.base64 } })),
    })),
  };
  if (req.tools?.length) {
    body.tools = req.tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters }));
    body.tool_choice = { type: "auto" };
  }
  const res = await post(cfg.url, { "x-api-key": cfg.key, "anthropic-version": "2023-06-01" }, body, req.timeoutMs ?? 60000, cfg.minIntervalMs, attempts);
  if (!res.ok) throw new AIError("http", providerError(res.status, cfg.provider, await res.text().catch(() => "")), res.status);
  const data = await res.json();
  const blocks: { type: string; text?: string; name?: string; input?: Record<string, unknown> }[] = data.content ?? [];
  return {
    text: blocks.filter((b) => b.type === "text").map((b) => b.text ?? "").join(""),
    toolCalls: blocks.filter((b) => b.type === "tool_use").map((b) => ({ name: String(b.name), args: b.input ?? {} })),
  };
}

/** Panggil model terpilih. Melempar AIError (gunakan describeAIError untuk pesan ke guru). */
export async function chat(req: ChatRequest): Promise<ChatResponse> {
  const cfg = aiConfig();
  if (!cfg.key) throw new AIError("nokey", NO_KEY_MESSAGE);
  const chain = modelChain(cfg, req);
  if (!chain.length) throw new AIError("nokey", "Model AI belum diatur. Isi AI_MODEL (atau AI_MODEL_<ID AGEN>) di .env.local.");
  for (let i = 0; i < chain.length; i++) {
    const model = chain[i], last = i === chain.length - 1;
    // Model yang masih punya cadangan: satu percobaan, batas waktu lebih pendek, lalu pindah ke model berikutnya.
    const r = last ? req : { ...req, timeoutMs: Math.round((req.timeoutMs ?? 60000) * 0.6) };
    try {
      const out = cfg.provider === "anthropic" ? await chatAnthropic(cfg, r, model, last ? 3 : 1) : await chatOpenAICompat(cfg, r, model, last ? 3 : 1);
      return { ...out, model };
    } catch (e) {
      const s = e instanceof AIError ? e.status : undefined;
      const failover = e instanceof AIError && (e.kind === "timeout" || (e.kind === "http" && s !== 401 && s !== 403));
      if (last || !failover) throw e;
      console.warn(`[ai] model ${model} gagal (${s ?? (e as AIError).kind}), mencoba ${chain[i + 1]}`);
    }
  }
  throw new AIError("http", "Semua model gagal.");
}
