/** Draf balasan email gaya Kiko untuk tugas paper. Logika murni (tanpa jaringan): identitas, nilai /16, dan isi draf dirakit lokal dari hasil koreksi. */
import type { Criterion, CriterionResult, PaperItem } from "./paper";

export interface KikoProfile { teacher: string; school: string; role: string }
export const DEFAULT_KIKO: KikoProfile = { teacher: "Pak Tama", school: "SMK Letris Indonesia 2", role: "Asisten Kelas UI/UX" };
export const NOT_FOUND = "[TIDAK DITEMUKAN]";
export const COVER_FIX = "Tambahkan halaman sampul berisi nama, kelas, dan nama sekolah.";

/** Rubrik Kiko: 4 kriteria × skor 1–4 = maks. 16. */
export const KIKO_RUBRIC: Criterion[] = [
  { id: "isi", name: "Isi dan pemahaman materi", weight: 25, desc: "Ketepatan konsep, kedalaman, contoh relevan" },
  { id: "struktur", name: "Struktur dan sistematika", weight: 25, desc: "Pendahuluan, isi, penutup, alur logis" },
  { id: "analisis", name: "Analisis dan pendapat sendiri", weight: 25, desc: "Argumen, keterkaitan dengan praktik UI/UX" },
  { id: "bahasasumber", name: "Bahasa, penulisan, dan sumber", weight: 25, desc: "Ejaan, kalimat efektif, kerapian, sumber dan kutipan" },
];

const clean = (s?: string) => (s ?? "").trim();
const flat = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const first = (name: string) => name.trim().split(/\s+/)[0] ?? name;

/** Subjek email berformat "[KELAS] [Nama Tugas] - [Nama Siswa]", mis. "XIIDKV3 Paper UI/UX - Quen Sha". */
export function parseSubject(subject: string): { className: string; task: string; name: string } | null {
  const m = clean(subject).replace(/^(re|fwd?):\s*/i, "").match(/^(\S+)\s+(.+?)\s+-\s+(.+)$/i);
  return m ? { className: m[1], task: m[2], name: m[3].trim() } : null;
}

export interface Identity { name: string; className: string; school: string; title: string; nis: string; notes: string[]; missingOnCover: string[] }

/** Urutan sumber: (a) lampiran, (b) subjek email, (c) nama pengirim; nama/kelas dari daftar siswa hanya cadangan terakhir (dicatat). Tidak menebak. */
export function resolveIdentity(i: { paper?: PaperItem["identity"]; subject?: string; senderName?: string; rosterName?: string; rosterClass?: string }): Identity {
  const p = i.paper ?? { name: "", nis: "", className: "", school: "", title: "" };
  const s = parseSubject(i.subject ?? "");
  const notes: string[] = [];
  let name = clean(p.name) || s?.name || clean(i.senderName) || "";
  if (!clean(p.name) && name) notes.push(`Nama tidak ada di paper; diambil dari ${s?.name ? "subjek email" : "nama pengirim"}.`);
  if (!name && clean(i.rosterName)) { name = clean(i.rosterName); notes.push("Nama diambil dari daftar siswa karena tidak ada di paper, subjek, maupun nama pengirim."); }
  let className = clean(p.className) || s?.className || "";
  if (!clean(p.className) && className) notes.push("Kelas tidak ada di paper; diambil dari subjek email.");
  if (!className && clean(i.rosterClass)) { className = clean(i.rosterClass); notes.push("Kelas diambil dari daftar siswa karena tidak ada di paper maupun subjek."); }
  if (clean(p.name) && s?.name && flat(p.name) !== flat(s.name)) notes.push(`Nama berbeda: lampiran "${clean(p.name)}" vs subjek "${s.name}". Dipakai data lampiran.`);
  if (clean(p.className) && s?.className && flat(p.className) !== flat(s.className)) notes.push(`Kelas berbeda: lampiran "${clean(p.className)}" vs subjek "${s.className}". Dipakai data lampiran.`);
  return {
    name: name || NOT_FOUND, className: className || NOT_FOUND, school: clean(p.school) || NOT_FOUND, title: clean(p.title) || NOT_FOUND, nis: clean(p.nis), notes,
    missingOnCover: [!clean(p.name) && "nama", !clean(p.className) && "kelas", !clean(p.school) && "sekolah"].filter(Boolean) as string[],
  };
}

export interface KikoRow { label: string; level: number; reason: string }
/** Memetakan hasil koreksi ke baris nilai Kiko. Rubrik 5 kriteria bawaan: Bahasa dan Sumber digabung (level dibulatkan ke bawah). */
export function kikoRows(rubric: Criterion[], criteria: CriterionResult[]): { rows: KikoRow[]; total: number; max: number } {
  const by = new Map(criteria.map((c) => [c.id, c]));
  const ids = new Set(rubric.map((c) => c.id));
  let rows: KikoRow[];
  if (["isi", "struktur", "analisis", "bahasa", "sumber"].every((k) => ids.has(k) && by.has(k))) {
    const b = by.get("bahasa")!, s = by.get("sumber")!;
    rows = [
      { label: "Isi dan pemahaman", level: by.get("isi")!.level, reason: by.get("isi")!.reason },
      { label: "Struktur", level: by.get("struktur")!.level, reason: by.get("struktur")!.reason },
      { label: "Analisis", level: by.get("analisis")!.level, reason: by.get("analisis")!.reason },
      { label: "Bahasa dan sumber", level: Math.floor((b.level + s.level) / 2), reason: [b.reason, s.reason].filter(Boolean).join(" ") },
    ];
  } else {
    rows = rubric.filter((c) => by.has(c.id)).map((c) => ({ label: c.name, level: by.get(c.id)!.level, reason: by.get(c.id)!.reason }));
  }
  return { rows, total: rows.reduce((s, r) => s + r.level, 0), max: rows.length * 4 };
}

export interface DraftInput { profile: KikoProfile; item: PaperItem; rubric: Criterion[]; taskTitle: string; rosterName?: string; rosterClass?: string }
export interface Draft { kind: "nilai" | "kirim-ulang"; subject: string; body: string; identity: Identity; scoreText: string; status: string; notes: string[] }

const signature = (p: KikoProfile) => ["Salam,", "Kiko", `${p.role} – ${p.teacher}`, p.school, `(Kiko adalah asisten AI yang bekerja atas arahan ${p.teacher}.)`].join("\n");

export function buildDraft(d: DraftInput): Draft {
  const { profile: p, item, taskTitle } = d;
  const id = resolveIdentity({ paper: item.identity, subject: item.subject, senderName: item.senderName, rosterName: d.rosterName, rosterClass: d.rosterClass });
  const notes = [...id.notes];
  const nick = id.name === NOT_FOUND ? NOT_FOUND : first(id.name);
  const baseSubject = clean(item.subject)
    || (id.className !== NOT_FOUND && id.name !== NOT_FOUND ? `${id.className.replace(/\s+/g, "")} ${taskTitle} - ${id.name}` : taskTitle);
  const subject = /^re:/i.test(baseSubject) ? baseSubject : `Re: ${baseSubject}`;

  // Lampiran tidak ada / tidak bisa dibuka / tidak bisa dinilai: jangan beri nilai, minta kirim ulang.
  if (item.status === "manual" || item.status === "error" || item.status === "pending" || !item.criteria || item.score === undefined) {
    if (item.manualReason) notes.push(`Tidak dinilai: ${item.manualReason}`);
    return {
      kind: "kirim-ulang", subject, identity: id, scoreText: "–", status: "Minta kirim ulang lampiran", notes,
      body: [
        `Halo ${nick},`, "",
        `Terima kasih sudah mengirim tugas "${taskTitle}". Sayangnya lampiran paper belum bisa Kiko buka atau baca dengan utuh, jadi belum bisa Kiko periksa dan belum ada nilai.`,
        "Mohon kirim ulang lampirannya dalam bentuk PDF atau Word (.docx).", "",
        `Nilai akhir tetap wewenang ${p.teacher}.`, "", signature(p),
      ].join("\n"),
    };
  }

  const { rows, total, max } = kikoRows(d.rubric, item.criteria);
  const fixes = [...(item.improvements?.length ? item.improvements : (item.mistakes ?? []).map((m) => m.text)).slice(0, 3)];
  if (id.missingOnCover.length) fixes.push(COVER_FIX);
  if (!fixes.length) fixes.push("Pertahankan kualitas ini dan tambahkan contoh yang lebih beragam pada paper berikutnya.");
  if (item.originality?.flag) notes.push(`[PERLU DICEK ${p.teacher.toUpperCase()}] ${item.originality.note.replace(/^\[PERLU DICEK GURU\]\s*/, "")}`.trim());
  if (item.doubts?.length) notes.push("Ada keraguan level pada beberapa kriteria (diambil yang lebih rendah).");
  if (item.late) notes.push("Dikumpulkan terlambat.");
  if (id.name !== NOT_FOUND && id.className === NOT_FOUND) notes.push("Kelas tidak ditemukan.");

  const body = [
    `Halo ${nick},`, "",
    `Paper "${id.title}" sudah Kiko terima.`,
    `Identitas: ${id.name}, kelas ${id.className}, ${id.school}.`,
    ...(item.summary ? [item.summary] : []),
    "", `Nilai: ${total}/${max}`,
    ...rows.map((r) => `- ${r.label}: ${r.level}/4. ${r.reason}`),
    "", "Perbaikan:", ...fixes.map((f, i) => `${i + 1}. ${f}`),
    "", `Nilai akhir tetap wewenang ${p.teacher}.`, "", signature(p),
  ].join("\n");

  return { kind: "nilai", subject, body, identity: id, scoreText: `${total}/${max}`, status: "Draf siap (belum dikirim)", notes };
}

export const gmailComposeUrl = (to: string, subject: string, body: string) =>
  `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

const cell = (v: string) => `"${v.replace(/"/g, '""')}"`;
export const draftRecapCsv = (rows: { name: string; className: string; scoreText: string; status: string; notes: string }[]) =>
  "﻿" + [["Nama", "Kelas", "Nilai", "Status draf", "Catatan"], ...rows.map((r) => [r.name, r.className, r.scoreText, r.status, r.notes])].map((r) => r.map(cell).join(",")).join("\r\n");
