"use client";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { AgentDef, STATUS_META } from "@/lib/agents";
import { DESKS, T } from "@/lib/office2d/layout";
import { ExternalStatus, Pose, poseOf } from "@/lib/sim/engine";
import { getSim } from "@/lib/sim/store";
import { useOffice } from "@/store/office";
import { Bx, PxSprite, mat, roundRect, usePxTex } from "./kit";
import { deskSeat } from "./Furniture3D";

const YAW = { down: 0, up: Math.PI, right: Math.PI / 2, left: -Math.PI / 2 } as const;
const MOOD_ICON: Record<string, string> = { senang: "😊", lelah: "😴", stres: "😣", netral: "" };
const DESK_OF = Object.fromEntries(DESKS.filter((d) => d.agentId).map((d) => [d.agentId!, d]));
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const angDiff = (a: number, b: number) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };

interface Targets { aX: number; aZ: number; bX: number; bZ: number; hipL: number; hipR: number; knee: number; torso: number; head: number; mouth: boolean; hold: "phone" | "cup" | null }

/** Sudut anggota badan per pose. Rotasi-x negatif = mengayun ke depan (menghadap +z). */
function targetsFor(pose: Pose, seated: boolean, phase: number, t: number, slump: boolean): Targets {
  const o: Targets = { aX: 0, aZ: 0.1, bX: 0, bZ: -0.1, hipL: 0, hipR: 0, knee: 0, torso: slump ? 0.14 : 0, head: slump ? 0.12 : 0, mouth: false, hold: null };
  if (seated) { o.hipL = o.hipR = -1.5; o.knee = 1.5; o.aX = o.bX = -0.9; o.aZ = 0.05; o.bZ = -0.05; }
  const sw = Math.sin(phase);
  switch (pose) {
    case "walk": o.hipL = -sw * 0.75; o.hipR = sw * 0.75; o.knee = 0; o.aX = sw * 0.6; o.bX = -sw * 0.6; break;
    case "typing": o.aX = -1.35 + Math.sin(t * 18) * 0.07; o.bX = -1.35 + Math.sin(t * 18 + 2) * 0.07; o.head += 0.1; break;
    case "wave": o.aX = -2.7; o.aZ = 0.3 + Math.sin(t * 9) * 0.35; break;
    case "hand": o.aX = -3.0; o.aZ = 0.15; break;
    case "think": o.aX = -2.1; o.aZ = -0.2; o.head += 0.15; o.bX = seated ? -1.2 : -0.7; break;
    case "scratch": o.aX = -2.6; o.aZ = -0.1 + Math.sin(t * 16) * 0.15; break;
    case "lean": o.aX = o.bX = -1.4; o.torso += 0.22; o.aZ = 0.2; o.bZ = -0.2; break;
    case "phone": o.aX = -2.4; o.aZ = -0.35; o.hold = "phone"; break;
    case "stretch": o.aX = o.bX = -3.1; o.aZ = 0.5; o.bZ = -0.5; o.torso -= 0.12; o.head -= 0.2; break;
    case "yawn": o.aX = -2.3; o.aZ = -0.3; o.head -= 0.28; o.mouth = true; break;
    case "sip": o.aX = -1.9; o.aZ = -0.2; o.hold = "cup"; break;
    case "talk": o.aX = -0.9 + Math.sin(t * 5) * 0.5; o.aZ = 0.25; o.mouth = Math.floor(t * 8) % 2 === 0; break;
    default: o.aX += Math.sin(t * 1.3) * 0.03; o.bX += Math.sin(t * 1.3 + 1) * 0.03;
  }
  return o;
}

interface Cur { aX: number; aZ: number; bX: number; bZ: number; hipL: number; hipR: number; knee: number; torso: number; head: number; sit: number; yaw: number; ready: boolean; phase: number; px: number; pz: number; key: string; bubbleKey: string; seatSet: boolean }

/** Avatar 3D low-poly: sendi bahu/pinggul/lutut, pose dari mesin sim, label nama + status, bubble percakapan. */
export function Avatar3D({ def }: { def: AgentDef }) {
  const outer = useRef<THREE.Group>(null), rig = useRef<THREE.Group>(null), upper = useRef<THREE.Group>(null), head = useRef<THREE.Group>(null);
  const armA = useRef<THREE.Group>(null), armB = useRef<THREE.Group>(null), legL = useRef<THREE.Group>(null), legR = useRef<THREE.Group>(null);
  const kneeL = useRef<THREE.Group>(null), kneeR = useRef<THREE.Group>(null), mouth = useRef<THREE.Mesh>(null), phone = useRef<THREE.Mesh>(null), cup = useRef<THREE.Mesh>(null);
  const ring = useRef<THREE.Mesh>(null), shadow = useRef<THREE.Mesh>(null);
  const labelSp = useRef<THREE.Sprite | null>(null), bubbleSp = useRef<THREE.Sprite | null>(null);
  const label = usePxTex(230, 28), bubble = usePxTex(190, 70);
  const cur = useRef<Cur>({ aX: 0, aZ: 0, bX: 0, bZ: 0, hipL: 0, hipR: 0, knee: 0, torso: 0, head: 0, sit: 0, yaw: 0, ready: false, phase: 0, px: 0, pz: 0, key: "", bubbleKey: "", seatSet: false });
  const mats = useMemo(() => ({ skin: mat(def.skin), hair: mat(def.hair), shirt: mat(def.shirt), pants: mat("#2d3748"), shoe: mat("#1a202c"), eye: mat("#1a202c"), mouth: mat("#7a2a2a") }), [def]);
  const hitMat = useMemo(() => new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }), []);

  useFrame((_, dtRaw) => {
    const dt = Math.min(0.05, dtRaw), c = cur.current;
    const sim = getSim(), a = sim.byId[def.id], g = outer.current;
    if (!a || !g || !rig.current) return;
    const vis = !a.hidden;
    g.visible = vis;
    if (!vis) { c.ready = false; return; }
    const ext = (useOffice.getState().statuses as Record<string, ExternalStatus>)[def.id];
    const t = sim.t;

    // posisi & arah
    const seatedDesk = a.mode === "seated" && !!DESK_OF[def.id];
    const seated = seatedDesk || (a.mode === "meeting" && !!a.meetSeat);
    let tx = a.x / T, tz = a.y / T, face: number = YAW[a.dir];
    if (seatedDesk) { const d = DESK_OF[def.id], s = deskSeat(d); tx = s[0]; tz = s[2]; face = d.dir === "up" ? Math.PI : 0; }
    else if (a.mode === "meeting" && a.meetSeat) face = YAW[a.meetSeat.dir];
    if (!c.ready) { c.px = tx; c.pz = tz; c.yaw = face; c.ready = true; }
    const moved = Math.hypot(a.x / T - c.px, a.y / T - c.pz);
    const gain = a.mode === "walk" ? 22 : 12;
    c.px += (tx - c.px) * Math.min(1, dt * gain); c.pz += (tz - c.pz) * Math.min(1, dt * gain);
    c.yaw += angDiff(c.yaw, face) * Math.min(1, dt * 12);
    g.position.set(c.px, 0, c.pz);
    rig.current.rotation.y = c.yaw;
    c.sit += ((seated ? 1 : 0) - c.sit) * Math.min(1, dt * 10);
    rig.current.position.y = -0.42 * c.sit;
    if (a.mode === "walk") c.phase += moved * 5.2; else c.phase += 0;

    // pose
    let pose: Pose = poseOf(a, ext);
    const tg = targetsFor(pose, c.sit > 0.5, c.phase, t, a.mood === "lelah");
    const k = Math.min(1, dt * 14);
    c.aX += (tg.aX - c.aX) * k; c.aZ += (tg.aZ - c.aZ) * k; c.bX += (tg.bX - c.bX) * k; c.bZ += (tg.bZ - c.bZ) * k;
    c.hipL += (tg.hipL - c.hipL) * k; c.hipR += (tg.hipR - c.hipR) * k; c.knee += (tg.knee - c.knee) * k;
    c.torso += (tg.torso - c.torso) * k; c.head += (tg.head - c.head) * k;
    armA.current?.rotation.set(c.aX, 0, c.aZ); armB.current?.rotation.set(c.bX, 0, c.bZ);
    legL.current?.rotation.set(c.hipL, 0, 0); legR.current?.rotation.set(c.hipR, 0, 0);
    const kl = pose === "walk" ? Math.max(0, c.hipL) * 0.9 : c.knee, kr = pose === "walk" ? Math.max(0, c.hipR) * 0.9 : c.knee;
    kneeL.current?.rotation.set(kl, 0, 0); kneeR.current?.rotation.set(kr, 0, 0);
    if (upper.current) { upper.current.rotation.x = c.torso; upper.current.position.y = 1.0 + (pose === "walk" ? Math.abs(Math.sin(c.phase)) * 0.05 : 0); }
    if (head.current) head.current.rotation.x = c.head;
    if (mouth.current) mouth.current.visible = tg.mouth;
    if (phone.current) phone.current.visible = tg.hold === "phone";
    if (cup.current) cup.current.visible = tg.hold === "cup";
    if (shadow.current) shadow.current.scale.setScalar(c.sit > 0.5 ? 0.75 : 1);

    // cincin sorot pada agen terpilih
    const selected = useOffice.getState().selectedId === def.id;
    if (ring.current) { ring.current.visible = selected; if (selected) ring.current.scale.setScalar(1 + Math.sin(performance.now() / 250) * 0.08); }

    // label + bubble (kanvas dilukis ulang hanya bila isi berubah)
    const st = ext ?? "IDLE";
    const focus = selected || hoverId.current === def.id;
    const mood = MOOD_ICON[a.mood];
    const lkey = `${focus}|${st}|${mood}`;
    if (c.key !== lkey) {
      c.key = lkey;
      const ctx = label.ctx, text = focus ? `${def.name} · ${def.title.replace("AI ", "")}` : def.name;
      ctx.clearRect(0, 0, label.w, label.h);
      ctx.font = "600 12px system-ui, sans-serif";
      const tw = Math.ceil(ctx.measureText(text).width), w = tw + 26 + (mood ? 20 : 0), x = (label.w - w) / 2;
      ctx.fillStyle = "rgba(28,31,46,0.88)"; roundRect(ctx, x, 3, w, 22, 11); ctx.fill();
      ctx.fillStyle = STATUS_META[st].color; ctx.beginPath(); ctx.arc(x + 11, 14, 4, 0, 6.3); ctx.fill();
      ctx.fillStyle = "#ffffff"; ctx.textBaseline = "middle"; ctx.textAlign = "left"; ctx.fillText(text, x + 20, 14.5);
      if (mood) { ctx.font = "13px system-ui, sans-serif"; ctx.fillText(mood, x + 22 + tw, 14.5); }
      label.tex.needsUpdate = true;
    }
    const bubbleOn = st !== "IDLE" || !!a.bubble;
    const kind = st === "WORKING" || st === "PROCESSING" ? "dots" : st === "NEEDS_APPROVAL" ? "alert" : st === "COMPLETED" ? "done" : a.bubble?.text ?? "";
    const dotFrame = kind === "dots" ? Math.floor(t * 4) % 3 : 0;
    const bkey = `${kind}|${dotFrame}`;
    if (bubbleSp.current) bubbleSp.current.visible = bubbleOn;
    if (bubbleOn && c.bubbleKey !== bkey) { c.bubbleKey = bkey; drawBubble(bubble.ctx, bubble.w, bubble.h, kind, dotFrame); bubble.tex.needsUpdate = true; }
    const headY = 2.95 - 0.42 * c.sit;
    if (labelSp.current) labelSp.current.position.set(0, headY + 0.1, 0);
    if (bubbleSp.current) bubbleSp.current.position.set(0, headY + 0.1, 0);
  });

  return (
    <group ref={outer} visible={false}>
      <mesh ref={shadow} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}><circleGeometry args={[0.62, 18]} /><meshBasicMaterial color="#000000" transparent opacity={0.2} depthWrite={false} /></mesh>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]} visible={false}><ringGeometry args={[0.75, 0.95, 32]} /><meshBasicMaterial color="#3ddc97" transparent opacity={0.9} depthWrite={false} /></mesh>
      <group ref={rig}>
        {/* kaki */}
        {([[-0.2, legL, kneeL], [0.2, legR, kneeR]] as const).map(([x, lref, kref], i) => (
          <group key={i} ref={lref} position={[x, 1.0, 0]}>
            <Bx at={[0, -0.5, 0]} s={[0.3, 0.5, 0.32]} m={mats.pants} />
            <group ref={kref} position={[0, -0.5, 0]}>
              <Bx at={[0, -0.5, 0]} s={[0.28, 0.5, 0.3]} m={mats.pants} />
              <Bx at={[0, -0.56, 0.07]} s={[0.3, 0.14, 0.44]} m={mats.shoe} />
            </group>
          </group>
        ))}
        {/* badan atas */}
        <group ref={upper} position={[0, 1.0, 0]}>
          <Bx at={[0, 0, 0]} s={[0.85, 0.95, 0.5]} m={mats.shirt} />
          <Bx at={[0, 0.78, 0.255]} s={[0.85, 0.16, 0.02]} c="#ffffff" m={mat("#ffffff", { a: 0.18 })} />
          {([[0.53, armA, 1], [-0.53, armB, 0]] as const).map(([x, aref, main], i) => (
            <group key={i} ref={aref} position={[x, 0.88, 0]}>
              <Bx at={[0, -0.8, 0]} s={[0.22, 0.8, 0.24]} m={mats.shirt} />
              <Bx at={[0, -0.95, 0]} s={[0.2, 0.2, 0.2]} m={mats.skin} />
              {main ? (
                <>
                  <mesh ref={phone} geometry={phoneGeo} material={mat("#1c1f2e")} position={[0, -0.95, 0.16]} visible={false} />
                  <mesh ref={cup} geometry={cupGeo} material={mat("#ffffff")} position={[0, -0.95, 0.14]} visible={false} />
                </>
              ) : null}
            </group>
          ))}
          <group ref={head} position={[0, 0.98, 0]}>
            <Bx at={[0, 0, 0]} s={[0.76, 0.76, 0.7]} m={mats.skin} />
            <Bx at={[0, 0.6, -0.02]} s={[0.82, 0.2, 0.76]} m={mats.hair} />
            <Bx at={[0, 0.2, -0.32]} s={[0.8, 0.5, 0.14]} m={mats.hair} />
            <Bx at={[-0.39, 0.3, -0.05]} s={[0.06, 0.4, 0.6]} m={mats.hair} />
            <Bx at={[0.39, 0.3, -0.05]} s={[0.06, 0.4, 0.6]} m={mats.hair} />
            <Bx at={[0, 0.52, 0.32]} s={[0.78, 0.12, 0.1]} m={mats.hair} />
            <Bx at={[-0.17, 0.32, 0.355]} s={[0.1, 0.14, 0.04]} m={mats.eye} />
            <Bx at={[0.17, 0.32, 0.355]} s={[0.1, 0.14, 0.04]} m={mats.eye} />
            <mesh ref={mouth} geometry={mouthGeo} material={mats.mouth} position={[0, 0.14, 0.355]} visible={false} />
          </group>
        </group>
      </group>
      {/* area klik */}
      <mesh position={[0, 1.4, 0]} material={hitMat} onClick={(e) => { if (e.delta < 5) { e.stopPropagation(); useOffice.getState().select(def.id); } }} onPointerOver={() => { hoverId.current = def.id; document.body.style.cursor = "pointer"; }} onPointerOut={() => { if (hoverId.current === def.id) hoverId.current = null; document.body.style.cursor = ""; }}>
        <boxGeometry args={[1.3, 2.9, 1.3]} />
      </mesh>
      <PxSprite t={label} innerRef={labelSp} position={[0, 3.05, 0]} cy={0} order={30} />
      <PxSprite t={bubble} innerRef={bubbleSp} position={[0, 3.05, 0]} cy={-0.35} order={31} />
    </group>
  );
}

const hoverId = { current: null as string | null };
const phoneGeo = new THREE.BoxGeometry(0.1, 0.34, 0.18), cupGeo = new THREE.CylinderGeometry(0.11, 0.09, 0.2, 10), mouthGeo = new THREE.BoxGeometry(0.2, 0.14, 0.04);

/** Gelembung status / ucapan. `kind` = "dots" | "alert" | "done" | teks ucapan. */
function drawBubble(c: CanvasRenderingContext2D, w: number, h: number, kind: string, frame: number) {
  c.clearRect(0, 0, w, h);
  const cx = w / 2;
  if (kind === "dots" || kind === "alert" || kind === "done") {
    const bw = 52, bh = 30, x = cx - bw / 2, y = h - bh - 10;
    c.fillStyle = kind === "alert" ? "#ef4444" : kind === "done" ? "#22c55e" : "#ffffff"; c.strokeStyle = "#1c1f2e"; c.lineWidth = 2;
    roundRect(c, x, y, bw, bh, 12); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(cx - 6, y + bh); c.lineTo(cx, y + bh + 8); c.lineTo(cx + 6, y + bh); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = kind === "dots" ? "#1c1f2e" : "#ffffff";
    if (kind === "dots") for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(cx - 14 + i * 14, y + bh / 2 + (frame === i ? -3 : 0), 3.4, 0, 6.3); c.fill(); }
    else { c.font = "bold 18px system-ui, sans-serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(kind === "alert" ? "!" : "✓", cx, y + bh / 2 + 1); }
    return;
  }
  // ucapan: bungkus teks hingga 2 baris
  c.font = "600 12px system-ui, sans-serif"; c.textAlign = "left"; c.textBaseline = "middle";
  const words = kind.split(" "), lines: string[] = [];
  let line = "";
  for (const wd of words) { const tryL = line ? `${line} ${wd}` : wd; if (c.measureText(tryL).width > w - 30 && line) { lines.push(line); line = wd; } else line = tryL; }
  if (line) lines.push(line);
  const shown = lines.slice(0, 3), tw = Math.max(...shown.map((l) => c.measureText(l).width)), bw = Math.min(w - 6, tw + 20), bh = shown.length * 15 + 12, x = cx - bw / 2, y = h - bh - 10;
  c.fillStyle = "#ffffff"; c.strokeStyle = "#1c1f2e"; c.lineWidth = 2; roundRect(c, x, y, bw, bh, 10); c.fill(); c.stroke();
  c.beginPath(); c.moveTo(cx - 6, y + bh); c.lineTo(cx, y + bh + 8); c.lineTo(cx + 6, y + bh); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = "#ffffff"; c.fillRect(cx - 5, y + bh - 2, 10, 4);
  c.fillStyle = "#1c1f2e";
  shown.forEach((l, i) => c.fillText(l, x + 10, y + 12 + i * 15));
}
