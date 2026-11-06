"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Trash2, UsersRound } from "lucide-react";
import type { Database } from "@/types/database.types";
import { StudentEditForm, StudentRemoveButton } from "@/components/record-forms";
import { StudentExport } from "@/components/student-tools";
import { removeStudentsAction } from "@/app/actions/records";
import { useAppDialog } from "@/components/app-dialog";

type ClassRow = Database["public"]["Tables"]["classes"]["Row"];
type StudentRow = Database["public"]["Tables"]["students"]["Row"];
type StudentGroup = { id: string; name: string; students: StudentRow[] };

export function StudentList({ students, classes, canManage }: { students: StudentRow[]; classes: ClassRow[]; canManage: boolean }) {
  const [query, setQuery] = useState("");
  const [classId, setClassId] = useState("all");
  const [activeFilter, setActiveFilter] = useState("aktif");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const { confirm, Dialog } = useAppDialog();
  const classNames = useMemo(() => new Map(classes.map((item) => [item.id, item.class_name])), [classes]);
  const filtered = useMemo(() => students.filter((student) => {
    const matchesName = student.full_name.toLocaleLowerCase("id-ID").includes(query.trim().toLocaleLowerCase("id-ID"));
    const matchesClass = classId === "all" || student.class_id === classId;
    const matchesActive = activeFilter === "semua" || (activeFilter === "aktif" ? student.is_active : !student.is_active);
    return matchesName && matchesClass && matchesActive;
  }), [students, query, classId, activeFilter]);
  const groups = useMemo<StudentGroup[]>(() => {
    const grouped = new Map<string, StudentRow[]>();
    for (const student of filtered) grouped.set(student.class_id, [...(grouped.get(student.class_id) ?? []), student]);
    return [...grouped.entries()]
      .map(([id, groupStudents]) => ({
        id,
        name: classNames.get(id) ?? "Kelas",
        students: groupStudents.sort((a, b) => a.roll_number - b.roll_number || a.full_name.localeCompare(b.full_name, "id")),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "id"));
  }, [filtered, classNames]);
  const visibleSelected = filtered.filter((student) => selectedIds.includes(student.id));
  const allVisibleSelected = filtered.length > 0 && visibleSelected.length === filtered.length;

  function toggleStudent(id: string) {
    setMessage("");
    setError("");
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function toggleAll() {
    setMessage("");
    setError("");
    setSelectedIds((current) => allVisibleSelected
      ? current.filter((id) => !filtered.some((student) => student.id === id))
      : [...new Set([...current, ...filtered.map((student) => student.id)])]);
  }

  async function deleteSelected() {
    const names = visibleSelected.slice(0, 3).map((student) => student.full_name).join(", ");
    const more = visibleSelected.length > 3 ? ` dan ${visibleSelected.length - 3} santri lainnya` : "";
    const confirmed = await confirm({
      title: `Hapus ${visibleSelected.length} santri yang dipilih?`,
      message: `${names}${more}\n\nSantri yang memiliki riwayat absensi akan dinonaktifkan agar riwayatnya tetap tersimpan.`,
      confirmLabel: `Hapus ${visibleSelected.length} santri`,
      cancelLabel: "Periksa lagi",
      tone: "danger",
    });
    if (!confirmed) return;
    setDeleting(true);
    setMessage("");
    setError("");
    const result = await removeStudentsAction(visibleSelected.map((student) => student.id));
    setDeleting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    const parts = [];
    if (result.deleted) parts.push(`${result.deleted} data dihapus`);
    if (result.deactivated) parts.push(`${result.deactivated} santri dinonaktifkan karena memiliki riwayat`);
    setMessage(`${parts.join("; ")}.`);
    setSelectedIds((current) => current.filter((id) => !visibleSelected.some((student) => student.id === id)));
  }

  const checkboxClass = "h-4 w-4 shrink-0 cursor-pointer accent-[#0d5c45]";
  const editControl = (student: StudentRow) => <StudentEditForm student={student} classes={classes} />;
  const removeControl = (student: StudentRow, compact = false) => <StudentRemoveButton student={student} compact={compact} />;

  return <>
    <Dialog />
    <div className="mb-4 grid grid-cols-1 gap-2.5 sm:grid-cols-[minmax(220px,1fr)_repeat(2,minmax(140px,auto))_auto] sm:items-center">
      <label className="flex h-[52px] min-w-0 items-center gap-3 rounded-xl border border-[#dfe7e1] bg-white px-4 focus-within:border-[#75a68d] sm:h-11 sm:gap-2.5 sm:px-3.5">
        <Search size={18} className="h-5 w-5 shrink-0 text-[#86928a] sm:h-4 sm:w-4" />
        <span className="sr-only">Cari nama santri</span>
        <input type="search" value={query} onChange={(event) => { setQuery(event.target.value); setMessage(""); setError(""); }} placeholder="Cari nama santri…" className="h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-[#98a29b] sm:text-sm" />
      </label>
      <label className="sr-only" htmlFor="filter-kelas">Filter kelas</label>
      <select id="filter-kelas" value={classId} onChange={(event) => setClassId(event.target.value)} className="h-11 w-full rounded-xl border border-[#dfe7e1] bg-white px-3 text-xs font-semibold text-[#536158]">
        <option value="all">Semua kelas</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.class_name}</option>)}
      </select>
      <label className="sr-only" htmlFor="filter-status">Filter status</label>
      <select id="filter-status" value={activeFilter} onChange={(event) => setActiveFilter(event.target.value)} className="h-11 w-full rounded-xl border border-[#dfe7e1] bg-white px-3 text-xs font-semibold text-[#536158]">
        <option value="aktif">Santri aktif</option><option value="nonaktif">Santri nonaktif</option><option value="semua">Semua status</option>
      </select>
      {canManage && <div className="sm:justify-self-end"><StudentExport students={filtered} classes={classes} /></div>}
    </div>

    {canManage && <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e3eae4] bg-white px-3.5 py-3 sm:px-4">
      <label className="inline-flex min-h-8 cursor-pointer items-center gap-2.5 text-xs font-semibold text-[#536158]">
        <input type="checkbox" checked={allVisibleSelected} onChange={toggleAll} className={checkboxClass} />
        <span>{allVisibleSelected ? "Batalkan pilihan" : "Pilih semua yang tampil"}<span className="ml-1 font-normal text-[#87938b]">({filtered.length})</span></span>
      </label>
      {visibleSelected.length > 0 && <button type="button" onClick={deleteSelected} disabled={deleting} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#a74338] px-3.5 text-xs font-bold text-white transition hover:bg-[#91372e] disabled:cursor-wait disabled:opacity-60">
        <Trash2 size={14} />{deleting ? "Menghapus…" : `Hapus ${visibleSelected.length} dipilih`}
      </button>}
    </div>}
    {error && <p role="alert" className="mb-3 rounded-xl border border-[#f2d8d4] bg-[#fff5f3] px-4 py-3 text-xs text-[#a64336]">{error}</p>}
    {message && <p role="status" className="mb-3 rounded-xl border border-[#d8e9dd] bg-[#f1f8f3] px-4 py-3 text-xs text-[#286345]">{message}</p>}

    {filtered.length === 0 ? <div className="rounded-2xl border border-dashed border-[#e0e7e1] bg-white px-5 py-12 text-center"><div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[#f0f5f1] text-[#718078]"><UsersRound size={20} /></div><p className="mt-3 text-sm font-semibold text-[#4d5c52]">Santri belum ditemukan</p><p className="mt-1 text-xs text-[#8b968f]">Ubah pencarian atau filter kelas.</p></div> : <>
      <div className="space-y-3 md:hidden">{groups.map((group) => <section key={group.id} className="overflow-hidden rounded-xl border border-[#dce6de] bg-white shadow-[0_1px_2px_rgba(20,50,30,0.03)]">
        <h3 className="flex items-center justify-between gap-3 bg-[#edf5ef] px-4 py-3 text-xs font-bold text-[#285c43]"><span>{group.name}</span><span className="text-[10px] font-semibold text-[#6b8172]">{group.students.length} santri</span></h3>
        <div className="divide-y divide-[#edf1ed]">{group.students.map((student) => <article key={student.id} className="flex min-h-[76px] items-center gap-2.5 p-3">
          {canManage && <input aria-label={`Pilih ${student.full_name}`} type="checkbox" checked={selectedIds.includes(student.id)} onChange={() => toggleStudent(student.id)} className={checkboxClass} />}
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#edf4ef] text-xs font-bold text-[#0d5c45]">{student.roll_number}</span>
          <div className="min-w-0 flex-1"><Link href={`/santri/${student.id}`} className="block truncate text-sm font-bold text-[#34443a]">{student.full_name}</Link><span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${student.is_active ? "bg-[#eaf4ef] text-[#2d6a4b]" : "bg-[#f0f2f0] text-[#758078]"}`}>{student.is_active ? "Aktif" : "Nonaktif"}</span></div>
          {canManage && <div className="flex shrink-0 items-center gap-0.5">{editControl(student)}{removeControl(student, true)}</div>}
        </article>)}</div>
      </section>)}</div>
      <div className="hidden overflow-x-auto rounded-2xl border border-[#e7ece8] bg-white shadow-[0_1px_3px_rgba(20,50,30,0.04)] md:block"><table className="w-full min-w-[780px] text-left text-sm"><thead className="bg-[#f7f9f7] text-[11px] font-bold uppercase tracking-wide text-[#748078]"><tr>{canManage && <th className="w-12 px-4 py-3.5"><span className="sr-only">Pilih santri</span></th>}<th className="w-24 px-5 py-3.5">No.</th><th className="px-5 py-3.5">Nama santri</th><th className="w-32 px-5 py-3.5">Status</th>{canManage && <th className="w-[260px] px-5 py-3.5">Kelola</th>}</tr></thead>{groups.map((group) => <tbody key={group.id}>
        <tr className="border-t border-[#e0e8e1] bg-[#edf5ef]"><th colSpan={canManage ? 5 : 3} className="px-5 py-3 text-left text-xs font-bold text-[#285c43]">{group.name}<span className="ml-2 text-[10px] font-semibold text-[#718078]">{group.students.length} santri</span></th></tr>
        {group.students.map((student) => <tr key={student.id} className="border-t border-[#edf1ed] transition-colors hover:bg-[#fbfcfb]">{canManage && <td className="px-4 py-2"><input aria-label={`Pilih ${student.full_name}`} type="checkbox" checked={selectedIds.includes(student.id)} onChange={() => toggleStudent(student.id)} className={checkboxClass} /></td>}<td className="px-5 py-3.5 font-semibold text-[#59675e]">{student.roll_number}</td><td className="px-5 py-3.5"><Link href={`/santri/${student.id}`} className="font-semibold text-[#34443a] hover:text-[#0d5c45]">{student.full_name}</Link></td><td className="px-5 py-3.5"><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${student.is_active ? "bg-[#eaf4ef] text-[#2d6a4b]" : "bg-[#f0f2f0] text-[#758078]"}`}>{student.is_active ? "Aktif" : "Nonaktif"}</span></td>{canManage && <td className="px-5 py-2"><div className="flex items-center gap-1">{editControl(student)}{removeControl(student)}</div></td>}</tr>)}
      </tbody>)}</table></div>
    </>}
    <p className="mt-3 text-xs text-[#849087]">Menampilkan {filtered.length} dari {students.length} santri</p>
  </>;
}
