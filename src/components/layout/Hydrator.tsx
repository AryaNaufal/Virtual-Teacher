"use client";
import { useEffect } from "react";
import { create } from "zustand";
import { useData } from "@/store/data";
import { useTasks } from "@/store/tasks";
import { startSync, SyncState } from "@/lib/sync";
import { dbEnabled } from "@/lib/dbmode";

interface SyncStore { state: SyncState; msg?: string; email?: string; set: (p: Partial<SyncStore>) => void }
export const useSyncStatus = create<SyncStore>((set) => ({ state: "off", set: (p) => set(p) }));

const OWNER_KEY = "ai-office-owner";

export function wipeLocal() {
  useData.persist.clearStorage();
  useTasks.persist.clearStorage();
  useData.getState().replaceAll({ classes: [], subjects: [], students: [], attendance: [], grades: [], finals: [], quizzes: [], submissions: [], docs: [], files: [], essays: [], papers: [] });
  useTasks.getState().replaceTasks([], 0);
}

export function Hydrator() {
  useEffect(() => {
    useData.persist.rehydrate();
    useTasks.persist.rehydrate();
    if (!dbEnabled) return;

    let stop: (() => void) | undefined, cancelled = false;
    fetch("/api/auth/me").then((r) => (r.ok ? r.json() : null)).then((d: { user?: { id: number; email: string } } | null) => {
      if (cancelled || !d?.user) return;
      const uid = String(d.user.id);
      // Data lokal milik akun lain tidak boleh terunggah ke akun ini.
      try {
        const prev = localStorage.getItem(OWNER_KEY);
        if (prev && prev !== uid) wipeLocal();
        localStorage.setItem(OWNER_KEY, uid);
      } catch { /* storage tidak tersedia */ }
      useSyncStatus.getState().set({ email: d.user.email });
      stop = startSync(uid, (state, msg) => useSyncStatus.getState().set({ state, msg }));
    }).catch(() => useSyncStatus.getState().set({ state: "error", msg: "Tidak bisa menghubungi server." }));
    return () => { cancelled = true; stop?.(); };
  }, []);
  return null;
}
