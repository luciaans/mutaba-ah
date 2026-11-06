import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, FileSpreadsheet, FileText, UserRound } from "lucide-react";
import { BottomNav, Sidebar } from "@/components/app-navigation";
import { LogoutButton } from "@/components/logout-button";
import { requireProfile } from "@/lib/auth";
import { REPORT_WEEK_START } from "@/lib/constants";
import { monthRangeInAppTimeZone, todayInAppTimeZone, weekRangeInAppTimeZone } from "@/lib/time";
import { createClient } from "@/lib/supabase/server";

type PrayerName = "subuh" | "zuhur" | "asar" | "magrib" | "isya";
const prayerLabels: Record<PrayerName, string> = { subuh: "Subuh", zuhur: "Zuhur", asar: "Asar", magrib: "Magrib", isya: "Isya" };
const absenceReasonLabels = { sakit: "Sakit", izin: "Izin", alfa: "Alfa" } as const;

export const metadata = { title: "Detail Santri" };

export const dynamic = "force-dynamic";

function dateList(year: number, month: number, days: number) {
  return Array.from({ length: days }, (_, index) => `${year}-${String(month).padStart(2, "0")}-${String(index + 1).padStart(2, "0")}`);
}

export default async function StudentDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ bulan?: string }> }) {
  const profile = await requireProfile();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const supabase = await createClient();
  const { data: student, error: studentError } = await supabase.from("students").select("*").eq("id", id).maybeSingle();
  if (studentError || !student) return <div className="flex min-h-dvh items-center justify-center bg-[#f6f8f6] p-5"><div className="rounded-2xl border border-[#e7ece8] bg-white p-8 text-center"><p className="text-sm font-bold text-[#34443a]">Data santri tidak ditemukan</p><Link href="/santri" className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-[#0d5c45] px-4 text-xs font-bold text-white">Kembali ke daftar santri</Link></div></div>;

  const today = todayInAppTimeZone();
  const { data: photoResult } = student.photo_url ? await supabase.storage.from("student-photos").createSignedUrl(student.photo_url, 60 * 60) : { data: null };
  const proposedMonth = query.bulan && /^\d{4}-(0[1-9]|1[0-2])$/.test(query.bulan) ? query.bulan : today.slice(0, 7);
  const selectedMonth = proposedMonth <= today.slice(0, 7) ? proposedMonth : today.slice(0, 7);
  const [year, month] = selectedMonth.split("-").map(Number);
  const monthRange = monthRangeInAppTimeZone(`${selectedMonth}-01`);
  const weekRange = weekRangeInAppTimeZone(today, REPORT_WEEK_START);
  const [monthSummaryResult, weekSummaryResult, calendarResult, classResult] = await Promise.all([
    supabase.rpc("attendance_student_summary", { p_start_date: monthRange.start, p_end_date: monthRange.end, p_class_id: student.class_id }),
    supabase.rpc("attendance_student_summary", { p_start_date: weekRange.start, p_end_date: weekRange.end, p_class_id: student.class_id }),
    supabase.rpc("attendance_student_calendar", { p_student_id: student.id, p_start_date: monthRange.start, p_end_date: monthRange.end }),
    supabase.from("classes").select("class_name").eq("id", student.class_id).maybeSingle(),
  ]);
  const monthSummary = monthSummaryResult.data?.find((item) => item.student_id === student.id);
  const weekSummary = weekSummaryResult.data?.find((item) => item.student_id === student.id);
  const calendarData = calendarResult.data ?? [];
  const className = classResult.data?.class_name ?? "Kelas";
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const allDates = dateList(year, month, daysInMonth);
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const mondayOffset = (firstWeekday + 6) % 7;
  const byDate = new Map<string, typeof calendarData>();
  calendarData.forEach((item) => byDate.set(item.attendance_date, [...(byDate.get(item.attendance_date) ?? []), item]));
  const recent = [...calendarData].sort((a, b) => b.attendance_date.localeCompare(a.attendance_date) || b.prayer_name.localeCompare(a.prayer_name)).slice(0, 15);
  const recorderIds = [...new Set(recent.map((item) => item.recorded_by))];
  const { data: recorderData } = recorderIds.length ? await supabase.from("profiles").select("id, full_name").in("id", recorderIds) : { data: [] as { id: string; full_name: string }[] };
  const recorderMap = new Map((recorderData ?? []).map((item) => [item.id, item.full_name]));
  const monthLabel = new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Pontianak", month: "long", year: "numeric" }).format(new Date(`${selectedMonth}-15T12:00:00+07:00`));
  const monthDates = [...Array(mondayOffset).fill("") as string[], ...allDates];

  return <div className="app-shell"><Sidebar role={profile.role} /><main className="main-content min-h-dvh px-5 pb-12 pt-5 sm:px-8 sm:pt-7 lg:px-11"><header className="mx-auto flex max-w-[1120px] items-center justify-between"><div><Link href="/santri" className="inline-flex min-h-9 items-center gap-1 text-xs font-semibold text-[#75827b] hover:text-[#0d5c45]"><ChevronLeft size={16} />Daftar santri</Link><h1 className="mt-1 text-xl font-bold text-[#1d2b24]">Detail santri</h1></div><LogoutButton /></header>
    <div className="mx-auto mt-5 max-w-[1120px] space-y-5"><section className="flex items-center gap-4 rounded-2xl border border-[#e7ece8] bg-white p-5 sm:p-6"><div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#eaf4ef] text-[#0d5c45]">{photoResult?.signedUrl ? <Image src={photoResult.signedUrl} alt={`Foto ${student.full_name}`} width={56} height={56} unoptimized className="h-full w-full object-cover" /> : <UserRound size={24} />}</div><div className="min-w-0"><h2 className="truncate text-lg font-bold text-[#25342b]">{student.full_name}</h2><p className="mt-1 text-xs text-[#849087]">{className} <span className="mx-1">·</span>No. {student.roll_number}</p><span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ${student.is_active ? "bg-[#eaf4ef] text-[#34704f]" : "bg-[#f0f2f0] text-[#758078]"}`}>{student.is_active ? "Aktif" : "Nonaktif"}</span></div></section>
      <section><h2 className="mb-3 text-sm font-bold text-[#25342b]">Ringkasan periode</h2><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[{ label: "Terlaksana pekan ini", value: weekSummary?.performed_count ?? 0, color: "text-[#34704f]" }, { label: "Tidak terlaksana pekan ini", value: weekSummary?.missed_count ?? 0, color: "text-[#a4483d]" }, { label: "Terlaksana bulan ini", value: monthSummary?.performed_count ?? 0, color: "text-[#34704f]" }, { label: "Tidak terlaksana bulan ini", value: monthSummary?.missed_count ?? 0, color: "text-[#a4483d]" }].map((item) => <article key={item.label} className="rounded-2xl border border-[#e7ece8] bg-white p-4"><p className="text-[10px] leading-relaxed text-[#849087]">{item.label}</p><p className={`mt-2 text-xl font-bold ${item.color}`}>{item.value || "—"}</p></article>)}</div><p className="mt-2 text-[10px] text-[#8c978f]">Pekan {weekRange.start} – {weekRange.end}; pekan dimulai hari {REPORT_WEEK_START === "monday" ? "Senin" : "Sabtu"}.</p></section>
      <section className="rounded-2xl border border-[#e7ece8] bg-white p-5 sm:p-6"><div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-sm font-bold text-[#25342b]">Kalender absensi</h2><p className="mt-1 text-xs text-[#849087]">Hijau: seluruh lima waktu tercatat melaksanakan. Merah: ada catatan tidak melaksanakan. Abu-abu: data belum lengkap.</p></div><form><label className="text-[10px] font-semibold text-[#68756d]">Pilih bulan<input type="month" name="bulan" defaultValue={selectedMonth} max={today.slice(0, 7)} className="mt-1 block h-10 rounded-lg border border-[#dfe7e1] bg-white px-2 text-xs" /></label></form></div><div className="grid grid-cols-7 gap-1.5 text-center">{["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map((day) => <div key={day} className="py-2 text-[10px] font-bold text-[#849087]">{day}</div>)}{monthDates.map((date, index) => { if (!date) return <div key={`pad-${index}`} />; const records = byDate.get(date) ?? []; const missedRecords = records.filter((item) => item.is_missed); const hasMissed = missedRecords.length > 0; const complete = records.length === 5 && !hasMissed; const state = hasMissed ? "bg-[#c94b41] text-white" : complete ? "bg-[#43815a] text-white" : "bg-[#eef1ee] text-[#758078]"; const reasons = missedRecords.map((item) => `${prayerLabels[item.prayer_name]}: ${item.absence_reason ? absenceReasonLabels[item.absence_reason as keyof typeof absenceReasonLabels] : "Alfa"}`).join(", "); const status = hasMissed ? `Tidak salat · ${reasons}` : complete ? "Lima waktu tercatat melaksanakan" : records.length ? `${records.length} waktu tercatat; belum lengkap` : "Belum ada catatan"; return <div key={date} title={`${date}: ${status}`} aria-label={`${date}: ${status}`} className={`flex aspect-square min-h-9 items-center justify-center rounded-lg text-[10px] font-semibold sm:min-h-12 sm:text-xs ${state}`}>{Number(date.slice(-2))}</div>; })}</div><div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[10px] text-[#718078]"><span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-[#43815a]" />Terlaksana lengkap</span><span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-[#c94b41]" />Ada tidak terlaksana</span><span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-[#eef1ee]" />Belum lengkap/tidak ada</span></div><div className="mt-4 flex flex-wrap gap-2"><a href={`/api/export/excel?jenis=individu&santri=${student.id}&bulan=${selectedMonth}`} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#0d5c45] px-4 text-xs font-bold text-white"><FileSpreadsheet size={15} />Unduh Excel individu</a><a href={`/api/export/pdf?jenis=individu&santri=${student.id}&bulan=${selectedMonth}`} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#dfe7e1] px-4 text-xs font-bold text-[#40564a]"><FileText size={15} />Unduh PDF individu</a></div></section>
      <section className="overflow-hidden rounded-2xl border border-[#e7ece8] bg-white"><div className="border-b border-[#edf1ed] px-5 py-4"><h2 className="text-sm font-bold text-[#25342b]">Riwayat lima waktu</h2><p className="mt-1 text-xs text-[#849087]">Catatan terbaru pada {monthLabel}.</p></div>{recent.length ? <div className="divide-y divide-[#edf1ed]">{recent.map((item) => <div key={`${item.attendance_date}-${item.prayer_name}`} className="flex items-center justify-between gap-3 px-5 py-3"><div><p className="text-xs font-bold text-[#34443a]">{prayerLabels[item.prayer_name]}</p><p className="mt-1 text-[10px] text-[#849087]">{new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Pontianak", weekday: "long", day: "numeric", month: "long" }).format(new Date(`${item.attendance_date}T12:00:00+07:00`))} · dicatat {recorderMap.get(item.recorded_by) ?? "pembimbing"}</p></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${item.is_missed ? "bg-[#fff0ed] text-[#a4483d]" : "bg-[#eaf4ef] text-[#34704f]"}`}>{item.is_missed ? `Tidak melaksanakan · ${item.absence_reason ? absenceReasonLabels[item.absence_reason as keyof typeof absenceReasonLabels] : "Alfa"}` : "Melaksanakan"}</span></div>)}</div> : <div className="p-10 text-center text-xs text-[#849087]">Belum ada data tersimpan pada bulan ini.</div>}</section>
      {(monthSummaryResult.error || weekSummaryResult.error || calendarResult.error) && <p role="alert" className="text-xs text-[#a64336]">Sebagian rekap belum dapat dimuat.</p>}
    </div></main><BottomNav role={profile.role} /></div>;
}
