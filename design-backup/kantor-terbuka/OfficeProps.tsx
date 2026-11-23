"use client";
import { useMemo } from "react";
import * as THREE from "three";

type V3 = [number, number, number];

// Tema: hijau tua + putih + abu-abu, dengan aksen hijau segar; lantai dan meja tetap kayu hangat.
export const C = {
  wall: "#f3f6f4", wallTop: "#1f6b4a", base: "#1f6b4a", wood: "#e3a25f", woodDark: "#d98f45", deskDark: "#3b2a24",
  chair: "#2f7d57", frame: "#39404c", glass: "#9ec9e8", grey: "#8a929c", teal: "#1f6b4a", sofa: "#5b6672",
  accent: "#3ddc97", rug: "#dbe6df",
};

/** Lantai keramik polos: satu warna abu-putih dengan nat tipis (tekstur dibuat di canvas, tanpa berkas gambar). */
export function useTileTexture(repeatX: number, repeatY: number) {
  return useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g = c.getContext("2d")!;
    g.fillStyle = "#f1f3f2";
    g.fillRect(0, 0, 256, 256);
    g.strokeStyle = "#d3d9d6"; // nat tipis dan lembut agar tidak berkedip/moire saat zoom out
    g.lineWidth = 4;
    g.strokeRect(0, 0, 256, 256);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 16;
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.repeat.set(repeatX, repeatY);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [repeatX, repeatY]);
}

export function Box({ p, s, color, rot = [0, 0, 0], cast = true, opacity }: { p: V3; s: V3; color: string; rot?: V3; cast?: boolean; opacity?: number }) {
  return (
    <mesh position={p} rotation={rot} castShadow={cast} receiveShadow>
      <boxGeometry args={s} />
      <meshStandardMaterial color={color} transparent={opacity !== undefined} opacity={opacity ?? 1} />
    </mesh>
  );
}

export function Plant({ position, scale = 1 }: { position: V3; scale?: number }) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.25, 0]} castShadow><cylinderGeometry args={[0.24, 0.18, 0.5, 14]} /><meshStandardMaterial color="#f1ece2" /></mesh>
      <mesh position={[0, 0.8, 0]} castShadow><sphereGeometry args={[0.38, 14, 14]} /><meshStandardMaterial color="#2f9e63" /></mesh>
      <mesh position={[0.14, 1.12, 0.06]} castShadow><sphereGeometry args={[0.26, 14, 14]} /><meshStandardMaterial color="#45c07c" /></mesh>
      <mesh position={[-0.16, 1.0, -0.08]} castShadow><sphereGeometry args={[0.22, 14, 14]} /><meshStandardMaterial color="#38a96b" /></mesh>
    </group>
  );
}

export function Bookcase({ position, rotY = 0, w = 2.2 }: { position: V3; rotY?: number; w?: number }) {
  const cols = ["#3b6fb6", "#e2e8f0", "#7a8ca6", "#e0a15a", "#475569", "#c9d4f0"];
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      <Box p={[0, 1, 0]} s={[w, 2, 0.5]} color="#c9a67a" />
      <Box p={[0, 1, 0.06]} s={[w - 0.2, 1.8, 0.4]} color="#b58f63" cast={false} />
      {[0.35, 0.95, 1.55].map((y, i) =>
        Array.from({ length: Math.floor((w - 0.4) / 0.28) }).map((_, j) => (
          <mesh key={`${i}-${j}`} position={[-w / 2 + 0.3 + j * 0.28, y, 0.16]}>
            <boxGeometry args={[0.2, 0.42 - ((i + j) % 3) * 0.05, 0.28]} />
            <meshStandardMaterial color={cols[(i * 3 + j) % cols.length]} />
          </mesh>
        )),
      )}
    </group>
  );
}

export function WaterCooler({ position }: { position: V3 }) {
  return (
    <group position={position}>
      <Box p={[0, 0.5, 0]} s={[0.55, 1, 0.55]} color="#f4f6f8" />
      <mesh position={[0, 1.3, 0]} castShadow><cylinderGeometry args={[0.24, 0.24, 0.55, 16]} /><meshStandardMaterial color="#7fd0ff" transparent opacity={0.75} /></mesh>
      <Box p={[0.12, 0.72, 0.29]} s={[0.1, 0.08, 0.06]} color="#2b8be0" />
    </group>
  );
}

export function Sofa({ position, rotY = 0 }: { position: V3; rotY?: number }) {
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      <Box p={[0, 0.3, 0]} s={[2.6, 0.5, 1]} color={C.sofa} />
      <Box p={[0, 0.78, -0.4]} s={[2.6, 0.7, 0.25]} color="#33506a" />
      <Box p={[-1.38, 0.5, 0]} s={[0.22, 0.75, 1]} color="#33506a" />
      <Box p={[1.38, 0.5, 0]} s={[0.22, 0.75, 1]} color="#33506a" />
      <Box p={[-0.6, 0.62, 0.05]} s={[0.5, 0.15, 0.5]} color="#e8c07a" rot={[0, 0.3, 0]} />
    </group>
  );
}

/** Meja resepsionis berbentuk huruf L dengan permukaan toska. */
export function Reception({ position, rotY = 0 }: { position: V3; rotY?: number }) {
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      <Box p={[0, 0.5, 0]} s={[4.2, 1, 0.9]} color={C.teal} />
      <Box p={[0, 1.02, 0.05]} s={[4.3, 0.08, 1.1]} color="#e9fbf4" />
      <Box p={[-2.05, 0.5, 1.35]} s={[0.9, 1, 2.2]} color={C.teal} />
      <Box p={[-2.05, 1.02, 1.4]} s={[1.1, 0.08, 2.3]} color="#e9fbf4" />
      <Box p={[0.6, 1.12, 0]} s={[0.5, 0.04, 0.35]} color="#ffffff" />
      <Box p={[-1.0, 1.08, 0.1]} s={[0.35, 0.08, 0.25]} color="#f6e7b0" />
    </group>
  );
}

export function OfficeChair({ position, rotY = 0, color = C.chair }: { position: V3; rotY?: number; color?: string }) {
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      <Box p={[0, 0.5, 0]} s={[0.55, 0.08, 0.55]} color={color} />
      <Box p={[0, 0.85, -0.25]} s={[0.55, 0.7, 0.08]} color={color} />
      <mesh position={[0, 0.25, 0]}><cylinderGeometry args={[0.04, 0.04, 0.5]} /><meshStandardMaterial color="#444b57" /></mesh>
      <Box p={[0, 0.04, 0]} s={[0.5, 0.05, 0.5]} color="#444b57" cast={false} />
    </group>
  );
}

export function MeetingTable({ position }: { position: V3 }) {
  const seats = [-1.5, -0.5, 0.5, 1.5];
  return (
    <group position={position}>
      <Box p={[0, 0.76, 0]} s={[4.4, 0.12, 1.4]} color="#8a5a3b" />
      {[[-2, -0.5], [2, -0.5], [-2, 0.5], [2, 0.5]].map(([x, z], i) => <Box key={i} p={[x, 0.37, z]} s={[0.1, 0.74, 0.1]} color="#5b3a26" />)}
      {seats.map((x) => <OfficeChair key={`a${x}`} position={[x, 0, -1.15]} rotY={Math.PI} />)}
      {seats.map((x) => <OfficeChair key={`b${x}`} position={[x, 0, 1.15]} />)}
      <OfficeChair position={[-2.7, 0, 0]} rotY={-Math.PI / 2} />
      <OfficeChair position={[2.7, 0, 0]} rotY={Math.PI / 2} />
      <Box p={[-1, 0.84, 0.1]} s={[0.5, 0.03, 0.35]} color="#fff" />
      <Box p={[1, 0.84, -0.1]} s={[0.5, 0.03, 0.35]} color="#fff" />
      <mesh position={[0, 0.9, 0]}><cylinderGeometry args={[0.1, 0.1, 0.16, 12]} /><meshStandardMaterial color="#222" /></mesh>
    </group>
  );
}

/** Pintu kayu. Posisi lokal: pusat dasar pintu. */
export function WoodDoor({ position, rotY = 0 }: { position: V3; rotY?: number }) {
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      <Box p={[0, 1.1, 0]} s={[0.95, 2.2, 0.1]} color="#d98f45" />
      <Box p={[0, 1.1, 0.06]} s={[0.7, 1.9, 0.02]} color="#e9a35c" cast={false} />
      <Box p={[0.35, 1.05, 0.12]} s={[0.05, 0.05, 0.08]} color="#d9dde3" cast={false} />
      <Box p={[0, 2.26, 0]} s={[1.1, 0.12, 0.14]} color="#39404c" cast={false} />
    </group>
  );
}

/**
 * Dinding kaca sepanjang `len` (sumbu x lokal), diputar 90° bila axis="z".
 * `door` = posisi tengah pintu sepanjang dinding (relatif ke pusat). Celah pintu diisi pintu kayu.
 */
export function GlassWall({ x, z, len, axis, door, h = 2.5 }: { x: number; z: number; len: number; axis: "x" | "z"; door?: number; h?: number }) {
  const doorW = 1.1;
  const segs: [number, number][] = door === undefined
    ? [[-len / 2, len / 2]]
    : [[-len / 2, door - doorW / 2], [door + doorW / 2, len / 2]];
  return (
    <group position={[x, 0, z]} rotation={[0, axis === "z" ? Math.PI / 2 : 0, 0]}>
      {segs.map(([a, b], i) => {
        const w = b - a, cx = (a + b) / 2;
        if (w <= 0.05) return null;
        const posts = Math.max(1, Math.round(w / 1.6));
        return (
          <group key={i}>
            <mesh position={[cx, h / 2, 0]}><boxGeometry args={[w, h, 0.05]} /><meshStandardMaterial color={C.glass} transparent opacity={0.22} roughness={0.1} depthWrite={false} /></mesh>
            <Box p={[cx, 0.06, 0]} s={[w, 0.12, 0.12]} color={C.frame} cast={false} />
            <Box p={[cx, h, 0]} s={[w, 0.1, 0.12]} color={C.frame} cast={false} />
            {Array.from({ length: posts + 1 }).map((_, k) => <Box key={k} p={[a + (w * k) / posts, h / 2, 0]} s={[0.07, h, 0.1]} color={C.frame} cast={false} />)}
          </group>
        );
      })}
      {door !== undefined && (
        <group>
          <Box p={[door, h + 0.05, 0]} s={[doorW + 0.1, 0.1, 0.12]} color={C.frame} cast={false} />
          <WoodDoor position={[door, 0, 0]} />
        </group>
      )}
    </group>
  );
}

/** Jendela di dinding luar: bingkai gelap + kaca biru langit, sedikit menonjol dari dinding. */
export function WindowPane({ position, rotY = 0, w = 2.4, h = 1.3 }: { position: V3; rotY?: number; w?: number; h?: number }) {
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      <Box p={[0, 0, 0]} s={[w + 0.2, h + 0.2, 0.08]} color={C.frame} cast={false} />
      <mesh position={[0, 0, 0.05]}><boxGeometry args={[w, h, 0.03]} /><meshStandardMaterial color="#bfe6ff" emissive="#8fd0ff" emissiveIntensity={0.35} /></mesh>
      <Box p={[0, 0, 0.07]} s={[0.05, h, 0.03]} color={C.frame} cast={false} />
      {[-0.22, 0.22].map((y, i) => <Box key={i} p={[0, y * h, 0.07]} s={[w, 0.03, 0.03]} color="#cdd5df" cast={false} />)}
    </group>
  );
}

export function FilingCabinet({ position, rotY = 0, n = 3 }: { position: V3; rotY?: number; n?: number }) {
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      {Array.from({ length: n }).map((_, i) => (
        <group key={i} position={[i * 0.62, 0, 0]}>
          <Box p={[0, 0.7, 0]} s={[0.58, 1.4, 0.55]} color="#aeb7c2" />
          {[0.25, 0.65, 1.05].map((y) => (
            <group key={y}>
              <Box p={[0, y, 0.29]} s={[0.5, 0.32, 0.02]} color="#c4ccd6" cast={false} />
              <Box p={[0, y + 0.08, 0.31]} s={[0.18, 0.03, 0.03]} color="#59616d" cast={false} />
            </group>
          ))}
        </group>
      ))}
    </group>
  );
}

export function Printer({ position, rotY = 0 }: { position: V3; rotY?: number }) {
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      <Box p={[0, 0.4, 0]} s={[1.3, 0.8, 0.8]} color="#e8ebef" />
      <Box p={[0, 0.88, 0]} s={[1.0, 0.18, 0.7]} color="#f7f8fa" />
      <Box p={[0, 0.75, 0.38]} s={[0.8, 0.05, 0.1]} color="#3b4350" cast={false} />
      <Box p={[0.5, 0.82, 0.3]} s={[0.18, 0.04, 0.12]} color={C.accent} cast={false} />
      <Box p={[0, 0.97, 0.1]} s={[0.5, 0.02, 0.36]} color="#fff" cast={false} />
    </group>
  );
}

/** Papan tulis putih berdiri di kaki roda (area terbuka) atau menempel di dinding (pakai y tinggi). */
export function Whiteboard({ position, rotY = 0, w = 2.2, standing = true }: { position: V3; rotY?: number; w?: number; standing?: boolean }) {
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      <Box p={[0, standing ? 1.45 : 0, 0]} s={[w + 0.14, 1.2, 0.07]} color="#aab2bd" cast={false} />
      <Box p={[0, standing ? 1.45 : 0, 0.045]} s={[w, 1.06, 0.02]} color="#ffffff" cast={false} />
      <Box p={[-w * 0.25, standing ? 1.6 : 0.15, 0.065]} s={[w * 0.4, 0.04, 0.01]} color={C.accent} cast={false} />
      <Box p={[w * 0.1, standing ? 1.4 : -0.05, 0.065]} s={[w * 0.55, 0.04, 0.01]} color="#3b82f6" cast={false} />
      <Box p={[-w * 0.15, standing ? 1.22 : -0.25, 0.065]} s={[w * 0.35, 0.04, 0.01]} color="#ef4444" cast={false} />
      {standing && (
        <>
          <Box p={[-w / 2, 0.45, 0]} s={[0.06, 0.9, 0.06]} color="#6b7480" />
          <Box p={[w / 2, 0.45, 0]} s={[0.06, 0.9, 0.06]} color="#6b7480" />
          <Box p={[0, 0.06, 0]} s={[w + 0.2, 0.06, 0.4]} color="#6b7480" />
        </>
      )}
    </group>
  );
}

export function CoffeeCorner({ position, rotY = 0 }: { position: V3; rotY?: number }) {
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      <Box p={[0, 0.45, 0]} s={[2.6, 0.9, 0.75]} color="#f1f3f2" />
      <Box p={[0, 0.92, 0]} s={[2.7, 0.06, 0.85]} color="#5b6672" />
      <Box p={[-0.8, 1.2, -0.05]} s={[0.5, 0.5, 0.4]} color="#2f3640" />
      <Box p={[-0.8, 1.18, 0.16]} s={[0.3, 0.2, 0.02]} color={C.accent} cast={false} />
      <mesh position={[0.1, 1.02, 0.1]}><cylinderGeometry args={[0.07, 0.06, 0.12, 12]} /><meshStandardMaterial color="#ffffff" /></mesh>
      <mesh position={[0.4, 1.02, 0.15]}><cylinderGeometry args={[0.07, 0.06, 0.12, 12]} /><meshStandardMaterial color={C.accent} /></mesh>
      <Box p={[1.0, 1.15, 0]} s={[0.55, 0.45, 0.45]} color="#e2e6ea" />
    </group>
  );
}

export function FloorLamp({ position }: { position: V3 }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.03, 0]}><cylinderGeometry args={[0.2, 0.22, 0.06, 16]} /><meshStandardMaterial color="#39404c" /></mesh>
      <mesh position={[0, 0.85, 0]}><cylinderGeometry args={[0.02, 0.02, 1.7, 8]} /><meshStandardMaterial color="#39404c" /></mesh>
      <mesh position={[0, 1.8, 0]}><cylinderGeometry args={[0.2, 0.3, 0.4, 16]} /><meshStandardMaterial color="#fff6dd" emissive="#ffe9a8" emissiveIntensity={0.5} /></mesh>
    </group>
  );
}

export function TrashBin({ position }: { position: V3 }) {
  return (
    <mesh position={[position[0], 0.22, position[2]]} castShadow><cylinderGeometry args={[0.2, 0.16, 0.44, 14]} /><meshStandardMaterial color="#6b7480" /></mesh>
  );
}

export function Frame({ position, rotY = 0, color = "#f3d9a4" }: { position: V3; rotY?: number; color?: string }) {
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      <Box p={[0, 0, 0]} s={[0.9, 0.7, 0.06]} color="#7a4b2a" cast={false} />
      <Box p={[0, 0, 0.04]} s={[0.74, 0.54, 0.02]} color={color} cast={false} />
    </group>
  );
}

export function WallClock({ position, rotY = 0 }: { position: V3; rotY?: number }) {
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.28, 0.28, 0.06, 24]} /><meshStandardMaterial color="#39404c" /></mesh>
      <mesh position={[0, 0, 0.035]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.23, 0.23, 0.02, 24]} /><meshStandardMaterial color="#ffffff" /></mesh>
      <Box p={[0, 0.07, 0.05]} s={[0.025, 0.14, 0.01]} color="#222" cast={false} />
      <Box p={[0.05, 0, 0.05]} s={[0.1, 0.025, 0.01]} color="#222" cast={false} />
    </group>
  );
}
