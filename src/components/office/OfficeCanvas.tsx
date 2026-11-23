"use client";
import { useEffect, useRef } from "react";
import { AGENTS, AgentDef, STATUS_META } from "@/lib/agents";
import { TRANSFER_MS, useOffice } from "@/store/office";
import { DESKS, DOORS, FURNITURE, ROOMS, SEATS, T, WORLD_H, WORLD_W, roomLabels } from "@/lib/office2d/layout";
import {
  ScreenKind, buildStatic, drawAvatar, drawBall, drawBubble, drawClock, drawCoolerLevel, drawDoors, drawEnvelope, drawMonitor, drawMood, drawOccupied,
  drawPaper, drawPill, drawPlantSway, drawSpeech, drawSteam, drawWindows, renderLighting,
} from "@/lib/office2d/draw";
import { ExternalStatus, Pose, SimAgent, poseOf } from "@/lib/sim/engine";
import { SimDriver } from "@/lib/sim/driver";
import { getSim } from "@/lib/sim/store";

interface Cam { cx: number; cy: number; zoom: number }

const PANEL_PX = 340; // lebar panel profil di kanan layar
const fitZoom = (w: number, h: number) => Math.min(w / WORLD_W, h / WORLD_H) * 0.98;
const SCREENS: ScreenKind[] = ["code", "chart", "doc", "call"];
const hashStr = (s: string) => { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };
const HALL = { x: 17, y: 8, w: 38, h: 25 };
const CLOSED_ROOMS = ROOMS.filter((r) => r.floor !== "carpetGrey" && r.floor !== "carpetPurple" && r.floor !== "rugLilac");
const WINDOWS = FURNITURE.filter((f) => f.k === "window");
const PLANTS = FURNITURE.filter((f) => f.k === "plant");
const COOLERS = FURNITURE.filter((f) => f.k === "cooler");
const STALLS = FURNITURE.filter((f) => f.k === "stall");
const inRect = (r: { x: number; y: number; w: number; h: number }, tx: number, ty: number) => tx >= r.x && tx < r.x + r.w && ty >= r.y && ty < r.y + r.h;

/** Kantor 2D: menggambar keadaan dari mesin simulasi (src/lib/sim) + kamera, klik, dan efek lingkungan. */
export default function OfficeCanvas() {
  const wrap = useRef<HTMLDivElement>(null);
  const cvRef = useRef<HTMLCanvasElement>(null);
  const cam = useRef<Cam>({ cx: WORLD_W / 2, cy: WORLD_H / 2, zoom: 1 });
  const goal = useRef<Cam | null>(null);
  const saved = useRef<Cam | null>(null);   // kamera sebelum fokus ke agen (dipulihkan saat panel ditutup)
  const follow = useRef(false);             // kamera sedang mengikuti agen terpilih
  const size = useRef({ w: 0, h: 0, dpr: 1 });
  const touched = useRef(false);
  const hover = useRef<string | null>(null);
  const selectedId = useOffice((s) => s.selectedId);
  const selRef = useRef<string | null>(null);

  const posOf = (a: AgentDef) => { const s = getSim().byId[a.id]; return s ? { x: s.x, y: s.y } : { x: SEATS[a.id].x, y: SEATS[a.id].y }; };

  // ── fokus kamera saat pilihan berubah ──
  const applyFocus = () => {
    const { w, h } = size.current;
    if (!w) return;
    const fit = fitZoom(w, h);
    const a = AGENTS.find((x) => x.id === selRef.current);
    if (a) {
      if (!saved.current) saved.current = { ...cam.current };
      const p = posOf(a);
      const zoom = Math.min(6, Math.max(2.6, fit * 3.2));
      const shift = w > 700 ? PANEL_PX / 2 / zoom : 0; // agen tampil di area yang tidak tertutup panel
      goal.current = { cx: p.x + shift, cy: p.y - 12, zoom };
      follow.current = true;
    } else if (saved.current) {
      follow.current = false; goal.current = { ...saved.current }; saved.current = null;
    } else {
      follow.current = false; goal.current = { cx: WORLD_W / 2, cy: WORLD_H / 2, zoom: fit };
    }
  };
  const applyFocusRef = useRef(applyFocus);
  applyFocusRef.current = applyFocus;
  useEffect(() => { selRef.current = selectedId; applyFocusRef.current(); }, [selectedId]);

  useEffect(() => {
    const cv = cvRef.current!, wrapEl = wrap.current!;
    const ctx = cv.getContext("2d")!;
    const stat = buildStatic();
    const light = document.createElement("canvas"); light.width = WORLD_W; light.height = WORLD_H;
    const labels = roomLabels();
    const anim: Record<string, { x: number; y: number; phase: number }> = {};
    const doorOpen: number[] = DOORS.map(() => 0);
    const lit = new Map<string, number>();
    const extOf = (): Record<string, ExternalStatus> => useOffice.getState().statuses as Record<string, ExternalStatus>;

    const resize = () => {
      const r = wrapEl.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      size.current = { w: r.width, h: r.height, dpr };
      cv.width = Math.max(1, Math.round(r.width * dpr)); cv.height = Math.max(1, Math.round(r.height * dpr));
      cv.style.width = `${r.width}px`; cv.style.height = `${r.height}px`;
      if (!touched.current && !selRef.current) { cam.current = { cx: WORLD_W / 2, cy: WORLD_H / 2, zoom: fitZoom(r.width, r.height) }; goal.current = null; }
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrapEl);

    // ── hit-test: avatar atau area mejanya ──
    const visible = (a: SimAgent) => !a.hidden;
    const hit = (wx: number, wy: number): AgentDef | null => {
      const sim = getSim();
      for (const s of sim.agents) if (visible(s) && Math.abs(wx - s.x) <= 9 && wy >= s.y - 26 && wy <= s.y + 3) return AGENTS.find((a) => a.id === s.id) ?? null;
      for (const d of DESKS) {
        if (!d.agentId) continue;
        if (wx >= d.x * T - 4 && wx <= (d.x + 4) * T + 4 && wy >= d.y * T - 4 && wy <= (d.y + 2) * T + 4) return AGENTS.find((a) => a.id === d.agentId) ?? null;
      }
      return null;
    };
    const toWorld = (sx: number, sy: number) => ({ x: (sx - size.current.w / 2) / cam.current.zoom + cam.current.cx, y: (sy - size.current.h / 2) / cam.current.zoom + cam.current.cy });

    // ── input ──
    let drag: { x: number; y: number; moved: boolean } | null = null;
    const onDown = (e: PointerEvent) => { cv.setPointerCapture(e.pointerId); drag = { x: e.clientX, y: e.clientY, moved: false }; };
    const onMove = (e: PointerEvent) => {
      const r = cv.getBoundingClientRect();
      if (drag) {
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (!drag.moved && Math.hypot(dx, dy) > 4) drag.moved = true;
        if (drag.moved) {
          cam.current.cx -= dx / cam.current.zoom; cam.current.cy -= dy / cam.current.zoom;
          drag.x = e.clientX; drag.y = e.clientY; goal.current = null; follow.current = false; touched.current = true; cv.style.cursor = "grabbing";
        }
        return;
      }
      const w = toWorld(e.clientX - r.left, e.clientY - r.top);
      const a = hit(w.x, w.y);
      hover.current = a?.id ?? null;
      cv.style.cursor = a ? "pointer" : "grab";
    };
    const onUp = (e: PointerEvent) => {
      const d = drag; drag = null;
      if (d && !d.moved) {
        const r = cv.getBoundingClientRect();
        const w = toWorld(e.clientX - r.left, e.clientY - r.top);
        const a = hit(w.x, w.y);
        if (a) useOffice.getState().select(a.id); // klik area kosong tidak membatalkan pilihan
      }
      cv.style.cursor = hover.current ? "pointer" : "grab";
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = cv.getBoundingClientRect();
      const before = toWorld(e.clientX - r.left, e.clientY - r.top);
      const fit = fitZoom(size.current.w, size.current.h);
      cam.current.zoom = Math.min(8, Math.max(fit * 0.7, cam.current.zoom * Math.exp(-e.deltaY * 0.0015)));
      const after = toWorld(e.clientX - r.left, e.clientY - r.top);
      cam.current.cx += before.x - after.x; cam.current.cy += before.y - after.y; // titik di bawah kursor tetap
      goal.current = null; touched.current = true;
    };
    cv.addEventListener("pointerdown", onDown); cv.addEventListener("pointermove", onMove); cv.addEventListener("pointerup", onUp);
    cv.addEventListener("pointercancel", onUp); cv.addEventListener("wheel", onWheel, { passive: false });
    cv.style.cursor = "grab";

    const rect = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, f: string) => { c.fillStyle = f; c.fillRect(Math.round(x), Math.round(y), w, h); };

    // ── render ──
    const render = (now: number, dt: number) => {
      const sim = getSim(), ext = extOf();
      const { w, h, dpr } = size.current;
      const t = sim.t; // animasi mengikuti waktu simulasi (jeda = membeku, 20x = cepat)
      const v = sim.vmin;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = "#cfdcd2"; ctx.fillRect(0, 0, cv.width, cv.height);
      const z = cam.current.zoom * dpr;
      ctx.setTransform(z, 0, 0, z, Math.round((w / 2 - cam.current.cx * cam.current.zoom) * dpr), Math.round((h / 2 - cam.current.cy * cam.current.zoom) * dpr));
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(stat, 0, 0);

      // lingkungan: langit di jendela, jam dinding, tanaman, dispenser, bilik toilet
      drawWindows(ctx, WINDOWS, v);
      drawClock(ctx, 32 * T, 7 * T + 8, v);
      for (const p of PLANTS) drawPlantSway(ctx, p, t);
      const using = (tile: [number, number]) => sim.agents.some((a) => a.mode === "do" && a.doKind === "cooler" && a.spot && a.spot[0] === tile[0] && a.spot[1] === tile[1]);
      COOLERS.forEach((c, i) => drawCoolerLevel(ctx, c.x, c.y, sim.waterLevel, using(i === 0 ? [39, 9] : [51, 37]), t));
      STALLS.forEach((s) => { if (sim.agents.some((a) => a.mode === "do" && a.doKind === "toilet" && a.spot && a.spot[0] >= s.x && a.spot[0] < s.x + s.w)) drawOccupied(ctx, s.x, s.y); });
      if (sim.meetingActive) { // layar/papan tulis ruang rapat menyala
        rect(ctx, 9 * T + 3, 19 * T + 2, 5 * T - 6, 12, "rgba(160,205,255,0.85)");
        for (let i = 0; i < 4; i++) rect(ctx, 9 * T + 7, 19 * T + 4 + i * 2, 20 + Math.floor(Math.abs(Math.sin(t + i)) * 24), 1, "#2563eb");
      }
      const printer = sim.agents.find((a) => a.mode === "do" && a.doKind === "printer");
      if (printer) drawPaper(ctx, 22, 35, Math.min(1, ((t * 0.8) % 1)));

      // pintu terbuka otomatis bila ada orang di dekatnya
      DOORS.forEach((d, i) => {
        const cx = (d.x + d.w / 2) * T, cy = (d.y + d.h / 2) * T;
        const near = sim.agents.some((a) => visible(a) && Math.hypot(a.x - cx, a.y - 6 - cy) < 26);
        doorOpen[i] += ((near ? 1 : 0) - doorOpen[i]) * Math.min(1, dt * 9);
      });
      drawDoors(ctx, DOORS, doorOpen);

      // monitor: konten berbeda; mati bila penghuni tak ada. Tugas AI sungguhan → bingkai & kode berwarna status
      for (const d of DESKS) {
        const a = d.agentId ? sim.byId[d.agentId] : null, st = d.agentId ? ext[d.agentId] : undefined;
        const real = !!st && st !== "IDLE";
        const on = !!a && (a.monitor || real);
        drawMonitor(ctx, d.x, d.y, d.dir, { on, kind: real ? "code" : SCREENS[(hashStr(d.agentId ?? "x") + Math.floor(t / 28)) % 4], tint: real ? STATUS_META[st!].color : null, t, seed: hashStr(d.agentId ?? "kosong") % 997 });
        if (a && a.mode === "seated" && t < a.coffeeUntil) drawSteam(ctx, (d.x + 2) * T + 13.5, d.dir === "up" ? d.y * T + 12 : (d.y + 2) * T - 16, t);
      }
      // sorot meja agen terpilih
      const sel = selRef.current && DESKS.find((d) => d.agentId === selRef.current);
      if (sel) {
        ctx.globalAlpha = 0.55 + 0.35 * Math.sin(now / 250);
        ctx.strokeStyle = "#3ddc97"; ctx.lineWidth = 2;
        ctx.strokeRect(sel.x * T - 5, sel.y * T - (sel.dir === "down" ? 30 : 5), 4 * T + 10, 2 * T + (sel.dir === "down" ? 36 : 40));
        ctx.globalAlpha = 1;
      }
      // label ruang/zona
      for (const l of labels) {
        if (l.kind === "team") drawPill(ctx, l.text, l.x, l.y, { bg: "rgba(255,255,255,0.85)", fg: "#4b5563", font: 7 });
        else drawPill(ctx, l.text, l.x, l.y, { bg: "rgba(28,31,46,0.78)", fg: "#e5e7eb", font: 6 });
      }

      // pingpong: bola hanya bila kedua sisi terisi
      const pp = sim.agents.filter((a) => a.mode === "do" && a.doKind === "break" && a.spot && (a.spot[0] === 25 || a.spot[0] === 32) && a.spot[1] === 26);
      if (pp.length === 2) drawBall(ctx, t);

      // agen, diurutkan menurut y agar tumpang-tindih natural
      const list = sim.agents.filter(visible).sort((a, b) => a.y - b.y);
      for (const a of list) {
        const ag = AGENTS.find((x) => x.id === a.id)!;
        const an = (anim[a.id] ??= { x: a.x, y: a.y, phase: 0 });
        an.phase += Math.hypot(a.x - an.x, a.y - an.y) / 5; an.x = a.x; an.y = a.y;
        let pose: Pose = poseOf(a, ext[a.id]);
        if (selRef.current === a.id) rect(ctx, a.x - 8, a.y - 2, 16, 4, "rgba(61,220,151,0.55)");
        drawAvatar(ctx, a.x, a.y, { skin: ag.skin, hair: ag.hair, shirt: ag.shirt }, a.dir, an.phase, pose, t, { slump: a.mood === "lelah" });
      }
      for (const a of list) {
        const ag = AGENTS.find((x) => x.id === a.id)!, st = ext[a.id] ?? "IDLE";
        const focus = selRef.current === a.id || hover.current === a.id;
        const text = focus ? `${ag.name} · ${ag.title.replace("AI ", "")}` : ag.name;
        const pw = drawPill(ctx, text, a.x, a.y - 30, { dot: STATUS_META[st].color, font: 7 });
        drawMood(ctx, a.mood, a.x + pw / 2 + 6, a.y - 30, t);
        if (st === "WORKING" || st === "PROCESSING") drawBubble(ctx, "dots", a.x, a.y - 42, t);
        else if (st === "NEEDS_APPROVAL") drawBubble(ctx, "alert", a.x, a.y - 42, t);
        else if (st === "COMPLETED") drawBubble(ctx, "done", a.x, a.y - 42, t);
        else if (a.bubble) drawSpeech(ctx, a.bubble.text, a.x, a.y - 37);
      }
      // amplop delegasi/laporan
      const nowMs = Date.now();
      for (const tr of useOffice.getState().transfers) {
        const k = (nowMs - tr.t0) / TRANSFER_MS;
        if (k < 0 || k > 1) continue;
        const A = sim.byId[tr.from], B = sim.byId[tr.to];
        if (!A || !B) continue;
        const fx = A.x, fy = A.y;
        const tx = B.x, ty = B.y;
        const e = k * k * (3 - 2 * k);
        drawEnvelope(ctx, fx + (tx - fx) * e, fy - 14 + (ty - fy) * e - Math.sin(Math.PI * e) * 36, tr.kind === "task" ? "#22c55e" : "#f59e0b");
      }

      // lampu: tiap ruang menyala bila ada orang (atau jam kerja); aula menyala selama hari kerja
      const occ = (r: { x: number; y: number; w: number; h: number }) => list.some((a) => inRect(r, Math.floor(a.x / T), Math.floor((a.y - 1) / T)));
      const work = v >= 7 * 60 + 30 && v < 18 * 60 + 30;
      const zones = [{ key: "hall", r: HALL, target: work || occ(HALL) || sim.presentCount() > 0 && v < 19.5 * 60 ? 1 : 0 }, ...CLOSED_ROOMS.map((r) => ({ key: r.name, r, target: (work && r.name !== "Toilet") || occ(r) ? 1 : 0 }))];
      const lz = zones.map((zn) => { const cur = lit.get(zn.key) ?? zn.target; const nxt = cur + (zn.target - cur) * Math.min(1, dt * 2.5); lit.set(zn.key, nxt); return { ...zn.r, a: nxt }; });
      renderLighting(ctx, light, v, lz);
      if (sim.alarm) { ctx.globalAlpha = 0.06 + 0.07 * Math.abs(Math.sin(now / 220)); rect(ctx, 0, 0, WORLD_W, WORLD_H, "#ff2a2a"); ctx.globalAlpha = 1; }
    };

    // ── loop ──
    const drv = new SimDriver();
    let raf = 0, last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const { sim } = drv.tick(dt, now);

      // kamera
      const g = goal.current, k = 1 - Math.exp(-dt * 7), c = cam.current;
      const fAgent = follow.current && selRef.current ? sim.byId[selRef.current] : null;
      const followed = fAgent ?? null;
      if (followed) {
        const shift = size.current.w > 700 ? PANEL_PX / 2 / c.zoom : 0;
        c.cx += (followed.x + shift - c.cx) * k; c.cy += (followed.y - 12 - c.cy) * k;
        if (g) { c.zoom += (g.zoom - c.zoom) * k; if (Math.abs(g.zoom - c.zoom) < 0.01) { c.zoom = g.zoom; goal.current = null; } }
      } else if (g) {
        c.cx += (g.cx - c.cx) * k; c.cy += (g.cy - c.cy) * k; c.zoom += (g.zoom - c.zoom) * k;
        if (Math.abs(g.cx - c.cx) < 0.3 && Math.abs(g.cy - c.cy) < 0.3 && Math.abs(g.zoom - c.zoom) < 0.01) { cam.current = { ...g }; goal.current = null; }
      }
      render(now, dt);

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    // halaman dibuka dengan agen sudah terpilih (mis. dari menu AI Employees): langsung fokus, tanpa animasi dari tampilan penuh
    selRef.current = useOffice.getState().selectedId;
    if (selRef.current) { applyFocusRef.current(); if (goal.current) { cam.current = { ...goal.current }; goal.current = null; saved.current = null; } }

    return () => {
      cancelAnimationFrame(raf); ro.disconnect();
      cv.removeEventListener("pointerdown", onDown); cv.removeEventListener("pointermove", onMove); cv.removeEventListener("pointerup", onUp);
      cv.removeEventListener("pointercancel", onUp); cv.removeEventListener("wheel", onWheel);
    };
  }, []);

  return (
    <div ref={wrap} className="relative h-full w-full overflow-hidden bg-[#cfdcd2]">
      <canvas ref={cvRef} className="block touch-none" />
    </div>
  );
}
