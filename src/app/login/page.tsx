"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { dbEnabled } from "@/lib/dbmode";
import { btnCls, inputCls } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [busy, setBusy] = useState(false);

  if (!dbEnabled)
    return (
      <div className="grid min-h-screen place-items-center p-6">
        <div className="max-w-md rounded-2xl border bg-white p-6 text-sm">
          <h1 className="mb-2 text-lg font-bold">Mode lokal</h1>
          Database belum diaktifkan, jadi login tidak diperlukan dan data tersimpan di browser ini. Lihat README untuk mengaktifkan database MySQL.
          <button onClick={() => router.push("/")} className={`${btnCls} mt-4 block`}>Masuk ke kantor</button>
        </div>
      </div>
    );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      if (mode === "up" && password.length < 8) throw new Error("Kata sandi minimal 8 karakter.");
      const res = await fetch(mode === "in" ? "/api/auth/login" : "/api/auth/register", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password, name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Gagal (HTTP ${res.status})`);
      router.replace("/");
      router.refresh();
    } catch (err) {
      setMsg({ ok: false, t: (err as Error).message });
    } finally { setBusy(false); }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-[#0f3d2b] p-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-3 rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-2 flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-[#3ddc97] font-black text-[#0f3d2b]">AI</div>
          <div><div className="font-bold">Teacher Office</div><div className="text-xs text-slate-500">{mode === "in" ? "Masuk sebagai Director" : "Buat akun guru"}</div></div>
        </div>
        {mode === "up" && <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama lengkap" className={`${inputCls} w-full`} />}
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className={`${inputCls} w-full`} />
        <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Kata sandi" className={`${inputCls} w-full`} />
        {msg && <p className={`text-xs ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{msg.t}</p>}
        <button disabled={busy} className={`${btnCls} w-full`}>{busy ? "Memproses…" : mode === "in" ? "Masuk" : "Daftar"}</button>
        <button type="button" onClick={() => { setMode(mode === "in" ? "up" : "in"); setMsg(null); }} className="w-full text-center text-xs text-slate-500 hover:underline">
          {mode === "in" ? "Belum punya akun? Daftar" : "Sudah punya akun? Masuk"}
        </button>
      </form>
    </div>
  );
}
