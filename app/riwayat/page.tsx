import Link from "next/link";
import { BottomNav, Sidebar } from "@/components/app-navigation";
import { LogoutButton } from "@/components/logout-button";
import { requireProfile } from "@/lib/auth";
import { formatDateId, formatTimeId, shiftIsoDate, todayInAppTimeZone, type PrayerName } from "@/lib/time";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

const prayerLabels: Record<PrayerName, string> = { subuh: "Subuh", zuhur: "Zuhur", asar: "Asar", magrib: "Magrib", isya: "Isya" };
const prayerOptions: PrayerName[] = ["subuh", "zuhur", "asar", "magrib", "isya"];
const absenceReasonLabels = { sakit: "Sakit", izin: "Izin", alfa: "Alfa" } as const;
type AttendanceRow = Database["public"]["Tables"]["prayer_attendance"]["Row"];

export const metadata = { title: "Riwayat Absensi" };

export const dynamic = "force-dynamic";

export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ mulai?: string; sampai?: string; kelas?: string; santri?: string; salat?: string; halaman?: string }> }) {
  const profile = await requireProfile();
  const params = await searchParams;
  const today = todayInAppTimeZone();
  const requestedStart = params.mulai && /^\d{4}-\d{2}-\d{2}$/.test(params.mulai) && params.mulai <= today ? params.mulai : shiftIsoDate(today, -6);
  const endDate = params.sampai && /^\d{4}-\d{2}-\d{2}$/.test(params.sampai) && params.sampai <= today ? params.sampai : today;
  const startDate = requestedStart > endDate ? endDate : requestedStart;
  const supabase = await createClient();
  const { data: classData } = await supabase.from("classes").select("id, class_name").order("class_name");
  const classes = classData ?? [];
  const classId = params.kelas && classes.some((item) => item.id === params.kelas) ? params.kelas : "all";
  const nameSearch = (params.santri ?? "").trim().replace(/[%_*]/g, "").slice(0, 80);
  const prayer = prayerOptions.includes(params.salat as PrayerName) ? params.salat as PrayerName : "all";
  const page = Math.max(1, Math.min(10000, Number(params.halaman) || 1));
  const pageSize = 50;
  const { data: matchingStudents, error: matchingStudentsError } = nameSearch ? await supabase.from("students").select("id, full_name, class_id, roll_number").ilike("full_name", `%${nameSearch}%`) : { data: null, error: null };
  const matchingStudentIds = nameSearch ? (matchingStudents ?? []).map((item) => item.id) : null;
  let attendance: AttendanceRow[] = [];
  let total = 0;
  let queryError = Boolean(matchingStudentsError);
  if (matchingStudentIds?.length === 0) {
    attendance = [];
  } else {
    let query = supabase.from("prayer_attendance").select("*", { count: "exact" }).gte("attendance_date", startDate).lte("attendance_date", endDate).order("attendance_date", { ascending: false }).order("updated_at", { ascending: false });
    if (classId !== "all") query = query.eq("class_id", classId);
    if (prayer !== "all") query = query.eq("prayer_name", prayer);
    if (matchingStudentIds) query = query.in("student_id", matchingStudentIds);
    const result = await query.range((page - 1) * pageSize, page * pageSize - 1);
    queryError = Boolean(result.error);
    attendance = result.data ?? [];
    total = result.count ?? 0;
  }
  const visibleStudentIds = [...new Set([...attendance.map((item) => item.student_id), ...(matchingStudents ?? []).map((item) => item.id)])];
  const { data: visibleStudents } = visibleStudentIds.length ? await supabase.from("students").select("id, full_name, class_id, roll_number").in("id", visibleStudentIds) : { data: [] as { id: string; full_name: string; class_id: string; roll_number: number }[] };
  const studentMap = new Map((visibleStudents ?? []).map((item) => [item.id, item]));
  const classMap = new Map(classes.map((item) => [item.id, item.class_name]));
  const recorderIds = [...new Set(attendance.map((item) => item.recorded_by))];
  const { data: recorders, error: recorderError } = recorderIds.length ? await supabase.from("profiles").select("id, full_name").in("id", recorderIds) : { data: [] as { id: string; full_name: string }[], error: null };
  const recorderMap = new Map((recorders ?? []).map((item) => [item.id, item.full_name]));
  const editCutoff = shiftIsoDate(today, -3);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return <div className="app-shell"><Sidebar role={profile.role} /><main className="main-content min-h-dvh px-5 pb-12 pt-5 sm:px-8 sm:pt-7 lg:px-11"><header className="mx-auto flex max-w-[1200px] items-center justify-between"><div><Link href="/" className="text-xs font-semibold text-[#75827b] hover:text-[#0d5c45]">← Beranda</Link><h1 className="mt-2 text-xl font-bold text-[#1d2b24]">Riwayat absensi</h1><p className="mt-1 text-xs text-[#849087]">Catatan resmi yang telah disimpan.</p></div><LogoutButton /></header>
    <div className="mx-auto mt-6 max-w-[1200px] space-y-4"><section className="rounded-2xl border border-[#e7ece8] bg-white p-4"><form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6"><label className="text-[11px] font-semibold text-[#5b695f]">Dari tanggal<input type="date" name="mulai" defaultValue={startDate} max={today} className="mt-1.5 h-11 w-full rounded-lg border border-[#dfe7e1] px-2 text-xs" /></label><label className="text-[11px] font-semibold text-[#5b695f]">Sampai tanggal<input type="date" name="sampai" defaultValue={endDate} max={today} className="mt-1.5 h-11 w-full rounded-lg border border-[#dfe7e1] px-2 text-xs" /></label><label className="text-[11px] font-semibold text-[#5b695f]">Kelas<select name="kelas" defaultValue={classId} className="mt-1.5 h-11 w-full rounded-lg border border-[#dfe7e1] bg-white px-2 text-xs"><option value="all">Semua kelas</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.class_name}</option>)}</select></label><label className="text-[11px] font-semibold text-[#5b695f]">Waktu salat<select name="salat" defaultValue={prayer} className="mt-1.5 h-11 w-full rounded-lg border border-[#dfe7e1] bg-white px-2 text-xs"><option value="all">Semua waktu</option>{prayerOptions.map((item) => <option key={item} value={item}>{prayerLabels[item]}</option>)}</select></label><label className="text-[11px] font-semibold text-[#5b695f] lg:col-span-2">Nama santri<input name="santri" defaultValue={nameSearch} placeholder="Cari nama santri" className="mt-1.5 h-11 w-full rounded-lg border border-[#dfe7e1] px-3 text-xs" /></label><button className="min-h-11 rounded-xl bg-[#0d5c45] text-xs font-bold text-white lg:col-span-6">Terapkan filter</button></form></section>
      {(queryError || recorderError) && <div role="alert" className="rounded-xl bg-[#fff1ef] p-3 text-xs text-[#a64336]">Riwayat belum dapat dimuat. Periksa koneksi dan akses kelas.</div>}
      <div className="flex items-center justify-between text-xs text-[#75827b]"><span>{total.toLocaleString("id-ID")} catatan · {formatDateId(startDate)} – {formatDateId(endDate)}</span><span>Halaman {page} dari {totalPages}</span></div>
      {attendance.length === 0 ? <div className="rounded-2xl border border-dashed border-[#e0e7e1] bg-white px-5 py-14 text-center text-xs text-[#849087]">Tidak ada catatan pada filter ini.</div> : <><div className="space-y-2 md:hidden">{attendance.map((item) => { const student = studentMap.get(item.student_id); return <article key={item.id} className="rounded-xl border border-[#e7ece8] bg-white p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold text-[#34443a]">{student?.full_name ?? "Santri"}</p><p className="mt-1 text-[10px] text-[#849087]">{classMap.get(item.class_id) ?? "Kelas"} · No. {student?.roll_number ?? "—"}</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${item.is_missed ? "bg-[#fff0ed] text-[#a4483d]" : "bg-[#eaf4ef] text-[#34704f]"}`}>{item.is_missed ? `Tidak melaksanakan · ${item.absence_reason ? absenceReasonLabels[item.absence_reason] : "Alfa"}` : "Melaksanakan"}</span></div><div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#edf1ed] pt-3 text-[10px] text-[#849087]"><span>{prayerLabels[item.prayer_name]} · {formatDateId(item.attendance_date, { weekday: "short", day: "numeric", month: "short", year: "numeric" })} · {formatTimeId(item.updated_at)}</span><span>Dicatat {recorderMap.get(item.recorded_by) ?? "pembimbing"}</span></div><div className="mt-3 text-right">{(profile.role === "admin" || item.attendance_date >= editCutoff) && <Link href={`/absensi?classId=${item.class_id}&date=${item.attendance_date}&prayer=${item.prayer_name}`} className="inline-flex min-h-10 items-center rounded-lg border border-[#dfe7e1] px-3 text-xs font-semibold text-[#42634e]">Edit sesi</Link>}</div></article>; })}</div>
      <div className="hidden overflow-x-auto rounded-2xl border border-[#e7ece8] bg-white md:block"><table className="w-full min-w-[950px] text-left text-xs"><thead className="bg-[#f7f9f7] font-bold text-[#748078]"><tr><th className="px-4 py-3">Tanggal dan waktu</th><th className="px-4 py-3">Santri</th><th className="px-4 py-3">Kelas</th><th className="px-4 py-3">Salat</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Pencatat</th><th className="px-4 py-3">Aksi</th></tr></thead><tbody>{attendance.map((item) => { const student = studentMap.get(item.student_id); return <tr key={item.id} className="border-t border-[#edf1ed]"><td className="px-4 py-3.5 text-[#68756d]">{formatDateId(item.attendance_date)}<span className="mt-1 block text-[10px]">{formatTimeId(item.updated_at)}</span></td><td className="px-4 py-3.5 font-semibold text-[#34443a]">{student?.full_name ?? "Santri"}</td><td className="px-4 py-3.5 text-[#68756d]">{classMap.get(item.class_id) ?? "Kelas"}</td><td className="px-4 py-3.5 text-[#68756d]">{prayerLabels[item.prayer_name]}</td><td className={`px-4 py-3.5 font-semibold ${item.is_missed ? "text-[#a4483d]" : "text-[#34704f]"}`}>{item.is_missed ? `Tidak melaksanakan · ${item.absence_reason ? absenceReasonLabels[item.absence_reason] : "Alfa"}` : "Melaksanakan"}</td><td className="px-4 py-3.5 text-[#68756d]">{recorderMap.get(item.recorded_by) ?? "Pembimbing"}</td><td className="px-4 py-3.5">{(profile.role === "admin" || item.attendance_date >= editCutoff) && <Link href={`/absensi?classId=${item.class_id}&date=${item.attendance_date}&prayer=${item.prayer_name}`} className="font-semibold text-[#42634e] hover:underline">Edit sesi</Link>}</td></tr>; })}</tbody></table></div></>}
      <div className="flex justify-between"><Link aria-disabled={page <= 1} href={`?mulai=${startDate}&sampai=${endDate}&kelas=${classId}&salat=${prayer}&santri=${encodeURIComponent(nameSearch)}&halaman=${Math.max(1, page - 1)}`} className={`flex min-h-11 items-center rounded-xl border border-[#dfe7e1] bg-white px-4 text-xs font-semibold ${page <= 1 ? "pointer-events-none opacity-40" : ""}`}>Sebelumnya</Link><Link aria-disabled={page >= totalPages} href={`?mulai=${startDate}&sampai=${endDate}&kelas=${classId}&salat=${prayer}&santri=${encodeURIComponent(nameSearch)}&halaman=${Math.min(totalPages, page + 1)}`} className={`flex min-h-11 items-center rounded-xl border border-[#dfe7e1] bg-white px-4 text-xs font-semibold ${page >= totalPages ? "pointer-events-none opacity-40" : ""}`}>Berikutnya</Link></div>
    </div></main><BottomNav role={profile.role} /></div>;
}
