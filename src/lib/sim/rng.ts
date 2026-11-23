/** Pengacak berbenih (mulberry32): benih yang sama → urutan yang sama, jadi simulasi bisa diulang persis. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Rng {
  private f: () => number;
  constructor(seed: number) { this.f = mulberry32(seed); }
  next() { return this.f(); }
  range(a: number, b: number) { return a + this.f() * (b - a); }
  int(a: number, b: number) { return Math.floor(this.range(a, b + 1)); }
  chance(p: number) { return this.f() < p; }
  pick<T>(xs: readonly T[]): T { return xs[Math.floor(this.f() * xs.length)]; }
  shuffle<T>(xs: readonly T[]): T[] { const o = [...xs]; for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(this.f() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; } return o; }
}
