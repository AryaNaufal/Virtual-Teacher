import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/server";
import { AIError, aiConfig, chat } from "@/lib/ai";
import { AGENTS } from "@/lib/agents";
import { PlannedTask, Priority, planWithRules } from "@/lib/router";

export const runtime = "nodejs";

const SPECIALISTS = AGENTS.filter((a) => a.id !== "manager");

async function planWithAI(message: string): Promise<PlannedTask[] | null> {
  try {
    const res = await chat({
      agent: "manager",
      timeoutMs: 25000,
      system:
        "Kamu AI Office Manager sebuah kantor guru. Analisis instruksi guru (Bahasa Indonesia) dan delegasikan ke AI Specialist yang tepat dengan memanggil delegate_task, satu kali per specialist. Agen: " +
        SPECIALISTS.map((a) => `${a.id} (${a.title}: ${a.description})`).join("; "),
      messages: [{ role: "user", content: message }],
      tools: [
        {
          name: "delegate_task",
          description: "Buat tugas untuk satu AI Specialist",
          parameters: {
            type: "object",
            properties: {
              agent_id: { type: "string", enum: SPECIALISTS.map((a) => a.id) },
              title: { type: "string", description: "Judul tugas singkat" },
              priority: { type: "string", enum: ["low", "normal", "high"] },
            },
            required: ["agent_id", "title", "priority"],
          },
        },
      ],
    });
    const out: PlannedTask[] = [];
    for (const c of res.toolCalls) {
      const a = c.args as { agent_id?: string; title?: unknown; priority?: string };
      if (c.name === "delegate_task" && SPECIALISTS.some((s) => s.id === a.agent_id) && typeof a.title === "string") {
        out.push({ agentId: a.agent_id!, title: a.title.slice(0, 120), priority: (["low", "normal", "high"].includes(a.priority ?? "") ? a.priority : "normal") as Priority });
      }
    }
    return out.length ? out.slice(0, 4) : null;
  } catch (e) {
    // Pemilihan agen punya cadangan (aturan kata kunci), jadi kegagalan AI tidak boleh menghentikan Command Center.
    if (!(e instanceof AIError && e.kind === "nokey")) console.warn("[command] AI gagal, memakai aturan kata kunci:", (e as Error).message);
    return null;
  }
}

export async function POST(req: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.res;
  let message = "";
  try {
    const body = await req.json();
    message = typeof body.message === "string" ? body.message.trim() : "";
  } catch {
    /* body tidak valid */
  }
  if (!message || message.length > 2000) {
    return NextResponse.json({ error: "Pesan kosong atau terlalu panjang." }, { status: 400 });
  }

  let tasks = aiConfig().key ? await planWithAI(message) : null;
  const source = tasks ? "ai" : "rules";
  if (!tasks) tasks = planWithRules(message);

  return NextResponse.json({ source, tasks });
}
