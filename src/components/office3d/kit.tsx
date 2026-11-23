"use client";
import * as THREE from "three";
import { MutableRefObject, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";

/** Satuan dunia 3D = 1 tile (±0,5 m). x/z = px denah / 16; y = tinggi. */
export type V3 = [number, number, number];

export const boxGeo = new THREE.BoxGeometry(1, 1, 1);
export const cylGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 14);
export const sphGeo = new THREE.SphereGeometry(0.5, 12, 10);

const cache = new Map<string, THREE.MeshLambertMaterial>();
export function mat(color: string, o: { e?: string; ei?: number; a?: number } = {}): THREE.MeshLambertMaterial {
  const key = `${color}|${o.e ?? ""}|${o.ei ?? 1}|${o.a ?? 1}`;
  let m = cache.get(key);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color, emissive: o.e ?? "#000000", emissiveIntensity: o.ei ?? 1, transparent: (o.a ?? 1) < 1, opacity: o.a ?? 1, depthWrite: (o.a ?? 1) >= 1 });
    cache.set(key, m);
  }
  return m;
}
/** Material langit di jendela (satu untuk semua jendela, diperbarui tiap frame). */
export const skyMat = new THREE.MeshBasicMaterial({ color: "#9fd4ff", toneMapped: false });

export function shade(hex: string, k: number): string {
  const c = new THREE.Color(hex); c.multiplyScalar(k); return `#${c.getHexString()}`;
}
export const hash = (a: number, b: number) => {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
};
export const hashStr = (s: string) => { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };

interface BP { at: V3; s: V3; c?: string; m?: THREE.Material; rot?: V3 }
/** Balok: `at` = tengah-bawah, `s` = ukuran. */
export function Bx({ at, s, c = "#ffffff", m, rot }: BP) {
  return <mesh geometry={boxGeo} material={m ?? mat(c)} position={[at[0], at[1] + s[1] / 2, at[2]]} scale={s} rotation={rot} />;
}
/** Silinder: `at` = tengah-bawah, `s` = [diameter, tinggi, diameter]. */
export function Cy({ at, s, c = "#ffffff", m, rot }: BP) {
  return <mesh geometry={cylGeo} material={m ?? mat(c)} position={[at[0], at[1] + s[1] / 2, at[2]]} scale={s} rotation={rot} />;
}
/** Bola/elipsoid: `at` = pusat. */
export function Sp({ at, s, c = "#ffffff", m }: BP) {
  return <mesh geometry={sphGeo} material={m ?? mat(c)} position={at} scale={s} />;
}

/** Kursi kantor kecil. `back` = sisi sandaran. Pusat dudukan di (x, z). */
export function Chair({ x, z, back, c = "#44546a" }: { x: number; z: number; back: "n" | "s" | "e" | "w"; c?: string }) {
  const rot = { n: 0, s: Math.PI, e: -Math.PI / 2, w: Math.PI / 2 }[back];
  return (
    <group position={[x, 0, z]} rotation={[0, rot, 0]}>
      <Bx at={[0, 0.45, 0]} s={[0.85, 0.1, 0.85]} c={c} />
      <Bx at={[0, 0.56, -0.4]} s={[0.85, 0.78, 0.1]} c={shade(c, 0.85)} />
      <Cy at={[0, 0.08, 0]} s={[0.12, 0.38, 0.12]} c="#2a2f3a" />
      <Bx at={[0, 0.02, 0]} s={[0.8, 0.07, 0.12]} c="#2a2f3a" />
      <Bx at={[0, 0.02, 0]} s={[0.12, 0.07, 0.8]} c="#2a2f3a" />
    </group>
  );
}

// ── sprite berukuran tetap di layar (label, bubble) ─────────────────────────────────────────────────────
export interface PxTex { cv: HTMLCanvasElement; ctx: CanvasRenderingContext2D; tex: THREE.CanvasTexture; mat: THREE.SpriteMaterial; w: number; h: number }
export function makePxTex(w: number, h: number): PxTex {
  const cv = document.createElement("canvas"); cv.width = w * 2; cv.height = h * 2;
  const ctx = cv.getContext("2d")!; ctx.scale(2, 2);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;
  const m = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, toneMapped: false });
  return { cv, ctx, tex, mat: m, w, h };
}
export function usePxTex(w: number, h: number) { return useMemo(() => makePxTex(w, h), [w, h]); }

/** Sprite yang selalu `w`×`h` piksel CSS di layar, berapa pun zoom kamera ortografik. */
export function PxSprite({ t, innerRef, position = [0, 0, 0], cy = 0.5, order = 20 }: { t: PxTex; innerRef?: MutableRefObject<THREE.Sprite | null>; position?: V3; cy?: number; order?: number }) {
  const local = useRef<THREE.Sprite | null>(null);
  useFrame(({ camera }) => { const sp = local.current; if (sp) { const k = 1 / camera.zoom; sp.scale.set(t.w * k, t.h * k, 1); } });
  return (
    <sprite
      ref={(n) => { local.current = n; if (innerRef) innerRef.current = n; }}
      material={t.mat} position={position} center={new THREE.Vector2(0.5, cy)} renderOrder={order}
    />
  );
}

export function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}
