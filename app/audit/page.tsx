import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import { BottomNav, Sidebar } from "@/components/app-navigation";
import { LogoutButton } from "@/components/logout-button";
import { requireRole } from "@/lib/auth";
import { formatDateId, formatTimeId, shiftIsoDate, todayInAppTimeZone, type PrayerName } from "@/lib/time";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

type LogRow = Database["public"]["Tables"]["attendance_logs"]["Row"];
const prayerLabels: Record<PrayerName, string> = { subuh: "Subuh", zuhur: "Zuhur", asar: "Asar", magrib: "Magrib", isya: "Isya" };

export const dynamic = "force-dynamic";

function statusText(value: boolean | null) {
  if (value === null) return "—";
  return value ? "Tidak melaksanakan" : "Melaksanakan";
}

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ mulai?: string; sampai?: string; aksi?: string; santri?: string; halaman?: string }> }) {
  const profile = await requireRole("admin");
  const params = await searchParams;
  const today = todayInAppTimeZone();
  const requestedStart = params.mulai && /^\d{4}-\d{2}-\d{2}$/.test(params.mulai) && params.mulai <= today ? params.mulai : shiftIsoDate(today, -29);
  const end = params.sampai && /^\d{4}-\d{2}-\d{2}$/.test(params.sampai) && params.sampai <= today ? params.sampai : today;
  const start = requestedStart > end ? end : requestedStart;
  const action = ["INSERT", "UPDATE", "DELETE"].includes(params.aksi ?? "") ? params.aksi as "INSERT" | "UPDATE" | "DELETE" : "all";
  const nameSearch = (params.santri ?? "").trim().replace(/[%_*]/g, "").slice(0, 80);
  const page = Math.max(1, Math.min(10000, Number(params.halaman) || 1));
  const pageSize = 50;
  const supabase = await createClient();
  const { data: matches, error: matchError } = nameSearch ? await supabase.from("students").select("id").ilike("full_name", `%${nameSearch}%`) : { data: null, error: null };
  const matchingIds = nameSearch ? (matches ?? []).map((item) => item.id) : null;
  let logs: LogRow[] = [];
  let total = 0;
  let error = Boolean(matchError);
  if (matchingIds?.length === 0) {
    logs = [];
  } else {
    let query = supabase.from("attendance_logs").select("*", { count: "exact" }).gte("attendance_date", start).lte("attendance_date", end).order("changed_at", { ascending: false });
    if (action !== "all") query = query.eq("action", action);
    if (matchingIds) query = query.in("student_id", matchingIds);
    const result = await query.range((page - 1) * pageSize, page * pageSize - 1);
    error ||= Boolean(result.error);
    logs = result.data ?? [];
    total = result.count ?? 0;
  }
  const [studentResult, changerResult] = await Promise.all([
    logs.length ? supabase.from("students").select("id, full_name, class_id, roll_number").in("id", [...new Set(logs.map((item) => item.student_id))]) : Promise.resolve({ data: [] as { id: string; full_name: string; class_id: string; roll_number: number }[] }),
    logs.length ? supabase.from("profiles").select("id, full_name").in("id", [...new Set(logs.flatMap((item) => item.changed_by ? [item.changed_by] : []))]) : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
  ]);
  const students = studentResult.data ?? [];
  const changers = changerResult.data ?? [];
  const studentMap = new Map(students.map((item) => [item.id, item]));
  const changerMap = new Map(changers.map((item) => [item.id, item.full_name]));
  const { data: classes } = await supabase.from("classes").select("id, class_name");
  const classMap = new Map((classes ?? []).map((item) => [item.id, item.class_name]));
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return <div className="app-shell"><Sidebar role="admin" /><main className="main-content min-h-dvh px-5 pb-12 pt-5 sm:px-8 sm:pt-7 lg:px-11"><header className="mx-auto flex max-w-[1200px] items-center justify-between"><div><Link href="/" className="text-xs font-semibold text-[#75827b] hover:text-[#0d5c45]">← Beranda</Link><h1 className="mt-2 flex items-center gap-2 text-xl font-bold text-[#1d2b24]"><LockKeyhole size={19} className="text-[#0d5c45]" />Audit log</h1><p className="mt-1 text-xs text-[#849087]">Catatan perubahan otomatis; log ini hanya dapat dibaca administrator.</p></div><LogoutButton /></header>
    <div className="mx-auto mt-6 max-w-[1200px] space-y-4"><div className="rounded-xl border border-[#dcebe1] bg-[#f3f8f4] px-4 py-3 text-xs leading-relaxed text-[#42664d]">Log dibuat oleh trigger database dan tidak menyediakan aksi ubah atau hapus.</div><section className="rounded-2xl border border-[#e7ece8] bg-white p-4"><form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><label className="text-[11px] font-semibold text-[#5b695f]">Dari tanggal<input type="date" name="mulai" defaultValue={start} max={today} className="mt-1.5 h-11 w-full rounded-lg border border-[#dfe7e1] px-2 text-xs" /></label><label className="text-[11px] font-semibold text-[#5b695f]">Sampai tanggal<input type="date" name="sampai" defaultValue={end} max={today} className="mt-1.5 h-11 w-full rounded-lg border border-[#dfe7e1] px-2 text-xs" /></label><label className="text-[11px] font-semibold text-[#5b695f]">Jenis perubahan<select name="aksi" defaultValue={action} className="mt-1.5 h-11 w-full rounded-lg border border-[#dfe7e1] bg-white px-2 text-xs"><option value="all">Semua perubahan</option><option value="INSERT">Catatan baru</option><option value="UPDATE">Perubahan</option><option value="DELETE">Penghapusan</option></select></label><label className="text-[11px] font-semibold text-[#5b695f]">Nama santri<input name="santri" defaultValue={nameSearch} placeholder="Cari nama santri" className="mt-1.5 h-11 w-full rounded-lg border border-[#dfe7e1] px-3 text-xs" /></label><button className="mt-auto min-h-11 rounded-xl bg-[#0d5c45] text-xs font-bold text-white">Terapkan filter</button></form></section>
      {error && <p role="alert" className="rounded-xl bg-[#fff1ef] p-3 text-xs text-[#a64336]">Audit log belum dapat dimuat.</p>}<p className="text-xs text-[#75827b]">{total.toLocaleString("id-ID")} perubahan · {formatDateId(start)} – {formatDateId(end)}</p>
      {logs.length === 0 ? <div className="rounded-2xl border border-dashed border-[#e0e7e1] bg-white px-5 py-14 text-center text-xs text-[#849087]">Belum ada perubahan yang cocok dengan filter.</div> : <><div className="space-y-2 md:hidden">{logs.map((item) => { const student = studentMap.get(item.student_id); return <article key={item.id} className="rounded-xl border border-[#e7ece8] bg-white p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold text-[#34443a]">{student?.full_name ?? "Santri"}</p><p className="mt-1 text-[10px] text-[#849087]">{classMap.get(student?.class_id ?? "") ?? "Kelas"} · {prayerLabels[item.prayer_name]}</p></div><span className="rounded-full bg-[#f2f5f2] px-2 py-1 text-[9px] font-bold text-[#68756d]">{item.action}</span></div><div className="mt-3 space-y-1 border-t border-[#edf1ed] pt-3 text-[10px] text-[#6c7971]"><p>{statusText(item.previous_status)} <span className="mx-1">→</span> {statusText(item.new_status)}</p><p>{formatDateId(item.attendance_date)} · {formatTimeId(item.changed_at)}</p><p>Diubah oleh {item.changed_by ? changerMap.get(item.changed_by) ?? "Akun nonaktif" : "Akun dihapus"}</p></div></article>; })}</div><div className="hidden overflow-x-auto rounded-2xl border border-[#e7ece8] bg-white md:block"><table className="w-full min-w-[1000px] text-left text-xs"><thead className="bg-[#f7f9f7] font-bold text-[#748078]"><tr><th className="px-4 py-3">Waktu perubahan</th><th className="px-4 py-3">Santri / kelas</th><th className="px-4 py-3">Salat</th><th className="px-4 py-3">Aksi</th><th className="px-4 py-3">Nilai lama</th><th className="px-4 py-3">Nilai baru</th><th className="px-4 py-3">Pengguna</th></tr></thead><tbody>{logs.map((item) => { const student = studentMap.get(item.student_id); return <tr key={item.id} className="border-t border-[#edf1ed]"><td className="px-4 py-3.5 text-[#68756d]">{formatDateId(item.attendance_date)}<span className="mt-1 block text-[10px]">{formatTimeId(item.changed_at)}</span></td><td className="px-4 py-3.5"><span className="font-semibold text-[#34443a]">{student?.full_name ?? "Santri"}</span><span className="mt-1 block text-[10px] text-[#849087]">{classMap.get(student?.class_id ?? "") ?? "Kelas"}</span></td><td className="px-4 py-3.5">{prayerLabels[item.prayer_name]}</td><td className="px-4 py-3.5">{item.action}</td><td className="px-4 py-3.5">{statusText(item.previous_status)}</td><td className="px-4 py-3.5">{statusText(item.new_status)}</td><td className="px-4 py-3.5">{item.changed_by ? changerMap.get(item.changed_by) ?? "Akun nonaktif" : "Akun dihapus"}</td></tr>; })}</tbody></table></div></>}
      <div className="flex justify-between"><Link href={`?mulai=${start}&sampai=${end}&aksi=${action}&santri=${encodeURIComponent(nameSearch)}&halaman=${Math.max(1, page - 1)}`} className={`flex min-h-11 items-center rounded-xl border border-[#dfe7e1] bg-white px-4 text-xs font-semibold ${page <= 1 ? "pointer-events-none opacity-40" : ""}`}>Sebelumnya</Link><span className="self-center text-xs text-[#849087]">Halaman {page} / {totalPages}</span><Link href={`?mulai=${start}&sampai=${end}&aksi=${action}&santri=${encodeURIComponent(nameSearch)}&halaman=${Math.min(totalPages, page + 1)}`} className={`flex min-h-11 items-center rounded-xl border border-[#dfe7e1] bg-white px-4 text-xs font-semibold ${page >= totalPages ? "pointer-events-none opacity-40" : ""}`}>Berikutnya</Link></div>
    </div></main><BottomNav role={profile.role} /></div>;
}
