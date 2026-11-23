import { describe, expect, it } from "vitest";
import { AGENTS } from "@/lib/agents";
import { DESKS, FURNITURE, POIS, ROOMS, SEATS, T, W, buildBlocked } from "@/lib/office2d/layout";
import { centerOf, findPath, tileOf } from "@/lib/office2d/nav";

const blocked = buildBlocked();
const isBlocked = (x: number, y: number) => blocked[y * W + x] === 1;

describe("denah kantor 2D", () => {
  it("setiap agen punya meja dan kursi, dan tiap meja hanya satu agen", () => {
    for (const a of AGENTS) expect(SEATS[a.id], `kursi ${a.id}`).toBeTruthy();
    const ids = DESKS.filter((d) => d.agentId).map((d) => d.agentId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBe(AGENTS.length);
  });

  it("tile kursi tidak terhalang dan meja menghalangi", () => {
    for (const a of AGENTS) { const [tx, ty] = tileOf(SEATS[a.id].x, SEATS[a.id].y); expect(isBlocked(tx, ty), `kursi ${a.id} (${tx},${ty})`).toBe(false); }
    for (const d of DESKS) expect(isBlocked(d.x + 1, d.y)).toBe(true);
  });

  it("perabot tidak saling menimpa meja dan tetap di dalam dunia", () => {
    for (const r of FURNITURE) { expect(r.x).toBeGreaterThanOrEqual(0); expect(r.x + r.w).toBeLessThanOrEqual(W); expect(r.y + r.h).toBeLessThanOrEqual(40); }
    for (const r of ROOMS) expect(r.x + r.w).toBeLessThanOrEqual(W);
  });

  it("setiap agen bisa mencapai sebagian besar titik jalan-jalan dan kembali ke kursinya", () => {
    const free = POIS.filter(([x, y]) => !isBlocked(x, y));
    expect(free.length).toBe(POIS.length); // semua POI harus di tile kosong
    for (const a of AGENTS) {
      const from = tileOf(SEATS[a.id].x, SEATS[a.id].y);
      const reach = free.filter((p) => findPath(blocked, from, p) !== null);
      expect(reach.length, `${a.id} bisa mencapai ${reach.length}/${free.length} POI`).toBeGreaterThanOrEqual(free.length - 1);
      const back = findPath(blocked, free[0], from);
      expect(back, `${a.id} kembali ke kursi`).not.toBeNull();
    }
  });

  it("BFS: tidak menembus dinding, tujuan terhalang → null, langkah berurutan bersebelahan", () => {
    const from = tileOf(SEATS.manager.x, SEATS.manager.y);
    expect(findPath(blocked, from, [0, 0])).toBeNull(); // rumput di luar bangunan
    const p = findPath(blocked, from, [40, 15])!;
    expect(p.length).toBeGreaterThan(10);
    let prev = from;
    for (const s of p) { expect(Math.abs(s[0] - prev[0]) + Math.abs(s[1] - prev[1])).toBe(1); expect(isBlocked(s[0], s[1])).toBe(false); prev = s; }
    const [cx, cy] = centerOf(3, 4);
    expect([cx, cy]).toEqual([3 * T + 8, 4 * T + 14]);
  });
});
