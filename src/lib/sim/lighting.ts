import { ROOMS, Rect, T } from "../office2d/layout";
import type { Sim } from "./engine";

const CLOSED = ROOMS.filter((r) => r.floor !== "carpetGrey" && r.floor !== "carpetPurple" && r.floor !== "rugLilac");
export const HALL: Rect = { x: 17, y: 8, w: 38, h: 25 };
export interface LightZone extends Rect { key: string; a: number }

const inRect = (r: Rect, tx: number, ty: number) => tx >= r.x && tx < r.x + r.w && ty >= r.y && ty < r.y + r.h;

/** Zona lampu: tiap ruang menyala bila ada orang (atau selama jam kerja); aula menyala sepanjang hari kerja. Nilai `a` dihaluskan. */
export class LightModel {
  private cur = new Map<string, number>();
  zones: LightZone[] = [{ key: "hall", ...HALL, a: 0 }, ...CLOSED.map((r) => ({ key: r.name, x: r.x, y: r.y, w: r.w, h: r.h, a: 0 }))];

  update(sim: Sim, dt: number) {
    const v = sim.vmin, work = v >= 7 * 60 + 30 && v < 18 * 60 + 30;
    const vis = sim.agents.filter((a) => !a.hidden);
    const occ = (r: Rect) => vis.some((a) => inRect(r, Math.floor(a.x / T), Math.floor((a.y - 1) / T)));
    for (const z of this.zones) {
      const target = z.key === "hall" ? (work || occ(z) || (sim.presentCount() > 0 && v < 19.5 * 60) ? 1 : 0) : (work && z.key !== "Toilet") || occ(z) ? 1 : 0;
      const c = this.cur.get(z.key) ?? target;
      const n = c + (target - c) * Math.min(1, dt * 2.5);
      this.cur.set(z.key, n); z.a = n;
    }
    return this.zones;
  }
}
