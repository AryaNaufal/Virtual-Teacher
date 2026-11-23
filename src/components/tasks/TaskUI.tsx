"use client";
import { AGENTS } from "@/lib/agents";
import { Task, TaskStatus } from "@/store/tasks";

export const TASK_STATUS: Record<TaskStatus, { label: string; cls: string }> = {
  pending: { label: "Pending", cls: "bg-slate-100 text-slate-600" },
  in_progress: { label: "In Progress", cls: "bg-blue-100 text-blue-700" },
  needs_approval: { label: "Needs Approval", cls: "bg-red-100 text-red-700" },
  completed: { label: "Completed", cls: "bg-emerald-100 text-emerald-700" },
  failed: { label: "Failed", cls: "bg-zinc-200 text-zinc-700" },
};

export const PRIORITY_LABEL = { low: "Rendah", normal: "Normal", high: "Tinggi" } as const;

export const agentOf = (id: string) => AGENTS.find((a) => a.id === id);

export function StatusBadge({ task }: { task: Task }) {
  const s = TASK_STATUS[task.status];
  const stage = task.status === "in_progress" ? (task.stage === "processing" ? " · memproses" : " · bekerja") : "";
  return <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.cls}`}>{s.label}{stage}</span>;
}

export const fmtDate = (ms: number) => new Date(ms).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
