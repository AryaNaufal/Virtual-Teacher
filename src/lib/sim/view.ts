import { AGENTS } from "@/lib/agents";
import { ExternalStatus, Mood, Sim, activityLabel } from "./engine";
import { PERSONAS, Rel, fmtTime, hm, relOf } from "./personas";

export const MOOD_LABEL: Record<Mood, string> = { senang: "Senang", lelah: "Lelah", stres: "Stres", netral: "Biasa saja" };
export const REL_LABEL: Record<Rel, string> = { friend: "teman dekat", colleague: "rekan kerja", boss: "atasan", report: "bawahan", none: "" };

export interface AgentView {
  id: string; name: string; present: boolean; activity: string; mood: Mood; moodLabel: string;
  needs: { energi: number; lapar: number; haus: number; fokus: number; sosial: number };
  log: { time: string; text: string }[];
  role: string; traits: string[]; quirk: string; relations: { name: string; rel: string }[];
}
export interface SimView {
  vmin: number; day: number; clock: string; period: string; alarm: boolean; meetingActive: boolean; present: number;
  feed: { time: string; text: string }[]; agents: Record<string, AgentView>;
}

const periodOf = (v: number) => (v < hm(5) || v >= hm(21) ? "Malam" : v < hm(11) ? "Pagi" : v < hm(15) ? "Siang" : v < hm(18) ? "Sore" : "Petang");

/** Cuplikan ringan untuk UI (profil karyawan, jam). Dibuat berkala, bukan tiap frame. */
export function buildView(sim: Sim, ext: Record<string, ExternalStatus | undefined>): SimView {
  const agents: Record<string, AgentView> = {};
  for (const a of sim.agents) {
    const p = PERSONAS[a.id];
    agents[a.id] = {
      id: a.id, name: a.name, present: true, activity: activityLabel(a, ext[a.id], sim.byId), mood: a.mood, moodLabel: MOOD_LABEL[a.mood],
      needs: { energi: a.needs.energy, lapar: a.needs.hunger, haus: a.needs.thirst, fokus: a.needs.focus, sosial: a.needs.social },
      log: [...a.log].reverse().slice(0, 14).map((l) => ({ time: fmtTime(l.v), text: l.text })),
      role: p.role, traits: p.traits, quirk: p.quirk,
      relations: AGENTS.filter((o) => o.id !== a.id && relOf(a.id, o.id) !== "none" && relOf(a.id, o.id) !== "colleague").map((o) => ({ name: o.name, rel: REL_LABEL[relOf(a.id, o.id)] })),
    };
  }
  return {
    vmin: sim.vmin, day: sim.day, clock: fmtTime(sim.vmin), period: periodOf(sim.vmin), alarm: sim.alarm, meetingActive: sim.meetingActive, present: sim.presentCount(),
    feed: [...sim.feed].reverse().slice(0, 6).map((f) => ({ time: fmtTime(f.v), text: f.text })), agents,
  };
}
