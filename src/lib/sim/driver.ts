import { useOffice } from "@/store/office";
import { ExternalStatus, Sim } from "./engine";
import { getSim, useSim } from "./store";
import { buildView } from "./view";

/**
 * Penggerak simulasi yang dipakai kedua tampilan (2D/3D): menyambungkan jam kantor ke jam dunia nyata, memajukan simulasi
 * (kecepatan tetap 1x), dan menerbitkan cuplikan ke UI (2 Hz).
 */
export class SimDriver {
  private viewAt = 0;

  static external(): Record<string, ExternalStatus> { return useOffice.getState().statuses as Record<string, ExternalStatus>; }

  /** Dipanggil sekali per frame. `dt` dalam detik nyata. */
  tick(dt: number, now: number): { sim: Sim; ext: Record<string, ExternalStatus> } {
    const sim = getSim(), ext = SimDriver.external(), d = new Date();
    sim.setWallClock(d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60);
    sim.step(Math.min(0.05, dt), ext);
    if (now - this.viewAt > 500) { this.viewAt = now; useSim.getState().setView(buildView(sim, ext)); }
    return { sim, ext };
  }
}
