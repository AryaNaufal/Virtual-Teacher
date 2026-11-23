import "./globals.css";
import type { Metadata } from "next";
import { Hydrator } from "@/components/layout/Hydrator";
import { Shell } from "@/components/layout/Shell";

export const metadata: Metadata = { title: "AI Teacher Office", description: "Kantor virtual 3D dengan pekerja AI untuk guru" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>
        <Hydrator />
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
