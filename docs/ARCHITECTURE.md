# AI Teacher Office — Arsitektur

Stack: Next.js 15 (App Router) · React 19 · TypeScript · Tailwind 4 · React Three Fiber/Three.js · Framer Motion · Zustand.
(Phase 5: MySQL (mysql2), OpenAI via API route, ExcelJS, jsPDF, docx.)

```
src/
  app/            Halaman & (nanti) API routes. [section] = placeholder modul Phase 3-5
  components/
    layout/       Sidebar
    office/       OfficeScene (canvas+kamera), Room, Character, Label, ProfilePanel, OfficeView
  lib/            agents.ts (9 agen + status), nav.ts (menu)
  store/          office.ts (status agen, riwayat, seleksi) — Zustand
```

Rencana modular (Phase 2+): `src/agents/<nama>/` per specialist (prompt, tools, handler),
`src/lib/orchestrator.ts` (Manager memilih specialist via tool calling),
`src/app/api/*` (semua panggilan OpenAI hanya di server; API key di `.env.local`, lihat `.env.example`).

Catatan teknis: label 3D memakai sprite canvas, bukan drei `<Html>` (konflik unmount di React 19).
TypeScript dipin ke v6 karena Next 15 belum mendukung TS 7.
