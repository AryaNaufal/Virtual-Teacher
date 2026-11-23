"use client";
import { AGENTS, OFFICE_D, OFFICE_W } from "@/lib/agents";
import { Label } from "./Label";
import { VacantDesk, Workstation } from "./Workstation";
import {
  Bookcase, Box, C, CoffeeCorner, FilingCabinet, FloorLamp, Frame, GlassWall, MeetingTable, Plant, Printer, Reception, Sofa,
  TrashBin, WallClock, WaterCooler, Whiteboard, WindowPane, WoodDoor, useTileTexture,
} from "./OfficeProps";

const X0 = -OFFICE_W / 2, X1 = OFFICE_W / 2; // -14 .. 14
const Z0 = -OFFICE_D / 2, Z1 = OFFICE_D / 2; // -12 .. 12
const WALL_H = 3;

/** Denah satu kantor terbuka: ruang kaca (Director, Administration, rapat) + dua kelompok meja berhadapan + resepsionis, ruang tunggu, dan pantry. */
export function OfficeLayout() {
  const tile = useTileTexture(14, 12); // ubin 2×2 unit
  return (
    <group>
      {/* pelat lantai (tampak tebal di sisi) + lantai keramik polos */}
      {/* atas pelat sengaja 6 cm di bawah lantai: bila sebidang akan terjadi z-fighting (kedip/garis acak) */}
      <Box p={[0, -0.36, 0]} s={[OFFICE_W + 0.6, 0.6, OFFICE_D + 0.6]} color="#a9b0ad" cast={false} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[OFFICE_W, OFFICE_D]} />
        <meshStandardMaterial map={tile} emissiveMap={tile} emissive="#ffffff" emissiveIntensity={0.18} roughness={0.55} metalness={0} />
      </mesh>

      {/* dinding luar putih dengan wainscot hijau tua: belakang (z-) dan kiri (x-) tinggi; sisi depan hanya pinggiran */}
      <Box p={[0, WALL_H / 2, Z0 - 0.12]} s={[OFFICE_W + 0.6, WALL_H, 0.3]} color={C.wall} />
      <Box p={[X0 - 0.12, WALL_H / 2, 0]} s={[0.3, WALL_H, OFFICE_D + 0.6]} color={C.wall} />
      <Box p={[0, 0.55, Z0 + 0.05]} s={[OFFICE_W, 1.1, 0.12]} color={C.base} cast={false} />
      <Box p={[X0 + 0.05, 0.55, 0]} s={[0.12, 1.1, OFFICE_D]} color={C.base} cast={false} />
      <Box p={[0, 1.13, Z0 + 0.05]} s={[OFFICE_W, 0.06, 0.15]} color={C.accent} cast={false} />
      <Box p={[X0 + 0.05, 1.13, 0]} s={[0.15, 0.06, OFFICE_D]} color={C.accent} cast={false} />
      <Box p={[0, WALL_H + 0.04, Z0 - 0.12]} s={[OFFICE_W + 0.6, 0.1, 0.34]} color={C.wallTop} cast={false} />
      <Box p={[X0 - 0.12, WALL_H + 0.04, 0]} s={[0.34, 0.1, OFFICE_D + 0.6]} color={C.wallTop} cast={false} />
      <Box p={[0, 0.15, Z1 + 0.15]} s={[OFFICE_W + 0.6, 0.3, 0.3]} color={C.wallTop} />
      <Box p={[X1 + 0.15, 0.15, 0]} s={[0.3, 0.3, OFFICE_D + 0.6]} color={C.wallTop} />

      {/* jendela & hiasan dinding belakang */}
      <WindowPane position={[-12.2, 1.9, Z0 + 0.1]} w={2} />
      <WindowPane position={[12.2, 1.9, Z0 + 0.1]} w={2} />
      <WoodDoor position={[0.4, 0, Z0 + 0.12]} />
      <WoodDoor position={[6.6, 0, Z0 + 0.12]} />
      <Frame position={[3.4, 1.9, Z0 + 0.12]} color="#d5ecdf" />
      <WallClock position={[9.6, 2.3, Z0 + 0.12]} />
      <Whiteboard position={[-4.75, 1.9, Z0 + 0.12]} standing={false} w={3.2} />
      {/* jendela & hiasan dinding kiri */}
      <WindowPane position={[X0 + 0.1, 1.9, -2]} rotY={Math.PI / 2} w={2.4} />
      <WindowPane position={[X0 + 0.1, 1.9, 3.5]} rotY={Math.PI / 2} w={2.4} />
      <Frame position={[X0 + 0.12, 1.9, 8.5]} rotY={Math.PI / 2} color="#d5ecdf" />
      <Frame position={[X0 + 0.12, 1.9, 0.9]} rotY={Math.PI / 2} color="#f3d9a4" />

      {/* Director Room (kaca) */}
      <GlassWall x={-8} z={-9} len={6} axis="z" />
      <GlassWall x={-11} z={-6} len={6} axis="x" door={1.8} />
      <Bookcase position={[-13.45, 0, -10.2]} rotY={Math.PI / 2} w={2.2} />
      <Plant position={[-8.8, 0, -11.2]} />
      <FloorLamp position={[-13.2, 0, -7]} />
      <TrashBin position={[-9.4, 0, -8.9]} />

      {/* Ruang rapat (kaca) */}
      <GlassWall x={-1.5} z={-9} len={6} axis="z" />
      <GlassWall x={-4.75} z={-6} len={6.5} axis="x" door={-1.5} />
      <MeetingTable position={[-4.75, 0, -9]} />
      <Plant position={[-2.1, 0, -11.2]} />
      <Label position={[-4.75, 3.3, -9]} scale={0.9} lines={[{ text: "Ruang Rapat", bg: "#39404c", fg: "#ffffff", size: 14 }]} />

      {/* Administration Room (kaca) */}
      <GlassWall x={8} z={-9} len={6} axis="z" />
      <GlassWall x={11} z={-6} len={6} axis="x" door={-1.6} />
      <Bookcase position={[13.45, 0, -9.5]} rotY={-Math.PI / 2} w={2.6} />
      <Plant position={[8.9, 0, -11.2]} />
      <FilingCabinet position={[9.2, 0, -11.5]} n={3} />

      {/* area umum belakang */}
      <WaterCooler position={[2.3, 0, -11.4]} />
      <Bookcase position={[4.1, 0, -11.55]} w={2} />
      <Plant position={[-0.6, 0, -11.2]} />
      <Whiteboard position={[0.6, 0, -3.2]} />
      <FloorLamp position={[-1.6, 0, -4.4]} />

      {/* dua kelompok meja berhadapan: baris belakang (flip) menghadap baris depan */}
      <Box p={[-5, 0.02, 1.55]} s={[5.3, 0.02, 0.06]} color="#5f8f78" cast={false} />
      <Box p={[6, 0.02, 1.55]} s={[5.3, 0.02, 0.06]} color="#5f8f78" cast={false} />
      <VacantDesk x={7.3} z={4.1} />
      <FilingCabinet position={[10.4, 0, 3.4]} rotY={-Math.PI / 2} n={3} />
      <Plant position={[10.4, 0, -0.6]} />
      <Plant position={[-9.4, 0, 1.2]} scale={0.9} />

      {/* resepsionis, ruang tunggu, pantry, dan alat cetak (depan) */}
      <Reception position={[-8.4, 0, 10]} />
      <Sofa position={[-12.7, 0, 3.4]} rotY={Math.PI / 2} />
      <Sofa position={[-12.7, 0, 7]} rotY={Math.PI / 2} />
      <Box p={[-11.2, 0.25, 5.2]} s={[0.9, 0.5, 0.9]} color="#e8d8bd" />
      <Printer position={[1, 0, 10.8]} rotY={Math.PI} />
      <CoffeeCorner position={[10.5, 0, 10.8]} rotY={Math.PI} />
      <Plant position={[-13, 0, 11]} scale={1.2} />
      <Plant position={[13, 0, 11]} scale={1.2} />
      <Plant position={[13, 0, 6.2]} />
      <Plant position={[4, 0, 11]} />
      <FloorLamp position={[-5.2, 0, 11]} />
      <Box p={[-5.8, 0.8, 9.6]} s={[0.12, 1.6, 4.2]} color={C.grey} />

      {AGENTS.map((a) => <Workstation key={a.id} agent={a} />)}
    </group>
  );
}
