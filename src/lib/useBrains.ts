"use client";
import { useEffect, useState } from "react";

export interface BrainInfo { configured: boolean; label: string; brains: Record<string, string[]> }
let cache: BrainInfo | null = null;
let pending: Promise<BrainInfo | null> | null = null;

/** Model AI tiap karyawan (dari /api/ai-status). Diambil sekali per muat halaman. */
export function useBrains(): BrainInfo | null {
  const [info, setInfo] = useState<BrainInfo | null>(cache);
  useEffect(() => {
    if (cache) return;
    pending ??= fetch("/api/ai-status").then((r) => (r.ok ? r.json() : null)).then((d) => { cache = d; return d; }).catch(() => null);
    let alive = true;
    pending.then((d) => { if (alive && d) setInfo(d); pending = null; });
    return () => { alive = false; };
  }, []);
  return info;
}

/** "nvidia/nemotron-3-ultra-550b-a55b:free" → { name: "nemotron-3-ultra-550b-a55b", vendor: "nvidia", free: true } */
export function modelParts(id: string) {
  if (id === "openrouter/free") return { name: "pilih otomatis", vendor: "openrouter", free: true }; // router OpenRouter: memilih model gratis yang tersedia
  const [path, tag] = id.split(":");
  const [vendor, ...rest] = path.split("/");
  return rest.length ? { name: rest.join("/"), vendor, free: tag === "free" } : { name: path, vendor: "", free: tag === "free" };
}
