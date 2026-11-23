import * as THREE from "three";
import { FloorKind, H, ROOMS, W } from "@/lib/office2d/layout";
import { hash } from "./kit";

const S = 32; // piksel per tile pada tekstur lantai

const PAL: Record<FloorKind, { base: string; alt: string; line: string }> = {
  wood: { base: "#dcb98a", alt: "#d0aa78", line: "#b98f5e" },
  woodDark: { base: "#8d5f3e", alt: "#7f5434", line: "#5e3d25" },
  tile: { base: "#eef2f1", alt: "#e4eae8", line: "#c3cfcc" },
  carpetGrey: { base: "#aeb7c2", alt: "#a6afbb", line: "#9aa4b0" },
  carpetPurple: { base: "#bba9d9", alt: "#b2a0d2", line: "#a591c6" },
  rugLilac: { base: "#d9caf0", alt: "#d2c2ec", line: "#b9a4de" },
};

/** Lantai seluruh denah digambar sekali ke satu kanvas (kayu, ubin, karpet, rumput di luar). */
export function buildFloorTexture(): THREE.CanvasTexture {
  const cv = document.createElement("canvas"); cv.width = W * S; cv.height = H * S;
  const c = cv.getContext("2d")!;
  // rumput di luar gedung
  c.fillStyle = "#a6d393"; c.fillRect(0, 0, cv.width, cv.height);
  for (let i = 0; i < 900; i++) { c.fillStyle = hash(i, 3) > 0.5 ? "#9ccb89" : "#b3dba0"; c.fillRect(hash(i, 1) * 6 * S, hash(i, 2) * H * S, 3, 3); }

  const wood = (x: number, y: number, w: number, h: number, k: FloorKind) => {
    const p = PAL[k];
    for (let ty = y; ty < y + h; ty++) for (let j = 0; j < 4; j++) {
      const py = (ty * 4 + j) * (S / 4);
      let px = x * S, n = 0;
      while (px < (x + w) * S) {
        const len = Math.min((x + w) * S - px, (2 + Math.floor(hash(ty * 7 + j, n + 11) * 3)) * S - (j % 2) * (S / 2) * (n === 0 ? 1 : 0));
        c.fillStyle = hash(ty * 4 + j, n) > 0.5 ? p.base : p.alt; c.fillRect(px, py, len, S / 4);
        c.fillStyle = p.line; c.fillRect(px, py + S / 4 - 1, len, 1); c.fillRect(px + len - 1, py, 1, S / 4);
        px += len; n++;
      }
    }
  };
  const tile = (x: number, y: number, w: number, h: number) => {
    const p = PAL.tile;
    for (let ty = y; ty < y + h; ty++) for (let tx = x; tx < x + w; tx++) {
      c.fillStyle = (tx + ty) % 2 ? p.base : p.alt; c.fillRect(tx * S, ty * S, S, S);
      c.fillStyle = p.line; c.fillRect(tx * S, ty * S, S, 1); c.fillRect(tx * S, ty * S, 1, S);
    }
  };
  const carpet = (x: number, y: number, w: number, h: number, k: FloorKind) => {
    const p = PAL[k];
    c.fillStyle = p.base; c.fillRect(x * S, y * S, w * S, h * S);
    for (let i = 0; i < w * h * 7; i++) { c.fillStyle = hash(i, 5) > 0.5 ? p.alt : p.line; c.fillRect(x * S + hash(i, 6) * w * S, y * S + hash(i, 7) * h * S, 2, 2); }
  };

  wood(6, 0, W - 6, H, "wood"); // lantai aula = kayu
  for (const r of ROOMS) {
    if (r.floor === "wood" || r.floor === "woodDark") wood(r.x, r.y, r.w, r.h, r.floor);
    else if (r.floor === "tile") tile(r.x, r.y, r.w, r.h);
    else carpet(r.x, r.y, r.w, r.h, r.floor);
    if (r.floor === "rugLilac") { c.strokeStyle = PAL.rugLilac.line; c.lineWidth = 3; c.strokeRect(r.x * S + 6, r.y * S + 6, r.w * S - 12, r.h * S - 12); }
  }
  // keset pintu masuk
  c.fillStyle = "#7a2f3a"; c.fillRect(16 * S + 4, 37 * S + 8, 2 * S - 8, 2 * S - 12);
  c.strokeStyle = "#e7c9a0"; c.lineWidth = 2; c.strokeRect(16 * S + 8, 37 * S + 12, 2 * S - 16, 2 * S - 20);

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return tex;
}
