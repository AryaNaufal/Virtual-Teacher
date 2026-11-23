/** Identitas, kepribadian, kebiasaan, dan hubungan antar karyawan (9 AI Employee). Waktu dalam menit virtual sejak 00:00. */
export type Rel = "friend" | "colleague" | "boss" | "report" | "none";

export interface Persona {
  id: string;
  role: string;            // peran (ditampilkan di profil)
  traits: string[];        // kepribadian
  walk: number;            // pengali kecepatan jalan
  chatty: number;          // 0..1 suka ngobrol
  coffee: number;          // 0..1 suka kopi/minum
  diligence: number;       // 0..1 rajin (jarang keluar meja)
  habit?: { pantryAt: number };
  quirk: string;           // kebiasaan unik
  rel: Record<string, Rel>;
}

export const hm = (h: number, m = 0) => h * 60 + m;
export const fmtTime = (v: number) => { const x = ((Math.floor(v) % 1440) + 1440) % 1440; return `${String(Math.floor(x / 60)).padStart(2, "0")}:${String(x % 60).padStart(2, "0")}`; };

const TEAM_A = ["attendance", "grading", "checker", "content"];
const TEAM_B = ["assignment", "reporting", "archivist"];

export const PERSONAS: Record<string, Persona> = {
  manager: { id: "manager", role: "Office Manager", traits: ["rajin", "suka kopi"], walk: 1.05, chatty: 0.6, coffee: 0.9, diligence: 0.85, habit: { pantryAt: hm(9, 30) }, quirk: "Selalu ke pantry sebelum jam 10", rel: {} },
  administrator: { id: "administrator", role: "Administrator", traits: ["pendiam", "rajin"], walk: 0.95, chatty: 0.25, coffee: 0.4, diligence: 0.9, quirk: "Pendiam dan sangat teliti", rel: { manager: "boss", archivist: "friend" } },
  attendance: { id: "attendance", role: "Pengolah Absensi", traits: ["ngobrol", "ramah"], walk: 1.1, chatty: 0.9, coffee: 0.5, diligence: 0.6, quirk: "Suka menyapa semua orang", rel: { manager: "boss", content: "friend" } },
  grading: { id: "grading", role: "Pengolah Nilai", traits: ["suka kopi", "santai"], walk: 1.0, chatty: 0.5, coffee: 1.0, diligence: 0.6, quirk: "Peminum kopi terbanyak", rel: { manager: "boss", checker: "friend" } },
  checker: { id: "checker", role: "Pemeriksa Jawaban", traits: ["rajin", "teliti"], walk: 0.95, chatty: 0.35, coffee: 0.6, diligence: 1.0, quirk: "Paling rajin, jarang beranjak dari meja", rel: { manager: "boss", grading: "friend" } },
  content: { id: "content", role: "Pembuat Materi", traits: ["ngobrol", "kreatif"], walk: 1.15, chatty: 0.85, coffee: 0.5, diligence: 0.5, quirk: "Sering main pingpong saat istirahat", rel: { manager: "boss", attendance: "friend" } },
  assignment: { id: "assignment", role: "Pembuat Soal", traits: ["pendiam", "fokus"], walk: 0.9, chatty: 0.2, coffee: 0.3, diligence: 0.85, quirk: "Jarang meninggalkan meja", rel: { manager: "boss", reporting: "friend" } },
  reporting: { id: "reporting", role: "Penyusun Laporan", traits: ["rajin", "ramah"], walk: 1.0, chatty: 0.6, coffee: 0.7, diligence: 0.9, quirk: "Sering mencetak dokumen", rel: { manager: "boss", assignment: "friend" } },
  paper: { id: "paper", role: "Korektor Paper", traits: ["teliti", "adil"], walk: 0.9, chatty: 0.3, coffee: 0.55, diligence: 0.95, quirk: "Membaca paper sampai habis sebelum menilai", rel: { manager: "boss", checker: "friend" } },
  archivist: { id: "archivist", role: "Pengarsip", traits: ["pendiam", "suka kopi"], walk: 0.85, chatty: 0.3, coffee: 0.85, diligence: 0.8, quirk: "Berjalan paling pelan, suka kopi", rel: { manager: "boss", administrator: "friend" } },
};

/** Hubungan a → b (simetris untuk teman/rekan; boss↔report saling berlawanan). */
export function relOf(a: string, b: string): Rel {
  const r = PERSONAS[a]?.rel[b];
  if (r) return r;
  const inv = PERSONAS[b]?.rel[a];
  if (inv === "boss") return "report";
  if (inv === "report") return "boss";
  if (inv) return inv;
  if ((TEAM_A.includes(a) && TEAM_A.includes(b)) || (TEAM_B.includes(a) && TEAM_B.includes(b))) return "colleague";
  return a === "manager" || b === "manager" ? (a === "manager" ? "boss" : "report") : "none";
}

/** Seberapa besar kemungkinan dua orang saling menghampiri / berhenti ngobrol. */
export const REL_WEIGHT: Record<Rel, number> = { friend: 1, boss: 0.7, report: 0.7, colleague: 0.55, none: 0.25 };
