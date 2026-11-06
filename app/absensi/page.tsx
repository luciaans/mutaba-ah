import Link from "next/link";
import { BookOpenCheck, ChevronLeft } from "lucide-react";
import { BottomNav, Sidebar } from "@/components/app-navigation";
import { AttendanceForm } from "@/components/attendance-form";
import { LogoutButton } from "@/components/logout-button";
import { requireProfile } from "@/lib/auth";
import { formatDateId, prayerForTime, todayInAppTimeZone, type PrayerName } from "@/lib/time";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

type ClassRow = Database["public"]["Tables"]["classes"]["Row"];
type StudentRow = Database["public"]["Tables"]["students"]["Row"];
type SessionRow = Database["public"]["Tables"]["attendance_sessions"]["Row"];
type AttendanceRow = Database["public"]["Tables"]["prayer_attendance"]["Row"];
type ProfileRow = Pick<Database["public"]["Tables"]["profiles"]["Row"], "id" | "full_name">;
type AssignmentRow = Database["public"]["Tables"]["teacher_classes"]["Row"];
type MonitoringTeacher = Pick<Database["public"]["Tables"]["profiles"]["Row"], "id" | "full_name" | "is_active">;
const prayerNames: PrayerName[] = ["subuh", "zuhur", "asar", "magrib", "isya"];
const prayerLabels: Record<PrayerName, string> = { subuh: "Subuh", zuhur: "Zuhur", asar: "Asar", magrib: "Magrib", isya: "Isya" };

export const metadata = { title: "Absensi" };

export const dynamic = "force-dynamic";

export default async function AttendancePage({ searchParams }: { searchParams: Promise<{ classId?: string; date?: string; prayer?: string }> }) {
  const profile = await requireProfile();
  const params = await searchParams;
  const today = todayInAppTimeZone();
  const earliestTeacherDate = new Date(`${today}T00:00:00Z`);
  earliestTeacherDate.setUTCDate(earliestTeacherDate.getUTCDate() - 3);
  const minTeacherDate = profile.role === "ustaz" ? earliestTeacherDate.toISOString().slice(0, 10) : null;
  const requestedDate = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) && params.date <= today ? params.date : today;
  const requestedPrayer = prayerNames.includes(params.prayer as PrayerName) ? params.prayer as PrayerName : prayerForTime();
  const supabase = await createClient();
  const { data: classData, error: classError } = await supabase.from("classes").select("*").order("class_name");
  const classes = (classData ?? []) as ClassRow[];
  const classId = classes.length === 1 ? classes[0].id : classes.some((item) => item.id === params.classId) ? params.classId as string : classes[0]?.id ?? "";
  let monitoringAssignments: AssignmentRow[] = [];
  let monitoringSessions: SessionRow[] = [];
  let monitoringTeachers: MonitoringTeacher[] = [];
  let monitoringRecorders: ProfileRow[] = [];
  let monitoringError = false;
  if (profile.role === "admin") {
    const [assignmentResult, monitoringSessionResult, teacherResult] = await Promise.all([
      supabase.from("teacher_classes").select("*").order("created_at"),
      supabase.from("attendance_sessions").select("*").eq("attendance_date", requestedDate),
      supabase.from("profiles").select("id, full_name, is_active").eq("role", "ustaz").order("full_name"),
    ]);
    monitoringError = Boolean(assignmentResult.error || monitoringSessionResult.error || teacherResult.error);
    monitoringAssignments = assignmentResult.data ?? [];
    monitoringSessions = (monitoringSessionResult.data ?? []) as SessionRow[];
    monitoringTeachers = (teacherResult.data ?? []) as MonitoringTeacher[];
    const recorderIds = [...new Set(monitoringSessions.map((item) => item.recorded_by))];
    if (recorderIds.length) {
      const { data, error } = await supabase.from("profiles").select("id, full_name").in("id", recorderIds);
      monitoringError ||= Boolean(error);
      monitoringRecorders = data ?? [];
    }
  }

  let students: StudentRow[] = [];
  let sessions: SessionRow[] = [];
  let attendance: AttendanceRow[] = [];
  let recorders: ProfileRow[] = [];
  let loadError = Boolean(classError);
  if (classId) {
    const [studentResult, sessionResult, attendanceResult] = await Promise.all([
      supabase.from("students").select("*").eq("class_id", classId).eq("is_active", true).order("roll_number"),
      supabase.from("attendance_sessions").select("*").eq("class_id", classId).eq("attendance_date", requestedDate),
      supabase.from("prayer_attendance").select("*").eq("class_id", classId).eq("attendance_date", requestedDate).eq("prayer_name", requestedPrayer),
    ]);
    loadError ||= Boolean(studentResult.error || sessionResult.error || attendanceResult.error);
    students = (studentResult.data ?? []) as StudentRow[];
    sessions = (sessionResult.data ?? []) as SessionRow[];
    const hasSession = sessions.some((item) => item.prayer_name === requestedPrayer);
    attendance = hasSession ? (attendanceResult.data ?? []) as AttendanceRow[] : [];
    const ids = [...new Set(sessions.map((item) => item.recorded_by))];
    if (ids.length) {
      const { data, error } = await supabase.from("profiles").select("id, full_name").in("id", ids);
      if (error) loadError = true;
      recorders = data ?? [];
    }
  }
  const classNames = new Map(classes.map((item) => [item.id, item.class_name]));
  const assignedClassIds = new Set(monitoringAssignments.map((item) => item.class_id));
  const monitoringRows = [
    ...monitoringTeachers.flatMap((teacher) => {
      const assigned = monitoringAssignments.filter((item) => item.teacher_id === teacher.id);
      return assigned.length
        ? assigned.map((item) => ({ key: `${teacher.id}:${item.class_id}`, teacherName: teacher.full_name, teacherActive: teacher.is_active, classId: item.class_id, className: classNames.get(item.class_id) ?? "Kelas" }))
        : [{ key: `${teacher.id}:none`, teacherName: teacher.full_name, teacherActive: teacher.is_active, classId: "", className: "Belum ditugaskan" }];
    }),
    ...classes.filter((item) => !assignedClassIds.has(item.id)).map((item) => ({ key: `unassigned:${item.id}`, teacherName: "Belum ditugaskan", teacherActive: true, classId: item.id, className: item.class_name })),
  ];
  const monitoringSessionMap = new Map(monitoringSessions.map((item) => [`${item.class_id}:${item.prayer_name}`, item]));
  const recorderNames = new Map(monitoringRecorders.map((item) => [item.id, item.full_name]));

  return <div className="app-shell"><Sidebar role={profile.role} /><main className="main-content min-h-dvh px-4 pb-12 pt-4 sm:px-8 sm:pt-7 lg:px-11"><header className="mx-auto mb-5 flex max-w-[1120px] items-center justify-between sm:mb-7"><div><Link href="/" className="inline-flex min-h-9 items-center gap-1 text-xs font-semibold text-[#75827b] hover:text-[#0d5c45]"><ChevronLeft size={16} />Beranda</Link><h1 className="mt-1 flex items-center gap-2 text-xl font-bold text-[#1d2b24]"><BookOpenCheck size={20} className="text-[#0d5c45]" />Absensi salat</h1><p className="mt-1 text-xs text-[#849087]">Tandai X hanya untuk santri yang tidak melaksanakan salat.</p></div><div className="flex items-center gap-3"><span className="hidden text-xs font-semibold text-[#536158] sm:block">{profile.full_name}</span><LogoutButton /></div></header>
    {profile.role === "admin" && <details open className="mx-auto mb-5 max-w-[1120px] overflow-hidden rounded-2xl border border-[#e7ece8] bg-white"><summary className="cursor-pointer border-b border-[#edf1ed] px-4 py-4 text-sm font-bold text-[#25342b] sm:px-5">Pemantauan absensi semua akun pembimbing</summary><div className="p-4 sm:p-5"><div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="text-xs text-[#68756d]">Status sesi setiap kelas dan nama pencatat untuk {formatDateId(requestedDate)}.</p><p className="mt-1 text-[10px] text-[#849087]">Klik status sesi untuk membuka absensi kelas tersebut.</p></div><form action="/absensi" method="get" className="flex items-end gap-2"><input type="hidden" name="classId" defaultValue={classId} /><input type="hidden" name="prayer" defaultValue={requestedPrayer} /><label className="text-[10px] font-semibold text-[#68756d]">Tanggal<input type="date" name="date" defaultValue={requestedDate} max={today} className="mt-1 block h-10 rounded-lg border border-[#dfe7e1] bg-white px-2 text-xs" /></label><button type="submit" className="min-h-10 rounded-lg bg-[#0d5c45] px-3 text-xs font-bold text-white">Lihat tanggal</button></form></div>
      {monitoringError ? <p role="alert" className="rounded-xl bg-[#fff1ef] p-3 text-xs text-[#a64336]">Data pemantauan belum dapat dimuat.</p> : <div className="overflow-x-auto rounded-xl border border-[#e7ece8]"><table className="w-full min-w-[1000px] text-left text-[11px]"><thead className="bg-[#f7f9f7] font-bold text-[#748078]"><tr><th className="px-3 py-3">Akun pembimbing</th><th className="px-3 py-3">Kelas</th>{prayerNames.map((prayer) => <th key={prayer} className="px-3 py-3 text-center">{prayerLabels[prayer]}</th>)}</tr></thead><tbody>{monitoringRows.map((row) => <tr key={row.key} className="border-t border-[#edf1ed]"><td className="px-3 py-3 font-semibold text-[#34443a]">{row.teacherName}{!row.teacherActive && <span className="ml-1 text-[9px] font-normal text-[#9a635b]">(nonaktif)</span>}</td><td className="px-3 py-3 text-[#68756d]">{row.className}</td>{prayerNames.map((prayer) => { const session = row.classId ? monitoringSessionMap.get(`${row.classId}:${prayer}`) : undefined; const label = session ? `Tersimpan · ${recorderNames.get(session.recorded_by) ?? "Akun"}` : "Belum diisi"; return <td key={prayer} className="px-2 py-2 text-center">{row.classId ? <Link href={`/absensi?classId=${row.classId}&date=${requestedDate}&prayer=${prayer}`} title={session ? `Diperbarui ${session.updated_at}` : "Buka sesi absensi"} className={`inline-flex min-h-9 w-full items-center justify-center rounded-lg px-2 text-[10px] font-semibold ${session ? "bg-[#eaf4ef] text-[#34704f] hover:bg-[#deeee3]" : "bg-[#f7f8f7] text-[#89958d] hover:bg-[#eff3f0]"}`}>{label}</Link> : <span className="text-[#a1aaa4]">—</span>}</td>; })}</tr>)}{monitoringRows.length === 0 && <tr><td colSpan={7} className="px-3 py-8 text-center text-xs text-[#849087]">Belum ada akun pembimbing atau kelas untuk dipantau.</td></tr>}</tbody></table></div>}
    </div></details>}
    {loadError && <div role="alert" className="mx-auto mb-4 max-w-[1120px] rounded-xl bg-[#fff1ef] p-3 text-xs text-[#a64336]">Sebagian data belum dapat dimuat. Periksa koneksi atau akses kelas.</div>}
    {classes.length === 0 ? <div className="mx-auto max-w-[1120px] rounded-2xl border border-dashed border-[#e0e7e1] bg-white px-5 py-14 text-center"><p className="text-sm font-semibold text-[#4d5c52]">Belum ada kelas tersedia</p><p className="mt-1 text-xs text-[#8b968f]">Hubungi administrator untuk penugasan kelas.</p></div> : <AttendanceForm classes={classes} initialClassId={classId} initialDate={requestedDate} today={today} minTeacherDate={minTeacherDate} initialPrayer={requestedPrayer} initialStudents={students} initialSessions={sessions} initialAttendance={attendance} initialProfiles={recorders} />}
    </main><BottomNav role={profile.role} /></div>;
}
