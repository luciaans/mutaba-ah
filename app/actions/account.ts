"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireProfile, requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/types/action-state";
export type { ActionState } from "@/types/action-state";

const usernameSchema = z.string().trim().toLowerCase().min(3).max(32).regex(/^[a-z0-9][a-z0-9._-]*$/);
const passwordSchema = z.string().min(8, "Kata sandi minimal 8 karakter.").max(128);

export async function createUstazAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const authorized = await requireRole("admin");
  const username = usernameSchema.safeParse(formData.get("username"));
  const fullName = z.string().trim().min(1).max(120).safeParse(formData.get("full_name"));
  const password = passwordSchema.safeParse(formData.get("password"));
  if (!username.success || !fullName.success || !password.success) return { error: "Periksa kembali nama, username, dan kata sandi (minimal 8 karakter)." };

  try {
    const admin = createAdminClient();
    const email = `${username.data}@mutabaah.internal`;
    const { data, error } = await admin.auth.admin.createUser({ email, password: password.data, email_confirm: true });
    if (error || !data.user) return { error: "Akun tidak dapat dibuat. Pastikan username belum digunakan." };

    const { error: profileError } = await admin.from("profiles").insert({
      id: data.user.id, username: username.data, full_name: fullName.data, role: "ustaz", is_active: true,
    });
    if (profileError) {
      await admin.auth.admin.deleteUser(data.user.id);
      return { error: "Data akun tidak dapat disimpan. Periksa username, lalu coba kembali." };
    }
    revalidatePath("/pengguna");
    return { success: `Akun ${fullName.data} berhasil dibuat oleh ${authorized.full_name}.` };
  } catch {
    return { error: "Layanan akun belum siap. Periksa konfigurasi Supabase." };
  }
}

export async function resetUstazPasswordAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole("admin");
  const userId = z.string().uuid().safeParse(formData.get("user_id"));
  if (!userId.success) return { error: "Akun tidak ditemukan." };

  const temporaryPassword = `${randomBytes(18).toString("base64url")}Aa1!`;
  try {
    const admin = createAdminClient();
    const { data: profile } = await admin.from("profiles").select("id, role").eq("id", userId.data).maybeSingle();
    if (!profile || profile.role !== "ustaz") return { error: "Akun pembimbing tidak ditemukan." };
    const { error } = await admin.auth.admin.updateUserById(userId.data, { password: temporaryPassword });
    if (error) return { error: "Kata sandi belum dapat direset. Silakan coba kembali." };
    return { success: "Kata sandi berhasil direset. Sampaikan sementara kepada pemilik akun secara langsung.", temporaryPassword };
  } catch {
    return { error: "Layanan akun belum siap. Periksa konfigurasi Supabase." };
  }
}

export async function toggleUstazActiveAction(formData: FormData): Promise<ActionState> {
  await requireRole("admin");
  const id = z.string().uuid().safeParse(formData.get("user_id"));
  const active = z.enum(["true", "false"]).safeParse(formData.get("active"));
  if (!id.success || !active.success) return { error: "Akun pembimbing tidak ditemukan." };
  try {
    const admin = createAdminClient();
    const { data: profile } = await admin.from("profiles").select("id, role").eq("id", id.data).maybeSingle();
    if (!profile || profile.role !== "ustaz") return { error: "Akun pembimbing tidak ditemukan." };
    const { error } = await admin.from("profiles").update({ is_active: active.data === "true" }).eq("id", id.data);
    if (error) return { error: "Status akun belum dapat diperbarui." };
    revalidatePath("/pengguna");
    return { success: active.data === "true" ? "Akun pembimbing diaktifkan kembali." : "Akun pembimbing dinonaktifkan." };
  } catch {
    return { error: "Layanan akun belum siap. Periksa konfigurasi Supabase." };
  }
}

export async function changeOwnPasswordAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  await requireProfile();
  const currentPassword = z.string().min(1).safeParse(formData.get("current_password"));
  const password = passwordSchema.safeParse(formData.get("password"));
  const confirmation = z.string().safeParse(formData.get("password_confirmation"));
  if (!currentPassword.success || !password.success || !confirmation.success) return { error: "Isi kata sandi saat ini dan kata sandi baru (minimal 8 karakter)." };
  if (password.data !== confirmation.data) return { error: "Konfirmasi kata sandi baru belum cocok." };

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) return { error: "Sesi masuk berakhir. Silakan masuk kembali." };
    const { error: verifyError } = await supabase.auth.signInWithPassword({ email: user.email, password: currentPassword.data });
    if (verifyError) return { error: "Kata sandi saat ini salah." };
    const { error } = await supabase.auth.updateUser({ password: password.data });
    if (error) return { error: "Kata sandi baru belum dapat disimpan." };
    return { success: "Kata sandi berhasil diperbarui." };
  } catch {
    return { error: "Koneksi bermasalah. Silakan coba kembali." };
  }
}
