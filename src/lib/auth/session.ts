/** Sesi login berbasis cookie bertanda tangan HMAC-SHA256 (Web Crypto: jalan di middleware Edge maupun Node). */
export const COOKIE = "ato_session";
export interface Session { uid: number; email: string; name: string; exp: number }

const enc = new TextEncoder();
const b64 = (b: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

async function hmacKey(): Promise<CryptoKey | null> {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) return null;
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function signSession(p: Omit<Session, "exp">, days = 14): Promise<string> {
  const key = await hmacKey();
  if (!key) throw new Error("AUTH_SECRET belum diisi di .env.local (minimal 16 karakter).");
  const body = b64(enc.encode(JSON.stringify({ ...p, exp: Date.now() + days * 86400_000 })));
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  return `${body}.${b64(sig)}`;
}

export async function readSession(token?: string | null): Promise<Session | null> {
  if (!token) return null;
  const [body, sig] = token.split(".");
  const key = await hmacKey();
  if (!body || !sig || !key) return null;
  try {
    if (!(await crypto.subtle.verify("HMAC", key, unb64(sig), enc.encode(body)))) return null;
    const s = JSON.parse(new TextDecoder().decode(unb64(body))) as Session;
    return s.exp > Date.now() ? s : null;
  } catch { return null; }
}
