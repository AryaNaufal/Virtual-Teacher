import { DESKS, Door, FURNITURE, Furn, H, ROOMS, T, W, WALLS, WORLD_H, WORLD_W, FloorKind } from "./layout";
import type { Pose } from "../sim/engine";

type Ctx = CanvasRenderingContext2D;
const OUT = "#2d2a45";

const rect = (c: Ctx, x: number, y: number, w: number, h: number, fill: string) => { c.fillStyle = fill; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
/** Persegi berkontur 1px (kesan pixel-art). */
const box = (c: Ctx, x: number, y: number, w: number, h: number, fill: string, out = OUT) => { rect(c, x - 1, y - 1, w + 2, h + 2, out); rect(c, x, y, w, h, fill); };
const hash = (x: number, y: number) => { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >> 13)) * 1274126177; return ((h ^ (h >> 16)) >>> 0) / 4294967295; };

// ── lantai ────────────────────────────────────────────────────────────────────
function floor(c: Ctx, x: number, y: number, w: number, h: number, kind: FloorKind) {
  const X = x * T, Y = y * T, Wp = w * T, Hp = h * T;
  if (kind === "wood" || kind === "woodDark") {
    const [a, b, seam] = kind === "wood" ? ["#e6c597", "#dcb88a", "#c9a273"] : ["#d2a572", "#c99c68", "#b08455"];
    for (let r = 0; r < Hp / 8; r++) {
      rect(c, X, Y + r * 8, Wp, 8, r % 2 ? a : b);
      rect(c, X, Y + r * 8 + 7, Wp, 1, seam);
      for (let s = ((r * 13) % 32); s < Wp; s += 32) rect(c, X + s, Y + r * 8, 1, 8, seam);
    }
  } else if (kind === "tile") {
    for (let ty = 0; ty < Hp / 8; ty++) for (let tx = 0; tx < Wp / 8; tx++) rect(c, X + tx * 8, Y + ty * 8, 8, 8, (tx + ty) % 2 ? "#e2e7ee" : "#eef1f5");
  } else if (kind === "carpetGrey" || kind === "carpetPurple") {
    const [a, b, edge] = kind === "carpetGrey" ? ["#9ca1a8", "#939aa2", "#7c828b"] : ["#7469c4", "#6a5fba", "#51479a"];
    for (let ty = 0; ty < Hp / 4; ty++) for (let tx = 0; tx < Wp / 4; tx++) rect(c, X + tx * 4, Y + ty * 4, 4, 4, (tx + ty) % 2 ? a : b);
    rect(c, X, Y, Wp, 1, edge); rect(c, X, Y + Hp - 1, Wp, 1, edge); rect(c, X, Y, 1, Hp, edge); rect(c, X + Wp - 1, Y, 1, Hp, edge);
  } else {
    rect(c, X, Y, Wp, Hp, "#eadcf3");
    for (let i = 0; i < Wp; i += 6) rect(c, X + i, Y + 2, 3, 1, "#d9c2e8");
    rect(c, X, Y, Wp, 2, "#c9a8dc"); rect(c, X, Y + Hp - 2, Wp, 2, "#c9a8dc"); rect(c, X, Y, 2, Hp, "#c9a8dc"); rect(c, X + Wp - 2, Y, 2, Hp, "#c9a8dc");
  }
}

// ── pohon & rumput ───────────────────────────────────────────────────────────
function tree(c: Ctx, px: number, py: number, s = 1) {
  rect(c, px - 3 * s, py + 14 * s, 6 * s, 12 * s, "#7a4e2d"); rect(c, px - 3 * s, py + 14 * s, 2 * s, 12 * s, "#935f37");
  const blobs: [number, number, number, string][] = [[0, 6, 20, "#2f8f4a"], [-10, 12, 14, "#3aa357"], [10, 12, 14, "#3aa357"], [0, -2, 14, "#47b563"]];
  for (const [dx, dy, r, col] of blobs) { rect(c, px + (dx - r / 2) * s - 1, py + (dy - r / 2) * s - 1, r * s + 2, r * s + 2, "#226c37"); rect(c, px + (dx - r / 2) * s, py + (dy - r / 2) * s, r * s, r * s, col); }
  rect(c, px - 6 * s, py - 2 * s, 4 * s, 3 * s, "#6fd18a");
}

// ── perabot ──────────────────────────────────────────────────────────────────
const DRAW: Record<string, (c: Ctx, f: Furn, x: number, y: number, w: number, h: number) => void> = {
  desk: (c, f, x, y, w, h) => {
    const top = f.dark ? "#6b4a3a" : "#f6f6f8", edge = f.dark ? "#4e3328" : "#c9ccd6";
    box(c, x + 1, y + 1, w - 2, h - 2, top); rect(c, x + 1, y + h - 5, w - 2, 3, edge);
  },
  plant: (c, f, x, y) => {
    rect(c, x + 4, y + 10, 8, 6, OUT); rect(c, x + 5, y + 10, 6, 5, "#c9784a");
    for (const [dx, dy, r, col] of [[3, 4, 7, "#2f9e63"], [8, 2, 7, "#45c07c"], [6, 7, 6, "#38a96b"]] as [number, number, number, string][]) { rect(c, x + dx - 1, y + dy - 1, r + 2, r + 2, "#1f6b4a"); rect(c, x + dx, y + dy, r, r, col); }
  },
  sofa: (c, f, x, y, w, h) => {
    const col = f.c ?? "#e8926b";
    box(c, x + 1, y + 1, w - 2, h - 2, col); rect(c, x + 1, y + 1, w - 2, 5, "rgba(0,0,0,0.18)"); rect(c, x + 1, y + 1, 4, h - 2, "rgba(0,0,0,0.12)"); rect(c, x + w - 5, y + 1, 4, h - 2, "rgba(0,0,0,0.12)");
    for (let i = 10; i < w - 6; i += 12) rect(c, x + i, y + 7, 1, h - 10, "rgba(0,0,0,0.15)");
  },
  shelf: (c, f, x, y, w, h) => {
    box(c, x + 1, y + 1, w - 2, h - 2, "#b88a5a"); rect(c, x + 3, y + 3, w - 6, h - 6, "#8a6240");
    const cols = ["#3b6fb6", "#e2e8f0", "#c94f4f", "#e0a15a", "#475569", "#6bbf8a"];
    for (let i = 0, k = 0; i < w - 8; i += 3, k++) { const bh = h - 9 - ((k * 7) % 4); rect(c, x + 4 + i, y + h - 4 - bh, 2, bh, cols[k % cols.length]); }
  },
  table: (c, f, x, y, w, h) => { box(c, x + 1, y + 1, w - 2, h - 2, f.c ?? "#f1e4cf"); rect(c, x + 1, y + h - 5, w - 2, 3, "rgba(0,0,0,0.15)"); },
  pingpong: (c, f, x, y, w, h) => {
    box(c, x + 2, y + 3, w - 4, h - 6, "#2e8b57"); rect(c, x + 4, y + 5, w - 8, 1, "#ffffff"); rect(c, x + 4, y + h - 7, w - 8, 1, "#ffffff");
    rect(c, x + w / 2 - 1, y + 3, 2, h - 6, "#ffffff"); rect(c, x + w / 2, y + 3, 1, h - 6, "#9dd9b5");
    rect(c, x + 8, y + 7, 3, 3, "#e84c4c"); rect(c, x + w - 12, y + h - 11, 3, 3, "#3b6fb6");
  },
  aquarium: (c, f, x, y, w, h) => {
    box(c, x + 1, y + 1, w - 2, h - 2, "#5cc8f0"); rect(c, x + 3, y + 3, w - 6, 3, "#9be0f7");
    for (let i = 0; i < 4; i++) { const fx = x + 8 + i * ((w - 20) / 3); rect(c, fx, y + 8 + (i % 2) * 3, 5, 3, i % 2 ? "#ffb347" : "#ff6f91"); rect(c, fx + 5, y + 9 + (i % 2) * 3, 2, 1, i % 2 ? "#ffb347" : "#ff6f91"); }
    rect(c, x + 3, y + h - 5, w - 6, 3, "#e5d29b");
  },
  cooler: (c, f, x, y) => { box(c, x + 3, y + 5, 10, 11, "#f4f6f8"); rect(c, x + 4, y + 0, 8, 6, "#7fd0ff"); rect(c, x + 5, y + 1, 2, 4, "#c4ecff"); rect(c, x + 7, y + 9, 3, 2, "#2b8be0"); },
  server: (c, f, x, y, w, h) => {
    box(c, x + 1, y + 1, w - 2, h - 2, "#2b2f3a"); for (let i = 4; i < h - 4; i += 5) { rect(c, x + 3, y + i, w - 6, 3, "#3d4252"); rect(c, x + 4, y + i + 1, 1, 1, (i / 5) % 2 ? "#4cf08a" : "#4aa3e8"); }
  },
  cabinet: (c, f, x, y, w, h) => {
    box(c, x + 1, y + 1, w - 2, h - 2, "#aeb7c2"); for (let i = 16; i < w - 2; i += 16) rect(c, x + i, y + 1, 1, h - 2, "#7c8591");
    for (let i = 0; i < w; i += 16) { rect(c, x + i + 4, y + 5, 8, 2, "#59616d"); rect(c, x + i + 4, y + h - 8, 8, 2, "#59616d"); }
  },
  counter: (c, f, x, y, w, h) => { box(c, x + 1, y + 1, w - 2, h - 2, "#f1f3f2"); rect(c, x + 1, y + 1, w - 2, 5, "#c9b79c"); rect(c, x + 6, y + 2, 7, 3, "#9fb7c9"); rect(c, x + w - 18, y + 1, 6, 5, "#2f3640"); rect(c, x + w - 17, y + 2, 2, 1, "#3ddc97"); },
  fridge: (c, f, x, y, w, h) => { box(c, x + 1, y + 1, w - 2, h - 2, "#e8edf2"); rect(c, x + 1, y + h / 2, w - 2, 1, "#9aa6b2"); rect(c, x + w - 5, y + 6, 1, 6, "#6b7480"); rect(c, x + w - 5, y + h / 2 + 4, 1, 6, "#6b7480"); },
  printer: (c, f, x, y, w, h) => { box(c, x + 1, y + 3, w - 2, h - 5, "#e8ebef"); rect(c, x + 4, y + 0, w - 8, 4, "#ffffff"); rect(c, x + 4, y + 7, w - 8, 2, "#3b4350"); rect(c, x + w - 8, y + 5, 2, 1, "#3ddc97"); },
  beanbag: (c, f, x, y) => { const col = f.c ?? "#4aa3e8"; rect(c, x + 1, y + 3, 14, 12, OUT); rect(c, x + 3, y + 1, 10, 16, OUT); rect(c, x + 2, y + 3, 12, 11, col); rect(c, x + 4, y + 2, 8, 13, col); rect(c, x + 5, y + 4, 3, 2, "rgba(255,255,255,0.35)"); },
  painting: (c, f, x, y, w, h) => { box(c, x + 2, y + 3, w - 4, h - 6, "#7a4b2a"); rect(c, x + 4, y + 5, w - 8, h - 10, "#f3d9a4"); rect(c, x + 6, y + 7, (w - 12) / 2, h - 14, "#e07a5f"); rect(c, x + w / 2, y + 8, (w - 12) / 2, h - 16, "#3d405b"); },
  bench: (c, f, x, y, w, h) => { box(c, x + 1, y + 4, w - 2, h - 8, "#b88a5a"); rect(c, x + 1, y + 4, w - 2, 3, "#d2a572"); },
  window: (c, f, x, y, w, h) => { box(c, x + 2, y + 2, w - 4, h - 4, "#bfe6ff"); rect(c, x + w / 2 - 1, y + 2, 2, h - 4, "#6b7a99"); rect(c, x + 2, y + h / 2 - 1, w - 4, 2, "#6b7a99"); rect(c, x + 4, y + 4, 5, 2, "rgba(255,255,255,0.6)"); },
  whiteboard: (c, f, x, y, w, h) => { box(c, x + 2, y + 2, w - 4, h - 4, "#ffffff"); rect(c, x + 6, y + 6, w * 0.35, 1, "#3ddc97"); rect(c, x + 6, y + 9, w * 0.5, 1, "#3b82f6"); rect(c, x + 6, y + 12, w * 0.25, 1, "#ef4444"); },
  sink: (c, f, x, y, w, h) => { box(c, x + 1, y + 2, w - 2, h - 4, "#e8edf2"); rect(c, x + 4, y + 5, 8, 5, "#9ad3f0"); rect(c, x + 7, y + 3, 2, 3, "#6b7480"); rect(c, x + w - 12, y + 5, 8, 5, "#9ad3f0"); rect(c, x + w - 9, y + 3, 2, 3, "#6b7480"); },
  stall: (c, f, x, y, w, h) => {
    box(c, x + 1, y + 1, w - 2, h - 2, "#cfd6e4"); rect(c, x + 3, y + 3, w - 6, h - 14, "#e8ecf4");
    rect(c, x + w / 2 - 5, y + 6, 10, 9, "#ffffff"); rect(c, x + w / 2 - 4, y + 7, 8, 5, "#dfe6f0"); rect(c, x + w / 2 - 3, y + 16, 6, 5, "#ffffff"); // kloset dilihat dari atas
    rect(c, x + 2, y + h - 11, w - 4, 9, "#9aa7c0"); rect(c, x + w - 8, y + h - 8, 3, 2, "#6b7480"); // pintu bilik
  },  chair: (c, f, x, y) => { box(c, x + 3, y + 4, 10, 9, f.c ?? "#2f7d57"); rect(c, x + 3, y + 4, 10, 3, "rgba(0,0,0,0.2)"); },
};

function wall(c: Ctx, x: number, y: number, w: number, h: number) {
  const X = x * T, Y = y * T, Wp = w * T, Hp = h * T;
  rect(c, X, Y, Wp, Hp, "#585c8f");
  rect(c, X, Y, Wp, 4, "#7c80b8");                 // sisi atas yang terkena cahaya
  rect(c, X, Y + Hp - 3, Wp, 3, "#3f4270");        // bayangan bawah
  rect(c, X, Y, 1, Hp, OUT); rect(c, X + Wp - 1, Y, 1, Hp, OUT);
}

/** Lukis seluruh latar statis (rumput, lantai, dinding, perabot, kursi) sekali ke canvas. */
export function buildStatic(): HTMLCanvasElement {
  const cv = document.createElement("canvas");
  cv.width = WORLD_W; cv.height = WORLD_H;
  const c = cv.getContext("2d")!;
  c.imageSmoothingEnabled = false;

  // rumput + bintik
  rect(c, 0, 0, WORLD_W, WORLD_H, "#a9dc8d");
  for (let i = 0; i < 260; i++) { const x = Math.floor(hash(i, 1) * 6 * T), y = Math.floor(hash(i, 2) * WORLD_H); rect(c, x, y, 2, 1, hash(i, 3) > 0.5 ? "#92cb74" : "#bbe7a1"); }
  // lantai aula (kayu) seluruh bangunan, lalu ruang/karpet menimpanya
  floor(c, 6, 0, W - 6, H, "wood");
  ROOMS.filter((r) => r.floor !== "carpetGrey" && r.floor !== "carpetPurple" && r.floor !== "rugLilac").forEach((r) => floor(c, r.x, r.y, r.w, r.h, r.floor));
  ROOMS.filter((r) => r.floor === "carpetGrey" || r.floor === "carpetPurple" || r.floor === "rugLilac").forEach((r) => floor(c, r.x, r.y, r.w, r.h, r.floor));

  // pohon di luar (kiri) — digambar setelah rumput, sebelum dinding
  [[18, 20, 1], [28, 120, 1.1], [14, 220, 1], [30, 330, 1.15], [16, 430, 1], [26, 540, 1.1], [14, 610, 0.9]].forEach(([x, y, s]) => tree(c, x, y, s));

  WALLS.forEach((r) => wall(c, r.x, r.y, r.w, r.h));
  // kursi di meja kerja (kosong saat agen sedang pergi)
  for (const d of DESKS) {
    const sx = (d.x + 2) * T, fy = d.dir === "up" ? (d.y + 2) * T + 18 : d.y * T - 1;
    box(c, sx - 6, fy - 11, 12, 10, d.dark ? "#2f3a48" : "#2f7d57"); rect(c, sx - 6, fy - 11, 12, 3, "rgba(0,0,0,0.22)");
  }
  // perabot: urut berdasarkan baris bawahnya agar tumpang-tindih natural
  [...FURNITURE].sort((a, b) => a.y + a.h - (b.y + b.h)).forEach((f) => DRAW[f.k]?.(c, f, f.x * T, f.y * T, f.w * T, f.h * T));
  void W;
  return cv;
}

// ── dinamis ──────────────────────────────────────────────────────────────────
export type { Pose };
export interface Look { skin: string; hair: string; shirt: string }
export interface AvatarOpts { slump?: boolean }

/** Avatar 12×22 px. (x, y) = tengah-bawah (telapak kaki). `slump` = lelah (kepala dan bahu sedikit turun). */
export function drawAvatar(c: Ctx, x: number, y: number, look: Look, dir: "up" | "down" | "left" | "right", step: number, pose: Pose, t: number, opts: AvatarOpts = {}) {
  const walk = pose === "walk";
  const leg = walk ? Math.floor(step) % 2 : 0;
  const bob = walk ? (leg ? -1 : 0) : 0;
  const drop = (opts.slump && !walk ? 1 : 0) + (pose === "lean" ? 1 : 0);
  const X = Math.round(x), Y = Math.round(y) + bob;
  if (!walk && pose !== "typing") rect(c, X - 5, Y - 1, 10, 2, "rgba(0,0,0,0.12)");
  // kaki
  rect(c, X - 4, Y - 6 + (leg ? 1 : 0), 3, 6 - (leg ? 1 : 0), "#2d3748"); rect(c, X + 1, Y - 6 + (leg ? 0 : 1), 3, 6 - (leg ? 0 : 1), "#2d3748");
  rect(c, X - 4, Y - 1, 3, 1, "#1a202c"); rect(c, X + 1, Y - 1, 3, 1, "#1a202c");
  // badan
  rect(c, X - 5, Y - 14 + drop, 10, 9 - drop, OUT); rect(c, X - 4, Y - 13 + drop, 8, 8 - drop, look.shirt);
  rect(c, X - 4, Y - 13 + drop, 8, 2, "rgba(255,255,255,0.18)");
  // lengan menurut pose
  const aY = Y - 12 + drop, tk = Math.floor(t * 9) % 2, sw = Math.floor(t * 6) % 2;
  const arm = (ax: number, ay: number, h: number) => rect(c, ax, ay, 2, h, look.shirt);
  const hand = (hx: number, hy: number) => rect(c, hx, hy, 2, 2, look.skin);
  switch (pose) {
    case "wave": arm(X + 5, aY - 5 - sw, 7); hand(X + 5, aY - 7 - sw); arm(X - 7, aY + 1, 5); break;
    case "hand": arm(X + 5, aY - 6, 8); hand(X + 5, aY - 8); arm(X - 7, aY + 1, 5); break;
    case "typing": { const up = dir === "up"; arm(X - 7, up ? aY - 3 + tk : aY + 4 - tk, 4); arm(X + 5, up ? aY - 2 - tk : aY + 4 - (1 - tk), 4); break; }
    case "think": arm(X + 4, aY - 3, 6); hand(X + 3, aY - 5); arm(X - 7, aY + 1, 5); break;
    case "scratch": arm(X + 5, aY - 6 - (Math.floor(t * 8) % 2), 8); hand(X + 4, aY - 8 - (Math.floor(t * 8) % 2)); arm(X - 7, aY + 1, 5); break;
    case "lean": arm(X - 8, aY - 3, 6); arm(X + 6, aY - 3, 6); hand(X - 7, aY - 5); hand(X + 5, aY - 5); break;
    case "phone": arm(X + 5, aY - 6, 8); rect(c, X + 4, Y - 20 + drop, 2, 4, "#1c1f2e"); arm(X - 7, aY + 1, 5); break;
    case "stretch": arm(X - 7, aY - 9, 10); arm(X + 5, aY - 9, 10); hand(X - 7, aY - 11); hand(X + 5, aY - 11); break;
    case "yawn": arm(X + 4, aY - 3, 6); hand(X + 3, aY - 5); arm(X - 7, aY + 1, 5); break;
    case "sip": arm(X + 5, aY - 4, 6); rect(c, X + 4, Y - 18 + drop, 3, 3, "#ffffff"); rect(c, X + 7, Y - 17 + drop, 1, 1, "#ffffff"); arm(X - 7, aY + 1, 5); break;
    case "talk": arm(X + 5, aY - (Math.floor(t * 5) % 2) * 2, 5); arm(X - 7, aY + 1, 5); break;
    default: arm(X - 7, aY + 1 + (walk && leg ? 1 : 0), 6); arm(X + 5, aY + 1 + (walk && !leg ? 1 : 0), 6);
  }
  // kepala
  const hY = Y - 23 + drop;
  rect(c, X - 5, hY, 10, 10, OUT); rect(c, X - 4, hY + 1, 8, 8, look.skin);
  if (dir === "down") {
    rect(c, X - 4, hY + 1, 8, 3, look.hair); rect(c, X - 4, hY + 3, 1, 3, look.hair); rect(c, X + 3, hY + 3, 1, 3, look.hair);
    rect(c, X - 3, hY + 5, 1, 2, "#1a202c"); rect(c, X + 2, hY + 5, 1, 2, "#1a202c");
    if (pose === "yawn") rect(c, X - 1, hY + 7, 2, 2, "#7a2a2a");
    else if (pose === "talk" && Math.floor(t * 8) % 2) rect(c, X - 1, hY + 7, 2, 1, "#7a2a2a");
  } else if (dir === "up") { rect(c, X - 4, hY + 1, 8, 7, look.hair); rect(c, X - 4, hY + 8, 8, 1, look.hair); }
  else { rect(c, X - 4, hY + 1, 8, 3, look.hair); rect(c, dir === "left" ? X - 4 : X + 1, hY + 3, 3, 5, look.hair); rect(c, dir === "left" ? X - 3 : X + 2, hY + 5, 1, 2, "#1a202c"); }
}

/** Pil nama/label bergaya referensi. Mengembalikan lebar pil (untuk menaruh ikon di sampingnya). */
export function drawPill(c: Ctx, text: string, cx: number, cy: number, opts: { bg?: string; fg?: string; dot?: string; font?: number } = {}): number {
  const size = opts.font ?? 7;
  c.font = `bold ${size}px monospace`;
  const tw = Math.ceil(c.measureText(text).width);
  const w = tw + 8 + (opts.dot ? 7 : 0), h = size + 4;
  const x = Math.round(cx - w / 2), y = Math.round(cy - h / 2);
  rect(c, x + 1, y, w - 2, h, opts.bg ?? "#1c1f2e"); rect(c, x, y + 1, w, h - 2, opts.bg ?? "#1c1f2e");
  if (opts.dot) rect(c, x + 3, y + h / 2 - 2, 4, 4, opts.dot);
  c.fillStyle = opts.fg ?? "#ffffff"; c.textBaseline = "middle"; c.textAlign = "left";
  c.fillText(text, x + 4 + (opts.dot ? 7 : 0), y + h / 2 + 0.5);
  return w;
}

/** Gelembung status: "..." (bekerja), "!" (butuh persetujuan), centang (selesai). */
export function drawBubble(c: Ctx, kind: "dots" | "alert" | "done", cx: number, cy: number, t: number) {
  const X = Math.round(cx), Y = Math.round(cy);
  if (kind === "dots") {
    rect(c, X - 9, Y - 6, 18, 11, OUT); rect(c, X - 8, Y - 5, 16, 9, "#ffffff"); rect(c, X - 2, Y + 4, 4, 2, "#ffffff");
    for (let i = 0; i < 3; i++) rect(c, X - 5 + i * 4, Y - 2 + (Math.floor(t * 4) % 3 === i ? -1 : 0), 2, 2, OUT);
  } else if (kind === "alert") {
    const hop = Math.abs(Math.sin(t * 5)) * 2;
    rect(c, X - 6, Y - 7 - hop, 12, 12, OUT); rect(c, X - 5, Y - 6 - hop, 10, 10, "#ef4444");
    rect(c, X - 1, Y - 4 - hop, 2, 4, "#ffffff"); rect(c, X - 1, Y + 1 - hop, 2, 2, "#ffffff");
  } else {
    rect(c, X - 6, Y - 7, 12, 12, OUT); rect(c, X - 5, Y - 6, 10, 10, "#22c55e");
    rect(c, X - 3, Y - 1, 2, 2, "#ffffff"); rect(c, X - 1, Y + 1, 2, 2, "#ffffff"); rect(c, X + 1, Y - 3, 2, 2, "#ffffff"); rect(c, X + 3, Y - 5, 1, 2, "#ffffff");
  }
}

/** Gelembung ucapan berisi teks pendek (maks. 2 baris). */
export function drawSpeech(c: Ctx, text: string, cx: number, cy: number) {
  c.font = "bold 6px monospace";
  const words = text.split(" "), lines: string[] = [""];
  for (const w of words) { const cur = lines[lines.length - 1]; if (cur && c.measureText(`${cur} ${w}`).width > 62) lines.push(w); else lines[lines.length - 1] = cur ? `${cur} ${w}` : w; }
  const ls = lines.slice(0, 2);
  const tw = Math.ceil(Math.max(...ls.map((l) => c.measureText(l).width))), w = tw + 8, h = ls.length * 8 + 4;
  const x = Math.round(cx - w / 2), y = Math.round(cy - h);
  rect(c, x + 1, y, w - 2, h, OUT); rect(c, x, y + 1, w, h - 2, OUT);
  rect(c, x + 1, y + 1, w - 2, h - 2, "#ffffff"); rect(c, x + 2, y, w - 4, h, "#ffffff");
  rect(c, Math.round(cx) - 2, y + h, 4, 2, OUT); rect(c, Math.round(cx) - 1, y + h, 2, 1, "#ffffff");
  c.fillStyle = OUT; c.textBaseline = "top"; c.textAlign = "left";
  ls.forEach((l, i) => c.fillText(l, x + 4, y + 3 + i * 8));
}

/** Ikon mood kecil di samping nama: senang (senyum), lelah (zZ), stres (kilat merah). */
export function drawMood(c: Ctx, mood: string, x: number, y: number, t: number) {
  const X = Math.round(x), Y = Math.round(y);
  if (mood === "senang") {
    rect(c, X - 4, Y - 3, 8, 7, OUT); rect(c, X - 3, Y - 4, 6, 9, OUT); rect(c, X - 3, Y - 3, 6, 7, "#ffd23f"); rect(c, X - 4, Y - 2, 8, 5, "#ffd23f");
    rect(c, X - 2, Y - 1, 1, 1, OUT); rect(c, X + 1, Y - 1, 1, 1, OUT); rect(c, X - 2, Y + 1, 1, 1, OUT); rect(c, X - 1, Y + 2, 2, 1, OUT); rect(c, X + 1, Y + 1, 1, 1, OUT);
  } else if (mood === "lelah") {
    const hop = Math.floor(t * 2) % 2;
    rect(c, X - 4, Y - 3 - hop, 5, 1, "#7aa2ff"); rect(c, X - 1, Y - 2 - hop, 1, 1, "#7aa2ff"); rect(c, X - 2, Y - 1 - hop, 1, 1, "#7aa2ff"); rect(c, X - 4, Y - hop, 5, 1, "#7aa2ff");
    rect(c, X + 1, Y - 5 + hop, 4, 1, "#b7ccff"); rect(c, X + 3, Y - 4 + hop, 1, 1, "#b7ccff"); rect(c, X + 1, Y - 3 + hop, 4, 1, "#b7ccff");
  } else if (mood === "stres") {
    rect(c, X - 4, Y - 4, 8, 8, OUT); rect(c, X - 3, Y - 3, 6, 6, "#ef4444");
    rect(c, X, Y - 3, 2, 2, "#ffffff"); rect(c, X - 1, Y - 1, 2, 2, "#ffffff"); rect(c, X - 2, Y + 1, 2, 2, "#ffffff");
  }
}

export type ScreenKind = "code" | "chart" | "doc" | "call";
/** Monitor di meja; layar menampilkan konten berbeda dan mati bila penghuni tak ada. `tint` = tugas AI sungguhan (warna status). */
export function drawMonitor(c: Ctx, deskX: number, deskY: number, dir: "up" | "down", o: { on: boolean; kind: ScreenKind; tint: string | null; t: number; seed: number }) {
  const cx = (deskX + 2) * T;
  const y = dir === "up" ? deskY * T + 4 : (deskY + 2) * T - 15;
  box(c, cx - 8, y, 16, 10, o.tint ?? "#1c2530");
  const sx = cx - 7, sy = y + 1, sw = 14, sh = 8;
  if (!o.on) { rect(c, sx, sy, sw, sh, "#0b1018"); rect(c, sx + 1, sy + 1, 3, 1, "rgba(255,255,255,0.08)"); }
  else {
    const ph = Math.floor(o.t / 2.2);
    if (o.kind === "code") {
      rect(c, sx, sy, sw, sh, "#10202c");
      for (let i = 0; i < 4; i++) { const w = 3 + Math.floor(hash(o.seed + i, ph) * 8), ind = Math.floor(hash(o.seed, i + ph) * 3); rect(c, sx + 1 + ind, sy + 1 + i * 2, Math.min(w, sw - 2 - ind), 1, o.tint ?? ["#4cf08a", "#7aa2ff", "#ffd23f", "#ff7aa8"][i]); }
    } else if (o.kind === "chart") {
      rect(c, sx, sy, sw, sh, "#f5f7fa");
      for (let i = 0; i < 5; i++) { const h = 1 + Math.floor(hash(o.seed + i, ph) * 6); rect(c, sx + 1 + i * 2 + i, sy + sh - 1 - h, 2, h, ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6"][i]); }
    } else if (o.kind === "doc") {
      rect(c, sx, sy, sw, sh, "#ffffff"); rect(c, sx, sy, sw, 1, "#3b82f6");
      for (let i = 0; i < 3; i++) rect(c, sx + 1, sy + 2 + i * 2, 4 + Math.floor(hash(o.seed + i, ph) * 8), 1, "#9ca3af");
    } else {
      rect(c, sx, sy, sw, sh, "#1f2937");
      rect(c, sx + 1, sy + 1, 6, 5, "#d9a066"); rect(c, sx + 7, sy + 1, 6, 5, "#e0ac84"); rect(c, sx + 2, sy + 2, 4, 1, "#3b2a1a"); rect(c, sx + 8, sy + 2, 4, 1, "#2b1d12"); rect(c, sx + 1, sy + 6, 12, 1, "#22c55e");
    }
  }
  rect(c, cx - 1, dir === "up" ? y + 10 : y - 2, 2, 2, "#4b5563");
  rect(c, cx - 6, dir === "up" ? y + 14 : y - 6, 10, 3, "#d5dbe3"); // papan ketik
  rect(c, cx + 12, dir === "up" ? y + 9 : y - 1, 3, 3, "#f4f1ea"); // gelas
}

/** Uap kopi di atas gelas di meja. */
export function drawSteam(c: Ctx, x: number, y: number, t: number) {
  for (let i = 0; i < 3; i++) { const ph = (t * 0.9 + i / 3) % 1; rect(c, Math.round(x + Math.sin((t + i) * 2.4) * 1.5), Math.round(y - ph * 9), 1, 2, `rgba(255,255,255,${(1 - ph) * 0.8})`); }
}

/** Kertas yang keluar dari printer (progress 0..1). */
export function drawPaper(c: Ctx, tx: number, ty: number, progress: number) {
  const x = tx * T + 4, y = ty * T + T - 3;
  rect(c, x, y, 10, 2 + Math.round(progress * 5), "#ffffff"); rect(c, x + 1, y + 1, 6, 1, "#9ca3af");
}

/** Isi galon dispenser (level 0..1) menimpa botol statis. */
export function drawCoolerLevel(c: Ctx, tx: number, ty: number, level: number, active: boolean, t: number) {
  const x = tx * T + 4, y = ty * T;
  const empty = Math.round(6 * (1 - Math.max(0, Math.min(1, level))));
  if (empty > 0) rect(c, x, y, 8, empty, "#e3ecf2");
  if (active) rect(c, x + 2 + Math.floor(t * 6) % 4, y + 5 - Math.floor(t * 4) % 4, 1, 1, "#ffffff");
}

/** Penanda "terisi" di bilik toilet. */
export function drawOccupied(c: Ctx, tx: number, ty: number) {
  rect(c, tx * T + 12, (ty + 3) * T - 8, 3, 3, "#ef4444");
}

/** Dedaunan tanaman bergoyang halus. */
export function drawPlantSway(c: Ctx, f: Furn, t: number) {
  const x = f.x * T, y = f.y * T, s = Math.round(Math.sin(t * 1.6 + f.x * 0.7 + f.y));
  rect(c, x + 5 + s, y + 2, 3, 2, "#6fd18a"); rect(c, x + 9 + s, y + 1, 2, 2, "#45c07c");
}

/** Bola pingpong memantul di antara dua pemain. */
export function drawBall(c: Ctx, t: number) {
  const k = (Math.sin(t * 3.2) + 1) / 2;
  rect(c, 25.5 * T + k * 7 * T, 26 * T + 6 - Math.abs(Math.sin(t * 6.4)) * 9, 2, 2, "#ffffff");
}

/** Jam dinding analog sesuai waktu virtual. */
export function drawClock(c: Ctx, cx: number, cy: number, vmin: number) {
  rect(c, cx - 7, cy - 6, 14, 12, OUT); rect(c, cx - 6, cy - 7, 12, 14, OUT); rect(c, cx - 6, cy - 6, 12, 12, "#ffffff"); rect(c, cx - 5, cy - 6, 10, 12, "#ffffff"); rect(c, cx - 5, cy - 7, 10, 14, "#ffffff");
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; rect(c, cx + Math.round(Math.sin(a) * 5) - 0, cy - Math.round(Math.cos(a) * 5), 1, 1, "#6b7280"); }
  const hand = (len: number, ang: number, w: number, col: string) => { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.sin(ang) * len, cy - Math.cos(ang) * len); c.stroke(); };
  const h = (vmin / 60) % 12, m = vmin % 60;
  hand(3, (h / 12) * Math.PI * 2, 1.2, OUT); hand(4.5, (m / 60) * Math.PI * 2, 1, "#374151");
}

/** Pintu: tertutup (daun penuh) atau terbuka (daun menyamping) menurut `open` 0..1. */
export function drawDoors(c: Ctx, doors: Door[], open: number[]) {
  doors.forEach((d, i) => {
    const o = open[i] ?? 0;
    const leaf = "#b9824f", edge = "#7a4b2a";
    if (d.orient === "h") {
      const x = d.x * T, y = d.y * T + T / 2 - 3, len = d.w * T;
      const w = Math.round(len * (1 - o * 0.88));
      box(c, x, y, w, 6, leaf, edge);
      if (o < 0.5) rect(c, x + w - 4, y + 2, 2, 2, "#e5e7eb");
    } else {
      const x = d.x * T + T / 2 - 3, y = d.y * T, len = d.h * T;
      const h = Math.round(len * (1 - o * 0.88));
      box(c, x, y, 6, h, leaf, edge);
      if (o < 0.5) rect(c, x + 2, y + h - 4, 2, 2, "#e5e7eb");
    }
  });
}

// ── cahaya & langit mengikuti jam virtual ────────────────────────────────────
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const TINT: [number, [number, number, number, number]][] = [
  [0, [15, 25, 70, 0.52]], [300, [15, 25, 70, 0.5]], [360, [255, 170, 120, 0.16]], [420, [255, 215, 165, 0.1]], [540, [255, 230, 190, 0.05]],
  [600, [255, 255, 255, 0]], [900, [255, 255, 255, 0]], [960, [255, 215, 160, 0.07]], [1020, [255, 160, 90, 0.16]], [1080, [255, 140, 80, 0.2]],
  [1140, [50, 60, 130, 0.38]], [1200, [20, 30, 80, 0.48]], [1320, [15, 25, 70, 0.52]], [1440, [15, 25, 70, 0.52]],
];
export function tintAt(v: number): [number, number, number, number] {
  const x = ((v % 1440) + 1440) % 1440;
  for (let i = 0; i < TINT.length - 1; i++) {
    const [a, A] = TINT[i], [b, B] = TINT[i + 1];
    if (x <= b) { const k = (x - a) / (b - a); return [lerp(A[0], B[0], k), lerp(A[1], B[1], k), lerp(A[2], B[2], k), lerp(A[3], B[3], k)]; }
  }
  return TINT[TINT.length - 1][1];
}

const SKY: [number, [number, number, number]][] = [
  [0, [14, 21, 54]], [300, [16, 26, 64]], [360, [242, 183, 160]], [420, [191, 225, 255]], [600, [159, 212, 255]], [900, [159, 212, 255]],
  [1000, [255, 217, 160]], [1080, [255, 157, 98]], [1140, [74, 87, 150]], [1200, [20, 28, 64]], [1440, [14, 21, 54]],
];
export function skyAt(v: number): string {
  const x = ((v % 1440) + 1440) % 1440;
  for (let i = 0; i < SKY.length - 1; i++) {
    const [a, A] = SKY[i], [b, B] = SKY[i + 1];
    if (x <= b) { const k = (x - a) / (b - a); return `rgb(${Math.round(lerp(A[0], B[0], k))},${Math.round(lerp(A[1], B[1], k))},${Math.round(lerp(A[2], B[2], k))})`; }
  }
  return "rgb(14,21,54)";
}

/** Warna langit di jendela + bintang saat malam. */
export function drawWindows(c: Ctx, windows: Furn[], vmin: number) {
  const sky = skyAt(vmin), night = tintAt(vmin)[3] > 0.4;
  for (const f of windows) {
    const x = f.x * T, y = f.y * T, w = f.w * T, h = f.h * T;
    rect(c, x + 4, y + 4, w - 8, h - 8, sky);
    rect(c, x + w / 2 - 1, y + 4, 2, h - 8, "#6b7a99");
    if (night) for (let i = 0; i < 4; i++) rect(c, x + 6 + Math.floor(hash(f.x + i, 9) * (w - 14)), y + 5 + Math.floor(hash(f.x, i) * (h - 11)), 1, 1, "#fff6c9");
  }
}

/**
 * Lapisan gelap/tint (pagi hangat, sore oranye, malam biru). Zona berlampu (a = 0..1) menembus gelapnya malam.
 * Menggambar ke kanvas luar-layar `off` lalu menempelkannya ke `ctx` (koordinat dunia).
 */
export function renderLighting(ctx: Ctx, off: HTMLCanvasElement, vmin: number, zones: { x: number; y: number; w: number; h: number; a: number }[]) {
  const [r, g, b, a] = tintAt(vmin);
  if (a < 0.004) return;
  const o = off.getContext("2d")!;
  o.globalCompositeOperation = "source-over"; o.clearRect(0, 0, off.width, off.height);
  o.fillStyle = `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${a})`; o.fillRect(0, 0, off.width, off.height);
  const dark = Math.max(0, Math.min(1, (a - 0.1) / 0.3)); // lampu baru terasa saat gelap
  if (dark > 0) {
    o.globalCompositeOperation = "destination-out";
    for (const z of zones) if (z.a > 0.01) { o.fillStyle = `rgba(0,0,0,${Math.min(1, z.a * dark * 0.92)})`; o.fillRect(z.x * T, z.y * T, z.w * T, z.h * T); }
    o.globalCompositeOperation = "source-over";
  }
  ctx.drawImage(off, 0, 0);
}

/** Amplop yang terbang (delegasi tugas / laporan). */
export function drawEnvelope(c: Ctx, x: number, y: number, color: string) {
  const X = Math.round(x), Y = Math.round(y);
  rect(c, X - 6, Y - 4, 12, 9, OUT); rect(c, X - 5, Y - 3, 10, 7, "#ffffff");
  rect(c, X - 5, Y - 3, 10, 1, color); rect(c, X - 4, Y - 2, 2, 1, color); rect(c, X - 2, Y - 1, 2, 1, color); rect(c, X, Y - 1, 2, 1, color); rect(c, X + 2, Y - 2, 2, 1, color);
  rect(c, X + 5, Y - 6, 2, 2, color); rect(c, X - 8, Y + 4, 2, 2, color);
}

export const _internal = { OUT };
void W;