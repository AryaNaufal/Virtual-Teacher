"use client";
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Label } from "./Label";
import * as THREE from "three";
import { AgentDef, STATUS_META } from "@/lib/agents";
import { TRANSFER_MS, useOffice } from "@/store/office";

const SEAT: [number, number] = [0, -0.95]; // posisi kursi (lokal ruangan)
const WANDER: [number, number] = [2.2, 1.2];

function Limb({ len, w, color, children, refObj }: { len: number; w: number; color: string; children?: React.ReactNode; refObj?: React.Ref<THREE.Group> }) {
  return (
    <group ref={refObj}>
      <mesh position={[0, -len / 2, 0]} castShadow>
        <boxGeometry args={[w, len, w]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {children}
    </group>
  );
}

export function Character({ agent }: { agent: AgentDef }) {
  const status = useOffice((s) => s.statuses[agent.id]);
  const selected = useOffice((s) => s.selectedId === agent.id);
  const select = useOffice((s) => s.select);

  const root = useRef<THREE.Group>(null!);
  const body = useRef<THREE.Group>(null!);
  const head = useRef<THREE.Group>(null!);
  const lArm = useRef<THREE.Group>(null!);
  const rArm = useRef<THREE.Group>(null!);
  const lThigh = useRef<THREE.Group>(null!);
  const rThigh = useRef<THREE.Group>(null!);
  const lShin = useRef<THREE.Group>(null!);
  const rShin = useRef<THREE.Group>(null!);
  const sit = useRef(1);
  const pos = useRef(new THREE.Vector3(SEAT[0], 0, SEAT[1]));
  const yaw = useRef(Math.PI);

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime + agent.grid[0] * 1.7 + agent.grid[1] * 2.3;
    const idle = status === "IDLE";

    // Agent idle berkeliling sebentar; status lain duduk di meja.
    let target = new THREE.Vector3(SEAT[0], 0, SEAT[1]);
    let walking = false;
    if (idle) {
      const c = t % 20;
      if (c > 6 && c < 14) target = new THREE.Vector3(WANDER[0], 0, WANDER[1]);
    }
    const atTargetSeat = target.x === SEAT[0] && target.z === SEAT[1];
    const delta = target.clone().sub(pos.current);
    if (delta.length() > 0.05) {
      walking = true;
      pos.current.add(delta.clone().normalize().multiplyScalar(Math.min(1.4 * dt, delta.length())));
      yaw.current = THREE.MathUtils.lerp(yaw.current, Math.atan2(delta.x, delta.z), 0.15);
    } else {
      yaw.current = THREE.MathUtils.lerp(yaw.current, atTargetSeat ? Math.PI : Math.PI * 0.75, 0.1);
    }
    const atSeat = pos.current.distanceTo(new THREE.Vector3(SEAT[0], 0, SEAT[1])) < 0.1;
    sit.current = THREE.MathUtils.lerp(sit.current, atSeat ? 1 : 0, 0.12);
    const s = sit.current;

    root.current.position.copy(pos.current);
    root.current.rotation.y = yaw.current;
    body.current.position.y = 0.8 - 0.3 * s;

    const swing = walking ? Math.sin(t * 7) * 0.7 : 0;
    lThigh.current.rotation.x = -(Math.PI / 2) * s + swing * (1 - s);
    rThigh.current.rotation.x = -(Math.PI / 2) * s - swing * (1 - s);
    lShin.current.rotation.x = (Math.PI / 2) * s;
    rShin.current.rotation.x = (Math.PI / 2) * s;

    let la = 0, ra = 0, raz = 0, hx = 0, bob = 0;
    // Pengirim memo mengulurkan tangan; penerima menengok saat memo tiba.
    const now = Date.now();
    const sending = useOffice.getState().transfers.some((x) => x.from === agent.id && now - x.t0 < 900);
    const receiving = useOffice.getState().transfers.some((x) => x.to === agent.id && now - x.t0 > TRANSFER_MS - 900);
    if (sending && !walking) { ra = -1.7 + Math.sin(t * 10) * 0.12; la = -0.5; hx = -0.1; }
    else if (receiving && !walking) { ra = -1.3; la = -1.3; hx = 0.3; }
    else if (walking) { la = swing * 0.8; ra = -swing * 0.8; }
    else if (status === "WORKING") { la = -1.15 + Math.sin(t * 14) * 0.08; ra = -1.15 + Math.cos(t * 12) * 0.08; hx = 0.2; }
    else if (status === "PROCESSING") { la = -1.2 + Math.sin(t * 22) * 0.1; ra = -1.2 + Math.cos(t * 20) * 0.1; hx = 0.25 + Math.sin(t * 8) * 0.1; }
    else if (status === "COMPLETED") { ra = -Math.PI + 0.3; raz = Math.sin(t * 8) * 0.5; la = s > 0.5 ? -0.3 : 0; }
    else if (status === "NEEDS_APPROVAL") { ra = -Math.PI + 0.2; la = -0.3; bob = Math.abs(Math.sin(t * 4)) * 0.05; }
    else { la = s > 0.5 ? -0.5 : Math.sin(t * 1.5) * 0.05; ra = s > 0.5 ? -0.5 : -Math.sin(t * 1.5) * 0.05; hx = Math.sin(t * 1.2) * 0.05; }
    lArm.current.rotation.set(la, 0, 0);
    rArm.current.rotation.set(ra, 0, raz);
    head.current.rotation.x = hx;
    body.current.position.y += bob + (walking ? Math.abs(Math.sin(t * 7)) * 0.04 : 0);
  });

  const meta = STATUS_META[status];
  const legColor = "#2d3748";

  return (
    <group
      onClick={(e) => { e.stopPropagation(); select(agent.id); }}
      onPointerOver={() => (document.body.style.cursor = "pointer")}
      onPointerOut={() => (document.body.style.cursor = "")}
    >
      <group ref={root}>
        {selected && (
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
            <ringGeometry args={[0.55, 0.7, 40]} />
            <meshBasicMaterial color="#3ddc97" />
          </mesh>
        )}
        <group ref={body}>
          <mesh position={[0, 0.45, 0]} castShadow>
            <boxGeometry args={[0.5, 0.7, 0.28]} />
            <meshStandardMaterial color={agent.shirt} />
          </mesh>
          <mesh position={[0, 0.78, 0.01]}>
            <boxGeometry args={[0.2, 0.06, 0.26]} />
            <meshStandardMaterial color="#ffffff" />
          </mesh>
          <group ref={head} position={[0, 0.95, 0]}>
            <mesh position={[0, 0.2, 0]} castShadow>
              <sphereGeometry args={[0.2, 20, 20]} />
              <meshStandardMaterial color={agent.skin} />
            </mesh>
            <mesh position={[0, 0.27, -0.03]}>
              <sphereGeometry args={[0.21, 20, 20, 0, Math.PI * 2, 0, Math.PI / 1.9]} />
              <meshStandardMaterial color={agent.hair} />
            </mesh>
            <mesh position={[-0.07, 0.22, 0.18]}><sphereGeometry args={[0.025]} /><meshBasicMaterial color="#111" /></mesh>
            <mesh position={[0.07, 0.22, 0.18]}><sphereGeometry args={[0.025]} /><meshBasicMaterial color="#111" /></mesh>
          </group>
          <group position={[-0.33, 0.75, 0]}><Limb refObj={lArm} len={0.6} w={0.14} color={agent.shirt} /></group>
          <group position={[0.33, 0.75, 0]}><Limb refObj={rArm} len={0.6} w={0.14} color={agent.shirt} /></group>
          <group position={[-0.13, 0.1, 0]}>
            <Limb refObj={lThigh} len={0.4} w={0.17} color={legColor}>
              <group position={[0, -0.4, 0]}><Limb refObj={lShin} len={0.4} w={0.15} color={legColor} /></group>
            </Limb>
          </group>
          <group position={[0.13, 0.1, 0]}>
            <Limb refObj={rThigh} len={0.4} w={0.17} color={legColor}>
              <group position={[0, -0.4, 0]}><Limb refObj={rShin} len={0.4} w={0.15} color={legColor} /></group>
            </Limb>
          </group>
        </group>
        <Label
          position={[0, 2.5, 0]}
          lines={[
            { text: `${agent.name} · ${agent.title.replace("AI ", "")}`, bg: "rgba(255,255,255,0.95)", fg: "#1e293b", size: 14 },
            { text: meta.label.toUpperCase(), bg: meta.color, fg: "#ffffff", size: 12 },
          ]}
        />
      </group>
    </group>
  );
}
