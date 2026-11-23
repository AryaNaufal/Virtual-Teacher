"use client";
import { useEffect, useMemo } from "react";
import * as THREE from "three";

interface Line { text: string; bg: string; fg: string; size: number }

/** Label 3D berbasis sprite canvas (menghindari drei <Html> yang bermasalah di React 19). */
export function Label({ lines, position, scale = 1 }: { lines: Line[]; position: [number, number, number]; scale?: number }) {
  const key = JSON.stringify(lines);
  const { texture, aspect } = useMemo(() => {
    const dpr = 2;
    const pad = 10;
    const gap = 6;
    const measure = document.createElement("canvas").getContext("2d")!;
    const dims = lines.map((l) => {
      measure.font = `600 ${l.size * dpr}px system-ui, sans-serif`;
      return { w: measure.measureText(l.text).width + pad * 2 * dpr, h: (l.size + pad) * dpr };
    });
    const W = Math.ceil(Math.max(...dims.map((d) => d.w)));
    const H = Math.ceil(dims.reduce((s, d) => s + d.h, 0) + gap * dpr * (lines.length - 1));
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const g = c.getContext("2d")!;
    let y = 0;
    lines.forEach((l, i) => {
      const d = dims[i];
      const x = (W - d.w) / 2;
      g.fillStyle = l.bg;
      g.beginPath();
      g.roundRect(x, y, d.w, d.h, d.h / 2);
      g.fill();
      g.fillStyle = l.fg;
      g.font = `600 ${l.size * dpr}px system-ui, sans-serif`;
      g.textBaseline = "middle";
      g.textAlign = "center";
      g.fillText(l.text, W / 2, y + d.h / 2 + 1);
      y += d.h + gap * dpr;
    });
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return { texture: t, aspect: W / H };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => () => texture.dispose(), [texture]);

  const h = 0.55 * scale * (lines.length > 1 ? 1.7 : 1);
  return (
    <sprite position={position} scale={[h * aspect, h, 1]} renderOrder={10}>
      <spriteMaterial map={texture} transparent depthTest={false} />
    </sprite>
  );
}
