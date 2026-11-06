import Link from "next/link";
import { UserRoundPlus } from "lucide-react";
import { BottomNav, Sidebar } from "@/components/app-navigation";
import { LogoutButton } from "@/components/logout-button";
import { StudentList } from "@/components/student-list";
import { StudentForm } from "@/components/record-forms";
import { StudentImport } from "@/components/student-tools";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

type ClassRow = Database["public"]["Tables"]["classes"]["Row"];
type StudentRow = Database["public"]["Tables"]["students"]["Row"];

export const metadata = { title: "Data Santri" };

export const dynamic = "force-dynamic";

export default async function StudentsPage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const [{ data: classesData, error: classError }, { data: studentsData, error: studentError }] = await Promise.all([
    supabase.from("classes").select("*").order("class_name"),
    supabase.from("students").select("*").order("class_id").order("roll_number"),
  ]);
  const classes = (classesData ?? []) as ClassRow[];
  const students = (studentsData ?? []) as StudentRow[];
  const canManage = profile.role === "admin";
  const canAddStudents = canManage || classes.length > 0;
  const loadError = classError || studentError;

  return <div className="app-shell"><Sidebar role={profile.role} /><main className="main-content min-h-dvh px-5 pb-12 pt-5 sm:px-8 sm:pt-7 lg:px-11"><header className="mx-auto flex max-w-[1200px] items-center justify-between"><div><Link href="/" className="text-xs font-semibold text-[#75827b] hover:text-[#0d5c45]">← Beranda</Link><h1 className="mt-2 text-xl font-bold text-[#1d2b24]">Data santri</h1><p className="mt-1 text-xs text-[#849087]">Nomor urut mengikuti daftar hadir per kelas.</p></div><div className="flex items-center gap-3"><a href="/kelas" className="hidden min-h-10 items-center rounded-xl border border-[#dfe7e1] bg-white px-3 text-xs font-semibold text-[#536158] transition hover:border-[#cbd9cf] hover:bg-[#f8faf8] sm:flex">Kelas</a><LogoutButton /></div></header>
    <div className="mx-auto mt-6 max-w-[1200px] space-y-5">{loadError ? <div role="alert" className="rounded-xl bg-[#fff1ef] p-4 text-xs text-[#a64336]">Data belum dapat dimuat. Periksa koneksi dan akses akun.</div> : <>
      {canAddStudents && <section className="rounded-2xl border border-[#e7ece8] bg-white p-5 sm:p-6"><div className="mb-4 flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eaf4ef] text-[#0d5c45]"><UserRoundPlus size={18} /></div><div><h2 className="text-sm font-bold text-[#25342b]">Tambah santri</h2><p className="mt-1 text-xs text-[#849087]">Nomor urut menentukan susunan daftar absensi.</p></div></div><StudentForm classes={classes} /></section>}
      {!canAddStudents && profile.role === "ustaz" && <section className="rounded-2xl border border-dashed border-[#dfe7e1] bg-white p-6 text-center"><p className="text-sm font-semibold text-[#4d5c52]">Belum ada kelas yang ditugaskan</p><p className="mt-1 text-xs text-[#849087]">Hubungi administrator untuk menetapkan kelas sebelum menambahkan santri.</p><Link href="/kelas" className="mt-3 inline-flex min-h-10 items-center rounded-lg border border-[#dfe7e1] px-3 text-xs font-semibold text-[#536158]">Lihat penugasan kelas</Link></section>}
      {canManage && <StudentImport classes={classes} students={students} />}
      <section className="rounded-2xl border border-[#e7ece8] bg-[#f9fbf9] p-4 sm:p-5"><StudentList students={students} classes={classes} canManage={canManage} /></section>
    </>}</div></main><BottomNav role={profile.role} /></div>;
}
