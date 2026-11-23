"use client";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MessageSquare, Send, X } from "lucide-react";
import { AGENTS, STATUS_META } from "@/lib/agents";
import { useRouter } from "next/navigation";
import { useOffice } from "@/store/office";
import { useTasks } from "@/store/tasks";
import { useSim } from "@/lib/sim/store";
import { Brain } from "@/components/Brain";

const MOOD_EMOJI = { senang: "😊", lelah: "😴", stres: "😤", netral: "😐" } as const;

export function ProfilePanel() {
  const { selectedId, statuses, history, select } = useOffice();
  const { tasks, createTasks, approve, reject } = useTasks();
  const router = useRouter();
  const [task, setTask] = useState("");
  const [showTask, setShowTask] = useState(false);
  const agent = AGENTS.find((a) => a.id === selectedId);
  const view = useSim((s) => s.view);
  const life = agent ? view?.agents[agent.id] : undefined;
  const waiting = tasks.filter((t) => t.agentId === agent?.id && t.status === "needs_approval");

  return (
    <AnimatePresence>
      {agent && (
        <motion.aside
          key={agent.id}
          initial={{ x: 40, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 40, opacity: 0 }}
          className="absolute bottom-4 right-4 top-4 z-20 flex w-80 flex-col overflow-y-auto rounded-2xl border border-[var(--line)] bg-white p-5 shadow-xl"
        >
          <button onClick={() => select(null)} className="absolute right-3 top-3 rounded p-1 text-slate-400 hover:bg-slate-100">
            <X size={16} />
          </button>
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-full text-lg font-bold text-white" style={{ background: agent.shirt }}>
              {agent.name[0]}
            </div>
            <div>
              <div className="font-bold">{agent.name}</div>
              <div className="text-sm text-slate-500">{agent.title}</div>
            </div>
          </div>
          <span
            className="mt-3 inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-bold text-white"
            style={{ background: STATUS_META[statuses[agent.id]].color }}
          >
            {STATUS_META[statuses[agent.id]].label} · {STATUS_META[statuses[agent.id]].desc}
          </span>
          <p className="mt-4 text-sm text-slate-600">{agent.description}</p>
          <div className="mt-1 text-xs text-slate-400">{agent.room}</div>

          <h4 className="mt-4 text-xs font-bold uppercase tracking-wide text-slate-400">Kemampuan</h4>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {agent.skills.map((s) => (
              <span key={s} className="rounded-md bg-emerald-50 px-2 py-1 text-xs text-emerald-800">{s}</span>
            ))}
          </div>

          <h4 className="mt-4 text-xs font-bold uppercase tracking-wide text-slate-400">Otak (model AI)</h4>
          <div className="mt-2 rounded-xl bg-slate-50 p-3 text-sm"><Brain agentId={agent.id} name={agent.name} /></div>

          {life && (
            <>
              <h4 className="mt-4 text-xs font-bold uppercase tracking-wide text-slate-400">Kehidupan hari ini</h4>
              <div className="mt-2 space-y-2 rounded-xl bg-slate-50 p-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <b className="leading-snug">{life.activity}</b>
                  <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-xs shadow-sm">{MOOD_EMOJI[life.mood]} {life.moodLabel}</span>
                </div>
                <div className="text-xs text-slate-500">{life.role} · {life.traits.join(", ")}</div>
                <div className="text-xs italic text-slate-400">&ldquo;{life.quirk}&rdquo;</div>
                <div className="space-y-1">
                  {(["energi", "fokus", "lapar", "haus", "sosial"] as const).map((k) => {
                    const good = k === "energi" || k === "fokus", val = life.needs[k];
                    return (
                      <div key={k} className="flex items-center gap-2 text-[11px] text-slate-500">
                        <span className="w-10 capitalize">{k}</span>
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full" style={{ width: `${Math.round(val * 100)}%`, background: (good ? val > 0.5 : val < 0.6) ? "#22c55e" : val > 0.8 || (good && val < 0.3) ? "#ef4444" : "#f59e0b" }} /></div>
                      </div>
                    );
                  })}
                </div>
                {life.relations.length > 0 && <div className="text-[11px] text-slate-500">{life.relations.map((r) => `${r.name} (${r.rel})`).join(", ")}</div>}
                {life.log.length > 0 && (
                  <ul className="space-y-0.5 border-t border-slate-200 pt-2 text-xs text-slate-600">
                    {life.log.slice(0, 8).map((l, i) => <li key={i}><span className="font-mono text-slate-400">{l.time}</span> {l.text}</li>)}
                  </ul>
                )}
              </div>
            </>
          )}

          <h4 className="mt-4 text-xs font-bold uppercase tracking-wide text-slate-400">Riwayat pekerjaan</h4>
          <ul className="mt-2 space-y-1.5 text-sm">
            {history[agent.id].length === 0 && <li className="text-slate-400">Belum ada pekerjaan.</li>}
            {history[agent.id].map((h) => (
              <li key={h.id} className="rounded-lg bg-slate-50 px-3 py-2">
                <div>{h.text}</div>
                <div className="text-[11px] text-slate-400">{new Date(h.at).toLocaleTimeString("id-ID")}</div>
              </li>
            ))}
          </ul>

          <div className="mt-auto space-y-2 pt-4">
            {waiting.map((t) => (
              <div key={t.id} className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs">
                <div className="mb-1 truncate"><b>{t.id}</b> menunggu persetujuan: {t.title}</div>
                <div className="flex gap-2">
                  <button onClick={() => approve(t.id)} className="flex-1 rounded-md bg-emerald-600 py-1.5 font-semibold text-white">Setujui</button>
                  <button onClick={() => reject(t.id)} className="flex-1 rounded-md border bg-white py-1.5">Tolak</button>
                </div>
              </div>
            ))}
            {showTask ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (task.trim()) {
                    createTasks([{ agentId: agent.id, title: task.trim(), priority: "normal" }]);
                    setTask("");
                    setShowTask(false);
                  }
                }}
                className="flex gap-2"
              >
                <input
                  autoFocus
                  value={task}
                  onChange={(e) => setTask(e.target.value)}
                  placeholder="Tulis tugas…"
                  className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm outline-none focus:border-emerald-500"
                />
                <button className="rounded-lg bg-[#1f6b4a] px-3 text-white"><Send size={15} /></button>
              </form>
            ) : (
              <button onClick={() => setShowTask(true)} className="w-full rounded-lg bg-[#1f6b4a] py-2 text-sm font-semibold text-white hover:bg-[#0f3d2b]">
                Berikan Tugas
              </button>
            )}
            <button onClick={() => router.push("/command")} className="flex w-full items-center justify-center gap-2 rounded-lg border py-2 text-sm hover:bg-slate-50">
              <MessageSquare size={15} /> Buka Chat
            </button>
            <p className="text-[11px] text-slate-400">Pemrosesan dokumen/data nyata dibangun di Phase 3–4; saat ini alur tugas, status, dan persetujuan sudah berjalan.</p>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
