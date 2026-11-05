import { BookOpenCheck, ShieldUser, UsersRound } from "lucide-react";
import Link from "next/link";
import { BottomNav, Sidebar } from "@/components/app-navigation";
import { CreateUstazForm, ResetPasswordForm, ToggleUstazActiveForm } from "@/components/account-forms";
import { AssignmentDeleteButton, AssignmentForm } from "@/components/record-forms";
import { LogoutButton } from "@/components/logout-button";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

type TeacherSummary = { id: string; username: string; full_name: string; is_active: boolean; created_at: string };
type ClassRow = Database["public"]["Tables"]["classes"]["Row"];

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const admin = await requireRole("admin");
  let teachers: TeacherSummary[] = [];
  let classes: ClassRow[] = [];
  let assignments: Database["public"]["Tables"]["teacher_classes"]["Row"][] = [];
  let loadError = false;
  try {
    const supabase = await createClient();
    const [teacherResult, classResult, assignmentResult] = await Promise.all([
      supabase.from("profiles").select("id, username, full_name, is_active, created_at").eq("role", "ustaz").order("full_name"),
      supabase.from("classes").select("*").order("class_name"),
      supabase.from("teacher_classes").select("*").order("created_at"),
    ]);
    loadError = Boolean(teacherResult.error || classResult.error || assignmentResult.error);
    teachers = (teacherResult.data ?? []) as TeacherSummary[];
    classes = (classResult.data ?? []) as ClassRow[];
    assignments = assignmentResult.data ?? [];
  } catch { loadError = true; }
  const teacherNames = new Map(teachers.map((teacher) => [teacher.id, teacher.full_name]));
  const classNames = new Map(classes.map((classRow) => [classRow.id, classRow.class_name]));

  return <div className="app-shell"><Sidebar role="admin" /><main className="main-content min-h-dvh px-5 pb-12 pt-5 sm:px-8 sm:pt-7 lg:px-11">
    <header className="mx-auto flex max-w-[1100px] items-center justify-between"><div><Link href="/" className="text-xs font-semibold text-[#75827b] hover:text-[#0d5c45]">← Beranda</Link><h1 className="mt-2 text-xl font-bold text-[#1d2b24]">Akun pembimbing</h1></div><div className="flex items-center gap-3"><p className="hidden text-xs font-semibold text-[#536158] sm:block">{admin.full_name}</p><LogoutButton /></div></header>
    <div className="mx-auto mt-7 max-w-[1100px] space-y-5">
      <section className="rounded-2xl border border-[#e7ece8] bg-white p-5 sm:p-7"><div className="mb-5 flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eaf4ef] text-[#0d5c45]"><UsersRound size={19} /></div><div><h2 className="text-sm font-bold text-[#25342b]">Tambah akun baru</h2><p className="mt-1 text-xs text-[#849087]">Akun pembimbing hanya dapat dibuat oleh administrator.</p></div></div><CreateUstazForm /></section>
      <section className="rounded-2xl border border-[#e7ece8] bg-white p-5 sm:p-7"><div className="mb-5 flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eaf4ef] text-[#0d5c45]"><BookOpenCheck size={19} /></div><div><h2 className="text-sm font-bold text-[#25342b]">Penugasan kelas untuk pembimbing</h2><p className="mt-1 text-xs text-[#849087]">Pilih akun pembimbing dan kelas yang boleh diaksesnya. Pembimbing dapat menambahkan santri pada kelas tugasannya.</p></div></div>
        {loadError ? <p role="alert" className="rounded-xl bg-[#fff1ef] p-4 text-xs text-[#a64336]">Data kelas dan penugasan belum dapat dimuat.</p> : teachers.length === 0 ? <p className="text-xs text-[#849087]">Buat akun pembimbing terlebih dahulu.</p> : classes.length === 0 ? <p className="text-xs text-[#849087]">Belum ada kelas. <Link href="/kelas" className="font-semibold text-[#0d5c45]">Buat kelas</Link> sebelum menetapkan penugasan.</p> : <><AssignmentForm classes={classes} teachers={teachers} /><div className="mt-5 divide-y divide-[#edf1ed]">{assignments.map((item) => <div key={item.id} className="flex min-h-14 items-center justify-between gap-3 py-2"><div><p className="text-xs font-semibold text-[#34443a]">{teacherNames.get(item.teacher_id) ?? "Akun pembimbing"}</p><p className="mt-1 text-[11px] text-[#849087]">{classNames.get(item.class_id) ?? "Kelas"}</p></div><AssignmentDeleteButton id={item.id} /></div>)}{assignments.length === 0 && <p className="py-5 text-center text-xs text-[#849087]">Belum ada penugasan kelas.</p>}</div></>}
      </section>
      <section className="rounded-2xl border border-[#e7ece8] bg-white p-5 sm:p-7"><div className="mb-5 flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f7f3e8] text-[#967c41]"><ShieldUser size={19} /></div><div><h2 className="text-sm font-bold text-[#25342b]">Daftar akun</h2><p className="mt-1 text-xs text-[#849087]">Kelola akses masuk pembimbing.</p></div></div>
        {loadError ? <p role="alert" className="rounded-xl bg-[#fff1ef] p-4 text-xs text-[#a64336]">Daftar akun belum dapat dimuat. Periksa koneksi dan konfigurasi Supabase.</p> : teachers.length === 0 ? <div className="rounded-xl border border-dashed border-[#e2e8e3] p-8 text-center text-xs text-[#849087]">Belum ada akun pembimbing.</div> : <div className="space-y-3">{teachers.map((teacher) => <article key={teacher.id} className="flex flex-col gap-3 rounded-xl border border-[#edf1ed] p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-bold text-[#34443a]">{teacher.full_name}</p><p className="mt-1 text-xs text-[#849087]">@{teacher.username} · {teacher.is_active ? "Aktif" : "Nonaktif"}</p></div><div className="flex flex-wrap gap-2"><ResetPasswordForm userId={teacher.id} /><ToggleUstazActiveForm userId={teacher.id} isActive={teacher.is_active} /></div></article>)}</div>}
      </section>
    </div>
  </main><BottomNav role={admin.role} /></div>;
}
