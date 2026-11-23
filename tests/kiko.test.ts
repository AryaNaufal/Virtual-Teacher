import { describe, expect, it } from "vitest";
import { DEFAULT_KIKO, KIKO_RUBRIC, NOT_FOUND, buildDraft, draftRecapCsv, gmailComposeUrl, kikoRows, parseSubject, resolveIdentity } from "@/lib/kiko";
import { DEFAULT_RUBRIC, PaperItem } from "@/lib/paper";

const crit = (levels: Record<string, 1 | 2 | 3 | 4>) => Object.entries(levels).map(([id, level]) => ({ id, level, reason: `Alasan ${id}.`, quote: "", quoteOk: false }));
const item = (over: Partial<PaperItem> = {}): PaperItem => ({
  id: "i1", studentId: "s1", submittedOn: "2026-11-20", late: false, status: "graded", chars: 2000, score: 80, grade: "B",
  criteria: crit({ isi: 3, struktur: 4, analisis: 2, bahasa: 3, sumber: 2 }),
  identity: { name: "Quen Sha Putri", nis: "", className: "XII DKV 3", school: "SMK Letris Indonesia 2", title: "Prinsip UI" },
  summary: "Paper membahas tiga prinsip desain antarmuka.", improvements: ["Tambahkan contoh nyata.", "Rapikan ejaan.", "Cantumkan sumber."],
  ...over,
});
const P = DEFAULT_KIKO;
const draft = (it: PaperItem, extra = {}) => buildDraft({ profile: P, item: it, rubric: DEFAULT_RUBRIC, taskTitle: "Paper UI/UX", rosterName: "Quen Sha Putri", rosterClass: "XII DKV 3", ...extra });

describe("identitas", () => {
  it("subjek berformat [KELAS] [Nama Tugas] - [Nama Siswa]", () => {
    expect(parseSubject("XIIDKV3 Paper UI/UX - Quen Sha")).toEqual({ className: "XIIDKV3", task: "Paper UI/UX", name: "Quen Sha" });
    expect(parseSubject("Re: XIIDKV3 Paper UI/UX - Quen Sha")?.name).toBe("Quen Sha");
    expect(parseSubject("halo pak")).toBeNull();
  });
  it("urutan sumber: lampiran → subjek → pengirim; berbeda dicatat dan lampiran dipakai", () => {
    const a = resolveIdentity({ paper: { name: "Quen Sha Putri", nis: "", className: "XII DKV 3", school: "SMK X", title: "J" }, subject: "XIIDKV2 Paper - Budi" });
    expect(a.name).toBe("Quen Sha Putri");
    expect(a.className).toBe("XII DKV 3");
    expect(a.notes.join(" ")).toMatch(/Nama berbeda.*Budi/);
    expect(a.notes.join(" ")).toMatch(/Kelas berbeda.*XIIDKV2/);
    const b = resolveIdentity({ paper: { name: "", nis: "", className: "", school: "", title: "" }, subject: "XIIDKV3 Paper - Quen Sha", senderName: "Lainnya" });
    expect(b).toMatchObject({ name: "Quen Sha", className: "XIIDKV3", school: NOT_FOUND, title: NOT_FOUND });
    const c = resolveIdentity({ paper: undefined, senderName: "Nama Pengirim" });
    expect(c.name).toBe("Nama Pengirim");
  });
  it("tidak ditemukan → [TIDAK DITEMUKAN], tidak menebak; daftar siswa hanya cadangan terakhir dan dicatat", () => {
    const x = resolveIdentity({});
    expect(x).toMatchObject({ name: NOT_FOUND, className: NOT_FOUND, school: NOT_FOUND });
    const y = resolveIdentity({ rosterName: "Ani Lestari", rosterClass: "XI DKV" });
    expect(y.name).toBe("Ani Lestari");
    expect(y.notes.join(" ")).toMatch(/daftar siswa/);
  });
});

describe("nilai gaya Kiko (maks. 16)", () => {
  it("rubrik 5 kriteria: Bahasa dan Sumber digabung, dibulatkan ke bawah", () => {
    const r = kikoRows(DEFAULT_RUBRIC, item().criteria!);
    expect(r.rows.map((x) => [x.label, x.level])).toEqual([["Isi dan pemahaman", 3], ["Struktur", 4], ["Analisis", 2], ["Bahasa dan sumber", 2]]);
    expect([r.total, r.max]).toEqual([11, 16]);
  });
  it("rubrik Kiko 4 kriteria dipakai apa adanya", () => {
    const r = kikoRows(KIKO_RUBRIC, crit({ isi: 4, struktur: 4, analisis: 3, bahasasumber: 1 }));
    expect([r.total, r.max, r.rows.length]).toEqual([12, 16, 4]);
  });
});

describe("draf balasan", () => {
  it("format persis: salam panggilan, identitas, nilai /16, perbaikan, wewenang guru, tanda tangan", () => {
    const d = draft(item(), { });
    expect(d.kind).toBe("nilai");
    expect(d.subject).toBe("Re: XIIDKV3 Paper UI/UX - Quen Sha".replace("XIIDKV3", "XIIDKV3").replace("Quen Sha", "Quen Sha Putri"));
    expect(d.body.split("\n")).toEqual([
      "Halo Quen,", "",
      'Paper "Prinsip UI" sudah Kiko terima.',
      "Identitas: Quen Sha Putri, kelas XII DKV 3, SMK Letris Indonesia 2.",
      "Paper membahas tiga prinsip desain antarmuka.", "",
      "Nilai: 11/16",
      "- Isi dan pemahaman: 3/4. Alasan isi.",
      "- Struktur: 4/4. Alasan struktur.",
      "- Analisis: 2/4. Alasan analisis.",
      "- Bahasa dan sumber: 2/4. Alasan bahasa. Alasan sumber.", "",
      "Perbaikan:", "1. Tambahkan contoh nyata.", "2. Rapikan ejaan.", "3. Cantumkan sumber.", "",
      "Nilai akhir tetap wewenang Pak Tama.", "",
      "Salam,", "Kiko", "Asisten Kelas UI/UX – Pak Tama", "SMK Letris Indonesia 2",
      "(Kiko adalah asisten AI yang bekerja atas arahan Pak Tama.)",
    ]);
    expect(d.scoreText).toBe("11/16");
  });
  it("subjek asli dipakai dengan awalan Re:", () => {
    expect(draft(item({ subject: "XIIDKV3 Paper UI/UX - Quen Sha" })).subject).toBe("Re: XIIDKV3 Paper UI/UX - Quen Sha");
  });
  it("identitas tidak ada di paper: tetap dinilai, perbaikan sampul ditambahkan, [TIDAK DITEMUKAN] tampil", () => {
    const d = draft(item({ identity: { name: "", nis: "", className: "", school: "", title: "" } }), { rosterName: "", rosterClass: "" });
    expect(d.kind).toBe("nilai");
    expect(d.body).toContain("Tambahkan halaman sampul berisi nama, kelas, dan nama sekolah.");
    expect(d.body).toContain(NOT_FOUND);
    expect(d.body).toContain("Halo [TIDAK DITEMUKAN],");
  });
  it("terindikasi salin-tempel: TIDAK ada di balasan, hanya di catatan internal [PERLU DICEK PAK TAMA]", () => {
    const d = draft(item({ originality: { flag: true, note: "[PERLU DICEK GURU] Paragraf 3 berbeda gaya." } }));
    expect(d.body).not.toMatch(/salin|tempel|menyontek|PERLU DICEK|keaslian/i);
    expect(d.notes.join(" ")).toContain("[PERLU DICEK PAK TAMA] Paragraf 3 berbeda gaya.");
  });
  it("lampiran tidak terbaca: tidak ada nilai, minta kirim ulang PDF/Word", () => {
    const d = draft({ ...item(), status: "manual", criteria: undefined, score: undefined, manualReason: "File kosong" });
    expect(d.kind).toBe("kirim-ulang");
    expect(d.body).not.toMatch(/Nilai: /);
    expect(d.body).toMatch(/PDF atau Word/);
    expect(d.status).toBe("Minta kirim ulang lampiran");
    expect(d.notes.join(" ")).toContain("File kosong");
  });
  it("profil guru dan sekolah bisa diganti", () => {
    const d = buildDraft({ profile: { teacher: "Bu Sari", school: "SMK Lain", role: "Asisten Kelas" }, item: item(), rubric: DEFAULT_RUBRIC, taskTitle: "T" });
    expect(d.body).toContain("Nilai akhir tetap wewenang Bu Sari.");
    expect(d.body).toContain("Asisten Kelas – Bu Sari");
    expect(d.body).toContain("(Kiko adalah asisten AI yang bekerja atas arahan Bu Sari.)");
  });
});

describe("Gmail dan rekap draf", () => {
  it("tautan tulis email di-encode dan tidak mengirim apa pun (hanya membuka jendela tulis)", () => {
    const u = gmailComposeUrl("a@b.id", "Re: Tugas & nilai", "Halo\nSalam");
    expect(u.startsWith("https://mail.google.com/mail/?view=cm&fs=1&to=a%40b.id&su=Re%3A%20Tugas%20%26%20nilai&body=Halo%0ASalam")).toBe(true);
  });
  it("CSV rekap draf: header Nama | Kelas | Nilai | Status draf | Catatan", () => {
    const csv = draftRecapCsv([{ name: "A", className: "XI", scoreText: "12/16", status: "Draf siap (belum dikirim)", notes: "x" }]);
    expect(csv.startsWith('﻿"Nama","Kelas","Nilai","Status draf","Catatan"')).toBe(true);
    expect(csv).toContain('"12/16"');
  });
});
