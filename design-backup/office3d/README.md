# Cadangan: kantor 3D isometrik (React Three Fiber)

Tampilan kantor 3D (9 ruangan, karakter kotak-kotak beranimasi, kamera zoom ke agen) diganti dengan kantor 2D pixel-art
(src/components/office/OfficeCanvas.tsx). File di sini TIDAK ikut dikompilasi (dikecualikan di tsconfig.json).

Untuk memakainya lagi: pindahkan semua file ke src/components/office/ dan di OfficeView.tsx ganti import OfficeCanvas dengan OfficeScene.
Paket three, @react-three/fiber, dan @react-three/drei masih terpasang. agents.ts masih menyimpan grid dan gentOrigin untuk 3D.
