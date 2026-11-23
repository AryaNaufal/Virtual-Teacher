import { H, T, W } from "./layout";

/** Tile tempat telapak kaki (px) berada. */
export const tileOf = (x: number, y: number): [number, number] => [Math.floor(x / T), Math.floor((y - 1) / T)];
/** Titik tengah tile → px (telapak kaki sedikit di atas dasar tile). */
export const centerOf = (tx: number, ty: number): [number, number] => [tx * T + T / 2, ty * T + T - 2];

/** Pencarian jalur terpendek (BFS, 4 arah) di grid tile. Mengembalikan daftar tile dari tujuan pertama langkah ke akhir, atau null. */
export function findPath(blocked: Uint8Array, from: [number, number], to: [number, number]): [number, number][] | null {
  const [sx, sy] = from, [tx, ty] = to;
  const ok = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && !blocked[y * W + x];
  if (!ok(tx, ty)) return null;
  if (sx === tx && sy === ty) return [];
  const prev = new Int32Array(W * H).fill(-1);
  const q: number[] = [sy * W + sx];
  prev[sy * W + sx] = sy * W + sx;
  for (let i = 0; i < q.length; i++) {
    const cur = q[i], cx = cur % W, cy = (cur / W) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx, ny = cy + dy, n = ny * W + nx;
      if (!ok(nx, ny) || prev[n] !== -1) continue;
      prev[n] = cur;
      if (nx === tx && ny === ty) {
        const path: [number, number][] = [];
        for (let k = n; k !== sy * W + sx; k = prev[k]) path.push([k % W, (k / W) | 0]);
        return path.reverse();
      }
      q.push(n);
    }
  }
  return null;
}
