/**
 * Denah kantor 2D tampak atas (gaya pixel-art). Semua koordinat dalam TILE (1 tile = 16 px dunia) kecuali disebut lain.
 * Data murni (tanpa canvas) supaya jalur jalan karakter bisa dites.
 */
export const T = 16;
export const W = 56; // lebar dunia (tile)
export const H = 40; // tinggi dunia (tile)
export const WORLD_W = W * T;
export const WORLD_H = H * T;

export interface Rect { x: number; y: number; w: number; h: number }

/** Dinding horizontal x0..x1 (inklusif) pada baris y; `gaps` = pintu [dari, sampai] (inklusif). */
const hwall = (x0: number, x1: number, y: number, gaps: [number, number][] = []): Rect[] => {
  const out: Rect[] = [];
  let cur = x0;
  for (const [g0, g1] of [...gaps].sort((a, b) => a[0] - b[0])) { if (g0 > cur) out.push({ x: cur, y, w: g0 - cur, h: 1 }); cur = g1 + 1; }
  if (cur <= x1) out.push({ x: cur, y, w: x1 - cur + 1, h: 1 });
  return out;
};
const vwall = (x: number, y0: number, y1: number, gaps: [number, number][] = []): Rect[] => {
  const out: Rect[] = [];
  let cur = y0;
  for (const [g0, g1] of [...gaps].sort((a, b) => a[0] - b[0])) { if (g0 > cur) out.push({ x, y: cur, w: 1, h: g0 - cur }); cur = g1 + 1; }
  if (cur <= y1) out.push({ x, y: cur, w: 1, h: y1 - cur + 1 });
  return out;
};

const TOP_DOORS: [number, number][] = [[23, 24], [34, 35], [47, 48]];
const LEFT_DOORS: [number, number][] = [[5, 6], [14, 15], [24, 25], [34, 35]];
const ENTRANCE_GAP: [number, number] = [17, 17]; // pintu masuk di dinding bawah (tile 17,39)

export const WALLS: Rect[] = [
  // dinding luar bangunan
  ...hwall(6, 55, 0), ...hwall(6, 55, 39, [ENTRANCE_GAP]), ...vwall(6, 0, 39), ...vwall(55, 0, 39),
  // kolom kiri: dinding kanan dengan pintu (Director, Administration, Rapat, Lobi) + sekat antar ruang
  ...vwall(16, 0, 39, LEFT_DOORS),
  ...hwall(7, 15, 9), ...hwall(7, 15, 19), ...hwall(7, 15, 30),
  // ruang-ruang atas (Pantry, Galeri, IT) dan bawah (Arsip, Server, Pojok Kopi)
  ...hwall(18, 54, 7, TOP_DOORS), ...vwall(18, 0, 7), ...vwall(29, 0, 7), ...vwall(40, 0, 7),
  ...hwall(18, 54, 33, TOP_DOORS), ...vwall(18, 33, 39), ...vwall(29, 33, 39), ...vwall(40, 33, 39),
];

export type FloorKind = "wood" | "woodDark" | "tile" | "carpetGrey" | "carpetPurple" | "rugLilac";
export interface Room extends Rect { name: string; floor: FloorKind; label?: boolean }

/** Lantai khusus (interior ruang, karpet). Sisanya = lantai kayu aula. */
export const ROOMS: Room[] = [
  { name: "Director Room", x: 7, y: 1, w: 9, h: 8, floor: "woodDark", label: true },
  { name: "Administration Room", x: 7, y: 10, w: 9, h: 9, floor: "tile", label: true },
  { name: "Ruang Rapat", x: 7, y: 20, w: 9, h: 10, floor: "tile", label: true },
  { name: "Lobi", x: 7, y: 31, w: 9, h: 8, floor: "wood", label: true },
  { name: "Pantry", x: 19, y: 1, w: 10, h: 6, floor: "tile", label: true },
  { name: "Toilet", x: 30, y: 1, w: 10, h: 6, floor: "tile", label: true },
  { name: "Ruang IT", x: 41, y: 1, w: 14, h: 6, floor: "tile", label: true },
  { name: "Arsip", x: 19, y: 34, w: 10, h: 5, floor: "tile", label: true },
  { name: "Ruang Server", x: 30, y: 34, w: 10, h: 5, floor: "tile", label: true },
  { name: "Pojok Kopi", x: 41, y: 34, w: 14, h: 5, floor: "wood", label: true },
  { name: "Tim Akademik", x: 19, y: 9, w: 20, h: 11, floor: "carpetGrey", label: true },
  { name: "Tim Dokumen", x: 42, y: 21, w: 13, h: 12, floor: "carpetGrey", label: true },
  { name: "Ruang Santai", x: 20, y: 23, w: 18, h: 8, floor: "carpetPurple", label: true },
  { name: "Lounge", x: 43, y: 10, w: 11, h: 9, floor: "rugLilac" },
];

export interface Desk { x: number; y: number; dir: "up" | "down"; agentId?: string; dark?: boolean }
/** Meja kerja 4×2 tile. `dir` = arah hadap orang yang duduk ("up" = duduk di bawah meja menghadap ke atas). */
export const DESKS: Desk[] = [
  { x: 9, y: 2, dir: "up", agentId: "manager", dark: true },
  { x: 9, y: 12, dir: "up", agentId: "administrator" },
  { x: 20, y: 10, dir: "up", agentId: "attendance" },
  { x: 30, y: 10, dir: "up", agentId: "grading" },
  { x: 20, y: 17, dir: "down", agentId: "checker" },
  { x: 30, y: 17, dir: "down", agentId: "content" },
  { x: 43, y: 23, dir: "up", agentId: "assignment" },
  { x: 50, y: 23, dir: "up", agentId: "reporting" },
  { x: 43, y: 30, dir: "down", agentId: "archivist" },
  { x: 50, y: 30, dir: "down", agentId: "paper" },
];

export interface Seat { x: number; y: number; dir: "up" | "down" | "left" | "right" } // px dunia; y = telapak kaki
export const SEATS: Record<string, Seat> = Object.fromEntries(
  DESKS.filter((d) => d.agentId).map((d) => [d.agentId!, { x: (d.x + 2) * T, y: d.dir === "up" ? (d.y + 2) * T + 18 : d.y * T - 1, dir: d.dir }]),
);

export type FurnKind =
  | "desk" | "plant" | "sofa" | "shelf" | "table" | "pingpong" | "aquarium" | "cooler" | "server" | "cabinet" | "counter"
  | "beanbag" | "painting" | "fridge" | "printer" | "bench" | "window" | "whiteboard" | "chair" | "sink" | "stall";
export interface Furn extends Rect { k: FurnKind; c?: string; dark?: boolean }

/** Perabot yang tidak menghalangi jalan (hiasan dinding, kursi). */
export const NON_BLOCKING: FurnKind[] = ["painting", "window", "whiteboard", "chair"];

const f = (k: FurnKind, x: number, y: number, w = 1, h = 1, c?: string): Furn => ({ k, x, y, w, h, c });

export const FURNITURE: Furn[] = [
  ...DESKS.map((d): Furn => ({ k: "desk", x: d.x, y: d.y, w: 4, h: 2, dark: d.dark })),
  // Director
  f("window", 9, 0, 4, 1), f("shelf", 13, 1, 3, 1), f("shelf", 7, 1, 2, 1), f("plant", 7, 7), f("plant", 15, 7),
  // Administration
  f("cabinet", 7, 10, 3, 1), f("shelf", 12, 10, 3, 1), f("plant", 15, 18), f("plant", 7, 18),
  // Ruang rapat
  f("whiteboard", 9, 19, 5, 1), f("table", 9, 23, 5, 3, "#8a5a3b"), f("plant", 15, 29),
  ...[9, 11, 13].flatMap((x) => [f("chair", x, 22, 1, 1, "#2f7d57"), f("chair", x, 26, 1, 1, "#2f7d57")]),
  f("chair", 8, 24, 1, 1, "#2f7d57"), f("chair", 14, 24, 1, 1, "#2f7d57"),
  // Lobi
  f("sofa", 8, 34, 4, 2, "#3d5a73"), f("table", 9, 37, 2, 1, "#d9c3a0"), f("shelf", 12, 31, 3, 1), f("plant", 7, 33), f("plant", 15, 38),
  // Pantry
  f("counter", 19, 1, 8, 1), f("fridge", 27, 1, 1, 2), f("table", 22, 4, 3, 2, "#f1e4cf"), f("chair", 21, 5, 1, 1, "#e8926b"), f("chair", 25, 5, 1, 1, "#e8926b"), f("plant", 19, 6),
  // Toilet
  f("sink", 31, 1, 2, 1), f("sink", 33, 1, 2, 1), f("stall", 35, 2, 2, 3), f("stall", 37, 2, 2, 3), f("painting", 31, 4, 2, 1), f("plant", 30, 6), f("plant", 39, 6),
  // jendela di dinding luar atas
  f("window", 22, 0, 4, 1), f("window", 33, 0, 4, 1), f("window", 46, 0, 5, 1),
  // akuarium di lobi
  f("aquarium", 8, 31, 4, 1),
  // Ruang IT
  ...[42, 43, 44, 45, 46].map((x) => f("server", x, 1, 1, 2)), f("desk", 50, 3, 4, 2), f("plant", 54, 6),
  // Arsip
  f("cabinet", 19, 38, 9, 1), f("printer", 22, 35, 2, 1), f("plant", 28, 34),
  // Ruang Server
  ...[31, 32, 33, 34, 35, 36].map((x) => f("server", x, 37, 1, 2)), f("plant", 39, 34),
  // Pojok Kopi
  f("counter", 42, 38, 8, 1), f("cooler", 51, 38), f("beanbag", 44, 35, 1, 1, "#4aa3e8"), f("beanbag", 46, 35, 1, 1, "#9b6bd6"), f("beanbag", 48, 35, 1, 1, "#4aa3e8"), f("plant", 54, 34),
  // Lounge
  f("shelf", 42, 9, 4, 1), f("shelf", 51, 9, 4, 1), f("sofa", 45, 10, 5, 2, "#e8926b"), f("sofa", 45, 17, 5, 2, "#e8926b"), f("table", 47, 13, 3, 3, "#f1e4cf"),
  f("beanbag", 43, 13, 1, 1, "#4aa3e8"), f("beanbag", 43, 15, 1, 1, "#4aa3e8"), f("beanbag", 53, 13, 1, 1, "#9b6bd6"), f("beanbag", 53, 15, 1, 1, "#9b6bd6"),
  f("plant", 42, 19), f("plant", 54, 19), f("plant", 41, 9),
  // Ruang Santai (pingpong)
  f("pingpong", 26, 25, 6, 3), f("sofa", 21, 23, 5, 2, "#e8926b"), f("sofa", 21, 29, 5, 2, "#e8926b"), f("sofa", 32, 23, 5, 2, "#e8926b"), f("sofa", 32, 29, 5, 2, "#e8926b"),
  f("plant", 20, 26), f("plant", 37, 26),
  // aula
  f("cooler", 39, 8), f("plant", 38, 20), f("plant", 41, 21), f("plant", 18, 20),
];

/** Titik tujuan jalan-jalan agen yang sedang idle (tile). */
export const POIS: [number, number][] = [
  [40, 15], [40, 26], [35, 21], [23, 8], [34, 8], [47, 8], [17, 15], [17, 26], [12, 28], [46, 20], [30, 32], [36, 32], [44, 12],
];

/** Grid tile yang tidak bisa dilewati (dinding + perabot yang menghalangi). 1 = terhalang. */
export function buildBlocked(): Uint8Array {
  const g = new Uint8Array(W * H);
  const mark = (r: Rect) => { for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (x >= 0 && y >= 0 && x < W && y < H) g[y * W + x] = 1; };
  WALLS.forEach(mark);
  FURNITURE.filter((r) => !NON_BLOCKING.includes(r.k)).forEach(mark);
  // di luar bangunan (rumput di kiri) tidak bisa dimasuki
  for (let y = 0; y < H; y++) for (let x = 0; x < 6; x++) g[y * W + x] = 1;
  return g;
}

/** Label zona/ruang (px dunia, pusat). */
export function roomLabels(): { text: string; x: number; y: number; kind: "room" | "team" }[] {
  return ROOMS.filter((r) => r.label).map((r) => ({
    text: r.name,
    x: (r.x + r.w / 2) * T,
    y: (r.y + (r.floor === "carpetGrey" ? 0.55 : 0.6)) * T,
    kind: r.floor === "carpetGrey" ? "team" : "room",
  }));
}

export interface Door extends Rect { orient: "h" | "v" }
/** Pintu: celah pada dinding yang membuka otomatis saat ada orang di dekatnya. */
export const DOORS: Door[] = [
  ...LEFT_DOORS.map(([a, b]): Door => ({ x: 16, y: a, w: 1, h: b - a + 1, orient: "v" })),
  ...[7, 33].flatMap((y) => TOP_DOORS.map(([a, b]): Door => ({ x: a, y, w: b - a + 1, h: 1, orient: "h" }))),
  { x: ENTRANCE_GAP[0], y: 39, w: 1, h: 1, orient: "h" },
];

export type Tile = [number, number];
export interface FacedTile { tile: Tile; dir: "up" | "down" | "left" | "right" }

/** Titik aktivitas (tile). Semua harus tile kosong yang bisa dicapai. */
export const SPOTS = {
  entrance: [17, 39] as Tile,
  pantry: [[21, 2], [23, 2], [25, 2]] as Tile[],                 // di depan konter pantry
  cooler: [[39, 9], [51, 37]] as Tile[],                           // dispenser air
  toilet: [[35, 5], [37, 5]] as Tile[],                            // depan bilik (orang masuk bilik)
  printer: [[22, 36]] as Tile[],
  meeting: [
    { tile: [9, 22], dir: "down" }, { tile: [11, 22], dir: "down" }, { tile: [13, 22], dir: "down" },
    { tile: [9, 26], dir: "up" }, { tile: [11, 26], dir: "up" }, { tile: [13, 26], dir: "up" },
    { tile: [8, 24], dir: "right" }, { tile: [14, 24], dir: "left" },
  ] as FacedTile[],
  meetingStand: [[9, 28], [10, 28], [11, 28], [12, 28], [13, 28], [8, 28]] as Tile[], // bila peserta lebih dari kursi
  lunch: [
    { tile: [21, 5], dir: "right" }, { tile: [25, 5], dir: "left" },
    { tile: [46, 12], dir: "up" }, { tile: [48, 12], dir: "up" }, { tile: [46, 16], dir: "down" }, { tile: [48, 16], dir: "down" },
    { tile: [45, 36], dir: "up" }, { tile: [47, 36], dir: "up" }, { tile: [49, 36], dir: "up" },
  ] as FacedTile[],
  breakLounge: [[44, 12], [43, 11], [50, 16], [44, 17]] as Tile[],
  pingpong: [{ tile: [25, 26], dir: "right" }, { tile: [32, 26], dir: "left" }] as FacedTile[],
  evac: [[40, 24], [40, 26], [40, 28], [39, 25], [41, 25], [39, 27], [41, 27], [39, 29], [41, 29]] as Tile[],
};