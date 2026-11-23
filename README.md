# AI Teacher Office

Kantor virtual 3D dengan 10 pekerja AI untuk administrasi dan akademik guru.
Next.js 15 · React 19 · React Three Fiber · Tailwind 4 · Zustand · MySQL/MariaDB (opsional) · OpenAI (opsional).

## Menjalankan
```
npm install --legacy-peer-deps
npm run dev          # http://localhost:3000
npm test             # tes unit (kalkulasi, router, parser)
npm run typecheck
```
Tanpa konfigurasi apa pun, aplikasi berjalan **mode lokal**: tanpa login, data di localStorage browser.

## Menghubungkan MySQL (login + database + berkas)
1. Nyalakan MySQL/MariaDB (mis. XAMPP → Start MySQL).
2. Salin `.env.example` → `.env.local`, isi blok MySQL (`MYSQL_*`), `NEXT_PUBLIC_DB_ENABLED=1`, dan `AUTH_SECRET` (acak, min. 16 karakter).
3. `npm run db:setup` membuat tabel dari `db/schema.sql` (aman diulang). Database harus sudah ada (atau isi `MYSQL_ADMIN_USER` agar dibuatkan).
4. Restart `npm run dev`, buka aplikasi → Daftar → masuk. Data lokal yang sudah ada diunggah ke akun baru yang masih kosong; selanjutnya perubahan disimpan otomatis (indikator di bawah sidebar).

Cara kerja: login memakai email + kata sandi (bcrypt) dan cookie sesi bertanda tangan (`src/lib/auth`). Semua data lewat API server (`/api/db/load` = satu permintaan baca, `/api/db/save` = satu transaksi tulis); setiap baris punya `owner_id` dari sesi, jadi guru hanya melihat datanya sendiri. Berkas unggahan disimpan di `data/uploads/<id guru>/` (jangan di-commit). Middleware mengharuskan login; API route menolak permintaan tanpa sesi. Sebaiknya hanya satu perangkat menulis dalam satu waktu (tidak ada penyelesaian konflik multi-perangkat). `MYSQL_PASSWORD` kosong hanya untuk XAMPP lokal; di server sungguhan pakai pengguna khusus berhak terbatas.

## Menghubungkan penyedia AI (ChatGPT, Claude, Gemini)
Isi kunci salah satu penyedia di `.env.local` lalu restart server; aplikasi memilih penyedia **otomatis**:

| Isi di `.env.local` | Penyedia | Model bawaan |
|---|---|---|
| `OPENAI_API_KEY` | ChatGPT (OpenAI) | `gpt-4o-mini` |
| `GEMINI_API_KEY` | Google Gemini | `gemini-3.6-flash` |
| `ANTHROPIC_API_KEY` | Anthropic Claude | `claude-haiku-5-5` |

- Bila beberapa kunci terisi, tambahkan `AI_PROVIDER=openai|gemini|anthropic` untuk memilih. Tanpa itu urutannya OpenAI, Gemini, lalu Claude.
- Ganti model dengan `OPENAI_MODEL`, `GEMINI_MODEL`, atau `ANTHROPIC_MODEL`. Untuk model baca-gambar yang berbeda: `AI_VISION_MODEL`.
- Groq, OpenRouter, atau Ollama lokal: `AI_PROVIDER=custom` + `AI_API_KEY` + `AI_BASE_URL` + `AI_MODEL` (format OpenAI).
- **Otak per karyawan:** `AI_MODEL_<ID>` (manager, content, assignment, checker, archivist) berisi satu atau beberapa model dipisah koma; `AI_MODEL_FALLBACKS` menambah cadangan untuk semua. Model pertama dicoba dulu, bila 429/503/404/timeout otomatis pindah ke berikutnya (kunci ditolak 401/403 tidak berpindah). Cocok dengan model gratis OpenRouter (`:free`) yang dibatasi laju; contoh isian ada di `.env.example`. Halaman **Settings** menampilkan rantai model tiap karyawan. Karyawan administrator, attendance, grading, dan reporting menghitung langsung dari data, tanpa model.
- Konfigurasi lama `AI_API_KEY` + `AI_BASE_URL` tetap jalan. Penyedia aktif dan model terlihat di halaman **Settings**.
- Kunci hanya dibaca di server. Fitur yang memakainya: pemilihan agen oleh Office Manager (tool calling), pembuatan materi/soal, koreksi esai, membaca foto/gambar. Bila AI gagal, pemilihan agen otomatis memakai aturan kata kunci.
- Kunci Claude berasal dari console.anthropic.com (kredit API); langganan Claude.ai tidak menyertakannya.

Perhatian privasi: tier gratis sebagian penyedia dapat memakai prompt untuk pelatihan model; hindari mengirim data siswa yang sensitif.

## Struktur
```
src/app/            halaman + api/{command,generate,extract,auth,db,files}
src/components/     office/ (2D + panel), office3d/ (3D), layout/, tasks/, ui
src/lib/            router, executors (logika tiap agen), calc, docs (ekspor PDF/Excel/Word), sync, auth/ (sesi), db/ (MySQL)
src/store/          office (status karakter), tasks (antrian & persetujuan), data (kelas, siswa, nilai, arsip)
db/schema.sql      skema MySQL (npm run db:setup)
tests/              vitest
```

## Korektor Paper
Karyawan ke-10 ("Paper", meja di Tim Dokumen) mengoreksi paper/makalah siswa. Buka menu **Korektor Paper**: pilih kelas, buat tugas (topik, ketentuan, tenggat), atur rubrik (bawaan 5 kriteria = 100 poin; bobot dan batas predikat A/B/C bisa diubah), lalu unggah paper DOCX/PDF (satuan, atau banyak berkas yang dicocokkan dengan nama siswa) atau tempel teksnya.
- Tiap kriteria dinilai level 4/3/2/1 beserta alasan dan **kutipan bukti dari paper** (kutipan yang tidak ditemukan di paper dibuang). Nilai dihitung aplikasi (bobot × level/4), bukan oleh AI; level bisa Anda ubah.
- Tidak menebak: file kosong/terlalu pendek/terlalu panjang/terpotong atau kriteria yang tidak dinilai → "perlu dicek manual". Bila AI ragu antara dua level, dipilih yang lebih rendah dan ditandai.
- Catatan keaslian bersifat netral dengan tanda **[PERLU DICEK GURU]**; AI dilarang menuduh. Umpan balik siswa maksimal 80 kata.
- Rekap kelas: nama, nilai, predikat, catatan, rata-rata, siswa yang belum mengumpulkan, 3 kesalahan paling umum, unduh CSV. Nilai masuk ke Grades hanya setelah Anda setujui. Tidak ada email yang dikirim.
- Lewat Command Center: "koreksi paper" dengan lampiran DOCX/PDF menilai satu paper dengan rubrik bawaan (lampiran dibatasi 20.000 karakter; yang lebih panjang diarahkan ke menu Korektor Paper).
- **Draf balasan email gaya Kiko** (`src/lib/kiko.ts`): di tiap paper ada bagian "Draf balasan Kiko". Identitas diambil berurutan dari sampul paper, subjek email (`[KELAS] [Nama Tugas] - [Nama Siswa]`), lalu nama pengirim; bila berbeda, data lampiran dipakai dan perbedaannya dicatat; bila tidak ada, ditulis `[TIDAK DITEMUKAN]`. Nilai memakai skala 4 kriteria × 4 = maks. 16 (rubrik 5 kriteria digabung: Bahasa dan Sumber; tombol "Rubrik Kiko" menyetel rubrik 4 kriteria). Teks balasan dirakit lokal dengan format tetap; hanya ringkasan 1 kalimat dan perbaikan yang datang dari AI. Catatan salin-tempel hanya masuk catatan internal `[PERLU DICEK PAK TAMA]`, tidak ke balasan. Lampiran tidak terbaca → balasan minta kirim ulang PDF/Word tanpa nilai; identitas tak ada di paper → perbaikan "Tambahkan halaman sampul…"; siswa yang sama tidak dinilai dua kali. Nama guru, peran, dan sekolah di tanda tangan bisa diubah di "Profil Kiko" (tersimpan di browser). **Aplikasi tidak punya akses Gmail**: tombol "Buka di Gmail" membuka jendela tulis yang sudah terisi, dan Anda mengirimnya sendiri. Rekap draf (Nama | Kelas | Nilai | Status draf | Catatan) bisa diunduh sebagai CSV.
- Teks paper dikirim ke model AI (model gratis dapat menyimpan prompt) dan **tidak disimpan** setelah dinilai; hanya hasilnya. Model diatur lewat `AI_MODEL_PAPER`.

## Tampilan 3D / 2D
Halaman Virtual Office punya tombol **3D | 2D** (kanan atas; pilihan diingat di browser, bawaan 3D). Keduanya digambar dari denah yang sama (`src/lib/office2d/layout.ts`) dan digerakkan mesin simulasi yang sama: 3D di `src/components/office3d/` (isometrik ortografik, geser dengan seret, zoom dengan roda, klik karyawan untuk fokus), 2D di `src/components/office/OfficeCanvas.tsx`. `src/lib/sim/driver.ts` menjalankan waktu simulasi; `src/lib/sim/lighting.ts` menghitung lampu ruang.

## Simulasi kehidupan kantor
Kantor hidup: 10 AI Employee punya kepribadian, kebiasaan, kebutuhan (energi, lapar, haus, fokus, sosial), mood, dan hubungan antar rekan.
- **Mesin** (`src/lib/sim/`): murni logika, terpisah dari penggambaran, pengacak berbenih (`seed`) sehingga bisa diulang. `engine.ts` (state machine), `personas.ts` (identitas, kebiasaan, graf hubungan), `view.ts` (cuplikan untuk UI), `driver.ts` (menjalankan waktu).
- **Jam = waktu dunia nyata**: jam di kiri bawah halaman Virtual Office mengikuti jam komputer Anda (tanpa kontrol kecepatan, jeda, atau lompat jam). Jam mengatur langit, cahaya jendela, dan lampu ruang, jadi malam sungguhan terlihat gelap. **Tidak ada jadwal harian**: semua karyawan selalu ada di meja; mereka hanya beranjak karena kebutuhan (kopi, air, toilet, printer, ngobrol, istirahat) dan kejadian acak otomatis (telepon berdering, printer macet, minta tolong). Kebutuhan karyawan berjalan dengan laju simulasi sendiri (cepat) agar kantor terlihat hidup.
- **Tugas AI sungguhan mengalahkan aktivitas lain**: agen yang punya tugas (WORKING/PROCESSING/dll.) langsung kembali ke meja dan bekerja.
- Klik karyawan untuk melihat aktivitas saat ini, mood, kebutuhan, hubungan, dan riwayat hari itu.
- Untuk mengubah perilaku: edit `personas.ts` (kebiasaan, kepribadian) atau konstanta di `engine.ts` (laju kebutuhan, durasi). Tes: `npm test` (`tests/sim.test.ts`).