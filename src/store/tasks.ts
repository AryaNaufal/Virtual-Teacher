import { create } from "zustand";
import { persist } from "zustand/middleware";
import { AGENTS, AgentStatus } from "@/lib/agents";
import { NEEDS_APPROVAL_AGENTS, PlannedTask, Priority } from "@/lib/router";
import { useOffice } from "./office";
import { executeTask } from "@/lib/executors";

export type TaskStatus = "pending" | "in_progress" | "needs_approval" | "completed" | "failed";
export interface TaskLog { at: number; text: string }
export interface Task {
  id: string;
  title: string;
  agentId: string;
  createdAt: number;
  deadline: number;
  priority: Priority;
  status: TaskStatus;
  stage?: "working" | "processing";
  result?: string;
  logs: TaskLog[];
  groupId?: string;
  attachment?: { name: string; text: string };
}

interface TasksState {
  tasks: Task[];
  counter: number;
  createTasks: (plans: PlannedTask[], opts?: { fromCommand?: boolean; attachment?: { name: string; text: string } }) => Task[];
  replaceTasks: (tasks: Task[], counter: number) => void;
  remove: (id: string) => void;
  clearFinished: () => number;
  approve: (id: string) => void;
  reject: (id: string) => void;
  retry: (id: string) => void;
}

const timers: Record<string, ReturnType<typeof setTimeout>[]> = {};
const DAY = 86_400_000;
const agentName = (id: string) => AGENTS.find((a) => a.id === id)?.name ?? id;

/** Status karakter di kantor diturunkan dari tugas-tugasnya. */
function syncAgent(agentId: string) {
  const mine = useTasks.getState().tasks.filter((t) => t.agentId === agentId);
  let s: AgentStatus = "IDLE";
  const running = mine.find((t) => t.status === "in_progress");
  if (running) s = running.stage === "processing" ? "PROCESSING" : "WORKING";
  else if (mine.some((t) => t.status === "needs_approval")) s = "NEEDS_APPROVAL";
  else if (mine.some((t) => t.status === "pending")) s = "WORKING";
  else if (mine.some((t) => t.status === "completed" && Date.now() - (t.logs[0]?.at ?? 0) < 6000)) s = "COMPLETED";
  useOffice.getState().setStatus(agentId, s);
}

export const useTasks = create<TasksState>()(
  persist(
    (set, get) => {
      const patch = (id: string, fn: (t: Task) => Partial<Task>, logText?: string) => {
        set((st) => ({
          tasks: st.tasks.map((t) =>
            t.id === id ? { ...t, ...fn(t), logs: logText ? [{ at: Date.now(), text: logText }, ...t.logs] : t.logs } : t,
          ),
        }));
        const t = get().tasks.find((x) => x.id === id);
        if (t) {
          if (logText) useOffice.getState().log(t.agentId, `${t.id}: ${logText}`);
          syncAgent(t.agentId);
        }
      };

      const run = (id: string) => {
        (timers[id] ?? []).forEach(clearTimeout);
        const agentId = get().tasks.find((t) => t.id === id)!.agentId;
        const needsApproval = NEEDS_APPROVAL_AGENTS.has(agentId);
        timers[id] = [
          setTimeout(() => patch(id, () => ({ status: "in_progress", stage: "working" }), "Mulai dikerjakan"), 1800),
          setTimeout(() => patch(id, () => ({ stage: "processing" }), "Memproses data"), 5000),
          setTimeout(async () => {
            const title = get().tasks.find((t) => t.id === id)?.title ?? "";
            let result: string;
            try {
              result = (await executeTask(agentId, title, get().tasks.find((t) => t.id === id)?.attachment)) ?? "Agen ini belum memiliki pemrosesan nyata (Administrator hanya mencatat tugas).";
            } catch (e) {
              patch(id, () => ({ status: "failed", stage: undefined, result: (e as Error).message }), `Gagal: ${(e as Error).message}`);
              return;
            }
            if (get().tasks.find((t) => t.id === id)?.status !== "in_progress") return; // dibatalkan/diubah
            useOffice.getState().sendMemo(agentId, "manager", "report");
            if (needsApproval) patch(id, () => ({ status: "needs_approval", stage: undefined, result }), "Selesai, menunggu persetujuan guru");
            else {
              patch(id, () => ({ status: "completed", stage: undefined, result }), "Selesai");
              setTimeout(() => syncAgent(agentId), 6200);
            }
            checkGroup(id);
          }, 9000),
        ];
      };

      const checkGroup = (id: string) => {
        const t = get().tasks.find((x) => x.id === id);
        if (!t?.groupId) return;
        const group = get().tasks.filter((x) => x.groupId === t.groupId);
        if (group.length > 1 && group.every((x) => x.status === "completed" || x.status === "needs_approval")) {
          useOffice.getState().log("manager", `Hasil ${group.map((x) => x.id).join(", ")} digabung dan dilaporkan ke guru`);
        }
      };

      return {
        tasks: [],
        counter: 0,
        createTasks: (plans, opts) => {
          const groupId = plans.length > 1 ? crypto.randomUUID() : undefined;
          let n = get().counter;
          const created: Task[] = plans.map((p) => {
            n += 1;
            const now = Date.now();
            return {
              id: `T-${String(n).padStart(3, "0")}`,
              title: p.title,
              agentId: p.agentId,
              createdAt: now,
              deadline: now + (p.priority === "high" ? 1 : p.priority === "low" ? 7 : 3) * DAY,
              priority: p.priority,
              status: "pending",
              logs: [{ at: now, text: opts?.fromCommand ? `Didelegasikan oleh Maya (Office Manager) ke ${agentName(p.agentId)}` : "Dibuat langsung oleh guru" }],
              groupId,
              attachment: opts?.attachment,
            };
          });
          set((st) => ({ tasks: [...created, ...st.tasks], counter: n }));
          const office = useOffice.getState();
          if (opts?.fromCommand) {
            office.setStatus("manager", "WORKING");
            office.log("manager", `Menganalisis instruksi, membagi ${created.length} tugas`);
            setTimeout(() => syncAgent("manager"), 1800);
          }
          created.forEach((t, i) => {
            if (opts?.fromCommand) office.sendMemo("manager", t.agentId, "task", 700 + i * 500);
            office.log(t.agentId, `${t.id}: Tugas diterima — ${t.title}`);
            syncAgent(t.agentId);
            run(t.id);
          });
          return created;
        },
        remove: (id) => {
          (timers[id] ?? []).forEach(clearTimeout);
          delete timers[id];
          const agentId = get().tasks.find((t) => t.id === id)?.agentId;
          set((st) => ({ tasks: st.tasks.filter((t) => t.id !== id) }));
          if (agentId) syncAgent(agentId);
        },
        clearFinished: () => {
          const gone = get().tasks.filter((t) => t.status === "completed" || t.status === "failed");
          gone.forEach((t) => get().remove(t.id));
          return gone.length;
        },
        replaceTasks: (tasks, counter) => {
          set({ tasks, counter });
          AGENTS.forEach((a) => syncAgent(a.id));
        },
        approve: (id) => patch(id, () => ({ status: "completed" }), "Disetujui guru"),
        reject: (id) => patch(id, () => ({ status: "failed", stage: undefined }), "Ditolak guru"),
        retry: (id) => {
          patch(id, () => ({ status: "pending", stage: undefined, result: undefined }), "Dicoba ulang");
          run(id);
        },
      };
    },
    {
      name: "ai-office-tasks",
      version: 1,
      skipHydration: true, // di-rehydrate setelah mount (Hydrator) agar tidak mismatch SSR
      partialize: (s) => ({ tasks: s.tasks, counter: s.counter }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        // Pekerjaan yang berjalan saat halaman ditutup tidak bisa dilanjutkan.
        state.tasks = state.tasks.map((t) =>
          t.status === "pending" || t.status === "in_progress"
            ? { ...t, status: "failed" as const, stage: undefined, logs: [{ at: Date.now(), text: "Terinterupsi saat aplikasi ditutup" }, ...t.logs] }
            : t,
        );
        queueMicrotask(() => AGENTS.forEach((a) => syncAgent(a.id)));
      },
    },
  ),
);
