import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AIError, _resetThrottle, aiConfig, chat, describeAIError, parseJsonLoose } from "@/lib/ai";
import { chunk, mapBatchResults } from "@/lib/essay";

const ENV_KEYS = ["AI_PROVIDER", "AI_API_KEY", "AI_BASE_URL", "AI_MODEL", "AI_VISION_MODEL", "AI_REASONING_EFFORT",
  "AI_MIN_INTERVAL_MS", "OPENAI_API_KEY", "OPENAI_MODEL", "OPENAI_VISION_MODEL", "GEMINI_API_KEY", "GOOGLE_API_KEY", "GEMINI_MODEL", "ANTHROPIC_API_KEY", "ANTHROPIC_MODEL", "AI_MODEL_FALLBACKS", "AI_MODEL_MANAGER", "AI_MODEL_CHECKER"];
let saved: Record<string, string | undefined>;
beforeEach(() => { saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]])); ENV_KEYS.forEach((k) => delete process.env[k]); process.env.AI_MIN_INTERVAL_MS = "0"; _resetThrottle(); });
afterEach(() => { ENV_KEYS.forEach((k) => (saved[k] === undefined ? delete process.env[k] : (process.env[k] = saved[k]))); vi.unstubAllGlobals(); });

describe("pemilihan penyedia otomatis", () => {
  it("tanpa kunci: openai bawaan, key kosong", () => {
    expect(aiConfig()).toMatchObject({ provider: "openai", key: "", model: "gpt-4o-mini", url: "https://api.openai.com/v1/chat/completions" });
  });
  it("hanya OPENAI_API_KEY → ChatGPT", () => {
    process.env.OPENAI_API_KEY = "sk-x";
    expect(aiConfig()).toMatchObject({ provider: "openai", key: "sk-x" });
  });
  it("hanya GEMINI_API_KEY → Gemini (reasoning none bawaan)", () => {
    process.env.GEMINI_API_KEY = "g-x";
    expect(aiConfig()).toMatchObject({ provider: "gemini", key: "g-x", effort: "none", url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions" });
  });
  it("hanya ANTHROPIC_API_KEY → Claude (Messages API, tanpa reasoning_effort)", () => {
    process.env.ANTHROPIC_API_KEY = "a-x";
    expect(aiConfig()).toMatchObject({ provider: "anthropic", key: "a-x", model: "claude-haiku-5-5", effort: "", url: "https://api.anthropic.com/v1/messages" });
  });
  it("AI_PROVIDER mengalahkan urutan otomatis saat ada beberapa kunci", () => {
    process.env.OPENAI_API_KEY = "sk-x"; process.env.ANTHROPIC_API_KEY = "a-x";
    expect(aiConfig().provider).toBe("openai");
    process.env.AI_PROVIDER = "anthropic";
    expect(aiConfig()).toMatchObject({ provider: "anthropic", key: "a-x" });
  });
  it("konfigurasi lama AI_API_KEY + AI_BASE_URL Gemini tetap jalan", () => {
    process.env.AI_API_KEY = "lama"; process.env.AI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai"; process.env.AI_MODEL = "gemini-3.6-flash";
    expect(aiConfig()).toMatchObject({ provider: "gemini", key: "lama", model: "gemini-3.6-flash" });
  });
  it("model khusus penyedia mengalahkan AI_MODEL sisa; AI_BASE_URL asing diabaikan", () => {
    process.env.AI_PROVIDER = "anthropic"; process.env.ANTHROPIC_API_KEY = "a-x";
    process.env.AI_MODEL = "gemini-3.6-flash"; process.env.AI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai";
    expect(aiConfig().url).toBe("https://api.anthropic.com/v1/messages");
    process.env.ANTHROPIC_MODEL = "claude-sonnet-5-5";
    expect(aiConfig().model).toBe("claude-sonnet-5-5");
  });
  it("custom (Ollama) memakai AI_BASE_URL apa adanya", () => {
    process.env.AI_PROVIDER = "custom"; process.env.AI_API_KEY = "ollama"; process.env.AI_BASE_URL = "http://localhost:11434/v1/"; process.env.AI_MODEL = "qwen3";
    expect(aiConfig()).toMatchObject({ provider: "custom", url: "http://localhost:11434/v1/chat/completions", model: "qwen3", effort: "" });
  });
});

const jsonRes = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("chat(): format permintaan & respons", () => {
  it("tanpa kunci → AIError nokey", async () => {
    await expect(chat({ messages: [{ role: "user", content: "hi" }] })).rejects.toMatchObject({ kind: "nokey" });
  });

  it("OpenAI: system, json_mode, tools, dan parsing tool_calls", async () => {
    process.env.OPENAI_API_KEY = "sk-x";
    const f = vi.fn().mockResolvedValue(jsonRes(200, { choices: [{ message: { content: null, tool_calls: [{ function: { name: "delegate_task", arguments: '{"agent_id":"grading","title":"t","priority":"high"}' } }] } }] }));
    vi.stubGlobal("fetch", f);
    const r = await chat({ system: "S", json: true, messages: [{ role: "user", content: "hi" }], tools: [{ name: "delegate_task", description: "d", parameters: { type: "object" } }] });
    const [url, init] = f.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    expect(init.headers.Authorization).toBe("Bearer sk-x");
    expect(body.messages[0]).toEqual({ role: "system", content: "S" });
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(body.tools[0].function.name).toBe("delegate_task");
    expect(body.reasoning_effort).toBeUndefined();
    expect(r.toolCalls).toEqual([{ name: "delegate_task", args: { agent_id: "grading", title: "t", priority: "high" } }]);
  });

  it("Gemini: kirim reasoning_effort=none, lalu ulangi tanpa itu bila model menolak (400)", async () => {
    process.env.GEMINI_API_KEY = "g-x";
    const f = vi.fn().mockResolvedValueOnce(jsonRes(400, { error: "bad" })).mockResolvedValueOnce(jsonRes(200, { choices: [{ message: { content: "halo" } }] }));
    vi.stubGlobal("fetch", f);
    const r = await chat({ messages: [{ role: "user", content: "hi" }] });
    expect(JSON.parse(f.mock.calls[0][1].body).reasoning_effort).toBe("none");
    expect(JSON.parse(f.mock.calls[1][1].body).reasoning_effort).toBeUndefined();
    expect(r.text).toBe("halo");
  });

  it("Claude: header x-api-key, system terpisah, max_tokens, tool_use, gambar base64", async () => {
    process.env.ANTHROPIC_API_KEY = "a-x";
    const f = vi.fn().mockResolvedValue(jsonRes(200, { content: [{ type: "text", text: "ok " }, { type: "tool_use", name: "delegate_task", input: { agent_id: "content", title: "x", priority: "normal" } }] }));
    vi.stubGlobal("fetch", f);
    const r = await chat({
      system: "S", json: true, vision: true,
      messages: [{ role: "user", content: [{ type: "text", text: "baca" }, { type: "image", mime: "image/png", base64: "QUJD" }] }],
      tools: [{ name: "delegate_task", description: "d", parameters: { type: "object", properties: {} } }],
    });
    const [url, init] = f.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect(init.headers["x-api-key"]).toBe("a-x");
    expect(init.headers["anthropic-version"]).toBe("2023-06-01");
    expect(init.headers.Authorization).toBeUndefined();
    expect(body.system).toContain("S");
    expect(body.system).toContain("JSON");
    expect(body.max_tokens).toBeGreaterThan(0);
    expect(body.messages[0].content[1]).toEqual({ type: "image", source: { type: "base64", media_type: "image/png", data: "QUJD" } });
    expect(body.tools[0]).toMatchObject({ name: "delegate_task", input_schema: { type: "object" } });
    expect(r.text).toBe("ok ");
    expect(r.toolCalls).toEqual([{ name: "delegate_task", args: { agent_id: "content", title: "x", priority: "normal" } }]);
  });

  it("galat HTTP dipetakan ke pesan guru; 503 diulang lalu berhasil", async () => {
    process.env.ANTHROPIC_API_KEY = "a-x";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonRes(401, {})));
    const e = await chat({ messages: [{ role: "user", content: "hi" }] }).catch((x) => x);
    expect(e).toBeInstanceOf(AIError);
    expect(describeAIError(e).message).toMatch(/Kunci AI ditolak.*Claude/);

    // Saldo habis (Anthropic mengirim 400 dengan pesan "credit balance")
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonRes(400, { type: "error", error: { message: "Your credit balance is too low to access the Anthropic API." } })));
    const e2 = await chat({ messages: [{ role: "user", content: "hi" }] }).catch((x) => x);
    expect(describeAIError(e2).message).toMatch(/Saldo kredit atau kuota API.*Claude/);

    vi.useFakeTimers();
    const f = vi.fn().mockResolvedValueOnce(jsonRes(529, {})).mockResolvedValueOnce(jsonRes(200, { content: [{ type: "text", text: "ok" }] }));
    vi.stubGlobal("fetch", f);
    const p = chat({ messages: [{ role: "user", content: "hi" }] });
    await vi.advanceTimersByTimeAsync(5000);
    expect((await p).text).toBe("ok");
    expect(f).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});

describe("pembatas laju & Retry-After", () => {
  it("jeda minimal bawaan: Gemini 4 dtk, lainnya 0; AI_MIN_INTERVAL_MS menimpa", () => {
    delete process.env.AI_MIN_INTERVAL_MS;
    process.env.GEMINI_API_KEY = "g";
    expect(aiConfig().minIntervalMs).toBe(4000);
    delete process.env.GEMINI_API_KEY; process.env.OPENAI_API_KEY = "o";
    expect(aiConfig().minIntervalMs).toBe(0);
    process.env.AI_MIN_INTERVAL_MS = "1500";
    expect(aiConfig().minIntervalMs).toBe(1500);
  });

  it("dua permintaan berurutan dijarakkan sesuai jeda", async () => {
    process.env.OPENAI_API_KEY = "sk-x"; process.env.AI_MIN_INTERVAL_MS = "3000";
    vi.useFakeTimers();
    const f = vi.fn().mockImplementation(async () => jsonRes(200, { choices: [{ message: { content: "ok" } }] }));
    vi.stubGlobal("fetch", f);
    const p = Promise.all([chat({ messages: [{ role: "user", content: "a" }] }), chat({ messages: [{ role: "user", content: "b" }] })]);
    await vi.advanceTimersByTimeAsync(10);
    expect(f).toHaveBeenCalledTimes(1); // yang kedua menunggu slotnya
    await vi.advanceTimersByTimeAsync(3000);
    expect(f).toHaveBeenCalledTimes(2);
    await p;
    vi.useRealTimers();
  });

  it("menghormati header Retry-After saat 429", async () => {
    process.env.OPENAI_API_KEY = "sk-x";
    vi.useFakeTimers();
    const busy = new Response("{}", { status: 429, headers: { "retry-after": "7" } });
    const f = vi.fn().mockResolvedValueOnce(busy).mockResolvedValueOnce(jsonRes(200, { choices: [{ message: { content: "ok" } }] }));
    vi.stubGlobal("fetch", f);
    const p = chat({ messages: [{ role: "user", content: "a" }] });
    await vi.advanceTimersByTimeAsync(6500);
    expect(f).toHaveBeenCalledTimes(1); // belum 7 detik
    await vi.advanceTimersByTimeAsync(700);
    expect((await p).text).toBe("ok");
    expect(f).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});

describe("gangguan jaringan sesaat", () => {
  it("mengulang saat fetch gagal (mis. ENOTFOUND) lalu berhasil; menyerah setelah 3 percobaan", async () => {
    process.env.OPENAI_API_KEY = "sk-x";
    vi.useFakeTimers();
    const dnsErr = () => Object.assign(new TypeError("fetch failed"), { cause: { code: "ENOTFOUND" } });
    const f = vi.fn().mockRejectedValueOnce(dnsErr()).mockResolvedValueOnce(jsonRes(200, { choices: [{ message: { content: "ok" } }] }));
    vi.stubGlobal("fetch", f);
    const p = chat({ messages: [{ role: "user", content: "a" }] });
    await vi.advanceTimersByTimeAsync(2000);
    expect((await p).text).toBe("ok");
    expect(f).toHaveBeenCalledTimes(2);

    const g = vi.fn().mockRejectedValue(dnsErr());
    vi.stubGlobal("fetch", g);
    const q = chat({ messages: [{ role: "user", content: "a" }] }).catch((e) => e);
    await vi.advanceTimersByTimeAsync(10000);
    const e = await q;
    expect(e).toBeInstanceOf(AIError);
    expect(describeAIError(e).message).toMatch(/ENOTFOUND/);
    expect(g).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });
});

describe("koreksi esai per batch", () => {
  it("memetakan hasil berdasarkan id dan mencatat yang hilang/ganda/tidak valid", () => {
    const parsed = { results: [
      { id: "a", score: 80, feedback: "baik" },
      { id: "b", score: 150, feedback: "kelebihan skor" },   // dijepit ke 100
      { id: "a", score: 10, feedback: "ganda" },              // diabaikan
      { id: "x", score: 50, feedback: "id tak dikenal" },     // diabaikan
      { id: "d", score: "abc", feedback: "skor rusak" },      // tidak valid
    ] };
    const r = mapBatchResults(parsed, ["a", "b", "c", "d"]);
    expect(r.results.map((x) => [x.id, x.score])).toEqual([["a", 80], ["b", 100]]);
    expect(r.missing).toEqual(["c", "d"]);
    expect(mapBatchResults("rusak", ["a"]).missing).toEqual(["a"]);
  });
  it("chunk membagi per ukuran batch", () => {
    expect(chunk([1, 2, 3, 4, 5, 6, 7], 5)).toEqual([[1, 2, 3, 4, 5], [6, 7]]);
    expect(chunk([], 5)).toEqual([]);
  });
});

describe("parseJsonLoose", () => {
  it("menoleransi pagar kode dan teks pembuka", () => {
    expect(parseJsonLoose('```json\n{"score": 80}\n```')).toEqual({ score: 80 });
    expect(parseJsonLoose('Tentu! {"score": 70, "feedback": "ok"} semoga membantu')).toEqual({ score: 70, feedback: "ok" });
    expect(() => parseJsonLoose("bukan json")).toThrow();
  });
});

describe("otak per karyawan: rantai model & cadangan otomatis", () => {
  const custom = () => { process.env.AI_PROVIDER = "custom"; process.env.AI_API_KEY = "k"; process.env.AI_BASE_URL = "https://openrouter.ai/api/v1"; process.env.AI_MODEL = "umum:free"; };
  const modelOf = (call: unknown[]) => JSON.parse((call[1] as { body: string }).body).model;

  it("urutan: model karyawan → model umum → cadangan; tanpa duplikat, maksimal 4", async () => {
    const { modelChain } = await import("@/lib/ai");
    custom(); process.env.AI_MODEL_MANAGER = "a:free, b:free"; process.env.AI_MODEL_FALLBACKS = "umum:free,c:free,d:free";
    expect(modelChain(aiConfig(), { agent: "manager" })).toEqual(["a:free", "b:free", "umum:free", "c:free"]);
    expect(modelChain(aiConfig(), { agent: "content" })).toEqual(["umum:free", "c:free", "d:free"]);
    expect(modelChain(aiConfig(), {})).toEqual(["umum:free", "c:free", "d:free"]);
  });

  it("tanpa konfigurasi tambahan: perilaku lama (satu model, 3 percobaan saat 503)", async () => {
    custom();
    const f = vi.fn().mockResolvedValueOnce(jsonRes(503, {})).mockResolvedValueOnce(jsonRes(200, { choices: [{ message: { content: "ok" } }] }));
    vi.stubGlobal("fetch", f);
    const r = await chat({ agent: "checker", messages: [{ role: "user", content: "x" }] });
    expect(r).toMatchObject({ text: "ok", model: "umum:free" });
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("429 pada model pertama → langsung pindah ke model berikutnya tanpa menunggu", async () => {
    custom(); process.env.AI_MODEL_CHECKER = "utama:free";
    const f = vi.fn().mockResolvedValueOnce(jsonRes(429, {})).mockResolvedValueOnce(jsonRes(200, { choices: [{ message: { content: "dari cadangan" } }] }));
    vi.stubGlobal("fetch", f);
    const r = await chat({ agent: "checker", messages: [{ role: "user", content: "x" }] });
    expect(r).toMatchObject({ text: "dari cadangan", model: "umum:free" });
    expect(f.mock.calls.map(modelOf)).toEqual(["utama:free", "umum:free"]);
  });

  it("kunci ditolak (401) tidak berpindah model; semua gagal → galat terakhir", async () => {
    custom(); process.env.AI_MODEL_CHECKER = "utama:free";
    const f = vi.fn().mockResolvedValue(jsonRes(401, {}));
    vi.stubGlobal("fetch", f);
    await expect(chat({ agent: "checker", messages: [{ role: "user", content: "x" }] })).rejects.toMatchObject({ status: 401 });
    expect(f).toHaveBeenCalledTimes(1);
    const g = vi.fn().mockResolvedValue(jsonRes(404, {}));
    vi.stubGlobal("fetch", g);
    await expect(chat({ agent: "checker", messages: [{ role: "user", content: "x" }] })).rejects.toMatchObject({ status: 404 });
    expect(g.mock.calls.map(modelOf)).toEqual(["utama:free", "umum:free"]);
  });

  it("model gratis yang menolak mode JSON (400) diulang tanpa response_format", async () => {
    custom();
    const f = vi.fn().mockResolvedValueOnce(jsonRes(400, { error: { message: "response_format not supported" } })).mockResolvedValueOnce(jsonRes(200, { choices: [{ message: { content: "{}" } }] }));
    vi.stubGlobal("fetch", f);
    await chat({ json: true, messages: [{ role: "user", content: "x" }] });
    expect(JSON.parse((f.mock.calls[0][1] as { body: string }).body).response_format).toBeTruthy();
    expect(JSON.parse((f.mock.calls[1][1] as { body: string }).body).response_format).toBeUndefined();
  });
});
