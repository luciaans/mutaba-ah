"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { AlertTriangle, CalendarDays, Check, Circle, LoaderCircle, RotateCcw, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatDateId, formatTimeId, type PrayerName } from "@/lib/time";
import { attendanceCheckedMap, attendanceReasonMap, isMissedFromCheckbox, type AbsenceReason } from "@/lib/attendance";
import { ConfirmationDialog } from "@/components/confirmation-dialog";
import { useAppDialog } from "@/components/app-dialog";
import type { Database } from "@/types/database.types";

type ClassRow = Database["public"]["Tables"]["classes"]["Row"];
type StudentRow = Database["public"]["Tables"]["students"]["Row"];
type SessionRow = Database["public"]["Tables"]["attendance_sessions"]["Row"];
type AttendanceRow = Database["public"]["Tables"]["prayer_attendance"]["Row"];
type ProfileRow = Pick<Database["public"]["Tables"]["profiles"]["Row"], "id" | "full_name">;

const prayers: { id: PrayerName; label: string }[] = [
  { id: "subuh", label: "Subuh" }, { id: "zuhur", label: "Zuhur" }, { id: "asar", label: "Asar" },
  { id: "magrib", label: "Magrib" }, { id: "isya", label: "Isya" },
];
const absenceReasons: { id: AbsenceReason; label: string }[] = [
  { id: "sakit", label: "Sakit" }, { id: "izin", label: "Izin" }, { id: "alfa", label: "Alfa" },
];
const absenceReasonLabels: Record<AbsenceReason, string> = { sakit: "Sakit", izin: "Izin", alfa: "Alfa" };

type Bundle = { students: StudentRow[]; sessions: SessionRow[]; attendance: AttendanceRow[]; profiles: ProfileRow[] };

function displayUpdatedAt(value: string) {
  return new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Pontianak", weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(value));
}

export function AttendanceForm({
  classes, initialClassId, initialDate, today, minTeacherDate, initialPrayer, initialStudents, initialSessions, initialAttendance, initialProfiles,
}: {
  classes: ClassRow[]; initialClassId: string; initialDate: string; today: string; minTeacherDate: string | null; initialPrayer: PrayerName;
  initialStudents: StudentRow[]; initialSessions: SessionRow[]; initialAttendance: AttendanceRow[]; initialProfiles: ProfileRow[];
}) {
  const router = useRouter();
  const [classId, setClassId] = useState(initialClassId);
  const [date, setDate] = useState(initialDate);
  const [prayer, setPrayer] = useState<PrayerName>(initialPrayer);
  const [bundle, setBundle] = useState<Bundle>({ students: initialStudents, sessions: initialSessions, attendance: initialAttendance, profiles: initialProfiles });
  const initialSessionExists = initialSessions.some((item) => item.prayer_name === initialPrayer);
  const [checked, setChecked] = useState<Record<string, boolean>>(() => attendanceCheckedMap(initialStudents, initialAttendance, initialSessionExists));
  const [baseline, setBaseline] = useState<Record<string, boolean>>(() => attendanceCheckedMap(initialStudents, initialAttendance, initialSessionExists));
  const [reasons, setReasons] = useState<Record<string, AbsenceReason>>(() => attendanceReasonMap(initialStudents, initialAttendance));
  const [baselineReasons, setBaselineReasons] = useState<Record<string, AbsenceReason>>(() => attendanceReasonMap(initialStudents, initialAttendance));
  const [recordedIds, setRecordedIds] = useState<Set<string>>(() => new Set(initialSessionExists ? initialAttendance.map((row) => row.student_id) : []));
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const { confirm, Dialog } = useAppDialog();
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);
  const [online, setOnline] = useState(true);
  const [toast, setToast] = useState("");
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update(); window.addEventListener("online", update); window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);

  const currentSession = bundle.sessions.find((item) => item.prayer_name === prayer);
  const checkedCount = bundle.students.reduce((count, student) => count + (checked[student.id] ? 1 : 0), 0);
  const unrecordedCount = currentSession ? bundle.students.length - recordedIds.size : bundle.students.length;
  const dirty = bundle.students.some((student) => Boolean(checked[student.id]) !== Boolean(baseline[student.id]) || (Boolean(checked[student.id]) && reasons[student.id] !== baselineReasons[student.id]));
  const checkedNames = useMemo(() => bundle.students.filter((student) => checked[student.id]).map((student) => `${student.full_name} (${absenceReasonLabels[reasons[student.id] ?? "alfa"]})`), [bundle.students, checked, reasons]);
  const filteredStudents = useMemo(() => bundle.students.filter((student) => student.full_name.toLocaleLowerCase("id-ID").includes(search.trim().toLocaleLowerCase("id-ID"))), [bundle.students, search]);
  const className = classes.find((item) => item.id === classId)?.class_name ?? "Kelas";
  const editLocked = Boolean(minTeacherDate && date < minTeacherDate);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  async function discardIfDirty() {
    if (!dirty) return true;
    return confirm({ title: "Buang perubahan absensi?", message: "Perubahan centang belum disimpan. Jika pindah sesi, perubahan ini akan hilang.", confirmLabel: "Buang dan pindah", cancelLabel: "Tetap di sesi", tone: "danger" });
  }

  async function loadBundle(nextClass: string, nextDate: string, nextPrayer: PrayerName) {
    if (!await discardIfDirty()) return;
    setLoading(true); setLoadError(""); setToast("");
    try {
      const supabase = createClient();
      const [studentResult, sessionResult, attendanceResult] = await Promise.all([
        supabase.from("students").select("*").eq("class_id", nextClass).eq("is_active", true).order("roll_number"),
        supabase.from("attendance_sessions").select("*").eq("class_id", nextClass).eq("attendance_date", nextDate),
        supabase.from("prayer_attendance").select("*").eq("class_id", nextClass).eq("attendance_date", nextDate).eq("prayer_name", nextPrayer),
      ]);
      if (studentResult.error || sessionResult.error || attendanceResult.error) throw new Error("Data absensi belum dapat dimuat.");
      const sessions = (sessionResult.data ?? []) as SessionRow[];
      const current = sessions.some((item) => item.prayer_name === nextPrayer);
      const attendance = current ? (attendanceResult.data ?? []) as AttendanceRow[] : [];
      const recorderIds = [...new Set(sessions.map((item) => item.recorded_by))];
      const profileResult = recorderIds.length ? await supabase.from("profiles").select("id, full_name").in("id", recorderIds) : { data: [] as ProfileRow[], error: null };
      if (profileResult.error) throw new Error("Nama pencatat absensi belum dapat dimuat.");
      const nextBundle: Bundle = { students: studentResult.data ?? [], sessions, attendance, profiles: profileResult.data ?? [] };
      const nextChecked = attendanceCheckedMap(nextBundle.students, attendance, current);
      const nextReasons = attendanceReasonMap(nextBundle.students, attendance);
      setBundle(nextBundle); setChecked(nextChecked); setBaseline(nextChecked);
      setReasons(nextReasons); setBaselineReasons(nextReasons);
      setRecordedIds(new Set(current ? attendance.map((row) => row.student_id) : []));
      setClassId(nextClass); setDate(nextDate); setPrayer(nextPrayer);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Data absensi belum dapat dimuat.");
    } finally { setLoading(false); }
  }

  function updatePrayer(nextPrayer: PrayerName) { if (nextPrayer !== prayer) void loadBundle(classId, date, nextPrayer); }
  function toggleStudent(studentId: string) {
    const nextChecked = !checked[studentId];
    setChecked((current) => ({ ...current, [studentId]: nextChecked }));
    if (nextChecked) setReasons((current) => ({ ...current, [studentId]: current[studentId] ?? "alfa" }));
  }
  async function resetChecks() {
    if (checkedCount === 0) return;
    if (!await confirm({ title: "Kosongkan semua tanda X?", message: "Semua santri akan ditandai melaksanakan pada sesi ini. Perubahan belum tersimpan sampai Anda menekan Simpan Absensi.", confirmLabel: "Kosongkan tanda", tone: "danger" })) return;
    setChecked(Object.fromEntries(bundle.students.map((student) => [student.id, false])));
  }

  function saveAttendance() {
    if (!online || !navigator.onLine) { setOnline(false); setDialogOpen(false); setToast("Anda sedang offline. Centang tetap tersimpan di layar; sambungkan jaringan untuk mencoba lagi."); return; }
    if (bundle.students.length === 0) { setToast("Belum ada santri aktif di kelas ini."); return; }
    startTransition(async () => {
      try {
        const supabase = createClient();
        const payload = bundle.students.map((student) => { const is_missed = isMissedFromCheckbox(Boolean(checked[student.id])); return { student_id: student.id, is_missed, absence_reason: is_missed ? (reasons[student.id] ?? "alfa") : null }; });
        const { data, error } = await supabase.rpc("save_attendance_session", {
          p_class_id: classId, p_attendance_date: date, p_prayer_name: prayer,
          p_expected_updated_at: currentSession?.updated_at ?? null, p_records: payload,
        });
        if (error) {
          setDialogOpen(false);
          if (error.code === "40001") setToast("Sesi diperbarui orang lain. Periksa ulang data terbaru sebelum menyimpan.");
          else if (error.code === "42501") setToast(error.message.includes("3 hari") ? error.message : "Anda tidak memiliki akses untuk mengubah sesi ini.");
          else setToast("Absensi belum tersimpan. Periksa koneksi dan coba lagi; tanda X tetap dipertahankan.");
          return;
        }
        const saved = data?.[0];
        if (!saved) { setToast("Sistem belum menerima konfirmasi penyimpanan. Coba muat ulang sesi."); return; }
        const updatedSession: SessionRow = {
          id: saved.session_id, class_id: classId, attendance_date: date, prayer_name: prayer,
          recorded_by: saved.saved_by, created_at: currentSession?.created_at ?? saved.saved_updated_at, updated_at: saved.saved_updated_at,
        };
        const updatedAttendance = payload.map((row) => ({
          id: "", student_id: row.student_id, class_id: classId, attendance_date: date, prayer_name: prayer,
          is_missed: row.is_missed, absence_reason: row.absence_reason, recorded_by: saved.saved_by, created_at: saved.saved_updated_at, updated_at: saved.saved_updated_at,
        } satisfies AttendanceRow));
        const nextSessions = [...bundle.sessions.filter((item) => item.prayer_name !== prayer), updatedSession];
        const nextAttendance = [...bundle.attendance.filter((item) => item.prayer_name !== prayer), ...updatedAttendance];
        const profile = bundle.profiles.find((item) => item.id === saved.saved_by);
        const { data: currentProfile } = profile ? { data: profile } : await supabase.from("profiles").select("id, full_name").eq("id", saved.saved_by).maybeSingle();
        const nextProfiles = currentProfile ? [...bundle.profiles.filter((item) => item.id !== saved.saved_by), currentProfile] : bundle.profiles;
        setBundle({ ...bundle, sessions: nextSessions, attendance: nextAttendance, profiles: nextProfiles });
        setBaseline(checked); setBaselineReasons(reasons); setRecordedIds(new Set(bundle.students.map((student) => student.id)));
        setDialogOpen(false); setToast(`Absensi tersimpan pukul ${formatTimeId(saved.saved_updated_at)} WIB.`); router.refresh();
      } catch {
        setDialogOpen(false);
        setToast("Koneksi bermasalah. Tanda X tetap dipertahankan; sambungkan jaringan lalu coba lagi.");
      }
    });
  }

  const recorder = currentSession ? bundle.profiles.find((item) => item.id === currentSession.recorded_by)?.full_name ?? "Pembimbing" : "";

  return <div className="mx-auto max-w-[1120px] pb-52">
    <section className="rounded-2xl border border-[#e7ece8] bg-white p-4 sm:p-5">
      <div className="grid gap-3 sm:grid-cols-[1fr_1.1fr]"><label className="text-xs font-semibold text-[#47564d]">Tanggal<div className="mt-1.5 flex h-12 items-center gap-2 rounded-xl border border-[#dfe7e1] px-3"><CalendarDays size={16} className="text-[#0d5c45]" /><input type="date" value={date} max={today} min={minTeacherDate ?? undefined} disabled={loading} onChange={(event) => { const value = event.target.value; if (value && value <= today && (!minTeacherDate || value >= minTeacherDate)) void loadBundle(classId, value, prayer); }} className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none" /></div>{minTeacherDate && <span className="mt-1 block text-[10px] font-normal text-[#849087]">Pembimbing dapat mengubah absensi dalam 3 hari terakhir.</span>}</label><label className="text-xs font-semibold text-[#47564d]">Kelas<select value={classId} disabled={loading || classes.length === 1} onChange={(event) => void loadBundle(event.target.value, date, prayer)} className="mt-1.5 h-12 w-full rounded-xl border border-[#dfe7e1] bg-white px-3 text-sm outline-none focus:border-[#70a68c]">{classes.map((item) => <option key={item.id} value={item.id}>{item.class_name}</option>)}</select></label></div>
      <div className="mt-4"><div className="mb-2 flex items-center justify-between"><p className="text-xs font-semibold text-[#47564d]">Waktu salat</p><p className="text-[11px] text-[#849087]">{bundle.students.length} santri aktif</p></div><div className="grid grid-cols-5 gap-1.5 rounded-xl bg-[#f3f6f3] p-1">{prayers.map((item) => { const isSaved = bundle.sessions.some((session) => session.prayer_name === item.id); return <button key={item.id} type="button" disabled={loading} onClick={() => updatePrayer(item.id)} aria-pressed={prayer === item.id} className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[11px] font-bold transition sm:min-h-16 sm:text-xs ${prayer === item.id ? "bg-white text-[#0d5c45] shadow-sm" : "text-[#6c7971] hover:bg-white/70"}`}><span>{item.label}</span><span className="flex items-center gap-1 text-[9px] font-medium">{isSaved ? <><Check size={11} />Tersimpan</> : <><Circle size={8} />Belum</>}</span></button>; })}</div></div>
    </section>

    {currentSession && <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-[#dcebe1] bg-[#f3f8f4] px-3.5 py-3 text-xs text-[#3d6950]"><Check size={14} /><span className="font-semibold">Sudah tersimpan</span><span>oleh {recorder}, {displayUpdatedAt(currentSession.updated_at)}</span></div>}
    {editLocked && <div role="status" className="mt-3 rounded-xl border border-[#f0e6ca] bg-[#fffaf0] px-3.5 py-3 text-xs leading-relaxed text-[#806b3d]">Sesi ini tetap dapat dilihat, tetapi batas edit pembimbing tiga hari sudah lewat.</div>}
    {unrecordedCount > 0 && <div className="mt-3 flex items-start gap-2 rounded-xl border border-[#f0e6ca] bg-[#fffaf0] px-3.5 py-3 text-xs leading-relaxed text-[#806b3d]"><AlertTriangle size={15} className="mt-0.5 shrink-0" /><p><strong>{unrecordedCount} santri belum tercatat.</strong> Santri yang masuk kelas setelah sesi tersimpan akan dihitung saat absensi ini disimpan.</p></div>}
    {loadError && <div role="alert" className="mt-3 rounded-xl bg-[#fff1ef] px-3.5 py-3 text-xs text-[#a64336]">{loadError}</div>}
    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center"><label className="flex h-11 flex-1 items-center gap-2.5 rounded-xl border border-[#dfe7e1] bg-white px-3.5"><Search size={16} className="text-[#86928a]" /><span className="sr-only">Cari nama santri</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari nama santri…" className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none" /></label><div className="flex items-center justify-between gap-3 rounded-xl border border-[#e7ece8] bg-white px-3.5 py-2.5 text-xs"><span className="font-bold text-[#a3483d]">{checkedCount} dari {bundle.students.length} tidak melaksanakan</span><button type="button" onClick={resetChecks} className="flex min-h-9 items-center gap-1.5 px-2 font-semibold text-[#607067] hover:text-[#0d5c45]"><RotateCcw size={14} />Reset</button></div></div>

    <div className="mt-3 overflow-hidden rounded-2xl border border-[#e7ece8] bg-white">
      {loading ? <div className="flex min-h-56 items-center justify-center gap-2 text-xs font-semibold text-[#718078]"><LoaderCircle size={17} className="animate-spin" />Memuat daftar absensi…</div> : bundle.students.length === 0 ? <div className="px-5 py-14 text-center"><p className="text-sm font-semibold text-[#4d5c52]">Belum ada santri aktif</p><p className="mt-1 text-xs text-[#8b968f]">Tambahkan santri aktif ke kelas {className} terlebih dahulu.</p></div> : filteredStudents.length === 0 ? <div className="px-5 py-12 text-center text-xs text-[#849087]">Nama santri tidak ditemukan.</div> : <>
        <div className="hidden grid-cols-[68px_1fr_150px] items-center bg-[#f7f9f7] px-5 py-3 text-[10px] font-bold uppercase tracking-wide text-[#748078] sm:grid"><span>No.</span><span>Nama santri</span><span className="text-center">Status sesi</span></div>
        <ul>{filteredStudents.map((student, index) => { const missed = Boolean(checked[student.id]); const recorded = recordedIds.has(student.id); return <li key={student.id} className="border-t border-[#edf1ed] first:border-t-0"><button type="button" role="checkbox" aria-checked={missed} onClick={() => toggleStudent(student.id)} className={`flex min-h-[68px] w-full items-center gap-3 px-3.5 text-left transition sm:min-h-[64px] sm:px-5 ${missed ? "bg-[#fff8f6]" : "bg-white hover:bg-[#fbfcfb]"}`}><span className="w-7 shrink-0 text-center text-xs font-bold tabular-nums text-[#77847b] sm:w-8">{student.roll_number || index + 1}</span><span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 transition ${missed ? "border-[#c94b41] bg-[#c94b41] text-white" : "border-[#d9e1db] bg-white text-transparent"}`} aria-hidden="true">{missed && <X size={17} strokeWidth={3} />}</span><span className="min-w-0 flex-1"><span className={`block truncate text-[13px] font-semibold ${missed ? "text-[#8d3e35]" : "text-[#34443a]"}`}>{student.full_name}</span><span className="mt-0.5 block text-[10px] text-[#89958d]">{recorded ? "Sudah tercatat" : "Belum tercatat"}</span></span><span className={`hidden min-w-[120px] text-center text-[11px] font-medium sm:block ${missed ? "text-[#b54a40]" : recorded ? "text-[#568067]" : "text-[#929c95]"}`}>{missed ? `Tidak melaksanakan · ${absenceReasonLabels[reasons[student.id] ?? "alfa"]}` : recorded ? "Melaksanakan" : "Belum tercatat"}</span></button>{missed && <fieldset className="flex flex-wrap items-center gap-2 bg-[#fff8f6] px-3.5 pb-3 pt-0 sm:pl-[5.25rem]"><legend className="sr-only">Alasan tidak salat untuk {student.full_name}</legend><span className="mr-1 text-[11px] font-semibold text-[#805b56]">Alasan:</span>{absenceReasons.map((reason) => <label key={reason.id} className={`inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-lg border px-3 text-xs font-semibold ${reasons[student.id] === reason.id ? "border-[#c94b41] bg-white text-[#9b4037]" : "border-[#eadbd8] text-[#7b6c69]"}`}><input type="radio" name={`absence-${student.id}`} value={reason.id} checked={(reasons[student.id] ?? "alfa") === reason.id} onChange={() => setReasons((current) => ({ ...current, [student.id]: reason.id }))} className="accent-[#c94b41]" />{reason.label}</label>)}</fieldset>}</li>; })}</ul>
      </>}
    </div>

    {toast && <div role="status" className="fixed bottom-[calc(148px+env(safe-area-inset-bottom))] left-1/2 z-40 w-[calc(100%-32px)] max-w-lg -translate-x-1/2 rounded-xl border border-[#dcebe1] bg-white px-4 py-3 text-center text-xs font-semibold text-[#35664a] shadow-lg sm:bottom-24">{toast}<button type="button" onClick={() => setToast("")} className="ml-3 underline">Tutup</button></div>}
    <div className="fixed inset-x-0 bottom-[calc(68px+env(safe-area-inset-bottom))] z-30 border-t border-[#e4ebe5] bg-white/95 px-4 py-3 backdrop-blur sm:bottom-0 sm:px-8 sm:py-3"><div className="mx-auto flex max-w-[1120px] items-center justify-between gap-3"><div className="min-w-0"><p className="truncate text-xs font-bold text-[#34443a]">{checkedCount} dari {bundle.students.length} santri tidak melaksanakan</p><p className="mt-1 truncate text-[10px] text-[#849087]">{className} · {prayers.find((item) => item.id === prayer)?.label} · {formatDateId(date)}</p></div><button type="button" onClick={() => setDialogOpen(true)} disabled={loading || isPending || bundle.students.length === 0 || !online || editLocked} className="flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#0d5c45] px-4 text-xs font-bold text-white shadow-sm transition hover:bg-[#0a4d3a] disabled:cursor-not-allowed disabled:opacity-50 sm:min-w-48 sm:px-6"><Check size={16} />Simpan Absensi</button></div></div>
    <ConfirmationDialog open={dialogOpen} title="Periksa absensi sebelum disimpan" description={`Absensi ${prayers.find((item) => item.id === prayer)?.label} kelas ${className}, ${date}. Catatan akan disimpan untuk seluruh ${bundle.students.length} santri aktif.`} names={checkedNames} confirmLabel={`Simpan ${bundle.students.length} catatan`} pending={isPending} onConfirm={saveAttendance} onCancel={() => setDialogOpen(false)} />
    <Dialog />
  </div>;
}
