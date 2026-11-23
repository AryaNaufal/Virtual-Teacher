"use client";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { STATUS_META } from "@/lib/agents";
import { DESKS, DOORS, Desk, SEATS, T, roomLabels } from "@/lib/office2d/layout";
import { ExternalStatus } from "@/lib/sim/engine";
import { getSim } from "@/lib/sim/store";
import { TRANSFER_MS, useOffice } from "@/store/office";
import { Bx, Cy, PxSprite, hash, hashStr, makePxTex, mat, roundRect } from "./kit";

type ScreenKind = "code" | "chart" | "doc" | "call";
const KINDS: ScreenKind[] = ["code", "chart", "doc", "call"];

// ── layar monitor ────────────────────────────────────────────────────────────────────────────────────────
function paintScreen(c: CanvasRenderingContext2D, w: number, h: number, on: boolean, kind: ScreenKind, tint: string | null, t: number, seed: number) {
  if (!on) { c.fillStyle = "#0b0f14"; c.fillRect(0, 0, w, h); c.fillStyle = "rgba(255,255,255,0.05)"; c.fillRect(0, 0, w, 10); return; }
  const row = Math.floor(t * 2);
  if (kind === "code") {
    c.fillStyle = "#0f172a"; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 11; i++) {
      const len = 16 + hash(seed + i, row + (i > 5 ? 0 : 3)) * 90, ind = Math.floor(hash(seed, i) * 3) * 10;
      c.fillStyle = tint ?? ["#7dd3fc", "#a78bfa", "#86efac", "#fcd34d"][Math.floor(hash(seed + 5, i) * 4)];
      c.fillRect(8 + ind, 8 + i * 8, len, 3);
    }
  } else if (kind === "chart") {
    c.fillStyle = "#f8fafc"; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 8; i++) { const bh = 12 + (0.5 + 0.5 * Math.sin(t * 0.6 + i + seed)) * 56; c.fillStyle = i % 2 ? "#60a5fa" : "#2563eb"; c.fillRect(12 + i * 17, h - 8 - bh, 12, bh); }
    c.fillStyle = "#94a3b8"; c.fillRect(8, h - 8, w - 16, 1);
  } else if (kind === "doc") {
    c.fillStyle = "#ffffff"; c.fillRect(0, 0, w, h); c.fillStyle = "#e2e8f0"; c.fillRect(0, 0, w, 10);
    for (let i = 0; i < 9; i++) { c.fillStyle = "#94a3b8"; c.fillRect(10, 18 + i * 8, 60 + hash(seed, i) * 70, 3); }
  } else {
    c.fillStyle = "#111827"; c.fillRect(0, 0, w, h);
    for (const [x, col] of [[w * 0.3, "#fbbf24"], [w * 0.7, "#34d399"]] as const) { c.fillStyle = col; c.beginPath(); c.arc(x, h * 0.42, 16, 0, 6.3); c.fill(); c.fillRect(x - 18, h * 0.42 + 18, 36, 22); }
    c.fillStyle = "#ef4444"; c.beginPath(); c.arc(w - 12, 12, 4 + (Math.floor(t * 2) % 2), 0, 6.3); c.fill();
  }
  if (tint) { c.strokeStyle = tint; c.lineWidth = 4; c.strokeRect(2, 2, w - 4, h - 4); }
}

function DeskRig({ d }: { d: Desk }) {
  const W = 160, H = 96, up = d.dir === "up";
  const s = useMemo(() => {
    const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    return { cv, tex, mat: new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }) };
  }, []);
  const last = useRef(0), steam = useRef<(THREE.Mesh | null)[]>([]), steamG = useRef<THREE.Group>(null);
  const z = d.y + (up ? 0.75 : 1.25), zMug = d.y + (up ? 0.6 : 1.4);
  useFrame(() => {
    const sim = getSim(), a = d.agentId ? sim.byId[d.agentId] : null;
    const now = performance.now();
    if (now - last.current > 150) {
      last.current = now;
      const st = d.agentId ? (useOffice.getState().statuses as Record<string, ExternalStatus>)[d.agentId] : undefined;
      const real = !!st && st !== "IDLE";
      const on = !!a && (a.monitor || real);
      const kind = real ? "code" : KINDS[(hashStr(d.agentId ?? "x") + Math.floor(sim.t / 28)) % 4];
      paintScreen(s.cv.getContext("2d")!, W, H, on, kind, real ? STATUS_META[st!].color : null, sim.t, hashStr(d.agentId ?? "kosong") % 997);
      s.tex.needsUpdate = true;
    }
    const hot = !!a && a.mode === "seated" && sim.t < a.coffeeUntil;
    if (steamG.current) steamG.current.visible = hot;
    if (hot) steam.current.forEach((m, i) => { if (!m) return; const k = (sim.t * 0.5 + i / 3) % 1; m.position.set(Math.sin(sim.t * 2 + i) * 0.06, k * 0.7, 0); m.scale.setScalar(0.1 + k * 0.12); (m.material as THREE.MeshBasicMaterial).opacity = 0.55 * (1 - k); });
  });
  return (
    <group>
      <group position={[d.x + 2, 1.14, z]} rotation={[0, up ? 0 : Math.PI, 0]}>
        <Bx at={[0, 0, 0]} s={[0.6, 0.06, 0.4]} c="#2b2f3a" />
        <Cy at={[0, 0, 0]} s={[0.14, 0.4, 0.14]} c="#2b2f3a" />
        <Bx at={[0, 0.4, 0]} s={[1.75, 1.05, 0.1]} c="#1f2430" />
        <mesh material={s.mat} position={[0, 0.93, 0.056]}><planeGeometry args={[1.6, 0.9]} /></mesh>
      </group>
      {/* mug kopi + uap */}
      <group position={[d.x + 3.2, 1.14, zMug]}>
        <Cy at={[0, 0, 0]} s={[0.26, 0.28, 0.26]} c="#f4f1ea" />
        <group ref={steamG} position={[0, 0.3, 0]} visible={false}>
          {[0, 1, 2].map((i) => <mesh key={i} ref={(n) => { steam.current[i] = n; }} geometry={new THREE.SphereGeometry(1, 8, 6)} material={new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.5, depthWrite: false })} />)}
        </group>
      </group>
    </group>
  );
}

export function DeskScreens() {
  return <>{DESKS.filter((d) => d.agentId).map((d) => <DeskRig key={d.agentId} d={d} />)}</>;
}

/** Area klik meja: memilih agen pemilik meja. */
export function DeskHits() {
  const m = useMemo(() => new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }), []);
  const ring = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const sel = useOffice.getState().selectedId, d = DESKS.find((x) => x.agentId === sel);
    if (!ring.current) return;
    ring.current.visible = !!d;
    if (d) { ring.current.position.set(d.x + 2, 0.04, d.y + 1 + (d.dir === "up" ? 0.8 : -0.8)); (ring.current.material as THREE.MeshBasicMaterial).opacity = 0.2 + 0.15 * Math.sin(performance.now() / 250); }
  });
  return (
    <>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} visible={false}><planeGeometry args={[5, 4.6]} /><meshBasicMaterial color="#3ddc97" transparent opacity={0.3} depthWrite={false} /></mesh>
      {DESKS.filter((d) => d.agentId).map((d) => (
        <mesh key={d.agentId} material={m} position={[d.x + 2, 0.9, d.y + 1 + (d.dir === "up" ? 0.8 : -0.8)]} onClick={(e) => { if (e.delta < 5) { e.stopPropagation(); useOffice.getState().select(d.agentId!); } }}>
          <boxGeometry args={[4.4, 1.8, 3.8]} />
        </mesh>
      ))}
    </>
  );
}

// ── pintu otomatis ───────────────────────────────────────────────────────────────────────────────────────
export function Doors3D() {
  const leaves = useRef<(THREE.Group | null)[]>([]);
  const open = useRef<number[]>(DOORS.map(() => 0));
  useFrame((_, dt) => {
    const sim = getSim();
    DOORS.forEach((d, i) => {
      const cx = (d.x + d.w / 2) * T, cy = (d.y + d.h / 2) * T;
      const near = sim.agents.some((a) => !a.hidden && Math.hypot(a.x - cx, a.y - 6 - cy) < 30);
      open.current[i] += ((near ? 1 : 0) - open.current[i]) * Math.min(1, dt * 9);
      const g = leaves.current[i];
      if (g) g.rotation.y = (d.orient === "h" ? 1 : -1) * open.current[i] * 1.5;
    });
  });
  return (
    <>
      {DOORS.map((d, i) => {
        const len = d.orient === "h" ? d.w : d.h;
        const pos: [number, number, number] = d.orient === "h" ? [d.x, 0, d.y + 0.5] : [d.x + 0.5, 0, d.y];
        return (
          <group key={i} ref={(n) => { leaves.current[i] = n; }} position={pos}>
            {d.orient === "h" ? <Bx at={[len / 2, 0, 0]} s={[len - 0.05, 1.45, 0.14]} c="#b98b5e" /> : <Bx at={[0, 0, len / 2]} s={[0.14, 1.45, len - 0.05]} c="#b98b5e" />}
            {d.orient === "h" ? <Bx at={[len - 0.25, 0.65, 0]} s={[0.1, 0.1, 0.22]} c="#d8c27a" /> : <Bx at={[0, 0.65, len - 0.25]} s={[0.22, 0.1, 0.1]} c="#d8c27a" />}
          </group>
        );
      })}
    </>
  );
}

// ── jam dinding ──────────────────────────────────────────────────────────────────────────────────────────
export function WallClock() {
  const hour = useRef<THREE.Group>(null), min = useRef<THREE.Group>(null);
  useFrame(() => {
    const v = getSim().vmin;
    if (min.current) min.current.rotation.z = -((v % 60) / 60) * Math.PI * 2;
    if (hour.current) hour.current.rotation.z = -(((v / 60) % 12) / 12) * Math.PI * 2;
  });
  return (
    <group position={[32, 1.05, 8.03]}>
      <Cy at={[0, 0, 0]} s={[0.95, 0.06, 0.95]} c="#ffffff" rot={[Math.PI / 2, 0, 0]} />
      <Cy at={[0, 0, -0.02]} s={[1.05, 0.04, 1.05]} c="#2b2f3a" rot={[Math.PI / 2, 0, 0]} />
      <group ref={hour} position={[0, 0, 0.05]}><Bx at={[0, 0, 0]} s={[0.06, 0.24, 0.02]} c="#1c1f2e" /></group>
      <group ref={min} position={[0, 0, 0.07]}><Bx at={[0, 0, 0]} s={[0.04, 0.36, 0.02]} c="#1c1f2e" /></group>
    </group>
  );
}

// ── efek lingkungan: kertas printer, bola pingpong, layar rapat, amplop ────────────────────────────────────────
export function Effects() {
  const paper = useRef<THREE.Mesh>(null), ball = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const sim = getSim(), t = sim.t;
    const printing = sim.agents.some((a) => a.mode === "do" && a.doKind === "printer");
    if (paper.current) { paper.current.visible = printing; if (printing) { const p = (t * 0.8) % 1; paper.current.position.set(23, 1.0 - 0.2 * p, 35.55 + p * 0.6); } }
    const pp = sim.agents.filter((a) => a.mode === "do" && a.doKind === "break" && a.spot && (a.spot[0] === 25 || a.spot[0] === 32) && a.spot[1] === 26);
    if (ball.current) { ball.current.visible = pp.length === 2; if (pp.length === 2) { const k = (t * 1.1) % 2, u = k < 1 ? k : 2 - k; ball.current.position.set(26.2 + u * 5.6, 1.3 + Math.sin(u * Math.PI) * 0.55, 26.5 + Math.sin(t * 2) * 0.3); } }
  });
  return (
    <>
      <mesh ref={paper} geometry={new THREE.BoxGeometry(0.9, 0.02, 0.6)} material={mat("#ffffff")} visible={false} />
      <mesh ref={ball} geometry={new THREE.SphereGeometry(0.1, 8, 6)} material={mat("#ffffff", { e: "#ffffff", ei: 0.6 })} visible={false} />
    </>
  );
}

/** Amplop yang terbang antar meja saat bos mendelegasikan tugas / laporan. */
export function Envelopes() {
  const transfers = useOffice((s) => s.transfers);
  return <>{transfers.map((tr) => <Envelope key={tr.id} tr={tr} />)}</>;
}
function Envelope({ tr }: { tr: { from: string; to: string; t0: number; kind: string } }) {
  const g = useRef<THREE.Group>(null);
  useFrame(() => {
    const sim = getSim(), k = (Date.now() - tr.t0) / TRANSFER_MS;
    if (!g.current) return;
    g.current.visible = k >= 0 && k <= 1;
    const A = sim.byId[tr.from], B = sim.byId[tr.to];
    if (!A || !B || !g.current.visible) return;
    const pt = (a: typeof A, id: string) => (SEATS[id] ? [a.x / T, a.y / T] : [0, 0]);
    const [fx, fz] = pt(A, tr.from), [tx, tz] = pt(B, tr.to), e = k * k * (3 - 2 * k);
    g.current.position.set(fx + (tx - fx) * e, 1.8 + Math.sin(Math.PI * e) * 2.4, fz + (tz - fz) * e);
    g.current.rotation.set(Math.sin(k * 9) * 0.2, k * 6, Math.cos(k * 7) * 0.2);
  });
  const col = tr.kind === "task" ? "#22c55e" : "#f59e0b";
  return (
    <group ref={g}>
      <Bx at={[0, -0.18, 0]} s={[0.7, 0.36, 0.06]} c="#ffffff" />
      <Bx at={[0, 0.08, 0.035]} s={[0.7, 0.1, 0.02]} c={col} />
      <Bx at={[0, -0.05, 0.04]} s={[0.12, 0.12, 0.02]} c={col} />
    </group>
  );
}

// ── label ruang (sprite) ─────────────────────────────────────────────────────────────────────────────────
function RoomLabel({ text, x, z, team }: { text: string; x: number; z: number; team: boolean }) {
  const t = useMemo(() => {
    const p = makePxTex(140, 22), c = p.ctx;
    c.font = "600 11px system-ui, sans-serif";
    const w = Math.ceil(c.measureText(text).width) + 16, x0 = (140 - w) / 2;
    c.fillStyle = team ? "rgba(255,255,255,0.88)" : "rgba(28,31,46,0.8)"; roundRect(c, x0, 2, w, 18, 9); c.fill();
    c.fillStyle = team ? "#4b5563" : "#e5e7eb"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(text, 70, 11.5);
    p.tex.needsUpdate = true; return p;
  }, [text, team]);
  return <PxSprite t={t} position={[x, 0.15, z]} order={5} />;
}
export function RoomLabels() {
  const ls = useMemo(() => roomLabels(), []);
  return <>{ls.map((l) => <RoomLabel key={l.text} text={l.text} x={l.x / T} z={l.y / T + 0.3} team={l.kind === "team"} />)}</>;
}
