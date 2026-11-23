export type AgentStatus = "IDLE" | "WORKING" | "PROCESSING" | "COMPLETED" | "NEEDS_APPROVAL";

export interface AgentDef {
  id: string;
  name: string;
  title: string;
  room: string;
  grid: [number, number]; // [col, row] di denah 3x3
  description: string;
  skills: string[];
  shirt: string;
  skin: string;
  hair: string;
}

export const STATUS_META: Record<AgentStatus, { label: string; color: string; desc: string }> = {
  IDLE: { label: "Idle", color: "#94a3b8", desc: "Sedang tidak bekerja" },
  WORKING: { label: "Working", color: "#3b82f6", desc: "Sedang mengerjakan tugas" },
  PROCESSING: { label: "Processing", color: "#f59e0b", desc: "Sedang memproses data" },
  COMPLETED: { label: "Completed", color: "#22c55e", desc: "Pekerjaan selesai" },
  NEEDS_APPROVAL: { label: "Needs Approval", color: "#ef4444", desc: "Menunggu persetujuan guru" },
};

export const AGENTS: AgentDef[] = [
  { id: "manager", name: "Maya", title: "AI Office Manager", room: "Director Room", grid: [0, 0],
    description: "Menerima instruksi guru, membagi tugas ke AI Specialist, memantau progres, dan menggabungkan hasil.",
    skills: ["Analisis instruksi", "Distribusi tugas", "Monitoring progres", "Penggabungan hasil"], shirt: "#0f3d2b", skin: "#e0ac84", hair: "#1a1a1a" },
  { id: "administrator", name: "Adi", title: "AI Administrator", room: "Administration Room", grid: [1, 0],
    description: "Mengelola data siswa, kelas, mata pelajaran, dan dokumen administrasi.",
    skills: ["Data siswa", "Data kelas", "Dokumen administrasi", "Arsip digital"], shirt: "#475569", skin: "#c68642", hair: "#2b1d12" },
  { id: "attendance", name: "Ayu", title: "AI Attendance", room: "Attendance Room", grid: [2, 0],
    description: "Mengolah absensi: hadir, sakit, izin, alfa, serta persentase kehadiran.",
    skills: ["Rekap absensi", "Persentase kehadiran", "Laporan absensi"], shirt: "#2f855a", skin: "#f1c27d", hair: "#3b2314" },
  { id: "grading", name: "Gilang", title: "AI Grading", room: "Grading Room", grid: [0, 1],
    description: "Mengelola nilai tugas, ujian, dan praktik; menghitung rata-rata dan rekap nilai.",
    skills: ["Hitung nilai", "Rata-rata", "Rekap nilai", "Analisis perkembangan"], shirt: "#1d4ed8", skin: "#d9a066", hair: "#111827" },
  { id: "checker", name: "Citra", title: "AI Checker", room: "Examination Room", grid: [1, 1],
    description: "Memeriksa jawaban pilihan ganda, esai berbasis rubrik, dan memberi rekomendasi nilai.",
    skills: ["Koreksi PG", "Penilaian esai", "Umpan balik", "Rubrik"], shirt: "#7c3aed", skin: "#f1c27d", hair: "#4a2c17" },
  { id: "content", name: "Kirana", title: "AI Content Creator", room: "Learning Studio", grid: [2, 1],
    description: "Membuat materi, rangkuman, modul, dan presentasi sesuai jenjang.",
    skills: ["Materi ajar", "Modul", "Presentasi", "Adaptasi jenjang"], shirt: "#be185d", skin: "#e0ac84", hair: "#1f1f1f" },
  { id: "assignment", name: "Arga", title: "AI Assignment Creator", room: "Assignment Studio", grid: [0, 2],
    description: "Membuat soal PG, esai, kuis, tugas praktik, lengkap dengan kunci dan pembahasan.",
    skills: ["Soal PG", "Soal esai", "Kuis", "Kunci jawaban"], shirt: "#b45309", skin: "#c68642", hair: "#0f0f0f" },
  { id: "reporting", name: "Rani", title: "AI Reporting", room: "Reporting Room", grid: [1, 2],
    description: "Menggabungkan nilai dan absensi menjadi laporan akademik PDF, Excel, dan Word.",
    skills: ["Laporan akademik", "Ekspor PDF/Excel/Word", "Gabung data"], shirt: "#0e7490", skin: "#f1c27d", hair: "#5a3a22" },
  { id: "archivist", name: "Arka", title: "AI Archivist", room: "Archive Room", grid: [2, 2],
    description: "Menyimpan dan mengelompokkan dokumen berdasarkan kelas dan mata pelajaran.",
    skills: ["Penyimpanan", "Pengelompokan", "Pencarian dokumen"], shirt: "#57534e", skin: "#d9a066", hair: "#262626" },
  { id: "paper", name: "Paper", title: "AI Korektor Paper", room: "Paper Room", grid: [3, 2],
    description: "Mengoreksi paper (makalah) siswa secara adil dan konsisten dengan rubrik: nilai per kriteria, catatan keaslian, umpan balik, dan rekap kelas.",
    skills: ["Rubrik paper", "Bukti kutipan", "Catatan keaslian", "Umpan balik siswa", "Rekap kelas"], shirt: "#0f766e", skin: "#e0ac84", hair: "#1c1917" },
];

/** Titik acuan meja kerja agen di dunia 3D (kursi sekitar 1 unit di depan meja). */
export const ROOM_SIZE = 8;
export const gridToWorld = ([c, r]: [number, number]): [number, number, number] => [
  (c - 1) * ROOM_SIZE, 0, (r - 1) * ROOM_SIZE,
];

/** Titik acuan meja kerja agen di dunia 3D (= pusat ruangannya; kursi sekitar 1 unit di depan meja). */
export const agentOrigin = (a: AgentDef): [number, number, number] => gridToWorld(a.grid);

/** Posisi z meja relatif ke titik acuan. */
export const deskDz = (_a: AgentDef) => -2;