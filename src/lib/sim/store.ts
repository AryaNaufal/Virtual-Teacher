import { create } from "zustand";
import { Sim } from "./engine";
import type { SimView } from "./view";

interface SimUI { view: SimView | null; setView: (v: SimView) => void }

/** Cuplikan simulasi untuk UI (profil, jam). Mesin simulasi sendiri hidup di `getSim()` (di luar React). */
export const useSim = create<SimUI>((set) => ({ view: null, setView: (view) => set({ view }) }));

// Satu mesin untuk seluruh aplikasi: berpindah halaman lalu kembali tidak mengulang keadaan dari awal.
let sim: Sim | null = null;
export const DEFAULT_SEED = 1337;
export function getSim(): Sim { return (sim ??= new Sim(DEFAULT_SEED)); }
