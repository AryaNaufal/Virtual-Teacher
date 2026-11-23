"use client";
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { AgentDef, ROOM_SIZE, STATUS_META, gridToWorld } from "@/lib/agents";
import { useOffice } from "@/store/office";
import { Character } from "./Character";
import { Label } from "./Label";

const H = ROOM_SIZE / 2;
const WALL_H = 2.6;

function Plant({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.2, 0]} castShadow><cylinderGeometry args={[0.18, 0.14, 0.4, 12]} /><meshStandardMaterial color="#e5e7eb" /></mesh>
      <mesh position={[0, 0.65, 0]} castShadow><sphereGeometry args={[0.32, 12, 12]} /><meshStandardMaterial color="#2f9e63" /></mesh>
      <mesh position={[0.1, 0.9, 0.05]} castShadow><sphereGeometry args={[0.2, 12, 12]} /><meshStandardMaterial color="#3dbb78" /></mesh>
    </group>
  );
}

function Shelf({ position, rotY = 0 }: { position: [number, number, number]; rotY?: number }) {
  const cols = ["#1f6b4a", "#e2e8f0", "#94a3b8", "#3ddc97", "#475569"];
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      <mesh position={[0, 0.9, 0]} castShadow><boxGeometry args={[2.2, 1.8, 0.45]} /><meshStandardMaterial color="#d6d3d1" /></mesh>
      {[0.3, 0.9, 1.5].map((y, i) =>
        Array.from({ length: 7 }).map((_, j) => (
          <mesh key={`${i}-${j}`} position={[-0.9 + j * 0.3, y, 0.2]}>
            <boxGeometry args={[0.22, 0.4, 0.1]} />
            <meshStandardMaterial color={cols[(i + j) % cols.length]} />
          </mesh>
        )),
      )}
    </group>
  );
}

function Desk({ agentId }: { agentId: string }) {
  const status = useOffice((s) => s.statuses[agentId]);
  const screen = useRef<THREE.MeshStandardMaterial>(null!);
  useFrame(({ clock }) => {
    const base = status === "IDLE" ? 0.15 : 0.9;
    const flick = status === "PROCESSING" ? 0.4 + Math.abs(Math.sin(clock.elapsedTime * 12)) * 0.6 : 1;
    screen.current.emissiveIntensity = base * flick;
    screen.current.emissive.set(STATUS_META[status].color);
  });
  return (
    <group position={[0, 0, -2]}>
      <mesh position={[0, 0.72, 0]} castShadow receiveShadow><boxGeometry args={[2.2, 0.08, 1]} /><meshStandardMaterial color="#f5f5f4" /></mesh>
      {[[-1, -0.4], [1, -0.4], [-1, 0.4], [1, 0.4]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.35, z]}><boxGeometry args={[0.08, 0.7, 0.08]} /><meshStandardMaterial color="#334155" /></mesh>
      ))}
      <mesh position={[0, 1.1, -0.15]} castShadow><boxGeometry args={[0.9, 0.55, 0.05]} /><meshStandardMaterial color="#111827" /></mesh>
      <mesh position={[0, 1.1, -0.12]}>
        <boxGeometry args={[0.82, 0.47, 0.01]} />
        <meshStandardMaterial ref={screen} color="#0b1f17" emissive="#3b82f6" emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[0, 0.9, -0.15]}><boxGeometry args={[0.1, 0.2, 0.1]} /><meshStandardMaterial color="#334155" /></mesh>
      <mesh position={[0, 0.77, 0.25]}><boxGeometry args={[0.6, 0.03, 0.2]} /><meshStandardMaterial color="#cbd5e1" /></mesh>
      <mesh position={[0, 0.5, 1.05]} castShadow><boxGeometry args={[0.6, 0.08, 0.6]} /><meshStandardMaterial color="#1f6b4a" /></mesh>
      <mesh position={[0, 0.85, 1.38]} castShadow><boxGeometry args={[0.6, 0.7, 0.08]} /><meshStandardMaterial color="#1f6b4a" /></mesh>
      <mesh position={[0, 0.25, 1.05]}><cylinderGeometry args={[0.04, 0.04, 0.5]} /><meshStandardMaterial color="#475569" /></mesh>
    </group>
  );
}

export function Room({ agent }: { agent: AgentDef }) {
  const pos = gridToWorld(agent.grid);
  const selected = useOffice((s) => s.selectedId === agent.id);
  const select = useOffice((s) => s.select);
  const isManager = agent.id === "manager";
  const bookish = agent.id === "archivist" || agent.id === "content" || agent.id === "administrator";

  return (
    <group position={pos}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow onClick={(e) => { e.stopPropagation(); select(agent.id); }}>
        <planeGeometry args={[ROOM_SIZE - 0.1, ROOM_SIZE - 0.1]} />
        <meshStandardMaterial color={selected ? "#d7efe2" : "#eef2f0"} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0.2]}>
        <planeGeometry args={[4.4, 3.4]} />
        <meshStandardMaterial color={isManager ? "#0f3d2b" : "#cfe3d9"} />
      </mesh>
      <mesh position={[0, WALL_H / 2, -H]} castShadow receiveShadow><boxGeometry args={[ROOM_SIZE, WALL_H, 0.15]} /><meshStandardMaterial color="#ffffff" /></mesh>
      <mesh position={[-H, WALL_H / 2, 0]} castShadow receiveShadow><boxGeometry args={[0.15, WALL_H, ROOM_SIZE]} /><meshStandardMaterial color="#f1f5f3" /></mesh>
      <mesh position={[0, 0.5, -H + 0.09]}><boxGeometry args={[ROOM_SIZE, 1, 0.02]} /><meshStandardMaterial color="#1f6b4a" /></mesh>
      <mesh position={[-H + 0.09, 0.5, 0]}><boxGeometry args={[0.02, 1, ROOM_SIZE]} /><meshStandardMaterial color="#1f6b4a" /></mesh>
      <mesh position={[0, 0.1, H]}><boxGeometry args={[ROOM_SIZE, 0.2, 0.12]} /><meshStandardMaterial color="#0f3d2b" /></mesh>
      <mesh position={[H, 0.1, 0]}><boxGeometry args={[0.12, 0.2, ROOM_SIZE]} /><meshStandardMaterial color="#0f3d2b" /></mesh>

      <mesh position={[2.5, 1.7, -H + 0.1]}><boxGeometry args={[1.8, 0.9, 0.04]} /><meshStandardMaterial color="#ffffff" /></mesh>

      <Desk agentId={agent.id} />
      <Character agent={agent} />
      <Plant position={[3, 0, 3]} />
      <Plant position={[-3, 0, 3]} />
      {bookish && <Shelf position={[-H + 0.35, 0, 1]} rotY={Math.PI / 2} />}
      {isManager && (
        <group position={[2.3, 0, 1.5]}>
          <mesh position={[0, 0.5, 0]} castShadow><cylinderGeometry args={[0.9, 0.9, 0.06, 24]} /><meshStandardMaterial color="#f5f5f4" /></mesh>
          <mesh position={[0, 0.25, 0]}><cylinderGeometry args={[0.08, 0.08, 0.5]} /><meshStandardMaterial color="#334155" /></mesh>
        </group>
      )}

      <Label position={[0, 3.1, -H + 0.2]} scale={1.1} lines={[{ text: agent.room, bg: "#0f3d2b", fg: "#ffffff", size: 15 }]} />
    </group>
  );
}
