/**
 * Mesin simulasi kehidupan kantor. Murni logika (tanpa canvas) dan deterministik (pengacak berbenih),
 * sehingga mudah diubah dan dites. Penggambaran hanya MEMBACA keadaan di sini.
 *
 * Skala waktu: 1 hari virtual = 300 detik simulasi pada kecepatan 1x (VMIN_PER_SEC = 4,8).
 * - Jadwal makro (datang, rapat, makan siang, pulang) mengikuti menit virtual.
 * - Gerak & mikro-perilaku (jalan, obrolan, menggaruk kepala) berdurasi detik simulasi agar tetap terlihat.
 * Tugas AI sungguhan (status bukan IDLE) selalu mengalahkan jadwal: agen duduk dan bekerja.
 */
import { AGENTS } from "@/lib/agents";
import { FacedTile, SEATS, SPOTS, Tile, W, buildBlocked } from "../office2d/layout";
import { centerOf, findPath, tileOf } from "../office2d/nav";
import { PERSONAS, Persona, REL_WEIGHT, fmtTime, hm, relOf } from "./personas";
import { Rng } from "./rng";

export const VMIN_PER_SEC = 4.8;
export const BASE_SPEED = 110; // px dunia per detik simulasi (~7 tile/dtk): melintasi kantor ≈ 6 dtk ≈ 28 menit virtual

export type Dir = "up" | "down" | "left" | "right";
export type Mood = "senang" | "lelah" | "stres" | "netral";
export type Sub = "type" | "think" | "scratch" | "lean" | "look" | "phone" | "ring" | "stretch" | "yawn" | "sip";
export type Mode = "walk" | "seated" | "do" | "meeting";
export type Intent = "seat" | "pantry" | "cooler" | "toilet" | "printer" | "meeting" | "freelunch" | "break" | "visit" | "evac";
export type Pose = "idle" | "typing" | "wave" | "hand" | "walk" | "think" | "scratch" | "lean" | "phone" | "stretch" | "yawn" | "sip" | "talk";
export type ExternalStatus = "IDLE" | "WORKING" | "PROCESSING" | "COMPLETED" | "NEEDS_APPROVAL";
export type SimEventName = "fire" | "freelunch" | "meeting" | "phone" | "jam" | "help";

interface Pt { x: number; y: number }
interface Needs { energy: number; hunger: number; thirst: number; bladder: number; social: number; focus: number }
interface Chat { with: string; until: number; next: number; turn: number }
interface Member { id: string; goAtV: number; leaveV: number; state: "wait" | "going" | "in" | "out"; arrivedT: number }
export interface Meeting { id: number; kind: "dadakan"; startV: number; members: Member[] }

export interface SimAgent {
  id: string; name: string; p: Persona;
  x: number; y: number; dir: Dir;
  mode: Mode; intent: Intent | null; sub: Sub; subUntil: number;
  path: Pt[]; dest: Tile | null; arriveDir?: Dir; stuck: number; blockT: number; rerouteAt: number; ghostUntil: number;
  needs: Needs; mood: Mood; moodSince: number; stress: number;
  bubble: { text: string; until: number } | null;
  chat: Chat | null; chatCool: Record<string, number>;
  doKind: Intent | null; doUntil: number; doMinT: number; hideAt: number; visitTarget: string | null; jam: boolean;
  nextDecide: number; cooldownUntil: number; printNeed: number;
  hidden: boolean; monitor: boolean; coffeeUntil: number; meetSeat: FacedTile | null; spot: Tile | null;
  flags: { habitDone: boolean };
  log: { v: number; text: string }[];
}

const SUBS = { type: [3, 8], think: [2, 5], scratch: [1.2, 1.8], lean: [3, 6], look: [1.2, 2], phone: [5, 9], ring: [1.6, 1.8], stretch: [2.4, 3], yawn: [1.8, 2.4], sip: [2, 3] } as const;

const LINES = {
  coffee: ["Kopi dulu yuk", "Ngopi?", "Kopinya udah jadi belum?"],
  work: ["Deadline-nya gimana?", "Laporannya udah?", "Nilainya udah masuk?", "Soalnya udah dicek?", "Bisa bantu cek ini?"],
  tired: ["Ngantuk banget...", "Hoaam...", "Butuh kopi nih"],
  friend: ["Weekend ke mana?", "Nonton apa semalam?", "Serius? Hahaha", "Cerita dong"],
  help: ["Bisa bantu sebentar?", "Tolong cek ini dong", "Aku bingung nih"],
  helped: ["Oke, sini aku lihat", "Sebentar ya", "Sudah ketemu masalahnya"],
  phone: ["Halo?", "Iya, baik, Pak.", "Sebentar, saya cek dulu", "Baik, nanti saya kirim"],
  jam: ["Printernya macet lagi...", "Kertasnya nyangkut!", "Aduh, rewel banget"],
  meeting: ["Ayo rapat", "Mulai ya", "Catat poin ini", "Setuju"],
  fire: ["Evakuasi!", "Ke luar semua!", "Tenang, jangan lari"],
  freeLunch: ["Asik, gratis!", "Makan gratis!", "Traktiran!"],
};

export class Sim {
  rng: Rng;
  t = 0;                 // detik simulasi sejak mulai
  vmin: number;          // menit virtual dalam hari berjalan (0..1440)
  day = 1;
  agents: SimAgent[];
  byId: Record<string, SimAgent> = {};
  meetings: Meeting[] = [];
  alarmUntil = 0;
  freeLunchUntil = 0;
  waterLevel = 1;        // isi galon dispenser (0..1)
  feed: { v: number; day: number; text: string }[] = [];
  private blocked = buildBlocked();
  private meetingSeq = 0;
  private lastPrinterJamT = 0;

  constructor(public seed = 1337, startV = hm(9, 0)) {
    this.rng = new Rng(seed);
    this.vmin = startV;
    this.agents = AGENTS.map((ag): SimAgent => {
      const p = PERSONAS[ag.id];
      const seat = SEATS[ag.id];
      const a: SimAgent = {
        id: ag.id, name: ag.name, p, x: seat.x, y: seat.y, dir: seat.dir, mode: "seated", intent: null, sub: "type", subUntil: 0,
        path: [], dest: null, stuck: 0, blockT: 0, rerouteAt: 0, ghostUntil: 0, needs: { energy: this.rng.range(0.75, 1), hunger: this.rng.range(0.15, 0.45), thirst: this.rng.range(0.1, 0.5), bladder: this.rng.range(0.15, 0.6), social: this.rng.range(0.2, 0.55), focus: this.rng.range(0.75, 1) }, mood: "netral", moodSince: 0, stress: 0, bubble: null,
        chat: null, chatCool: {}, doKind: null, doUntil: 0, doMinT: 0, hideAt: 0, visitTarget: null, jam: false,
        nextDecide: this.rng.range(2, 14), cooldownUntil: this.rng.range(5, 25), printNeed: this.rng.range(0, 0.3), hidden: false, monitor: true, coffeeUntil: 0,
        meetSeat: null, spot: null, flags: { habitDone: false }, log: [],
      };
      this.byId[a.id] = a;
      return a;
    });
  }

  // ── hari baru: kebiasaan pribadi diulang; rapat hanya dadakan (lewat event) ────────────────────────────
  private startDay() {
    for (const a of this.agents) a.flags.habitDone = false;
  }

  // ── API ────────────────────────────────────────────────────────────────────────────────────────────────
  step(dtSim: number, external: Record<string, ExternalStatus | undefined> = {}) {
    let left = dtSim;
    while (left > 1e-6) { const d = Math.min(0.25, left); this.sub(d, external); left -= d; }
  }

  /**
   * Sambungkan jam simulasi ke jam dunia nyata (menit sejak 00:00, boleh pecahan). Jam ini mengatur langit dan lampu serta kebiasaan
   * berbasis jam; kebutuhan karyawan (haus, toilet, dst.) tetap berjalan dengan laju simulasinya sendiri agar kehidupan kantor terlihat.
   */
  setWallClock(v: number) { this.wallV = v; }

  fireEvent(name: SimEventName) {
    const present = this.agents;
    if (name === "fire") { this.alarmUntil = this.t + 24; this.note("Alarm kebakaran berbunyi — evakuasi"); }
    else if (name === "freelunch") { this.freeLunchUntil = this.t + 26; this.note("Makan siang gratis di pantry!"); }
    else if (name === "meeting") {
      const members = present.filter((a) => !this.isForced(a)).map((a) => ({ id: a.id, goAtV: this.vmin, leaveV: this.vmin + 25, state: "wait" as const, arrivedT: 0 }));
      if (members.length) { this.meetings.push({ id: ++this.meetingSeq, kind: "dadakan", startV: this.vmin, members }); this.note("Rapat dadakan dimulai"); }
    } else if (name === "phone") { const a = this.rng.pick(present.filter((x) => x.mode === "seated" && !x.chat && !this.isForced(x))); if (a) this.ring(a); }
    else if (name === "jam") { this.printerJam(true); }
    else if (name === "help") { this.helpRequest(); }
  }

  get meetingActive() { return this.meetings.some((m) => m.members.some((x) => x.state === "in")); }
  get alarm() { return this.alarmUntil > this.t; }
  presentCount() { return this.agents.length; }

  // ── langkah utama ──────────────────────────────────────────────────────────────────────────────────────
  private wallV: number | null = null;
  private ext: Record<string, ExternalStatus | undefined> = {};
  private isForced(a: SimAgent) { const s = this.ext[a.id]; return !!s && s !== "IDLE"; }

  private sub(dt: number, external: Record<string, ExternalStatus | undefined>) {
    this.ext = external;
    this.t += dt;
    const dv = dt * VMIN_PER_SEC; // laju kebutuhan & acara acak
    if (this.wallV !== null) {
      if (this.wallV < this.vmin - 720) { this.day++; this.startDay(); } // lewat tengah malam
      this.vmin = this.wallV;
    } else {
      this.vmin += dv;
      if (this.vmin >= 1440) { this.vmin -= 1440; this.day++; this.startDay(); }
    }

    this.randomEvents(dv, dt);
    this.updateMeetings();
    for (const a of this.agents) this.tick(a, dt, dv);
    this.resolveSocial();
    this.waterLevel = Math.min(1, this.waterLevel + dv * 0.00004); // isi ulang perlahan
  }

  private tick(a: SimAgent, dt: number, dv: number) {
    const forced = this.isForced(a);
    if (a.bubble && a.bubble.until <= this.t) a.bubble = null;
    a.stress = Math.max(0, a.stress - dt * 0.03);

    this.updateNeeds(a, dv);
    this.updateMood(a);

    // gangguan global: alarm / makan gratis (tugas AI sungguhan tidak ikut)
    if (!forced) {
      if (this.alarm && a.intent !== "evac" && a.doKind !== "evac") { this.goSpotKind(a, "evac"); }
      else if (this.freeLunchUntil > this.t && a.intent !== "freelunch" && a.doKind !== "freelunch" && !this.alarm) { this.goSpotKind(a, "freelunch"); }
    }
    if (forced && a.mode !== "seated" && a.intent !== "seat") { a.chat = null; this.goSeat(a); }

    if (a.chat) { this.tickChat(a); return; }

    switch (a.mode) {
      case "walk": if (this.follow(a, dt)) this.onArrive(a); break;
      case "seated": this.tickSeated(a, forced); break;
      case "do": this.tickDo(a, forced); break;
      case "meeting": this.tickMeeting(a, forced); break;
    }
  }

  // ── kebutuhan & mood ──────────────────────────────────────────────────────────────────────────────────
  private updateNeeds(a: SimAgent, dv: number) {
    const n = a.needs;
    const active = a.mode === "seated" || a.mode === "meeting";
    n.energy = Math.max(0, n.energy - dv * 0.00055);
    n.hunger = Math.min(1, n.hunger + dv * 0.0011);
    n.thirst = Math.min(1, n.thirst + dv * 0.0018 * (0.7 + a.p.coffee * 0.6));
    n.bladder = Math.min(1, n.bladder + dv * 0.0014);
    if (active) { n.social = Math.min(1, n.social + dv * 0.0008 * (0.4 + a.p.chatty)); n.focus = Math.max(0, n.focus - dv * 0.0011 * (1.4 - a.p.diligence)); a.printNeed += dv * 0.0006 * (0.5 + a.p.diligence); }
  }

  private updateMood(a: SimAgent) {
    if (this.t - a.moodSince < 6) return;
    const n = a.needs;
    const tired = 1 - n.energy;
    const stress = a.stress + (1 - n.focus) * 0.25 + (n.hunger > 0.85 ? 0.2 : 0);
    const next: Mood = tired > 0.62 ? "lelah" : stress > 0.55 ? "stres" : n.social < 0.5 && n.hunger < 0.6 && n.energy > 0.5 ? "senang" : "netral";
    if (next !== a.mood) { a.mood = next; a.moodSince = this.t; }
  }

  // ── duduk bekerja: keputusan makro, perjalanan karena kebutuhan, dan mikro-perilaku ──────────────────────
  private tickSeated(a: SimAgent, forced: boolean) {
    if (forced) { a.sub = "type"; a.dir = SEATS[a.id].dir; return; }
    if (this.t >= a.nextDecide) { a.nextDecide = this.t + 0.8; if (this.decide(a)) return; }
    if (this.t >= a.subUntil) this.nextSub(a);
    a.dir = a.sub === "look" ? (a.subUntil % 2 < 1 ? "left" : "right") : SEATS[a.id].dir;
  }

  private decide(a: SimAgent): boolean {
    const v = this.vmin, n = a.needs;
    // kebiasaan pribadi (mis. kopi menjelang jam 10) didahulukan; rapat dadakan menyusul setelahnya
    if (a.p.habit && !a.flags.habitDone && v >= a.p.habit.pantryAt && v < a.p.habit.pantryAt + 150) { a.flags.habitDone = true; return this.goSpot(a, "pantry", SPOTS.pantry, "Ke pantry (kebiasaan)"); }
    // rapat yang sudah waktunya berangkat
    for (const m of this.meetings) {
      const mem = m.members.find((x) => x.id === a.id);
      if (mem && mem.state === "wait" && v >= mem.goAtV && v < m.startV + 120) return this.goMeeting(a, m, mem);
    }
    if (this.t < a.cooldownUntil) return false;
    if (n.thirst > 0.7 && this.rng.chance(0.3)) {
      if (this.rng.chance(a.p.coffee)) return this.goSpot(a, "pantry", SPOTS.pantry, "Ke pantry buat kopi");
      return this.goSpot(a, "cooler", SPOTS.cooler, "Ambil air minum");
    }
    if (n.bladder > 0.8 && this.rng.chance(0.3)) return this.goSpot(a, "toilet", SPOTS.toilet, "Ke toilet");
    if (a.printNeed > 0.5 && this.rng.chance(0.2)) { a.printNeed = 0; return this.goSpot(a, "printer", SPOTS.printer, "Mencetak dokumen"); }
    if (n.social > 0.85 && this.rng.chance(a.p.chatty * 0.35)) { if (this.visitSomeone(a)) return true; }
    if ((n.focus < 0.22 || n.energy < 0.28) && this.rng.chance(0.25)) return this.goBreak(a);
    return false;
  }

  private nextSub(a: SimAgent) {
    if (a.sub === "ring") { a.sub = "phone"; a.subUntil = this.t + this.rng.range(5, 9); this.say(a, this.rng.pick(LINES.phone), 3); return; }
    const n = a.needs;
    const w: [Sub, number][] = [
      ["type", 58 + a.p.diligence * 20], ["think", 14], ["scratch", 5], ["lean", 7 + (1 - n.energy) * 12], ["look", 5 + a.p.chatty * 6], ["phone", 2],
      ["stretch", n.focus < 0.4 ? 8 : 1.5], ["yawn", n.energy < 0.4 ? 10 : 1], ["sip", this.t < a.coffeeUntil ? 12 : 0],
    ];
    let r = this.rng.next() * w.reduce((s, x) => s + x[1], 0), pick: Sub = "type";
    for (const [s, wt] of w) { if ((r -= wt) <= 0) { pick = s; break; } }
    a.sub = pick;
    const [lo, hi] = SUBS[pick];
    a.subUntil = this.t + this.rng.range(lo, hi);
    if (pick === "yawn") this.say(a, "Hoaam...", 1.8);
    if (pick === "phone") this.say(a, this.rng.pick(LINES.phone), 3);
    if (pick === "stretch") { n.focus = Math.min(1, n.focus + 0.25); }
  }

  // ── perjalanan ───────────────────────────────────────────────────────────────────────────────────────
  private occupied(a: SimAgent, dest?: Tile): Uint8Array {
    const g = new Uint8Array(this.blocked);
    for (const o of this.agents) {
      if (o === a || o.hidden) continue;
      const [tx, ty] = tileOf(o.x, o.y);
      if (dest && tx === dest[0] && ty === dest[1]) continue;
      g[ty * W + tx] = 1;
    }
    const [sx, sy] = tileOf(a.x, a.y); g[sy * W + sx] = 0;
    return g;
  }

  private route(a: SimAgent, dest: Tile, intent: Intent, last?: { x: number; y: number; dir?: Dir }): boolean {
    const from = tileOf(a.x, a.y);
    const p = findPath(this.occupied(a, dest), from, dest) ?? findPath(this.blocked, from, dest);
    if (!p) return false;
    a.path = p.map(([tx, ty]) => { const [x, y] = centerOf(tx, ty); return { x, y }; });
    if (last) a.path.push({ x: last.x, y: last.y });
    a.arriveDir = last?.dir; a.dest = dest; a.intent = intent; a.mode = "walk"; a.stuck = 0; a.hidden = false;
    return true;
  }

  private goSeat(a: SimAgent) {
    const s = SEATS[a.id], [tx, ty] = tileOf(s.x, s.y);
    a.doKind = null; a.hidden = false; a.meetSeat = null; a.spot = null;
    if (!this.route(a, [tx, ty], "seat", { x: s.x, y: s.y, dir: s.dir })) { a.x = s.x; a.y = s.y; a.dir = s.dir; a.mode = "seated"; a.path = []; }
  }

  private pickFree<T extends Tile | FacedTile>(a: SimAgent, list: readonly T[]): T | null {
    const tileOfItem = (it: T): Tile => ("tile" in it ? it.tile : it);
    const used = new Set(this.agents.filter((o) => o !== a && (o.spot || o.meetSeat)).map((o) => (o.spot ?? o.meetSeat!.tile).join(",")));
    const free = list.filter((it) => !used.has(tileOfItem(it).join(",")));
    return (free.length ? this.rng.pick(free) : null);
  }

  private goSpot(a: SimAgent, kind: Intent, list: readonly Tile[], text: string): boolean {
    const spot = this.pickFree(a, list);
    if (!spot || !this.route(a, spot, kind)) return false;
    a.spot = spot; a.doKind = null; a.sub = "type";
    a.cooldownUntil = this.t + 22;
    this.log(a, text);
    return true;
  }

  private goSpotKind(a: SimAgent, kind: "evac" | "freelunch") {
    a.chat = null; a.hidden = false;
    const list = kind === "evac" ? SPOTS.evac : SPOTS.lunch.map((l) => l.tile);
    const spot = this.pickFree(a, list) ?? list[0];
    if (this.route(a, spot, kind)) { a.spot = spot; this.say(a, this.rng.pick(kind === "evac" ? LINES.fire : LINES.freeLunch), 3); }
  }

  private goBreak(a: SimAgent): boolean {
    const playful = a.p.id === "content" || a.p.id === "attendance";
    if (playful) {
      const spot = this.pickFree(a, SPOTS.pingpong);
      if (spot && this.route(a, spot.tile, "break", { x: centerOf(...spot.tile)[0], y: centerOf(...spot.tile)[1], dir: spot.dir })) { a.spot = spot.tile; a.cooldownUntil = this.t + 30; this.log(a, "Main pingpong sebentar"); return true; }
    }
    return this.goSpot(a, "break", SPOTS.breakLounge, "Istirahat sebentar di lounge");
  }

  private goMeeting(a: SimAgent, m: Meeting, mem: Member): boolean {
    const seat = this.pickFree(a, SPOTS.meeting);
    const dest: Tile = seat ? seat.tile : (this.pickFree(a, SPOTS.meetingStand) ?? SPOTS.meetingStand[0]);
    const c = centerOf(...dest);
    if (!this.route(a, dest, "meeting", { x: c[0], y: c[1], dir: seat?.dir ?? "up" })) return false;
    a.meetSeat = seat ?? { tile: dest, dir: "up" }; a.spot = null; mem.state = "going"; a.sub = "type";
    this.say(a, this.rng.pick(LINES.meeting), 2.6); this.log(a, "Rapat dadakan");
    return true;
  }

  private visitSomeone(a: SimAgent): boolean {
    const cand = this.agents.filter((o) => o !== a && o.mode === "seated" && !o.chat && !this.isForced(o));
    if (!cand.length) return false;
    const weights = cand.map((o) => REL_WEIGHT[relOf(a.id, o.id)] + 0.05);
    let r = this.rng.next() * weights.reduce((s, w) => s + w, 0), who = cand[0];
    for (let i = 0; i < cand.length; i++) { if ((r -= weights[i]) <= 0) { who = cand[i]; break; } }
    const s = SEATS[who.id], [sx, sy] = tileOf(s.x, s.y);
    const side = [[-1, 0], [1, 0], [0, s.dir === "up" ? 1 : -1]].map(([dx, dy]) => [sx + dx, sy + dy] as Tile).find(([x, y]) => !this.blocked[y * W + x]);
    if (!side || !this.route(a, side, "visit")) return false;
    a.visitTarget = who.id; a.cooldownUntil = this.t + 25;
    this.log(a, `Menghampiri ${who.name}`);
    return true;
  }

  private onArrive(a: SimAgent) {
    switch (a.intent) {
      case "seat": a.mode = "seated"; a.dir = a.arriveDir ?? SEATS[a.id].dir; a.subUntil = 0; a.spot = null; break;
      case "meeting": {
        a.mode = "meeting"; a.dir = a.arriveDir ?? "up";
        const m = this.meetings.find((x) => x.members.some((y) => y.id === a.id && y.state === "going"));
        const mem = m?.members.find((y) => y.id === a.id);
        if (mem) { mem.state = "in"; mem.arrivedT = this.t; }
        break;
      }
      case "visit": {
        const who = a.visitTarget ? this.byId[a.visitTarget] : null;
        if (who && who.mode === "seated" && !who.chat) {
          const s = SEATS[who.id];
          a.dir = Math.abs(a.x - s.x) > Math.abs(a.y - s.y) ? (s.x > a.x ? "right" : "left") : (s.y > a.y ? "down" : "up");
          this.startChat(a, who, "visit");
        } else this.goSeat(a);
        break;
      }
      case "evac": case "freelunch": case "pantry": case "cooler": case "toilet": case "printer": case "break": this.startDo(a, a.intent); break;
      default: this.goSeat(a);
    }
    if (a.intent !== "seat") a.intent = a.mode === "walk" ? a.intent : null;
  }

  private startDo(a: SimAgent, kind: Intent) {
    a.mode = "do"; a.doKind = kind; a.doMinT = this.t; a.hideAt = 0;
    const d = (lo: number, hi: number) => this.t + this.rng.range(lo, hi);
    if (kind === "pantry") { a.doUntil = d(4, 7); this.say(a, this.rng.pick(LINES.coffee), 2.6); }
    else if (kind === "cooler") a.doUntil = d(3, 5);
    else if (kind === "toilet") { a.doUntil = d(4, 6); a.hideAt = this.t + 0.7; }
    else if (kind === "printer") { a.doUntil = d(4, 7); if (a.jam) { a.doUntil += 6; this.say(a, this.rng.pick(LINES.jam), 3); a.stress = Math.min(1, a.stress + 0.4); a.jam = false; } }
    else if (kind === "break") a.doUntil = d(6, 10);
    else a.doUntil = this.t; // evac / freelunch ditentukan oleh alarm/gratis
  }

  private tickDo(a: SimAgent, forced: boolean) {
    const k = a.doKind;
    if (k === "toilet") a.hidden = a.hideAt > 0 && this.t >= a.hideAt && this.t < a.doUntil - 0.7;
    if (forced) { a.hidden = false; this.goSeat(a); return; }
    if (k === "freelunch" && this.t < this.freeLunchUntil) return;
    if (k === "evac" && this.t < this.alarmUntil) return;
    if (k !== "evac" && k !== "freelunch" && this.t < a.doUntil) return;
    // selesai → efek kebutuhan, lalu kembali ke meja
    const n = a.needs;
    if (k === "pantry") { n.thirst = 0.05; n.energy = Math.min(1, n.energy + 0.08); a.coffeeUntil = this.t + 70; }
    else if (k === "cooler") { n.thirst = 0.1; this.waterLevel = Math.max(0.05, this.waterLevel - 0.05); }
    else if (k === "toilet") n.bladder = 0;
    else if (k === "break") { n.focus = 0.9; n.social *= 0.5; n.energy = Math.min(1, n.energy + 0.05); }
    else if (k === "freelunch") { n.hunger = 0.05; n.energy = Math.min(1, n.energy + 0.25); n.thirst = 0.1; n.social *= 0.6; }
    a.hidden = false; a.cooldownUntil = this.t + 18;
    this.goSeat(a);
  }

  private tickMeeting(a: SimAgent, forced: boolean) {
    const m = this.meetings.find((x) => x.members.some((y) => y.id === a.id && y.state === "in"));
    const mem = m?.members.find((y) => y.id === a.id);
    if (!m || !mem) { this.goSeat(a); return; }
    if (forced || (this.vmin >= mem.leaveV && this.t >= mem.arrivedT + 7)) { mem.state = "out"; a.needs.focus = Math.max(0.3, a.needs.focus - 0.1); this.goSeat(a); return; }
    if (this.t >= a.subUntil) {
      a.sub = this.rng.chance(0.4) ? "think" : "type"; a.subUntil = this.t + this.rng.range(2, 5);
      if (this.rng.chance(0.25)) this.say(a, this.rng.pick(LINES.meeting), 2.4);
    }
  }

  private updateMeetings() {
    // peserta yang sedang "going" tapi tidak lagi berjalan (dibatalkan) dikembalikan ke "wait"
    for (const m of this.meetings) for (const mem of m.members) {
      const a = this.byId[mem.id];
      if (mem.state === "going" && a.intent !== "meeting" && a.mode !== "meeting") mem.state = "out";
    }
    this.meetings = this.meetings.filter((m) => m.members.some((x) => x.state !== "out"));
  }

  // ── mengikuti jalur: kecepatan per orang, menghindari tabrakan, kembali merutekan bila macet ──────────────
  private follow(a: SimAgent, dt: number): boolean {
    const tgt = a.path[0];
    if (!tgt) return true;
    const moodMul = a.mood === "lelah" ? 0.82 : a.mood === "stres" ? 1.15 : 1;
    const mv = BASE_SPEED * a.p.walk * moodMul * dt;
    const dx = tgt.x - a.x, dy = tgt.y - a.y, dist = Math.hypot(dx, dy);
    if (dist > 0.5) a.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
    const step = Math.min(mv, dist), ux = dist ? dx / dist : 0, uy = dist ? dy / dist : 0;
    if (this.t >= a.ghostUntil) {
      for (const o of this.agents) {
        if (o === a || o.hidden) continue;
        if (Math.hypot(o.x - (a.x + ux * 7), o.y - (a.y + uy * 7)) < 8 && Math.hypot(o.x - a.x, o.y - a.y) > 0.01) {
          a.blockT += dt;
          if (a.blockT > 1 && this.t >= a.rerouteAt && a.dest) { // coba jalur lain yang menghindari orang
            a.rerouteAt = this.t + 1.5;
            const p = findPath(this.occupied(a, a.dest), tileOf(a.x, a.y), a.dest);
            if (p) { const last = a.path[a.path.length - 1]; const pts = p.map(([tx, ty]) => { const [x, y] = centerOf(tx, ty); return { x, y }; }); if (last && a.arriveDir !== undefined) pts.push(last); a.path = pts; }
          }
          if (a.blockT > 4) { a.ghostUntil = this.t + 1.5; a.blockT = 0; } // terpaksa melewati agar tidak macet selamanya
          return false;
        }
      }
    }
    a.blockT = 0;
    if (dist <= mv) { a.x = tgt.x; a.y = tgt.y; a.path.shift(); } else { a.x += ux * step; a.y += uy * step; }
    return a.path.length === 0;
  }

  // ── sosial: berpapasan → berhenti, saling menghadap, bicara ───────────────────────────────────────────────
  private resolveSocial() {
    const walkers = this.agents.filter((a) => a.mode === "walk" && !a.chat && a.intent !== "evac" && !this.isForced(a));
    for (let i = 0; i < walkers.length; i++) for (let j = i + 1; j < walkers.length; j++) {
      const a = walkers[i], b = walkers[j];
      if (Math.hypot(a.x - b.x, a.y - b.y) > 20) continue;
      if ((a.chatCool[b.id] ?? 0) > this.t) continue;
      a.chatCool[b.id] = b.chatCool[a.id] = this.t + 30;
      const p = 0.6 * REL_WEIGHT[relOf(a.id, b.id)] * (a.p.chatty + b.p.chatty) / 1.2 + 0.05;
      if (this.rng.chance(Math.min(0.9, p))) this.startChat(a, b, "passing");
    }
  }

  private startChat(a: SimAgent, b: SimAgent, kind: "passing" | "visit") {
    const until = this.t + this.rng.range(4, 6.5);
    a.chat = { with: b.id, until, next: this.t, turn: 0 };
    b.chat = { with: a.id, until, next: this.t + 1.2, turn: 1 };
    const face = (p: SimAgent, q: SimAgent): Dir => Math.abs(q.x - p.x) > Math.abs(q.y - p.y) ? (q.x > p.x ? "right" : "left") : q.y > p.y ? "down" : "up";
    a.dir = face(a, b); if (b.mode !== "seated") b.dir = face(b, a);
    a.needs.social = Math.max(0, a.needs.social - 0.45); b.needs.social = Math.max(0, b.needs.social - 0.45);
    const rel = relOf(a.id, b.id);
    this.log(a, `Ngobrol dengan ${b.name}${kind === "visit" ? " di mejanya" : ""}`); this.log(b, `Ngobrol dengan ${a.name}`);
    void rel;
  }

  private tickChat(a: SimAgent) {
    const c = a.chat!, other = this.byId[c.with];
    if (!other || !other.chat || this.t >= c.until) {
      a.chat = null;
      if (a.mode === "walk" || a.mode === "seated") a.nextDecide = this.t + 0.5;
      // kunjungan selesai → kembali ke meja
      if (a.intent === "visit" && a.mode === "walk") { a.visitTarget = null; this.goSeat(a); }
      return;
    }
    if (this.t >= c.next) {
      c.next = this.t + 2.6; c.turn++;
      const pool = a.mode === "walk" && a.intent === "visit" && c.turn === 1 ? LINES.help
        : a.needs.energy < 0.45 && this.rng.chance(0.4) ? LINES.tired
        : this.rng.chance(a.p.coffee * 0.4) ? LINES.coffee : relOf(a.id, other.id) === "friend" && this.rng.chance(0.5) ? LINES.friend : LINES.work;
      this.say(a, this.rng.pick(pool), 2.4);
    }
  }

  // ── acara acak ────────────────────────────────────────────────────────────────────────────────────────
  private randomEvents(dv: number, dt: number) {
    if (this.rng.chance(dv / 90)) this.fireEvent("phone");
    if (this.rng.chance(dv / 240)) this.printerJam(false);
    if (this.rng.chance(dv / 140)) this.helpRequest();
    void dt;
  }

  /** Telepon berdering (bubble ☎), lalu agen menjawab (sub "phone") lewat nextSub(). */
  private ring(a: SimAgent) {
    a.sub = "ring"; a.subUntil = this.t + 1.7; a.stress = Math.min(1, a.stress + 0.25);
    this.say(a, "Kring!", 1.7); this.log(a, "Telepon berdering");
  }
  private printerJam(forced: boolean) {
    if (!forced && this.t - this.lastPrinterJamT < 30) return;
    this.lastPrinterJamT = this.t;
    const at = this.agents.find((x) => x.mode === "do" && x.doKind === "printer");
    if (at) { at.doUntil += 6; at.stress = Math.min(1, at.stress + 0.4); this.say(at, this.rng.pick(LINES.jam), 3); this.log(at, "Printer macet"); this.note("Printer macet"); return; }
    const a = this.rng.pick(this.agents.filter((x) => x.mode === "seated" && !x.chat && !this.isForced(x)));
    if (a) { a.jam = true; a.printNeed = 0; this.goSpot(a, "printer", SPOTS.printer, "Mencetak (printer macet)"); }
  }

  private helpRequest() {
    const seated = this.agents.filter((x) => x.mode === "seated" && !x.chat && !this.isForced(x));
    if (seated.length < 2) return;
    const req = this.rng.pick(seated);
    const helpers = seated.filter((x) => x !== req).sort((a, b) => REL_WEIGHT[relOf(req.id, b.id)] - REL_WEIGHT[relOf(req.id, a.id)]);
    const helper = helpers[0];
    if (!helper) return;
    this.say(req, this.rng.pick(LINES.help), 3); req.stress = Math.min(1, req.stress + 0.2);
    const s = SEATS[req.id], [sx, sy] = tileOf(s.x, s.y);
    const side = [[-1, 0], [1, 0], [0, s.dir === "up" ? 1 : -1]].map(([dx, dy]) => [sx + dx, sy + dy] as Tile).find(([x, y]) => !this.blocked[y * W + x]);
    if (side && this.route(helper, side, "visit")) { helper.visitTarget = req.id; this.log(helper, `Membantu ${req.name}`); this.log(req, "Minta tolong rekan"); }
  }

  // ── util ──────────────────────────────────────────────────────────────────────────────────────────────
  private say(a: SimAgent, text: string, dur = 2.6) { a.bubble = { text, until: this.t + dur }; }
  private log(a: SimAgent, text: string) { a.log.push({ v: this.vmin, text }); if (a.log.length > 40) a.log.shift(); }
  private note(text: string) { this.feed.push({ v: this.vmin, day: this.day, text }); if (this.feed.length > 30) this.feed.shift(); }
}

/** Pose gambar dari keadaan simulasi (tugas AI sungguhan mengalahkan semuanya). */
export function poseOf(a: SimAgent, ext?: ExternalStatus): Pose {
  if (a.mode === "walk") return a.chat ? "talk" : "walk";
  if (a.chat) return "talk";
  if (ext && ext !== "IDLE" && a.mode === "seated") return ext === "COMPLETED" ? "wave" : ext === "NEEDS_APPROVAL" ? "hand" : "typing";
  if (a.mode === "seated") return ({ type: "typing", think: "think", scratch: "scratch", lean: "lean", look: "idle", phone: "phone", ring: "idle", stretch: "stretch", yawn: "yawn", sip: "sip" } as Record<Sub, Pose>)[a.sub];
  if (a.mode === "meeting") return a.sub === "think" ? "think" : "talk";
  if (a.mode === "do") return a.doKind === "break" || a.doKind === "evac" ? "idle" : a.doKind === "pantry" ? "sip" : "idle";
  return "idle";
}

/** Keterangan aktivitas saat ini (Bahasa Indonesia). */
export function activityLabel(a: SimAgent, ext?: ExternalStatus, byId?: Record<string, SimAgent>): string {
  if (ext && ext !== "IDLE") return ext === "NEEDS_APPROVAL" ? "Menunggu persetujuan guru" : ext === "COMPLETED" ? "Tugas selesai" : "Mengerjakan tugas AI";
  if (a.chat) return `Ngobrol dengan ${byId?.[a.chat.with]?.name ?? "rekan"}`;
  switch (a.mode) {
    case "walk": return ({ seat: "Kembali ke meja", pantry: "Menuju pantry", cooler: "Mengambil air minum", toilet: "Menuju toilet", printer: "Menuju printer", meeting: "Menuju ruang rapat", freelunch: "Menuju makan gratis", break: "Berjalan untuk istirahat", visit: "Menghampiri rekan", evac: "Evakuasi" } as Record<Intent, string>)[a.intent ?? "seat"] ?? "Berjalan";
    case "meeting": return "Sedang rapat";
    case "do": return ({ pantry: "Membuat kopi di pantry", cooler: "Minum di dispenser", toilet: "Di toilet", printer: "Mencetak dokumen", freelunch: "Makan gratis", break: "Istirahat", evac: "Menunggu di titik kumpul" } as Partial<Record<Intent, string>>)[a.doKind ?? "break"] ?? "Beraktivitas";
    case "seated": return ({ type: "Mengetik", think: "Berpikir sejenak", scratch: "Menggaruk kepala", lean: "Bersandar", look: "Menoleh ke rekan", phone: "Menerima telepon", ring: "Telepon berdering", stretch: "Meregangkan badan", yawn: "Menguap", sip: "Menyeruput kopi" } as Record<Sub, string>)[a.sub];
  }
  return "";
}

export { fmtTime, hm };
