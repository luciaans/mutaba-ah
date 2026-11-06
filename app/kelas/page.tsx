import Link from "next/link";
import { BookOpenCheck, UsersRound } from "lucide-react";
import { BottomNav, Sidebar } from "@/components/app-navigation";
import { AssignmentDeleteButton, AssignmentForm, ClassDeleteButton, ClassForm } from "@/components/record-forms";
import { LogoutButton } from "@/components/logout-button";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

type ClassRow = Database["public"]["Tables"]["classes"]["Row"];
type TeacherRow = Pick<Database["public"]["Tables"]["profiles"]["Row"], "id" | "full_name">;

export const metadata = { title: "Kelas" };

export const dynamic = "force-dynamic";

export default async function ClassesPage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const [{ data: classesData }, { data: assignmentData }] = await Promise.all([
    supabase.from("classes").select("*").order("class_name"),
    supabase.from("teacher_classes").select("*").order("created_at"),
  ]);
  const classes = (classesData ?? []) as ClassRow[];
  const assignments = assignmentData ?? [];
  const teacherIds = [...new Set(assignments.map((item) => item.teacher_id))];
  const [{ data: teacherData }, { data: studentCounts }] = await Promise.all([
    teacherIds.length ? supabase.from("profiles").select("id, full_name").in("id", teacherIds) : Promise.resolve({ data: [] as TeacherRow[] }),
    supabase.from("students").select("class_id"),
  ]);
  const teachers = (teacherData ?? []) as TeacherRow[];
  const teacherMap = new Map(teachers.map((item) => [item.id, item.full_name]));
  const classMap = new Map(classes.map((item) => [item.id, item.class_name]));
  const counts = new Map<string, number>();
  studentCounts?.forEach((item) => counts.set(item.class_id, (counts.get(item.class_id) ?? 0) + 1));
  const admin = profile.role === "admin";

  return <div className="app-shell"><Sidebar role={profile.role} /><main className="main-content min-h-dvh px-5 pb-12 pt-5 sm:px-8 sm:pt-7 lg:px-11"><header className="mx-auto flex max-w-[1100px] items-center justify-between"><div><Link href="/" className="text-xs font-semibold text-[#75827b] hover:text-[#0d5c45]">← Beranda</Link><h1 className="mt-2 text-xl font-bold text-[#1d2b24]">Kelas dan penugasan</h1></div><div className="flex items-center gap-3"><Link href="/santri" className="hidden min-h-10 items-center gap-2 rounded-xl border border-[#dfe7e1] bg-white px-3 text-xs font-semibold text-[#4e5d53] sm:flex"><UsersRound size={15} />Data santri</Link><LogoutButton /></div></header>
    <div className="mx-auto mt-7 max-w-[1100px] space-y-5">
      {admin && <section className="rounded-2xl border border-[#e7ece8] bg-white p-5 sm:p-6"><h2 className="mb-4 text-sm font-bold text-[#25342b]">Tambah kelas</h2><ClassForm /></section>}
      <section className="rounded-2xl border border-[#e7ece8] bg-white p-5 sm:p-6"><div className="mb-4 flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eaf4ef] text-[#0d5c45]"><BookOpenCheck size={18} /></div><div><h2 className="text-sm font-bold text-[#25342b]">Daftar kelas</h2><p className="mt-1 text-xs text-[#849087]">{classes.length} kelas tersedia untuk akun ini</p></div></div>
        {classes.length === 0 ? <p className="rounded-xl border border-dashed border-[#e2e8e3] p-8 text-center text-xs text-[#849087]">Belum ada kelas yang ditugaskan.</p> : <div className="space-y-3">{classes.map((item) => <article key={item.id} className="rounded-xl border border-[#edf1ed] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-sm font-bold text-[#34443a]">{item.class_name}</h3><p className="mt-1 text-xs text-[#849087]">Tahun pelajaran {item.academic_year} <span className="mx-1">·</span>{counts.get(item.id) ?? 0} santri</p>{item.description && <p className="mt-2 text-xs text-[#6d7b72]">{item.description}</p>}</div>{admin && <ClassDeleteButton id={item.id} label={item.class_name} />}</div>{admin && <details className="mt-3 border-t border-[#edf1ed] pt-3"><summary className="cursor-pointer text-xs font-semibold text-[#536158]">Edit kelas</summary><div className="mt-3"><ClassForm initial={item} /></div></details>}</article>)}</div>}
      </section>
      {admin && <section className="rounded-2xl border border-[#e7ece8] bg-white p-5 sm:p-6"><div className="mb-5"><h2 className="text-sm font-bold text-[#25342b]">Penugasan pembimbing</h2><p className="mt-1 text-xs text-[#849087]">Tetapkan kelas yang dapat diakses oleh masing-masing pembimbing.</p></div><AssignmentForm classes={classes} teachers={teachers} /><div className="mt-5 divide-y divide-[#edf1ed]">{assignments.map((item) => <div key={item.id} className="flex min-h-14 items-center justify-between gap-3 py-2"><div><p className="text-xs font-semibold text-[#34443a]">{teacherMap.get(item.teacher_id) ?? "Akun pembimbing"}</p><p className="mt-1 text-[11px] text-[#849087]">{classMap.get(item.class_id) ?? "Kelas"}</p></div><AssignmentDeleteButton id={item.id} /></div>)}{assignments.length === 0 && <p className="py-5 text-center text-xs text-[#849087]">Belum ada penugasan.</p>}</div></section>}
    </div></main><BottomNav role={profile.role} /></div>;
}
