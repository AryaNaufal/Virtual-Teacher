"use client";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { AGENTS } from "@/lib/agents";
import { H, T, W } from "@/lib/office2d/layout";
import { SimDriver } from "@/lib/sim/driver";
import { LightModel } from "@/lib/sim/lighting";
import { getSim } from "@/lib/sim/store";
import { useOffice } from "@/store/office";
import { Avatar3D } from "./Avatar3D";
import { DeskHits, DeskScreens, Doors3D, Effects, Envelopes, RoomLabels, WallClock } from "./Dynamic3D";
import { StaticWorld } from "./Furniture3D";
import { Lighting3D } from "./Lighting3D";

const PANEL_PX = 340;
const CENTER = new THREE.Vector3(31, 0, 20);
const DIR = new THREE.Vector3(28, 26, 28).normalize();
const SIN_E = DIR.y;
const RIGHT = new THREE.Vector3(1, 0, -1).normalize();
const FWD = new THREE.Vector3(-1, 0, -1).normalize();
const fitZoom = (w: number, h: number) => Math.min(w / 66, h / 43);

/** Menjalankan simulasi tiap frame (satu-satunya pemanggil `step` saat tampilan 3D aktif). */
function Ticker({ model }: { model: LightModel }) {
  const drv = useMemo(() => new SimDriver(), []);
  useFrame((_, dt) => { drv.tick(dt, performance.now()); model.update(getSim(), Math.min(0.05, dt)); }, -1);
  return null;
}

/** Kamera isometrik ortografik: seret = geser, roda = zoom, fokus ke agen terpilih lalu pulih saat ditutup. */
function Rig() {
  const { camera, gl, size } = useThree();
  const st = useRef({ target: CENTER.clone(), zoom: 14 });
  const goal = useRef<{ target: THREE.Vector3; zoom: number } | null>(null);
  const saved = useRef<{ target: THREE.Vector3; zoom: number } | null>(null);
  const follow = useRef(false), touched = useRef(false);
  const selRef = useRef<string | null>(null);
  const sizeRef = useRef(size); sizeRef.current = size;
  const selectedId = useOffice((s) => s.selectedId);

  const apply = () => {
    const c = camera as THREE.OrthographicCamera;
    c.zoom = st.current.zoom;
    c.position.copy(st.current.target).addScaledVector(DIR, 120);
    c.lookAt(st.current.target);
    c.updateProjectionMatrix(); c.updateMatrixWorld();
  };
  const shiftFor = (zoom: number) => (sizeRef.current.width > 700 ? PANEL_PX / 2 / zoom : 0);
  const agentPos = (id: string) => { const a = getSim().byId[id]; return a ? new THREE.Vector3(a.x / T, 0, a.y / T) : null; };

  const applyFocus = () => {
    const { width: w, height: h } = sizeRef.current;
    if (!w) return;
    const fit = fitZoom(w, h), id = selRef.current;
    if (id) {
      if (!saved.current) saved.current = { target: st.current.target.clone(), zoom: st.current.zoom };
      const p = agentPos(id) ?? new THREE.Vector3(...((): [number, number, number] => { const d = AGENTS.find((x) => x.id === id); void d; return [31, 0, 20]; })());
      const zoom = Math.min(90, Math.max(30, fit * 3.4));
      goal.current = { target: p.clone().addScaledVector(RIGHT, shiftFor(zoom)), zoom };
      follow.current = true;
    } else if (saved.current) { follow.current = false; goal.current = saved.current; saved.current = null; }
    else { follow.current = false; goal.current = { target: CENTER.clone(), zoom: fit }; }
  };
  const focusRef = useRef(applyFocus); focusRef.current = applyFocus;
  useEffect(() => { selRef.current = selectedId; focusRef.current(); }, [selectedId]);

  useEffect(() => {
    const { width: w, height: h } = sizeRef.current;
    if (!touched.current && !selRef.current) { st.current.zoom = fitZoom(w, h); st.current.target.copy(CENTER); goal.current = null; apply(); }
  }, [size.width, size.height]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = gl.domElement;
    let drag: { x: number; y: number; moved: boolean } | null = null;
    const down = (e: PointerEvent) => { drag = { x: e.clientX, y: e.clientY, moved: false }; };
    const move = (e: PointerEvent) => {
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) > 4) drag.moved = true;
      if (!drag.moved) return;
      const z = st.current.zoom;
      st.current.target.addScaledVector(RIGHT, -dx / z).addScaledVector(FWD, dy / (z * SIN_E));
      drag.x = e.clientX; drag.y = e.clientY; goal.current = null; follow.current = false; touched.current = true; apply();
    };
    const up = () => { drag = null; };
    const ground = (cx: number, cy: number) => {
      const r = el.getBoundingClientRect();
      const ndc = new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
      const ray = new THREE.Raycaster(); ray.setFromCamera(ndc, camera);
      const out = new THREE.Vector3(); return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), out);
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const fit = fitZoom(sizeRef.current.width, sizeRef.current.height), before = ground(e.clientX, e.clientY);
      st.current.zoom = Math.min(120, Math.max(fit * 0.7, st.current.zoom * Math.exp(-e.deltaY * 0.0015)));
      apply();
      const after = ground(e.clientX, e.clientY);
      if (before && after && !follow.current) st.current.target.add(before).sub(after);
      goal.current = null; touched.current = true; apply();
    };
    el.addEventListener("pointerdown", down); window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
    el.addEventListener("wheel", wheel, { passive: false });
    return () => { el.removeEventListener("pointerdown", down); window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); el.removeEventListener("wheel", wheel); };
  }, [gl, camera]); // eslint-disable-line react-hooks/exhaustive-deps

  // halaman dibuka dengan agen sudah terpilih: langsung fokus tanpa animasi dari tampilan penuh
  useEffect(() => {
    selRef.current = useOffice.getState().selectedId;
    if (selRef.current) { focusRef.current(); if (goal.current) { st.current = { target: goal.current.target.clone(), zoom: goal.current.zoom }; goal.current = null; saved.current = null; } }
    apply();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useFrame((_, dt) => {
    const k = 1 - Math.exp(-dt * 7), s = st.current, g = goal.current;
    const id = selRef.current, fa = follow.current && id ? agentPos(id) : null;
    if (fa) {
      s.target.lerp(fa.addScaledVector(RIGHT, shiftFor(s.zoom)), k);
      if (g) { s.zoom += (g.zoom - s.zoom) * k; if (Math.abs(g.zoom - s.zoom) < 0.05) { s.zoom = g.zoom; goal.current = null; } }
    } else if (g) {
      s.target.lerp(g.target, k); s.zoom += (g.zoom - s.zoom) * k;
      if (s.target.distanceTo(g.target) < 0.05 && Math.abs(g.zoom - s.zoom) < 0.05) { s.target.copy(g.target); s.zoom = g.zoom; goal.current = null; }
    }
    apply();
  });
  return null;
}

/** Kantor 3D isometrik dari data denah yang sama dengan 2D, digerakkan mesin simulasi yang sama. */
export default function Scene3D() {
  const model = useMemo(() => new LightModel(), []);
  return (
    <div className="relative h-full w-full overflow-hidden bg-[#cfdcd2]">
      <Canvas orthographic dpr={[1, 1.5]} gl={{ antialias: true, powerPreference: "high-performance" }} camera={{ position: [60, 60, 60], zoom: 14, near: 0.1, far: 400 }} style={{ touchAction: "none" }}>
        <Ticker model={model} />
        <Lighting3D model={model} />
        <Rig />
        <StaticWorld />
        <DeskScreens />
        <DeskHits />
        <Doors3D />
        <WallClock />
        <Effects />
        <RoomLabels />
        {AGENTS.map((a) => <Avatar3D key={a.id} def={a} />)}
        <Envelopes />
      </Canvas>
    </div>
  );
}
void W; void H;
