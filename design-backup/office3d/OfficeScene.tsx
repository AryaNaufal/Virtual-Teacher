"use client";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, OrthographicCamera } from "@react-three/drei";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { AGENTS, agentOrigin } from "@/lib/agents";
import { useOffice } from "@/store/office";
import { Room } from "./Room";
import { Memos } from "./Memo";

/** Zoom yang membuat seluruh kantor (3×3 ruangan) muat di jendela. */
const fitZoom = (w: number, h: number) => Math.max(4, Math.min(40, Math.min(w / 36, h / 30)));
const ANIM_MS = 1500;
const PANEL_PX = 340; // lebar panel profil di kanan layar saat agen dipilih
const RIGHT = new THREE.Vector3(1, 0, -1).normalize(); // arah "kanan layar" di dunia (kamera isometrik)

/**
 * Saat agen dipilih: kamera bergerak halus dan zoom in ke agen itu (digeser agar agen berada di tengah area yang tidak tertutup panel).
 * Saat pilihan ditutup (X / Esc): kembali ke kamera SEBELUM fokus (posisi, putaran, zoom). Setelah animasi selesai, zoom/putar manual tetap bebas.
 */
function CameraRig() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controls = useRef<any>(null);
  const { camera, size } = useThree();
  const selectedId = useOffice((s) => s.selectedId);
  const goal = useRef<{ target: THREE.Vector3; zoom: number; position?: THREE.Vector3 }>({ target: new THREE.Vector3(), zoom: 15 });
  const saved = useRef<{ target: THREE.Vector3; position: THREE.Vector3; zoom: number } | null>(null); // kamera sebelum fokus ke agen
  const until = useRef(0);
  const first = useRef(true);

  useEffect(() => {
    const a = AGENTS.find((x) => x.id === selectedId);
    const fit = fitZoom(size.width, size.height);
    const c = controls.current;
    if (a) {
      // ingat posisi kamera sebelum fokus pertama; berpindah antar-agen tidak menimpanya
      if (!saved.current && c && !first.current) saved.current = { target: c.target.clone(), position: camera.position.clone(), zoom: camera.zoom };
      const zoom = Math.max(30, Math.min(85, fit * 3.4));
      const [x, , z] = agentOrigin(a);
      const seatZ = z - 0.95; // posisi duduk karakter
      const shift = size.width > 700 ? PANEL_PX / 2 / zoom : 0; // geser ke kanan di dunia = karakter bergeser ke kiri di layar
      goal.current = { target: new THREE.Vector3(x + RIGHT.x * shift, 0.9, seatZ + RIGHT.z * shift), zoom };
    } else if (saved.current) {
      goal.current = { ...saved.current };
      saved.current = null;
    } else {
      goal.current = { target: new THREE.Vector3(0, 0, 0), zoom: fit };
    }
    if (!first.current) until.current = performance.now() + ANIM_MS;
  }, [selectedId, size.width, size.height, camera]);

  useFrame(() => {
    const c = controls.current;
    if (!c) return;
    if (first.current) {
      // frame pertama: langsung pas dengan jendela, tanpa animasi
      first.current = false;
      const d = goal.current.target.clone().sub(c.target);
      c.target.add(d);
      camera.position.add(d);
      camera.zoom = goal.current.zoom;
      camera.updateProjectionMatrix();
      c.update();
      return;
    }
    if (performance.now() > until.current) return;
    if (goal.current.position) {
      c.target.lerp(goal.current.target, 0.1);
      camera.position.lerp(goal.current.position, 0.1);
    } else {
      const d = goal.current.target.clone().sub(c.target).multiplyScalar(0.1);
      c.target.add(d);
      camera.position.add(d);
    }
    camera.zoom += (goal.current.zoom - camera.zoom) * 0.1;
    camera.updateProjectionMatrix();
    c.update();
  });

  return (
    <OrbitControls
      ref={controls}
      enablePan={false}
      minZoom={4}
      maxZoom={90}
      minPolarAngle={Math.PI / 6}
      maxPolarAngle={Math.PI / 2.6}
    />
  );
}

export default function OfficeScene() {
  return (
    // Klik di area kosong tidak membatalkan pilihan; kembali lewat X di panel, tombol "Lihat seluruh kantor", atau Esc.
    <Canvas shadows>
      <color attach="background" args={["#e8efeb"]} />
      <OrthographicCamera makeDefault position={[26, 26, 26]} zoom={20} near={-100} far={200} />
      <ambientLight intensity={0.9} />
      <hemisphereLight args={["#ffffff", "#9fb8aa", 0.5]} />
      <directionalLight
        position={[15, 25, 10]}
        intensity={1.6}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
        shadow-bias={-0.0006}
        shadow-normalBias={0.05}
      />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#cfdcd5" />
      </mesh>
      {AGENTS.map((a) => <Room key={a.id} agent={a} />)}
      <Memos />
      <CameraRig />
    </Canvas>
  );
}
