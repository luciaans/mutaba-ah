"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireProfile, requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { buildClassNameLookup, hasClassNameCandidate, isGradeSectionClassName, resolveClassId } from "@/lib/class-name";
import type { ActionState } from "@/types/action-state";
export type { ActionState } from "@/types/action-state";

const classSchema = z.object({ id: z.string().uuid().optional(), class_name: z.string().trim().min(1).max(80), description: z.string().trim().max(500), academic_year: z.string().trim().min(4).max(20) });
const studentSchema = z.object({ id: z.string().uuid().optional(), class_id: z.string().uuid(), full_name: z.string().trim().min(1).max(160), roll_number: z.coerce.number().int().positive().max(9999) });

export async function saveClassAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole("admin");
  const parsed = classSchema.safeParse({
    id: formData.get("id") || undefined, class_name: formData.get("class_name"),
    description: formData.get("description") ?? "", academic_year: formData.get("academic_year"),
  });
  if (!parsed.success) return { error: "Lengkapi nama kelas dan tahun pelajaran." };
  const supabase = await createClient();
  const payload = { class_name: parsed.data.class_name, description: parsed.data.description || null, academic_year: parsed.data.academic_year };
  const query = parsed.data.id ? supabase.from("classes").update(payload).eq("id", parsed.data.id) : supabase.from("classes").insert(payload);
  const { error } = await query;
  if (error) return { error: "Kelas tidak dapat disimpan. Pastikan nama kelas belum digunakan." };
  revalidatePath("/kelas"); revalidatePath("/santri");
  return { success: parsed.data.id ? "Perubahan kelas berhasil disimpan." : "Kelas berhasil ditambahkan." };
}

export async function deleteClassAction(formData: FormData): Promise<ActionState> {
  await requireRole("admin");
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { error: "Kelas tidak ditemukan." };
  const supabase = await createClient();
  const { error } = await supabase.from("classes").delete().eq("id", id.data);
  if (error) return { error: "Kelas masih memiliki santri atau catatan sehingga tidak dapat dihapus." };
  revalidatePath("/kelas"); revalidatePath("/santri");
  return { success: "Kelas berhasil dihapus." };
}

export async function saveStudentAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireProfile();
  const parsed = studentSchema.safeParse({
    id: formData.get("id") || undefined, class_id: formData.get("class_id"), full_name: formData.get("full_name"),
    roll_number: formData.get("roll_number"),
  });
  if (!parsed.success) return { error: "Periksa kembali kelas, nama, dan nomor urut santri." };
  if (profile.role === "ustaz") {
    if (parsed.data.id) return { error: "Pembimbing hanya dapat menambahkan santri baru." };
    const supabase = await createClient();
    const { data: assignment, error: assignmentError } = await supabase.from("teacher_classes").select("id").eq("teacher_id", profile.id).eq("class_id", parsed.data.class_id).maybeSingle();
    if (assignmentError || !assignment) return { error: "Anda hanya dapat menambahkan santri ke kelas yang ditugaskan." };
    const { error } = await supabase.from("students").insert({ class_id: parsed.data.class_id, full_name: parsed.data.full_name, roll_number: parsed.data.roll_number });
    if (error) return { error: "Santri tidak dapat disimpan. Periksa nomor urut dan kelas." };
    revalidatePath("/santri"); revalidatePath("/absensi"); revalidatePath("/");
    return { success: "Santri berhasil ditambahkan." };
  }
  const supabase = await createClient();
  if (parsed.data.id) {
    const { data: current, error: currentError } = await supabase.from("students").select("class_id").eq("id", parsed.data.id).maybeSingle();
    if (currentError) return { error: "Data kelas santri belum dapat diperiksa." };
    if (current && current.class_id !== parsed.data.class_id) {
      const { count, error } = await supabase.from("prayer_attendance").select("id", { count: "exact", head: true }).eq("student_id", parsed.data.id);
      if (error) return { error: "Riwayat santri belum dapat diperiksa." };
      if (count && count > 0) return { error: "Santri yang sudah memiliki riwayat tidak dapat dipindahkan kelasnya. Nonaktifkan data lama, lalu buat data baru di kelas tujuan." };
    }
  }
  const payload = { class_id: parsed.data.class_id, full_name: parsed.data.full_name, roll_number: parsed.data.roll_number };
  const query = parsed.data.id ? supabase.from("students").update(payload).eq("id", parsed.data.id) : supabase.from("students").insert(payload);
  const { error } = await query;
  if (error) return { error: "Santri tidak dapat disimpan. Periksa nomor urut dan kelas." };
  revalidatePath("/santri"); revalidatePath("/kelas"); revalidatePath("/absensi"); revalidatePath("/");
  return { success: parsed.data.id ? "Perubahan santri berhasil disimpan." : "Santri berhasil ditambahkan." };
}

export async function removeStudentAction(formData: FormData): Promise<ActionState> {
  await requireRole("admin");
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { error: "Santri tidak ditemukan." };
  const supabase = await createClient();
  const { count, error: attendanceError } = await supabase.from("prayer_attendance").select("id", { count: "exact", head: true }).eq("student_id", id.data);
  if (attendanceError) return { error: "Status riwayat santri tidak dapat diperiksa." };
  const result = count && count > 0
    ? await supabase.from("students").update({ is_active: false }).eq("id", id.data)
    : await supabase.from("students").delete().eq("id", id.data);
  if (result.error) return { error: "Data santri belum dapat diubah." };
  revalidatePath("/santri"); revalidatePath("/");
  return { success: count && count > 0 ? "Santri dinonaktifkan. Riwayatnya tetap tersimpan." : "Santri dihapus karena belum memiliki riwayat absensi." };
}

export async function removeStudentsAction(ids: unknown): Promise<{ error?: string; deleted?: number; deactivated?: number }> {
  await requireRole("admin");
  const parsed = z.array(z.string().uuid()).min(1).max(1000).safeParse(ids);
  if (!parsed.success) return { error: "Pilih minimal satu santri untuk dihapus." };
  const studentIds = [...new Set(parsed.data)];
  const supabase = await createClient();
  const { data: attendance, error: attendanceError } = await supabase
    .from("prayer_attendance")
    .select("student_id")
    .in("student_id", studentIds);
  if (attendanceError) return { error: "Riwayat absensi santri belum dapat diperiksa." };

  const withHistory = new Set((attendance ?? []).map((record) => record.student_id));
  const deactivateIds = studentIds.filter((id) => withHistory.has(id));
  const deleteIds = studentIds.filter((id) => !withHistory.has(id));
  if (deactivateIds.length) {
    const { error } = await supabase.from("students").update({ is_active: false }).in("id", deactivateIds);
    if (error) return { error: "Santri yang memiliki riwayat belum dapat dinonaktifkan." };
  }
  if (deleteIds.length) {
    const { error } = await supabase.from("students").delete().in("id", deleteIds);
    if (error) return { error: "Sebagian data belum dapat dihapus. Muat ulang daftar sebelum mencoba lagi." };
  }
  revalidatePath("/santri"); revalidatePath("/"); revalidatePath("/absensi");
  return { deleted: deleteIds.length, deactivated: deactivateIds.length };
}

export async function saveAssignmentAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole("admin");
  const parsed = z.object({ teacher_id: z.string().uuid(), class_id: z.string().uuid() }).safeParse({ teacher_id: formData.get("teacher_id"), class_id: formData.get("class_id") });
  if (!parsed.success) return { error: "Pilih pembimbing dan kelas." };
  const supabase = await createClient();
  const { error } = await supabase.from("teacher_classes").insert(parsed.data);
  if (error) return { error: "Penugasan sudah ada atau tidak dapat disimpan." };
  revalidatePath("/kelas"); revalidatePath("/pengguna"); revalidatePath("/");
  return { success: "Penugasan kelas berhasil ditambahkan." };
}

export async function deleteAssignmentAction(formData: FormData): Promise<ActionState> {
  await requireRole("admin");
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { error: "Penugasan tidak ditemukan." };
  const supabase = await createClient();
  const { error } = await supabase.from("teacher_classes").delete().eq("id", id.data);
  if (error) return { error: "Penugasan tidak dapat dihapus." };
  revalidatePath("/kelas"); revalidatePath("/pengguna"); revalidatePath("/");
  return { success: "Penugasan kelas berhasil dihapus." };
}

const importRowSchema = z.object({ class_name: z.string().trim().min(1).max(100), roll_number: z.coerce.number().int().positive().max(9999), full_name: z.string().trim().min(1).max(160) });

export async function importStudentsAction(rows: unknown): Promise<{ inserted: number; failed: { row: number; reason: string }[] }> {
  await requireRole("admin");
  const parsed = z.array(importRowSchema).max(100).safeParse(rows);
  if (!parsed.success) return { inserted: 0, failed: [{ row: 0, reason: "Batch tidak valid atau melebihi 100 baris." }] };
  const supabase = await createClient();
  const [{ data: classRows, error: classError }, { data: currentRows, error: studentError }] = await Promise.all([
    supabase.from("classes").select("id, class_name, academic_year"),
    supabase.from("students").select("class_id, full_name, roll_number"),
  ]);
  if (classError || studentError) return { inserted: 0, failed: [{ row: 0, reason: "Data kelas dan santri belum dapat diperiksa." }] };
  const existingClasses = classRows ?? [];
  const academicYear = existingClasses[0]?.academic_year ?? (() => {
    const now = new Date();
    const year = now.getUTCFullYear();
    const startYear = now.getUTCMonth() >= 6 ? year : year - 1;
    return `${startYear}/${startYear + 1}`;
  })();
  const byName = buildClassNameLookup(existingClasses);
  const classNamesInFile = [...new Set(parsed.data.map((row) => row.class_name.trim()))];
  for (const className of classNamesInFile) {
    if (resolveClassId(byName, className) || hasClassNameCandidate(byName, className) || !isGradeSectionClassName(className)) continue;
    const { data: createdClass, error: createClassError } = await supabase
      .from("classes")
      .insert({ class_name: className, academic_year: academicYear, description: null })
      .select("id, class_name")
      .single();
    if (createClassError || !createdClass) continue;
    existingClasses.push({ ...createdClass, academic_year: academicYear });
    for (const key of [className, ...className.split(/[\/|]/)]) {
      const normalized = key.normalize("NFKC").toLocaleLowerCase("id-ID").replace(/[\s./_-]+/g, "");
      if (normalized) byName.set(normalized, createdClass.id);
    }
  }
  const names = new Set((currentRows ?? []).map((item) => `${item.class_id}:${item.full_name.trim().toLocaleLowerCase("id-ID")}`));
  const rolls = new Set((currentRows ?? []).map((item) => `${item.class_id}:${item.roll_number}`));
  const batchNames = new Set<string>();
  const batchRolls = new Set<string>();
  const valid: { class_id: string; roll_number: number; full_name: string }[] = [];
  const failed: { row: number; reason: string }[] = [];
  parsed.data.forEach((row, index) => {
    const classId = resolveClassId(byName, row.class_name);
    if (!classId) { failed.push({ row: index + 2, reason: `Kelas “${row.class_name}” tidak dikenal.` }); return; }
    const nameKey = `${classId}:${row.full_name.toLocaleLowerCase("id-ID")}`;
    const rollKey = `${classId}:${row.roll_number}`;
    const problems: string[] = [];
    if (names.has(nameKey) || batchNames.has(nameKey)) problems.push("Nama duplikat di kelas.");
    if (rolls.has(rollKey) || batchRolls.has(rollKey)) problems.push("Nomor urut sudah dipakai.");
    if (problems.length) { failed.push({ row: index + 2, reason: problems.join(" ") }); return; }
    names.add(nameKey); rolls.add(rollKey);
    batchNames.add(nameKey); batchRolls.add(rollKey);
    valid.push({ class_id: classId, roll_number: row.roll_number, full_name: row.full_name.trim() });
  });
  if (valid.length) {
    const { error } = await supabase.from("students").insert(valid);
    if (error) return { inserted: 0, failed: [...failed, ...valid.map((_, index) => ({ row: index + 2, reason: "Penyimpanan gagal karena data berubah atau nomor urut duplikat." }))] };
  }
  revalidatePath("/santri"); revalidatePath("/kelas"); revalidatePath("/absensi"); revalidatePath("/");
  return { inserted: valid.length, failed };
}

export async function deactivateStudentAction(formData: FormData): Promise<ActionState> {
  await requireRole("admin");
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { error: "Santri tidak ditemukan." };
  const supabase = await createClient();
  const { error } = await supabase.from("students").update({ is_active: false }).eq("id", id.data);
  if (error) return { error: "Status santri belum dapat diubah." };
  revalidatePath("/santri"); revalidatePath("/");
  return { success: "Santri dinonaktifkan." };
}

export async function reactivateStudentAction(formData: FormData): Promise<ActionState> {
  await requireRole("admin");
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { error: "Santri tidak ditemukan." };
  const supabase = await createClient();
  const { error } = await supabase.from("students").update({ is_active: true }).eq("id", id.data);
  if (error) return { error: "Santri belum dapat diaktifkan. Periksa nomor urut yang mungkin sudah dipakai." };
  revalidatePath("/santri"); revalidatePath("/"); revalidatePath("/absensi");
  return { success: "Santri diaktifkan kembali." };
}
