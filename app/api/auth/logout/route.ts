import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database.types";

export async function POST(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const response = NextResponse.json({ ok: true });
  if (url && key) {
    const supabase = createServerClient<Database>(url, key, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) { for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options); },
      },
    });
    await supabase.auth.signOut();
  }
  response.headers.set("location", new URL("/login", request.url).toString());
  return response;
}
