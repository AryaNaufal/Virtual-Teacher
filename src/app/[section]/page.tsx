import { notFound } from "next/navigation";
import { NAV } from "@/lib/nav";

export default async function Page({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const item = NAV.find((n) => n.href === `/${section}`);
  if (!item) notFound();
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">{item.label}</h1>
      <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
        Modul ini dijadwalkan pada Phase {item.phase}.
      </div>
    </div>
  );
}
