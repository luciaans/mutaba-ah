import { AlertCircle, ArrowUpRight, CalendarDays, Check, Clock3, Sparkles } from "lucide-react";
import Link from "next/link";
import { BottomNav, Sidebar } from "@/components/app-navigation";
import { Brand } from "@/components/brand";
import { LogoutButton } from "@/components/logout-button";
import { requireProfile } from "@/lib/auth";
import { DashboardCards } from "@/components/dashboard-cards";
import { InstallPrompt } from "@/components/pwa-shell";
import { createClient } from "@/lib/supabase/server";
import { formatDateId, formatTimeId, prayerForTime, todayInAppTimeZone, type PrayerName } from "@/lib/time";

const prayerLabels: Record<PrayerName, string> = { subuh: "Subuh", zuhur: "Zuhur", asar: "Asar", magrib: "Magrib", isya: "Isya" };

export const dynamic = "force-dynamic";

export default async function Home() {
  const profile = await requireProfile();
  const today = todayInAppTimeZone();
  const supabase = await createClient();
  const [summaryResult, recentResult, remindersResult] = await Promise.all([
    supabase.rpc("dashboard_summary", { p_attendance_date: today }),
    supabase.rpc("dashboard_recent_activities", { p_limit: 6 }),
    supabase.rpc("dashboard_class_reminders", { p_attendance_date: today }),
  ]);
  const reminders = remindersResult.data ?? [];
  const summaryRows = summaryResult.data ?? [];
  const recentActivities = recentResult.data ?? [];
  const dashboardError = Boolean(summaryResult.error || recentResult.error || remindersResult.error);
  return (
    <div className="app-shell">
      <Sidebar role={profile.role} />
      <main className="main-content min-h-dvh px-5 pb-12 pt-5 sm:px-8 sm:pt-7 lg:px-11">
        <header className="mx-auto flex max-w-[1240px] items-center justify-between gap-4">
          <div className="md:hidden"><Brand compact /></div>
          <div className="hidden md:block">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8a968e]">Ruang kerja</p>
            <h1 className="mt-1 text-xl font-bold tracking-tight text-[#1d2b24]">Beranda</h1>
          </div>
          <div className="ml-auto flex min-w-0 items-center gap-2.5 rounded-2xl border border-[#e4ebe5] bg-white px-3 py-2.5 shadow-[0_2px_8px_rgba(29,43,36,0.04)] sm:shrink-0 sm:gap-3 sm:rounded-xl sm:px-3.5 sm:py-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#eaf4ef] text-[#0d5c45]"><CalendarDays size={17} aria-hidden="true" /></span>
            <span className="flex min-w-0 flex-col justify-center">
              <time className="block whitespace-nowrap text-[11px] font-bold leading-4 text-[#34443a] sm:text-xs">{formatDateId(today)}</time>
              <span className="mt-0.5 block whitespace-nowrap text-[10px] font-medium leading-4 text-[#7c8980]">Nanga Tepuai, Kapuas Hulu</span>
            </span>
          </div>
          <div className="hidden shrink-0 items-center gap-3 sm:flex"><div className="text-right leading-tight"><p className="text-xs font-bold text-[#34443a]">{profile.full_name}</p><p className="mt-1 text-[10px] text-[#89958d]">{profile.role === "ustaz" ? "Pembimbing" : "Admin"}</p></div><LogoutButton /></div>
        </header>

        <div className="mx-auto mt-7 max-w-[1240px] sm:mt-9">
          <section className="relative overflow-hidden rounded-[26px] bg-[#0d5c45] px-6 py-7 text-white shadow-[0_12px_32px_rgba(17,73,54,0.12)] sm:px-9 sm:py-9">
            <div className="pointer-events-none absolute -right-12 -top-28 h-72 w-72 rounded-full border border-white/10" />
            <div className="pointer-events-none absolute -right-1 -top-16 h-52 w-52 rounded-full border border-white/10" />
            <div className="relative max-w-[670px]">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-semibold tracking-wide text-[#e1eee7]">
                <Sparkles size={13} aria-hidden="true" /> Sistem Monitoring Ibadah Santri
              </div>
              <h2 className="max-w-[560px] text-[26px] font-bold leading-[1.2] tracking-tight sm:text-[34px]">Menjaga Kedisiplinan,<br className="hidden sm:block" /> Membentuk Kebiasaan Ibadah.</h2>
              <p className="mt-3 max-w-[460px] text-[13px] leading-relaxed text-[#d2e4da] sm:text-sm">Catat pelaksanaan salat dengan mudah, agar pendampingan santri berjalan konsisten setiap hari.</p>
              <div className="mt-6 flex items-stretch gap-2 sm:flex-wrap sm:items-center"><Link href={`/absensi?date=${today}&prayer=${prayerForTime()}`} className="inline-flex min-h-12 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl bg-white px-2 text-xs font-bold text-[#14573f] shadow-sm transition hover:bg-[#f2f7f3] focus-visible:outline-white sm:flex-none sm:gap-2 sm:px-4 sm:text-sm"><Check size={16} aria-hidden="true" />Mulai absensi<ArrowUpRight size={15} aria-hidden="true" /></Link><InstallPrompt /></div>
            </div>
          </section>

          <section aria-labelledby="ringkasan-heading" className="mt-7">
            <div className="mb-3">
              <div>
              <h2 id="ringkasan-heading" className="text-[15px] font-bold text-[#25342b]">Ringkasan hari ini</h2>
              <p className="mt-1 text-xs text-[#849087]">Data kehadiran salat yang sudah tercatat</p>
              </div>
            </div>
            {dashboardError && <div role="alert" className="mb-3 flex items-center gap-2 rounded-xl bg-[#fff8eb] px-3 py-2.5 text-xs text-[#806b3d]"><AlertCircle size={14} />Ringkasan belum dapat dimuat dari server.</div>}
            <DashboardCards rows={summaryRows} isAdmin={profile.role === "admin"} />
          </section>

          <section className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <article className="rounded-2xl border border-[#e7ece8] bg-white p-5 sm:p-6">
              <div className="flex items-start justify-between">
                <div><h2 className="text-sm font-bold text-[#25342b]">Aktivitas terbaru</h2><p className="mt-1 text-xs text-[#849087]">Catatan absensi yang baru disimpan</p></div>
                <Clock3 size={17} className="text-[#93a097]" aria-hidden="true" />
              </div>
              {recentActivities.length ? <ul className="mt-4 divide-y divide-[#edf1ed]">{recentActivities.map((item) => <li key={item.session_id} className="flex items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="truncate text-xs font-bold text-[#435249]">{item.recorder_name} <span className="font-medium text-[#89958d]">· {item.class_name}</span></p><p className="mt-1 text-[10px] text-[#849087]">{prayerLabels[item.prayer_name]} · {formatDateId(item.attendance_date, { day: "numeric", month: "short" })} pukul {formatTimeId(item.updated_at)}</p></div><span className="shrink-0 rounded-lg bg-[#f2f6f3] px-2 py-1 text-[10px] font-bold text-[#607067]">{item.student_count} santri</span></li>)}</ul> : <div className="flex min-h-32 flex-col items-center justify-center py-5 text-center"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f1f5f2] text-[#718078]"><Clock3 size={18} /></div><p className="mt-3 text-xs font-semibold text-[#59675e]">Belum ada aktivitas tersimpan</p><p className="mt-1 max-w-xs text-[11px] leading-relaxed text-[#909b94]">Riwayat pencatatan tersimpan akan muncul di sini.</p></div>}
            </article>
            <article className="rounded-2xl border border-[#e7ece8] bg-white p-5 sm:p-6">
              <div className="flex items-start justify-between">
                <div><h2 className="text-sm font-bold text-[#25342b]">Pengingat absensi</h2><p className="mt-1 text-xs text-[#849087]">Kelas yang perlu dicatat hari ini</p></div>
                <span className="rounded-full bg-[#fbf7eb] px-2.5 py-1 text-[10px] font-bold text-[#92783e]">Hari ini</span>
              </div>
              {reminders.length ? <ul className="mt-3 max-h-[290px] space-y-2 overflow-auto">{reminders.map((item) => <li key={`${item.class_id}-${item.prayer_name}`}><Link href={`/absensi?classId=${item.class_id}&date=${today}&prayer=${item.prayer_name}`} className="flex min-h-12 items-center justify-between gap-2 rounded-xl border border-[#edf1ed] px-3 py-2 hover:border-[#cbded0] hover:bg-[#f8fbf8]"><span className="min-w-0"><span className="block truncate text-xs font-bold text-[#435249]">{item.class_name}</span><span className="mt-0.5 block text-[10px] text-[#849087]">{prayerLabels[item.prayer_name]} · {item.recorded_student_count}/{item.active_student_count} santri tercatat</span></span><ArrowUpRight size={15} className="shrink-0 text-[#0d5c45]" /></Link></li>)}</ul> : dashboardError ? <div className="mt-4 rounded-xl border border-dashed border-[#e2e8e3] bg-[#fafcfa] px-4 py-5 text-center"><p className="text-xs font-semibold text-[#59675e]">Pengingat belum dapat dimuat</p><p className="mt-1 text-[11px] text-[#909b94]">Periksa koneksi, lalu muat ulang halaman.</p></div> : <div className="mt-4 rounded-xl border border-dashed border-[#d5e5d9] bg-[#f5faf6] px-4 py-5 text-center"><p className="text-xs font-semibold text-[#3f6b4e]">Semua waktu salat sudah dicatat</p><p className="mt-1 text-[11px] text-[#7e9282]">Pengingat berikutnya akan tampil saat ada sesi yang belum disimpan.</p></div>}
            </article>
          </section>
          <p className="mt-7 text-center text-[10px] font-medium tracking-wide text-[#9aa49d]">MUTABA’AH <span className="mx-1 text-[#b59552]">·</span> Menjaga Kedisiplinan, Membentuk Kebiasaan Ibadah</p>
        </div>
      </main>
      <BottomNav role={profile.role} />
    </div>
  );
}
