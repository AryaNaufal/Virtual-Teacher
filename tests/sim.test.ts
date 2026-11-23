import { describe, expect, it } from "vitest";
import { AGENTS } from "@/lib/agents";
import { SEATS, SPOTS, W, buildBlocked } from "@/lib/office2d/layout";
import { findPath, tileOf } from "@/lib/office2d/nav";
import { Sim, activityLabel, poseOf } from "@/lib/sim/engine";
import { hm, fmtTime } from "@/lib/sim/personas";

const blocked = buildBlocked();
const isBlocked = (t: readonly [number, number]) => blocked[t[1] * W + t[0]] === 1;

/** Jalankan sim sampai jam virtual `toV` (hari yang sama), memanggil `probe` tiap langkah. */
function run(sim: Sim, toV: number, probe?: (s: Sim) => void, ext: Record<string, never> = {}, dt = 0.25) {
  for (let i = 0; i < 20000 && sim.vmin < toV; i++) { sim.step(dt, ext); probe?.(sim); }
}

describe("titik aktivitas", () => {
  const lists: [string, (readonly [number, number])[]][] = [
    ["pantry", SPOTS.pantry], ["cooler", SPOTS.cooler], ["toilet", SPOTS.toilet], ["printer", SPOTS.printer],
    ["meeting", SPOTS.meeting.map((m) => m.tile)], ["meetingStand", SPOTS.meetingStand], ["freelunch", SPOTS.lunch.map((m) => m.tile)],
    ["break", SPOTS.breakLounge], ["pingpong", SPOTS.pingpong.map((m) => m.tile)], ["evac", SPOTS.evac], ["entrance", [SPOTS.entrance]],
  ];
  it("semua titik kosong (tidak terhalang)", () => { for (const [n, l] of lists) for (const t of l) expect(isBlocked(t), `${n} ${t}`).toBe(false); });
  it("semua titik terjangkau dari kursi mana pun", () => {
    for (const a of AGENTS) {
      const from = tileOf(SEATS[a.id].x, SEATS[a.id].y);
      for (const [n, l] of lists) for (const t of l) expect(findPath(blocked, from, [t[0], t[1]]), `${a.id} → ${n} ${t}`).not.toBeNull();
    }
  });
});

describe("simulasi kehidupan kantor (tanpa jadwal harian: karyawan selalu di kantor)", () => {
  it("deterministik: benih yang sama → hasil yang sama", () => {
    const snap = (seed: number) => { const s = new Sim(seed); run(s, hm(12, 0)); return s.agents.map((a) => `${a.id}:${a.mode}:${Math.round(a.x)},${Math.round(a.y)}:${a.log.length}`).join("|"); };
    expect(snap(7)).toBe(snap(7));
    expect(snap(7)).not.toBe(snap(8));
  });

  it("selalu di meja: semua hadir sejak awal, tanpa datang/pulang, makan siang, dan rapat rutin", () => {
    const s = new Sim(1337);
    expect(s.presentCount()).toBe(AGENTS.length);
    expect(s.agents.every((a) => a.mode === "seated" && a.monitor)).toBe(true);
    let minSeated = 9;
    run(s, hm(23, 0), (x) => { minSeated = Math.min(minSeated, x.agents.filter((a) => a.mode === "seated").length); });
    expect(s.presentCount(), "semua tetap hadir sampai malam").toBe(AGENTS.length);
    expect(minSeated, "selalu ada yang duduk bekerja").toBeGreaterThanOrEqual(2);
    const banned = ["Datang ke kantor", "Pulang", "Bersiap pulang", "Pergi makan siang", "Menuju ruang rapat"];
    for (const a of s.agents) for (const l of a.log) expect(banned, `${a.id}: ${l.text}`).not.toContain(l.text);
    expect(s.meetings.length, "tidak ada rapat rutin").toBe(0);
  });

  it("kehidupan: perjalanan pantry/toilet/printer, obrolan, dan micro-behavior benar-benar terjadi", () => {
    const s = new Sim(1337);
    const subs = new Set<string>(), kinds = new Set<string>(); let chats = 0, bubbles = 0;
    run(s, hm(20, 0), (x) => {
      for (const a of x.agents) { if (a.mode === "seated") subs.add(a.sub); if (a.doKind) kinds.add(a.doKind); if (a.chat) chats++; if (a.bubble) bubbles++; }
    });
    for (const k of ["pantry", "toilet"]) expect(kinds.has(k), `aktivitas ${k}`).toBe(true);
    for (const sub of ["type", "think", "lean"]) expect(subs.has(sub), `sub ${sub}`).toBe(true);
    expect(subs.size).toBeGreaterThanOrEqual(5);
    expect(chats).toBeGreaterThan(0);
    expect(bubbles).toBeGreaterThan(0);
  });

  it("kebiasaan unik: Maya ke pantry sebelum jam 10", () => {
    const s = new Sim(1337);
    let mayaPantry = -1;
    run(s, hm(11, 30), (x) => { const m = x.byId.manager; if (mayaPantry < 0 && (m.doKind === "pantry" || m.intent === "pantry")) mayaPantry = x.vmin; });
    expect(mayaPantry, "Maya ke pantry menjelang jam 10").toBeGreaterThanOrEqual(hm(9, 30));
    expect(mayaPantry).toBeLessThan(hm(11, 0));
  });

  it("tugas AI sungguhan mengalahkan aktivitas lain: langsung duduk & bekerja di mejanya", () => {
    const s = new Sim(1337, hm(4, 0));
    const ext = { checker: "WORKING" } as never;
    for (let i = 0; i < 160; i++) s.step(0.25, ext);
    const c = s.byId.checker;
    expect(c.mode).toBe("seated");
    expect(poseOf(c, "WORKING")).toBe("typing");
    expect(activityLabel(c, "WORKING")).toMatch(/tugas AI/);
    expect(tileOf(c.x, c.y)).toEqual(tileOf(SEATS.checker.x, SEATS.checker.y));
    // di tengah perjalanan (pantry/toilet/obrolan) lalu ada tugas → langsung kembali ke meja
    const s2 = new Sim(1337);
    let away: string | undefined;
    run(s2, hm(20, 0), (x) => { away ??= x.agents.find((a) => a.mode === "do" && a.doKind !== "evac" && a.doKind !== "freelunch")?.id; if (away) x.vmin = hm(20, 0); });
    expect(away, "ada yang sedang di luar meja").toBeDefined();
    for (let i = 0; i < 200; i++) s2.step(0.25, { [away!]: "PROCESSING" } as never);
    expect(s2.byId[away!].mode).toBe("seated");
  });

  it("alarm kebakaran: semua evakuasi ke titik kumpul lalu kembali ke meja", () => {
    const s = new Sim(1337);
    run(s, hm(11, 0));
    s.fireEvent("fire");
    for (let i = 0; i < 60; i++) s.step(0.25, {}); // ±15 dtk
    expect(s.agents.filter((a) => a.intent === "evac" || a.doKind === "evac").length).toBeGreaterThanOrEqual(7);
    for (let i = 0; i < 110; i++) s.step(0.25, {}); // alarm usai (24 dtk) + ±12 dtk
    expect(s.alarm).toBe(false);
    expect(s.agents.filter((a) => a.intent === "evac" || a.doKind === "evac").length, "tidak ada yang tertinggal di titik kumpul").toBe(0);
  });

  it("makan gratis & rapat dadakan memanggil semua orang", () => {
    const s = new Sim(3);
    run(s, hm(11, 20));
    s.fireEvent("meeting");
    let peak = 0;
    for (let i = 0; i < 70; i++) { s.step(0.25, {}); peak = Math.max(peak, s.agents.filter((a) => a.mode === "meeting").length); }
    expect(peak).toBeGreaterThanOrEqual(3);
    for (let i = 0; i < 160; i++) s.step(0.25, {}); // rapat bubar, semua kembali ke meja
    expect(s.agents.filter((a) => a.mode === "meeting").length).toBe(0);
    s.fireEvent("freelunch");
    for (let i = 0; i < 48; i++) s.step(0.25, {});
    expect(s.agents.filter((a) => a.doKind === "freelunch" || a.intent === "freelunch").length).toBeGreaterThanOrEqual(3);
  });

  it("tidak ada yang macet: tak ada agen berjalan > 60 dtk berturut-turut dan tak ada dua agen di titik yang sama", () => {
    const s = new Sim(99);
    const walkSince: Record<string, number> = {}; let overlap = 0;
    run(s, hm(21, 0), (x) => {
      for (const a of x.agents) {
        if (a.mode === "walk" && !a.chat) { walkSince[a.id] ??= x.t; expect(x.t - walkSince[a.id], `${a.id} berjalan terlalu lama di jam ${fmtTime(x.vmin)}`).toBeLessThan(60); } else delete walkSince[a.id];
      }
      const vis = x.agents.filter((a) => !a.hidden);
      for (let i = 0; i < vis.length; i++) for (let j = i + 1; j < vis.length; j++) if (Math.hypot(vis[i].x - vis[j].x, vis[i].y - vis[j].y) < 3) overlap++;
    });
    expect(overlap).toBeLessThan(60); // sesekali bersinggungan saat lewat pintu tidak apa-apa
  });

  it("jam dunia nyata: jam kantor mengikuti jam dinding, hari berganti saat lewat tengah malam", () => {
    const s = new Sim(5);
    s.setWallClock(hm(23, 59));
    s.step(0.25, {});
    expect(s.vmin).toBeCloseTo(hm(23, 59), 5);
    expect(s.day).toBe(1);
    s.setWallClock(hm(0, 1));
    s.step(0.25, {});
    expect(s.vmin).toBeCloseTo(hm(0, 1), 5);
    expect(s.day).toBe(2);
    // jam tidak meloncat sendiri: tanpa setWallClock baru, jam tetap sama walau simulasi berjalan
    for (let i = 0; i < 40; i++) s.step(0.25, {});
    expect(s.vmin).toBeCloseTo(hm(0, 1), 5);
  });
});
