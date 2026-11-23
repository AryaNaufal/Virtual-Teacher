import { create } from "zustand";
import { AGENTS, AgentStatus } from "@/lib/agents";

export interface HistoryItem { id: string; text: string; at: number; }

export interface Transfer { id: string; from: string; to: string; kind: "task" | "report"; t0: number }
export const TRANSFER_MS = 2200;

interface OfficeState {
  transfers: Transfer[];
  sendMemo: (from: string, to: string, kind: Transfer["kind"], delayMs?: number) => void;
  statuses: Record<string, AgentStatus>;
  history: Record<string, HistoryItem[]>;
  selectedId: string | null;
  select: (id: string | null) => void;
  setStatus: (id: string, s: AgentStatus) => void;
  log: (id: string, text: string) => void;
}

if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  // Hanya untuk debugging di mode dev: window.__office.getState().sendMemo("manager","grading","task")
  setTimeout(() => { (window as unknown as { __office?: unknown }).__office = useOffice; }, 0);
}

export const useOffice = create<OfficeState>((set) => ({
  statuses: Object.fromEntries(AGENTS.map((a) => [a.id, "IDLE" as AgentStatus])),
  history: Object.fromEntries(AGENTS.map((a) => [a.id, [] as HistoryItem[]])),
  selectedId: null,
  transfers: [],
  /** Memo 3D terbang antar meja (delegasi tugas / laporan hasil). Murni visual. */
  sendMemo: (from, to, kind, delayMs = 0) => {
    const t: Transfer = { id: crypto.randomUUID(), from, to, kind, t0: Date.now() + delayMs };
    setTimeout(() => {
      set((st) => ({ transfers: [...st.transfers, t] }));
      setTimeout(() => set((st) => ({ transfers: st.transfers.filter((x) => x.id !== t.id) })), TRANSFER_MS + 100);
    }, delayMs);
  },
  select: (id) => set({ selectedId: id }),
  setStatus: (id, s) => set((st) => ({ statuses: { ...st.statuses, [id]: s } })),
  log: (id, text) =>
    set((st) => ({ history: { ...st.history, [id]: [{ id: crypto.randomUUID(), text, at: Date.now() }, ...st.history[id]].slice(0, 30) } })),
}));
