"use client";
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { AGENTS, agentOrigin, deskDz } from "@/lib/agents";
import { TRANSFER_MS, Transfer, useOffice } from "@/store/office";

const deskPos = (id: string) => {
  const a = AGENTS.find((x) => x.id === id)!;
  const [x, , z] = agentOrigin(a);
  return new THREE.Vector3(x, 1.0, z + deskDz(a));
};

/** Memo yang terbang melengkung dari meja pengirim ke meja penerima. */
function MemoMesh({ t }: { t: Transfer }) {
  const ref = useRef<THREE.Group>(null!);
  const a = useRef(deskPos(t.from));
  const b = useRef(deskPos(t.to));
  useFrame(() => {
    const k = (Date.now() - t.t0) / TRANSFER_MS;
    const g = ref.current;
    if (k < 0 || k > 1) { g.visible = false; return; }
    g.visible = true;
    const e = k * k * (3 - 2 * k); // ease in-out
    g.position.lerpVectors(a.current, b.current, e);
    g.position.y += Math.sin(Math.PI * e) * (3 + a.current.distanceTo(b.current) * 0.15);
    g.rotation.set(0.4, e * Math.PI * 4, Math.sin(e * 12) * 0.3);
    g.scale.setScalar(2.2);
  });
  const color = t.kind === "task" ? "#3ddc97" : "#f59e0b";
  return (
    <group ref={ref} visible={false}>
      <mesh castShadow>
        <boxGeometry args={[0.55, 0.04, 0.4]} />
        <meshStandardMaterial color="#ffffff" emissive={color} emissiveIntensity={0.6} />
      </mesh>
      <mesh position={[0, 0.03, -0.1]}><boxGeometry args={[0.4, 0.02, 0.06]} /><meshBasicMaterial color={color} /></mesh>
      <mesh position={[0, -0.15, 0]}><sphereGeometry args={[0.22, 16, 16]} /><meshBasicMaterial color={color} transparent opacity={0.85} /></mesh>
      <pointLight color={color} intensity={6} distance={4} />
    </group>
  );
}

export function Memos() {
  const transfers = useOffice((s) => s.transfers);
  return <>{transfers.map((t) => <MemoMesh key={t.id} t={t} />)}</>;
}
