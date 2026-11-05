import { Activity, BookOpenCheck, CircleUserRound, Percent, UsersRound } from "lucide-react";
import type { Database } from "@/types/database.types";
import { ReportCharts } from "@/components/report-charts";

type SummaryRow = Database["public"]["Functions"]["dashboard_summary"]["Returns"][number];
const prayerLabels: Record<SummaryRow["prayer_name"], string> = { subuh: "Subuh", zuhur: "Zuhur", asar: "Asar", magrib: "Magrib", isya: "Isya" };

export function DashboardCards({ rows, isAdmin }: { rows: SummaryRow[]; isAdmin: boolean }) {
  const summary = rows[0];
  if (!summary) return <p className="rounded-2xl border border-dashed border-[#e0e7e1] bg-white p-8 text-center text-xs text-[#849087]">Ringkasan belum dapat dimuat.</p>;
  const performedTotal = rows.reduce((total, row) => total + row.performed_count, 0);
  const attendanceTotal = rows.reduce((total, row) => total + row.attendance_count, 0);
  const dailyPercent = attendanceTotal ? `${(performedTotal * 100 / attendanceTotal).toLocaleString("id-ID", { maximumFractionDigits: 1 })}%` : "—";
  const cards = [
    { label: "Santri aktif", value: summary.active_student_count.toLocaleString("id-ID"), icon: UsersRound },
    { label: "Total kelas", value: summary.class_count.toLocaleString("id-ID"), icon: BookOpenCheck },
    { label: isAdmin ? "Kelas tanggung jawab" : "Kelas saya", value: summary.responsibility_class_count.toLocaleString("id-ID"), icon: CircleUserRound },
    { label: "Santri tercatat hari ini", value: summary.recorded_student_count.toLocaleString("id-ID"), icon: Activity },
    { label: "Santri tercatat tidak salat", value: summary.missed_student_count.toLocaleString("id-ID"), icon: Activity },
    { label: "Pelaksanaan hari ini", value: dailyPercent, icon: Percent },
  ];
  return <>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">{cards.map(({ label, value, icon: Icon }, index) => <article key={label} className="rounded-2xl border border-[#e7ece8] bg-white p-4 sm:p-5"><div className="flex items-center justify-between gap-2"><p className="text-[10px] font-semibold leading-snug text-[#7e8a82]">{label}</p><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${index === 4 ? "bg-[#fff1ef] text-[#b04b40]" : index === 5 ? "bg-[#f7f3e8] text-[#987e45]" : "bg-[#eaf4ef] text-[#0d5c45]"}`}><Icon size={15} /></span></div><p className="mt-4 text-xl font-bold tracking-tight text-[#25342b]">{value}</p></article>)}</div>
    <section className="mt-5 rounded-2xl border border-[#e7ece8] bg-white p-5 sm:p-6"><div className="mb-4"><h2 className="text-sm font-bold text-[#25342b]">Statistik salat hari ini</h2><p className="mt-1 text-xs text-[#849087]">Jumlah dari catatan yang sudah tersimpan untuk setiap waktu salat</p></div><div className="grid gap-2 md:grid-cols-5">{rows.map((row) => <article key={row.prayer_name} className="rounded-xl border border-[#edf1ed] p-3.5"><div className="flex items-center justify-between"><h3 className="text-xs font-bold text-[#35443a]">{prayerLabels[row.prayer_name]}</h3><span className={`rounded-full px-2 py-1 text-[9px] font-bold ${row.session_saved ? "bg-[#eaf4ef] text-[#34704f]" : "bg-[#f2f4f2] text-[#89958d]"}`}>{row.session_saved ? "Sudah diabsen" : "Belum diabsen"}</span></div>{row.session_saved ? <><p className="mt-3 text-[11px] text-[#65736a]">Melaksanakan <strong className="text-[#2e6247]">{row.performed_count}</strong><span className="mx-2 text-[#c0c8c2]">·</span>Tidak <strong className="text-[#a4483d]">{row.missed_count}</strong></p><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#f5e5e2]"><div className="h-full rounded-full bg-[#43815a]" style={{ width: `${row.attendance_count ? (row.performed_count / row.attendance_count) * 100 : 0}%` }} /></div></> : <p className="mt-3 text-[11px] text-[#929c95]">Belum ada catatan</p>}</article>)}</div><div className="mt-5">{rows.some((row) => row.attendance_count > 0) ? <ReportCharts rows={rows.map((row) => ({ name: prayerLabels[row.prayer_name], performed: row.performed_count, missed: row.missed_count }))} /> : <div className="rounded-xl bg-[#f8faf8] px-4 py-8 text-center text-xs text-[#849087]">Grafik akan tampil setelah catatan absensi tersimpan.</div>}</div></section>
  </>;
}
