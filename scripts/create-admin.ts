import { createClient } from "@supabase/supabase-js";
import { loadEnvConfig } from "@next/env";
import type { Database } from "../types/database.types";

loadEnvConfig(process.cwd());

const [argumentUsername, argumentPassword, argumentFullName] = process.argv.slice(2);
const username = (argumentUsername ?? process.env.SUPABASE_ADMIN_USERNAME ?? "").trim().toLowerCase();
const password = argumentPassword ?? process.env.SUPABASE_ADMIN_PASSWORD ?? "";
const fullName = (argumentFullName ?? process.env.SUPABASE_ADMIN_FULL_NAME ?? "").trim();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) throw new Error("NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY harus tersedia di environment.");
if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username)) throw new Error("Username admin harus 3–32 karakter dan memakai huruf kecil, angka, titik, garis bawah, atau tanda hubung.");
if (password.length < 12 || password.length > 128) throw new Error("Kata sandi admin harus 12–128 karakter.");
if (!fullName || fullName.length > 120) throw new Error("Nama lengkap admin harus diisi (maksimal 120 karakter).");

const supabase = createClient<Database>(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
const email = `${username}@mutabaah.internal`;

async function main() {
  const { data: existingProfile, error: profileReadError } = await supabase.from("profiles").select("id").eq("username", username).maybeSingle();
  if (profileReadError) {
    process.stderr.write(`Pemeriksaan profil gagal (${profileReadError.code ?? "tanpa kode"}): ${profileReadError.message}\n`);
    throw new Error("Profil admin belum dapat diperiksa. Pastikan migration sudah diterapkan dan key server benar.");
  }

  let userId = existingProfile?.id;
  let createdNow = false;
  if (!userId) {
    const { data: users, error: listError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listError) throw new Error("Akun Auth belum dapat diperiksa.");
    const existingAuthUser = users.users.find((user) => user.email === email);
    if (existingAuthUser) userId = existingAuthUser.id;
  }

  if (userId) {
    const { error } = await supabase.auth.admin.updateUserById(userId, { email, password, email_confirm: true });
    if (error) throw new Error("Kredensial akun admin belum dapat diperbarui.");
  } else {
    const { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
    if (error || !data.user) throw new Error("Akun admin belum dapat dibuat.");
    userId = data.user.id;
    createdNow = true;
  }

  const { error: profileError } = await supabase.from("profiles").upsert({
    id: userId, username, full_name: fullName, role: "admin", is_active: true,
  }, { onConflict: "id" });
  if (profileError) {
    if (createdNow) await supabase.auth.admin.deleteUser(userId);
    throw new Error("Profil admin belum dapat disimpan. Periksa migration dan username unik.");
  }
  process.stdout.write("Akun admin MUTABA'AH siap digunakan.\n");
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : "Pembuatan akun admin gagal."}\n`);
  process.exitCode = 1;
});
