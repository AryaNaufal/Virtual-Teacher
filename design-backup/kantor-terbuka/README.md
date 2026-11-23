# Cadangan: desain kantor terbuka (satu ruang, lantai keramik, ruang kaca, meja berhadapan)

Dibuat dari referensi gambar kantor open-plan, lalu dilepas dari aplikasi atas permintaan (dikembalikan ke desain 9 ruangan).
File di sini TIDAK ikut dikompilasi (dikecualikan di tsconfig.json).

Isi: OfficeLayout.tsx (denah), Workstation.tsx (meja + karakter), OfficeProps.tsx (dinding kaca, pintu, sofa, dispenser, dll).

Untuk memakainya lagi:
1. Pindahkan ketiga file ke src/components/office/.
2. Di src/lib/agents.ts ganti grid menjadi pos: [x, z] (+ lip?: boolean) — posisi lama ada di riwayat percakapan:
   manager [-11,-7.5], administrator [11,-7.5], attendance [-6.3,-1 flip], grading [-3.7,-1 flip], checker [-6.3,4.1],
   content [-3.7,4.1], assignment [4.7,-1 flip], reporting [7.3,-1 flip], archivist [4.7,4.1]
   dan agentOrigin = [pos[0], 0, pos[1]], deskDz = flip ? 2 : -2.
3. Di OfficeScene.tsx ganti <Room/> dengan <OfficeLayout/>.
