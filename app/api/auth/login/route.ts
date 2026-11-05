import { createHash } from "node:crypto";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database.types";
import { loginSchema } from "@/lib/schemas";
const attempts = new Map<string, { count: number; startedAt: number }>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function isLimited(key: string) {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || now - entry.startedAt >= WINDOW_MS) {
    attempts.set(key, { count: 1, startedAt: now });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_ATTEMPTS;
}

function hashed(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function POST(request: NextRequest) {
  let raw: unknown;
  try { raw = await request.json(); } catch { return NextResponse.json({ error: "Username atau password salah." }, { status: 400 }); }
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Username atau password salah." }, { status: 400 });

  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const usernameKey = hashed(parsed.data.username);
  if (isLimited(`ip:${hashed(forwarded)}`) || isLimited(`username:${usernameKey}`)) {
    return NextResponse.json({ error: "Terlalu banyak percobaan. Silakan coba kembali beberapa saat lagi." }, { status: 429 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.json({ error: "Layanan masuk belum dikonfigurasi." }, { status: 503 });

  const response = NextResponse.json({ ok: true });
  const supabase = createServerClient<Database>(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) { for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options); },
    },
  });
  const { data, error } = await supabase.auth.signInWithPassword({
    email: `${parsed.data.username}@mutabaah.internal`,
    password: parsed.data.password,
  });
  if (error || !data.user) {
    response.cookies.getAll().forEach((cookie) => response.cookies.delete(cookie.name));
    return NextResponse.json({ error: "Username atau password salah." }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase.from("profiles").select("is_active").eq("id", data.user.id).maybeSingle();
  if (profileError || !profile?.is_active) {
    await supabase.auth.signOut();
    return NextResponse.json({ error: "Username atau password salah." }, { status: 401 });
  }
  attempts.delete(`ip:${hashed(forwarded)}`);
  attempts.delete(`username:${usernameKey}`);
  return response;
}
