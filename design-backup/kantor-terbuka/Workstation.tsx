"use client";
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { AgentDef, STATUS_META, agentOrigin } from "@/lib/agents";
import { useOffice } from "@/store/office";
import { Character } from "./Character";
import { Label } from "./Label";
import { Box, C, OfficeChair, Plant, TrashBin } from "./OfficeProps";

/** Meja + monitor yang layarnya menyala sesuai status agen (tanpa agen: layar redup). Kursi duduk karakter ada di z lokal ≈ +1. */
export function Desk({ agentId, dark = false, chairColor }: { agentId?: string; dark?: boolean; chairColor?: string }) {
  const status = useOffice((s) => (agentId ? s.statuses[agentId] : "IDLE"));
  const screen = useRef<THREE.MeshStandardMaterial>(null!);
  useFrame(({ clock }) => {
    const base = status === "IDLE" ? 0.2 : 0.95;
    const flick = status === "PROCESSING" ? 0.4 + Math.abs(Math.sin(clock.elapsedTime * 12)) * 0.6 : 1;
    screen.current.emissiveIntensity = base * flick;
    screen.current.emissive.set(agentId ? STATUS_META[status].color : "#4b5d73");
  });
  const top = dark ? C.deskDark : C.wood;
  const drawer = dark ? "#2d1f1a" : C.woodDark;
  return (
    <group position={[0, 0, -2]}>
      <Box p={[0, 0.72, 0]} s={[2.4, 0.07, 1.1]} color={top} />
      <Box p={[-0.95, 0.36, 0]} s={[0.5, 0.7, 1]} color={drawer} />
      {[0.52, 0.3, 0.1].map((y) => <Box key={y} p={[-0.95, y + 0.02, 0.51]} s={[0.4, 0.14, 0.02]} color={dark ? "#4a3128" : "#eab073"} cast={false} />)}
      <Box p={[1.05, 0.36, 0.4]} s={[0.08, 0.7, 0.08]} color="#4b5563" />
      <Box p={[1.05, 0.36, -0.4]} s={[0.08, 0.7, 0.08]} color="#4b5563" />
      <Box p={[0.1, 1.1, -0.2]} s={[0.95, 0.55, 0.05]} color="#1c2530" />
      <mesh position={[0.1, 1.1, -0.17]}>
        <boxGeometry args={[0.87, 0.47, 0.01]} />
        <meshStandardMaterial ref={screen} color="#0b1f17" emissive="#3b82f6" emissiveIntensity={0.5} />
      </mesh>
      <Box p={[0.1, 0.89, -0.2]} s={[0.1, 0.2, 0.1]} color="#4b5563" />
      <Box p={[0.1, 0.77, 0.25]} s={[0.62, 0.03, 0.2]} color="#d5dbe3" />
      <Box p={[0.55, 0.77, 0.27]} s={[0.1, 0.03, 0.14]} color="#d5dbe3" />
      <Box p={[-0.35, 0.76, 0.15]} s={[0.4, 0.015, 0.3]} color="#ffffff" rot={[0, 0.2, 0]} />
      <mesh position={[0.85, 0.82, 0.1]}><cylinderGeometry args={[0.06, 0.05, 0.1, 12]} /><meshStandardMaterial color="#f4f1ea" /></mesh>
      {/* lampu meja kecil */}
      <mesh position={[-0.2, 0.77, -0.35]}><cylinderGeometry args={[0.07, 0.08, 0.03, 12]} /><meshStandardMaterial color="#39404c" /></mesh>
      <Box p={[-0.2, 0.95, -0.35]} s={[0.025, 0.36, 0.025]} color="#39404c" cast={false} />
      <mesh position={[-0.2, 1.14, -0.3]} rotation={[0.4, 0, 0]}><coneGeometry args={[0.1, 0.12, 12]} /><meshStandardMaterial color={C.accent} /></mesh>
      <OfficeChair position={[0, 0, 1.05]} rotY={Math.PI} color={chairColor ?? (dark ? "#2f3a48" : C.chair)} />
    </group>
  );
}

/** Meja kosong (tanpa agen) untuk melengkapi kelompok meja. */
export function VacantDesk({ x, z, flip = false }: { x: number; z: number; flip?: boolean }) {
  return (
    <group position={[x, 0, z]} rotation={[0, flip ? Math.PI : 0, 0]}>
      <Desk />
      <TrashBin position={[1.5, 0, -0.9]} />
    </group>
  );
}

export function Workstation({ agent }: { agent: AgentDef }) {
  const [x, , z] = agentOrigin(agent);
  const selected = useOffice((s) => s.selectedId === agent.id);
  const select = useOffice((s) => s.select);
  const isOffice = agent.id === "manager" || agent.id === "administrator";

  return (
    <group position={[x, 0, z]} rotation={[0, agent.flip ? Math.PI : 0, 0]}>
      {/* karpet zona: bisa diklik, dan menyala saat agen dipilih */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, isOffice ? -0.6 : -1.1]} receiveShadow onClick={(e) => { e.stopPropagation(); select(agent.id); }}>
        <planeGeometry args={isOffice ? [4.4, 4.4] : [2.5, 3.2]} />
        <meshStandardMaterial color={selected ? "#b8f2d4" : C.rug} transparent opacity={selected ? 0.95 : 0.85} depthWrite={false} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
      </mesh>
      <Desk agentId={agent.id} dark={agent.id === "manager"} />
      <Character agent={agent} />
      {agent.id === "manager" && <Plant position={[1.9, 0, -3.4]} />}
      {/* label ruangan hanya untuk ruang kaca; zona terbuka cukup memakai label nama di atas karakter */}
      {isOffice && <Label position={[0, 3.35, -2]} scale={0.9} lines={[{ text: agent.room, bg: "#1f6b4a", fg: "#ffffff", size: 14 }]} />}
    </group>
  );
}
