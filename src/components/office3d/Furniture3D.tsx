"use client";
import { memo, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { DESKS, FURNITURE, Furn, H, W, WALLS } from "@/lib/office2d/layout";
import { getSim } from "@/lib/sim/store";
import { Bx, Chair, Cy, Sp, V3, hash, mat, shade, skyMat } from "./kit";
import { buildFloorTexture } from "./floor";

const TALL = 4.2, LOW = 1.55, BOARD = 2.7;
const wallGrid = (() => { const g = new Uint8Array(W * H); for (const r of WALLS) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) g[y * W + x] = 1; return g; })();
const isWall = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && wallGrid[y * W + x] === 1;
const BOARDS = FURNITURE.filter((f) => f.k === "whiteboard");
const TABLES = FURNITURE.filter((f) => f.k === "table" || f.k === "pingpong");
const cxOf = (f: Furn) => f.x + f.w / 2, czOf = (f: Furn) => f.y + f.h / 2;

/** Sisi depan perabot yang menempel dinding: menghadap menjauhi dinding (+1 = selatan, -1 = utara). */
function frontOf(f: Furn): 1 | -1 {
  let north = false, south = false;
  for (let x = f.x; x < f.x + f.w; x++) { if (isWall(x, f.y - 1)) north = true; if (isWall(x, f.y + f.h)) south = true; }
  return north && !south ? 1 : south && !north ? -1 : 1;
}

// ── tekstur kecil yang digambar sekali ──
const texCache = new Map<string, THREE.CanvasTexture>();
function canvasTex(key: string, w: number, h: number, draw: (c: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  let t = texCache.get(key);
  if (!t) {
    const cv = document.createElement("canvas"); cv.width = w; cv.height = h; draw(cv.getContext("2d")!);
    t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; texCache.set(key, t);
  }
  return t;
}
const BOOKS = ["#c0392b", "#2e86c1", "#27ae60", "#f39c12", "#8e44ad", "#16a085", "#d35400", "#34495e", "#e8d9b5"];
const bookTex = (w: number) => canvasTex(`books${w}`, w * 48, 120, (c) => {
  c.fillStyle = "#6a4528"; c.fillRect(0, 0, w * 48, 120);
  for (let r = 0; r < 3; r++) {
    c.fillStyle = "#a9794a"; c.fillRect(0, r * 40 + 36, w * 48, 4);
    let x = 3;
    while (x < w * 48 - 8) { const bw = 5 + Math.floor(hash(x, r) * 7), bh = 24 + Math.floor(hash(r, x) * 10); c.fillStyle = BOOKS[Math.floor(hash(x + 3, r + 9) * BOOKS.length)]; c.fillRect(x, r * 40 + 36 - bh, bw, bh); x += bw + 1; }
  }
});
const ledTex = (variant: number) => canvasTex(`led${variant}`, 64, 160, (c) => {
  c.fillStyle = "#1d222d"; c.fillRect(0, 0, 64, 160);
  for (let r = 0; r < 9; r++) {
    c.fillStyle = "#2b3140"; c.fillRect(4, 6 + r * 17, 56, 13);
    for (let i = 0; i < 4; i++) { c.fillStyle = hash(r + variant * 11, i) > 0.5 ? "#32e08a" : hash(r, i + 4) > 0.6 ? "#4aa3ff" : "#f5a524"; c.fillRect(8 + i * 6, 10 + r * 17, 3, 3); }
    c.fillStyle = "#12151c"; c.fillRect(34, 9 + r * 17, 22, 2); c.fillRect(34, 13 + r * 17, 22, 2);
  }
});
const boardTex = canvasTex("board", 256, 64, (c) => {
  c.fillStyle = "#fafafa"; c.fillRect(0, 0, 256, 64);
  c.strokeStyle = "#2563eb"; c.lineWidth = 3; c.beginPath(); c.moveTo(14, 18); c.lineTo(110, 18); c.moveTo(14, 32); c.lineTo(150, 32); c.moveTo(14, 46); c.lineTo(90, 46); c.stroke();
  c.strokeStyle = "#dc2626"; c.beginPath(); c.arc(200, 32, 18, 0, 6.3); c.stroke();
});
const boardLive = canvasTex("boardLive", 256, 64, (c) => {
  c.fillStyle = "#cfe6ff"; c.fillRect(0, 0, 256, 64);
  c.fillStyle = "#2563eb"; for (let i = 0; i < 4; i++) c.fillRect(14, 10 + i * 12, 60 + hash(i, 4) * 130, 5);
});
const paintTex = canvasTex("paint", 128, 64, (c) => {
  c.fillStyle = "#f7efe0"; c.fillRect(0, 0, 128, 64);
  c.fillStyle = "#7fb7a4"; c.fillRect(8, 8, 112, 48); c.fillStyle = "#e8a87c"; c.beginPath(); c.arc(40, 30, 14, 0, 6.3); c.fill();
  c.fillStyle = "#355c7d"; c.beginPath(); c.moveTo(8, 56); c.lineTo(60, 24); c.lineTo(120, 56); c.fill();
});

// ── perabot ──────────────────────────────────────────────────────────────────────────────────────────────
function Desk({ f }: { f: Furn }) {
  const top = f.dark ? "#3a3f4b" : "#e2cba6", leg = f.dark ? "#22262f" : "#8b6b4b";
  return (
    <group position={[cxOf(f), 0, czOf(f)]}>
      <Bx at={[0, 1.08, 0]} s={[f.w, 0.12, f.h]} c={top} />
      {([[-1, -1], [1, -1], [-1, 1], [1, 1]] as const).map(([sx, sz], i) => <Bx key={i} at={[sx * (f.w / 2 - 0.12), 0, sz * (f.h / 2 - 0.12)]} s={[0.1, 1.08, 0.1]} c={leg} />)}
      <Bx at={[f.w / 2 - 0.65, 0.2, 0]} s={[1.0, 0.85, f.h - 0.3]} c={shade(top, 0.9)} />
      <Bx at={[f.w / 2 - 0.65, 0.5, 0]} s={[0.96, 0.03, f.h - 0.26]} c={shade(top, 0.7)} />
    </group>
  );
}

function PlantMesh({ f, i }: { f: Furn; i: number }) {
  const g = useRef<THREE.Group>(null);
  useFrame(() => { if (g.current) g.current.rotation.z = Math.sin(getSim().t * 1.3 + i) * 0.03; });
  const lean = hash(f.x, f.y);
  return (
    <group position={[cxOf(f), 0, czOf(f)]}>
      <Cy at={[0, 0, 0]} s={[0.7, 0.6, 0.7]} c="#c47a4e" />
      <group ref={g} position={[0, 0.6, 0]}>
        <Cy at={[0, 0, 0]} s={[0.1, 0.8, 0.1]} c="#6b4a2b" />
        <Sp at={[0, 1.0, 0]} s={[1.0, 0.85, 1.0]} c="#3f9b5f" />
        <Sp at={[0.3 * (lean - 0.5) * 2, 1.45, 0.1]} s={[0.7, 0.6, 0.7]} c="#4fb36f" />
        <Sp at={[-0.22, 0.75, 0.28]} s={[0.55, 0.5, 0.55]} c="#2f8a52" />
      </group>
    </group>
  );
}

function Sofa({ f }: { f: Furn }) {
  const c = f.c ?? "#3d5a73";
  let near: Furn | null = null, nd = 99;
  for (const t of TABLES) { const d = Math.hypot(cxOf(t) - cxOf(f), czOf(t) - czOf(f)); if (d < nd) { nd = d; near = t; } }
  const back = near && czOf(near) < czOf(f) ? 1 : -1; // +1 = sandaran di selatan
  const d = f.h;
  return (
    <group position={[cxOf(f), 0, czOf(f)]}>
      <Bx at={[0, 0, 0]} s={[f.w, 0.55, d]} c={shade(c, 0.85)} />
      <Bx at={[0, 0.55, -back * 0.18]} s={[f.w - 0.9, 0.22, d - 0.6]} c={shade(c, 1.15)} />
      <Bx at={[0, 0.2, back * (d / 2 - 0.25)]} s={[f.w, 1.15, 0.5]} c={c} />
      <Bx at={[-(f.w / 2 - 0.22), 0.2, 0]} s={[0.44, 0.9, d]} c={shade(c, 0.95)} />
      <Bx at={[f.w / 2 - 0.22, 0.2, 0]} s={[0.44, 0.9, d]} c={shade(c, 0.95)} />
    </group>
  );
}

function Shelf({ f }: { f: Furn }) {
  const s = frontOf(f);
  const m = useMemo(() => new THREE.MeshLambertMaterial({ map: bookTex(f.w) }), [f.w]);
  return (
    <group position={[cxOf(f), 0, czOf(f)]}>
      <Bx at={[0, 0, 0]} s={[f.w, 2.7, 0.9]} c="#6a4528" />
      <mesh material={m} position={[0, 1.35, s * 0.455]} rotation={[0, s > 0 ? 0 : Math.PI, 0]}><planeGeometry args={[f.w - 0.1, 2.5]} /></mesh>
    </group>
  );
}

function Table({ f }: { f: Furn }) {
  const c = f.c ?? "#8a5a3b";
  return (
    <group position={[cxOf(f), 0, czOf(f)]}>
      <Bx at={[0, 0.98, 0]} s={[f.w, 0.14, f.h]} c={c} />
      {([[-1, -1], [1, -1], [-1, 1], [1, 1]] as const).map(([sx, sz], i) => <Bx key={i} at={[sx * (f.w / 2 - 0.14), 0, sz * (f.h / 2 - 0.14)]} s={[0.12, 0.98, 0.12]} c={shade(c, 0.7)} />)}
    </group>
  );
}

function PingPong({ f }: { f: Furn }) {
  return (
    <group position={[cxOf(f), 0, czOf(f)]}>
      <Bx at={[0, 1.0, 0]} s={[f.w, 0.14, f.h]} c="#2f7d57" />
      <Bx at={[0, 1.14, 0]} s={[f.w - 0.2, 0.01, 0.06]} c="#ffffff" />
      <Bx at={[0, 1.14, 0]} s={[0.06, 0.01, f.h - 0.2]} c="#ffffff" />
      <Bx at={[0, 1.14, 0]} s={[0.05, 0.42, f.h + 0.15]} m={mat("#f5f5f5", { a: 0.7 })} />
      {([[-1, -1], [1, -1], [-1, 1], [1, 1]] as const).map(([sx, sz], i) => <Bx key={i} at={[sx * (f.w / 2 - 0.3), 0, sz * (f.h / 2 - 0.25)]} s={[0.14, 1.0, 0.14]} c="#2a2f3a" />)}
    </group>
  );
}

function Aquarium({ f }: { f: Furn }) {
  const fish = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(() => {
    const t = getSim().t;
    fish.current.forEach((m, i) => { if (!m) return; const k = (t * (0.18 + i * 0.07) + i * 0.37) % 1; m.position.set(-1.6 + 3.2 * (i % 2 ? 1 - k : k), 1.55 + Math.sin(t + i * 2) * 0.15, 0.1 * (i - 1)); m.rotation.y = i % 2 ? Math.PI : 0; });
  });
  return (
    <group position={[cxOf(f), 0, czOf(f)]}>
      <Bx at={[0, 0, 0]} s={[f.w, 0.95, 0.95]} c="#2b3a4a" />
      <Bx at={[0, 0.95, 0]} s={[f.w - 0.2, 1.2, 0.8]} m={mat("#7fd0ef", { a: 0.45, e: "#2a8fc2", ei: 0.35 })} />
      <Bx at={[0, 0.95, 0]} s={[f.w - 0.25, 0.12, 0.75]} c="#e8d9a8" />
      {[0, 1, 2, 3].map((i) => <mesh key={i} ref={(n) => { fish.current[i] = n; }} geometry={new THREE.BoxGeometry(0.28, 0.14, 0.08)} material={mat(i % 2 ? "#ff8a3d" : "#ffd23d", { e: "#ff7a20", ei: 0.25 })} />)}
    </group>
  );
}

function Cooler({ f, idx }: { f: Furn; idx: number }) {
  const water = useRef<THREE.Mesh>(null);
  useFrame(() => { if (water.current) { const l = Math.max(0.05, getSim().waterLevel); water.current.scale.y = 0.62 * l; water.current.position.y = 1.34 + 0.31 * l; } });
  void idx;
  return (
    <group position={[cxOf(f), 0, czOf(f)]}>
      <Bx at={[0, 0, 0]} s={[0.7, 1.3, 0.7]} c="#e8eef2" />
      <Bx at={[0, 0.7, 0.36]} s={[0.4, 0.14, 0.06]} c="#3a7bd5" />
      <Bx at={[0, 0.5, 0.36]} s={[0.3, 0.1, 0.06]} c="#e0584a" />
      <Cy at={[0, 1.3, 0]} s={[0.55, 0.7, 0.55]} m={mat("#a9d7f5", { a: 0.4 })} />
      <mesh ref={water} geometry={new THREE.CylinderGeometry(0.5, 0.5, 1, 12)} material={mat("#4aa3e8", { a: 0.8 })} position={[0, 1.65, 0]} scale={[0.5, 0.6, 0.5]} />
    </group>
  );
}

function Server({ f, i }: { f: Furn; i: number }) {
  const s = frontOf(f);
  const m = useMemo(() => new THREE.MeshBasicMaterial({ map: ledTex(i % 3), toneMapped: false }), [i]);
  return (
    <group position={[cxOf(f), 0, czOf(f)]}>
      <Bx at={[0, 0, 0]} s={[0.92, 2.7, 1.85]} c="#2a2f3a" />
      <mesh material={m} position={[0, 1.35, s * 0.93]} rotation={[0, s > 0 ? 0 : Math.PI, 0]}><planeGeometry args={[0.84, 2.5]} /></mesh>
    </group>
  );
}

function Cabinet({ f }: { f: Furn }) {
  const s = frontOf(f);
  return (
    <group position={[cxOf(f), 0, czOf(f)]}>
      <Bx at={[0, 0, 0]} s={[f.w, 1.7, 0.95]} c="#9aa5b1" />
      {Array.from({ length: f.w }, (_, i) => (
        <group key={i} position={[-f.w / 2 + i + 0.5, 0, s * 0.48]}>
          {[0, 1, 2].map((r) => (
            <group key={r}>
              <Bx at={[0, 0.1 + r * 0.55, 0]} s={[0.92, 0.5, 0.03]} c="#b6c0cb" />
              <Bx at={[0, 0.3 + r * 0.55, s * 0.03]} s={[0.35, 0.05, 0.04]} c="#4b5563" />
            </group>
          ))}
        </group>
      ))}
    </group>
  );
}

function Counter({ f }: { f: Furn }) {
  const s = frontOf(f);
  return (
    <group position={[cxOf(f), 0, czOf(f)]}>
      <Bx at={[0, 0, 0]} s={[f.w, 1.15, 0.95]} c="#f1e9da" />
      <Bx at={[0, 1.15, 0]} s={[f.w + 0.04, 0.1, 1.05]} c="#8a6a4a" />
      {Array.from({ length: f.w }, (_, i) => <Bx key={i} at={[-f.w / 2 + i + 0.5, 0.1, s * 0.48]} s={[0.9, 0.95, 0.03]} c={i % 2 ? "#e3d8c3" : "#eadfc8"} />)}
      {f.w >= 6 && (
        <>
          <Bx at={[-f.w / 2 + 1.2, 1.25, 0]} s={[0.7, 0.8, 0.5]} c="#2b2f3a" />
          <Bx at={[-f.w / 2 + 1.2, 1.55, s * 0.26]} s={[0.4, 0.08, 0.04]} c="#e0584a" />
          <Bx at={[-f.w / 2 + 3, 1.25, 0.05]} s={[0.95, 0.5, 0.6]} c="#d6dae0" />
          <Cy at={[-f.w / 2 + 4.6, 1.25, 0]} s={[0.3, 0.35, 0.3]} c="#f6f6f6" />
        </>
      )}
    </group>
  );
}

function Fridge({ f }: { f: Furn }) {
  return (
    <group position={[cxOf(f), 0, czOf(f)]}>
      <Bx at={[0, 0, 0]} s={[0.92, 2.7, 1.8]} c="#eef2f4" />
      <Bx at={[0, 1.55, 0.92]} s={[0.9, 0.03, 0.02]} c="#b8c2c9" />
      <Bx at={[0.3, 1.7, 0.94]} s={[0.06, 0.5, 0.05]} c="#8a949c" />
      <Bx at={[0.3, 0.7, 0.94]} s={[0.06, 0.6, 0.05]} c="#8a949c" />
    </group>
  );
}

function Printer({ f }: { f: Furn }) {
  return (
    <group position={[cxOf(f), 0, czOf(f)]}>
      <Bx at={[0, 0, 0]} s={[f.w, 0.95, 0.95]} c="#d9dde3" />
      <Bx at={[0, 0.95, -0.1]} s={[f.w - 0.3, 0.14, 0.6]} c="#aab2bd" />
      <Bx at={[0.5, 0.95, 0.25]} s={[0.5, 0.05, 0.3]} c="#2b2f3a" />
      <Bx at={[0, 0.5, 0.48]} s={[1.2, 0.08, 0.04]} c="#7b8491" />
    </group>
  );
}

function Beanbag({ f }: { f: Furn }) {
  return <Sp at={[cxOf(f), 0.32, czOf(f)]} s={[0.95, 0.65, 0.95]} c={f.c ?? "#4aa3e8"} />;
}

function Sink({ f }: { f: Furn }) {
  return (
    <group position={[cxOf(f), 0, czOf(f)]}>
      <Bx at={[0, 0, 0]} s={[f.w, 1.1, 0.9]} c="#e9eef0" />
      <Bx at={[0, 1.1, 0]} s={[f.w + 0.02, 0.1, 1.0]} c="#c9d3d6" />
      <Bx at={[0, 1.2, 0.05]} s={[0.9, 0.03, 0.55]} c="#8fb8d4" />
      <Cy at={[0, 1.2, -0.3]} s={[0.08, 0.35, 0.08]} c="#9ca3af" />
      <Bx at={[0, 1.6, -0.46]} s={[f.w - 0.3, 1.2, 0.04]} m={mat("#d5eef7", { a: 0.9, e: "#9fd1e6", ei: 0.25 })} />
    </group>
  );
}

function Stall({ f }: { f: Furn }) {
  const ind = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const occ = getSim().agents.some((a) => a.mode === "do" && a.doKind === "toilet" && a.spot && a.spot[0] >= f.x && a.spot[0] < f.x + f.w);
    if (ind.current) ind.current.material = occ ? mat("#ff4d4d", { e: "#ff2a2a", ei: 1 }) : mat("#35d07f", { e: "#20b060", ei: 0.8 });
  });
  const c = "#8db6d4", d = 2.0;
  return (
    <group position={[cxOf(f), 0, czOf(f)]}>
      <Bx at={[0, 0, -f.h / 2 + 0.04]} s={[f.w, d, 0.08]} c={c} />
      <Bx at={[-f.w / 2 + 0.04, 0, 0]} s={[0.08, d, f.h]} c={c} />
      <Bx at={[f.w / 2 - 0.04, 0, 0]} s={[0.08, d, f.h]} c={c} />
      <Bx at={[0, 0.2, f.h / 2 - 0.04]} s={[f.w - 0.1, d - 0.35, 0.08]} c={shade(c, 1.1)} />
      <mesh ref={ind} geometry={new THREE.BoxGeometry(0.25, 0.14, 0.04)} material={mat("#35d07f", { e: "#20b060", ei: 0.8 })} position={[0, 1.55, f.h / 2 + 0.02]} />
      <Bx at={[0, 0, -f.h / 2 + 0.6]} s={[0.7, 0.55, 0.75]} c="#f4f6f7" />
      <Bx at={[0, 0.55, -f.h / 2 + 0.3]} s={[0.7, 0.55, 0.22]} c="#f4f6f7" />
    </group>
  );
}

function Painting({ f }: { f: Furn }) {
  const m = useMemo(() => new THREE.MeshLambertMaterial({ map: paintTex }), []);
  return (
    <group position={[cxOf(f), 0, czOf(f)]}>
      <Bx at={[-f.w / 2 + 0.2, 0, 0]} s={[0.08, 1.2, 0.5]} c="#6a4528" />
      <Bx at={[f.w / 2 - 0.2, 0, 0]} s={[0.08, 1.2, 0.5]} c="#6a4528" />
      <Bx at={[0, 1.0, 0]} s={[f.w, 1.1, 0.1]} c="#6a4528" />
      <mesh material={m} position={[0, 1.55, 0.055]}><planeGeometry args={[f.w - 0.2, 0.9]} /></mesh>
    </group>
  );
}

function Whiteboard({ f }: { f: Furn }) {
  const face = useRef<THREE.Mesh>(null);
  const idle = useMemo(() => new THREE.MeshBasicMaterial({ map: boardTex, toneMapped: false }), []);
  const live = useMemo(() => new THREE.MeshBasicMaterial({ map: boardLive, toneMapped: false }), []);
  useFrame(() => { if (face.current) face.current.material = getSim().meetingActive ? live : idle; });
  return (
    <group position={[cxOf(f), 0, f.y + 1.0]}>
      <Bx at={[0, 1.15, 0.03]} s={[f.w - 0.2, 1.3, 0.06]} c="#c9ced6" />
      <mesh ref={face} material={idle} position={[0, 1.8, 0.07]}><planeGeometry args={[f.w - 0.4, 1.1]} /></mesh>
    </group>
  );
}

function Window({ f }: { f: Furn }) {
  const z = f.y + 1; // sisi dalam dinding utara
  return (
    <group position={[cxOf(f), 0, z]}>
      <Bx at={[0, 1.25, 0.04]} s={[f.w - 0.1, 2.2, 0.08]} c="#fbfaf6" />
      <mesh material={skyMat} position={[0, 2.35, 0.085]}><planeGeometry args={[f.w - 0.5, 1.8]} /></mesh>
      <Bx at={[0, 1.45, 0.1]} s={[0.08, 1.8, 0.04]} c="#fbfaf6" />
      <Bx at={[0, 2.28, 0.1]} s={[f.w - 0.5, 0.07, 0.04]} c="#fbfaf6" />
      <Bx at={[0, 1.2, 0.2]} s={[f.w, 0.1, 0.3]} c="#e9e2d2" />
    </group>
  );
}

function ChairF({ f }: { f: Furn }) {
  let near: Furn | null = null, nd = 99;
  for (const t of TABLES) { const d = Math.hypot(cxOf(t) - cxOf(f), czOf(t) - czOf(f)); if (d < nd) { nd = d; near = t; } }
  let back: "n" | "s" | "e" | "w" = "n";
  if (near) {
    const dx = cxOf(near) - cxOf(f), dz = czOf(near) - czOf(f);
    back = Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? "w" : "e") : dz > 0 ? "n" : "s";
  }
  return <Chair x={cxOf(f)} z={czOf(f)} back={back} c={f.c ?? "#44546a"} />;
}

function Bench({ f }: { f: Furn }) {
  return <Bx at={[cxOf(f), 0, czOf(f)]} s={[f.w, 0.6, f.h]} c={f.c ?? "#8a6a4a"} />;
}

function furnitureEl(f: Furn, i: number, coolerIdx: { n: number }) {
  switch (f.k) {
    case "desk": return <Desk key={i} f={f} />;
    case "plant": return <PlantMesh key={i} f={f} i={i} />;
    case "sofa": return <Sofa key={i} f={f} />;
    case "shelf": return <Shelf key={i} f={f} />;
    case "table": return <Table key={i} f={f} />;
    case "pingpong": return <PingPong key={i} f={f} />;
    case "aquarium": return <Aquarium key={i} f={f} />;
    case "cooler": return <Cooler key={i} f={f} idx={coolerIdx.n++} />;
    case "server": return <Server key={i} f={f} i={i} />;
    case "cabinet": return <Cabinet key={i} f={f} />;
    case "counter": return <Counter key={i} f={f} />;
    case "beanbag": return <Beanbag key={i} f={f} />;
    case "painting": return <Painting key={i} f={f} />;
    case "fridge": return <Fridge key={i} f={f} />;
    case "printer": return <Printer key={i} f={f} />;
    case "bench": return <Bench key={i} f={f} />;
    case "window": return <Window key={i} f={f} />;
    case "whiteboard": return <Whiteboard key={i} f={f} />;
    case "chair": return <ChairF key={i} f={f} />;
    case "sink": return <Sink key={i} f={f} />;
    case "stall": return <Stall key={i} f={f} />;
    default: return null;
  }
}

/** Kursi dan perlengkapan meja kerja (keyboard, mouse) — layar monitor ada di Dynamic3D. */
export function deskSeat(d: { x: number; y: number; dir: "up" | "down" }): V3 {
  return [d.x + 2, 0, d.dir === "up" ? d.y + 2.6 : d.y - 0.6];
}

function DeskGear() {
  return (
    <>
      {DESKS.map((d, i) => {
        const [sx, , sz] = deskSeat(d);
        const up = d.dir === "up";
        return (
          <group key={i}>
            <Chair x={sx} z={sz} back={up ? "s" : "n"} c={d.dark ? "#2f3542" : "#44546a"} />
            <Bx at={[d.x + 2, 1.14, d.y + (up ? 1.55 : 0.45)]} s={[1.15, 0.06, 0.38]} c="#2f3542" />
            <Bx at={[d.x + 2.95, 1.14, d.y + (up ? 1.55 : 0.45)]} s={[0.2, 0.05, 0.3]} c="#2f3542" />
          </group>
        );
      })}
    </>
  );
}

function Walls() {
  return (
    <>
      {WALLS.map((r, i) => {
        const tall = r.y === 0 && r.h === 1 || r.x === 6 && r.w === 1;
        const board = !tall && BOARDS.some((b) => b.x < r.x + r.w && b.x + b.w > r.x && b.y < r.y + r.h && b.y + b.h > r.y);
        const h = tall ? TALL : board ? BOARD : LOW;
        const cx = r.x + r.w / 2, cz = r.y + r.h / 2;
        return (
          <group key={i}>
            <Bx at={[cx, 0, cz]} s={[r.w, h, r.h]} c={tall ? "#f4efe6" : "#eee8dc"} />
            <Bx at={[cx, h, cz]} s={[r.w + 0.02, 0.1, r.h + 0.02]} c={tall ? "#d9d0bf" : "#c4b8a3"} />
            <Bx at={[cx, 0, cz]} s={[r.w + 0.02, 0.18, r.h + 0.02]} c="#cfc6b2" />
          </group>
        );
      })}
    </>
  );
}

/** Seluruh bagian statis kantor (tidak pernah dirender ulang): tanah, lantai, dinding, perabot. */
export const StaticWorld = memo(function StaticWorld() {
  const floor = useMemo(() => buildFloorTexture(), []);
  const cooler = { n: 0 };
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[W / 2, -0.06, H / 2]}><planeGeometry args={[260, 260]} /><meshLambertMaterial color="#a3cf90" /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[W / 2, 0, H / 2]}><planeGeometry args={[W, H]} /><meshLambertMaterial map={floor} /></mesh>
      <Walls />
      {FURNITURE.map((f, i) => furnitureEl(f, i, cooler))}
      <DeskGear />
    </group>
  );
});
