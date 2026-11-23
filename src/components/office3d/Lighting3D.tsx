"use client";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { skyAt, tintAt } from "@/lib/office2d/draw";
import { ROOMS } from "@/lib/office2d/layout";
import { getSim } from "@/lib/sim/store";
import type { LightModel } from "@/lib/sim/lighting";
import { skyMat } from "./kit";

const DAY_BG = new THREE.Color("#cfdcd2"), NIGHT_BG = new THREE.Color("#0d1630");
const WHITE = new THREE.Color("#ffffff");
const tmp = new THREE.Color(), tint = new THREE.Color();

interface Lamp { zone: number; pos: [number, number, number]; dist: number; k: number }
/** Satu lampu titik per ruang tertutup, empat untuk aula besar. Indeks zona mengikuti LightModel (0 = aula, lalu ruang tertutup). */
function lamps(model: LightModel): Lamp[] {
  const out: Lamp[] = [];
  [[24, 14], [36, 25], [48, 14], [48, 28]].forEach(([x, z]) => out.push({ zone: 0, pos: [x, 3.6, z], dist: 22, k: 1 }));
  model.zones.forEach((z, i) => { if (i > 0) out.push({ zone: i, pos: [z.x + z.w / 2, 3.2, z.y + z.h / 2], dist: Math.max(z.w, z.h) * 1.1 + 2, k: 0.8 }); });
  void ROOMS;
  return out;
}

/** Cahaya siang-malam: matahari berputar & berubah warna, langit di jendela, lampu ruang menyala bila gelap, kilau merah saat alarm. */
export function Lighting3D({ model }: { model: LightModel }) {
  const { scene } = useThree();
  const hemi = useRef<THREE.HemisphereLight>(null), sun = useRef<THREE.DirectionalLight>(null), alarm = useRef<THREE.PointLight>(null);
  const lampDefs = useMemo(() => lamps(model), [model]);
  const pts = useRef<(THREE.PointLight | null)[]>([]);

  useFrame(({ clock }) => {
    const sim = getSim(), v = sim.vmin;
    const [r, g, b, a] = tintAt(v);
    tint.setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace);
    const night = Math.min(1, a * 1.8), dark = Math.max(0, Math.min(1, (a - 0.1) / 0.3));
    scene.background = tmp.copy(DAY_BG).lerp(NIGHT_BG, night).clone();
    skyMat.color.set(skyAt(v));
    if (hemi.current) {
      hemi.current.intensity = 1.05 - 0.72 * night;
      hemi.current.color.copy(WHITE).lerp(tint, Math.min(1, a * 1.6));
      hemi.current.groundColor.set("#b9b19c").lerp(tint, Math.min(0.8, a * 1.2));
      if (sim.alarm) hemi.current.color.lerp(new THREE.Color("#ff4040"), 0.25 + 0.2 * Math.sin(clock.elapsedTime * 7));
    }
    if (sun.current) {
      const ang = Math.max(0, Math.min(1, (v - 360) / 720)) * Math.PI; // terbit 06:00 → terbenam 18:00
      sun.current.position.set(31 + Math.cos(ang) * 40, 14 + Math.sin(ang) * 34, 20 + 24);
      sun.current.intensity = 1.25 * (1 - Math.min(1, a * 2.1) * 0.93);
      sun.current.color.copy(WHITE).lerp(tint, Math.min(1, a * 3));
    }
    pts.current.forEach((p, i) => { const d = lampDefs[i]; if (p && d) p.intensity = model.zones[d.zone].a * dark * 16 * d.k; });
    if (alarm.current) alarm.current.intensity = sim.alarm ? 18 * (0.5 + 0.5 * Math.abs(Math.sin(clock.elapsedTime * 6))) : 0;
  });

  return (
    <>
      <hemisphereLight ref={hemi} args={["#ffffff", "#b9b19c", 1]} />
      <directionalLight ref={sun} position={[40, 40, 40]} intensity={1.2} target-position={[31, 0, 20]} />
      {lampDefs.map((d, i) => <pointLight key={i} ref={(n) => { pts.current[i] = n; }} position={d.pos} intensity={0} distance={d.dist} decay={1.4} color="#ffe2b0" />)}
      <pointLight ref={alarm} position={[36, 3, 20]} intensity={0} distance={60} decay={1} color="#ff2a2a" />
    </>
  );
}
