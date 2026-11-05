"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Pencil, Plus, Trash2 } from "lucide-react";
import { deleteAssignmentAction, deleteClassAction, reactivateStudentAction, removeStudentAction, saveAssignmentAction, saveClassAction, saveStudentAction } from "@/app/actions/records";
import type { ActionState } from "@/types/action-state";
import type { Database } from "@/types/database.types";
import { StudentPhotoUpload } from "@/components/student-photo-upload";
import { useAppDialog } from "@/components/app-dialog";

type ClassRow = Database["public"]["Tables"]["classes"]["Row"];
type StudentRow = Database["public"]["Tables"]["students"]["Row"];
type TeacherRow = Pick<Database["public"]["Tables"]["profiles"]["Row"], "id" | "full_name">;
function Feedback({ state }: { state: ActionState }) {
  if (state.error) return <p role="alert" className="mt-3 rounded-lg bg-[#fff1ef] px-3 py-2 text-xs text-[#a64336]">{state.error}</p>;
  if (state.success) return <p role="status" className="mt-3 rounded-lg bg-[#edf6f0] px-3 py-2 text-xs text-[#286345]">{state.success}</p>;
  return null;
}

export function ClassForm({ initial }: { initial?: ClassRow }) {
  const [state, action, pending] = useActionState(saveClassAction, {});
  return <form action={action} className="grid gap-3 rounded-xl border border-[#edf1ed] p-4 sm:grid-cols-2"><input type="hidden" name="id" value={initial?.id ?? ""} /><label className="text-xs font-semibold text-[#47564d]">Nama kelas<input name="class_name" required maxLength={80} defaultValue={initial?.class_name} placeholder="Contoh: Kelas 1A" className="mt-1.5 h-11 w-full rounded-xl border border-[#dfe7e1] px-3 text-sm font-normal outline-none focus:border-[#70a68c]" /></label><label className="text-xs font-semibold text-[#47564d]">Tahun pelajaran<input name="academic_year" required maxLength={20} defaultValue={initial?.academic_year ?? "2026/2027"} className="mt-1.5 h-11 w-full rounded-xl border border-[#dfe7e1] px-3 text-sm font-normal outline-none focus:border-[#70a68c]" /></label><label className="text-xs font-semibold text-[#47564d] sm:col-span-2">Deskripsi<input name="description" maxLength={500} defaultValue={initial?.description ?? ""} className="mt-1.5 h-11 w-full rounded-xl border border-[#dfe7e1] px-3 text-sm font-normal outline-none focus:border-[#70a68c]" /></label><div className="sm:col-span-2"><button disabled={pending} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#0d5c45] px-4 text-xs font-bold text-white disabled:opacity-60">{initial ? <Pencil size={14} /> : <Plus size={14} />}{pending ? "Menyimpan…" : initial ? "Simpan perubahan" : "Tambah kelas"}</button><Feedback state={state} /></div></form>;
}

export function ClassDeleteButton({ id, label }: { id: string; label: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const { confirm, alert, Dialog } = useAppDialog();
  async function action() {
    if (pending) return;
    setPending(true);
    const confirmed = await confirm({ title: `Hapus kelas ${label}?`, message: "Kelas yang masih memiliki santri atau catatan tidak dapat dihapus.", confirmLabel: "Hapus kelas", tone: "danger" });
    if (!confirmed) { setPending(false); return; }
    const formData = new FormData(); formData.set("id", id);
    try {
      const result = await deleteClassAction(formData);
      if (result.error) await alert({ title: "Kelas belum dihapus", message: result.error, tone: "danger" });
      else { await alert({ title: "Kelas dihapus", message: result.success ?? "Data kelas berhasil dihapus.", tone: "success" }); router.refresh(); }
    } catch {
      await alert({ title: "Kelas belum dihapus", message: "Server tidak merespons. Muat ulang halaman dan coba lagi.", tone: "danger" });
    } finally { setPending(false); }
  }
  return <><Dialog /><button type="button" onClick={action} disabled={pending} className="flex min-h-10 items-center gap-2 rounded-xl border border-[#efd0cb] bg-white px-3 text-xs font-semibold text-[#a74338] transition hover:bg-[#fff3f0] disabled:opacity-60"><Trash2 size={14} />{pending ? "Konfirmasi…" : "Hapus kelas"}</button></>;
}

export function AssignmentForm({ classes, teachers }: { classes: ClassRow[]; teachers: TeacherRow[] }) {
  const [state, action, pending] = useActionState(saveAssignmentAction, {});
  return <form action={action} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]"><label className="text-xs font-semibold text-[#47564d]">Pembimbing<select name="teacher_id" required defaultValue="" className="mt-1.5 h-11 w-full rounded-xl border border-[#dfe7e1] bg-white px-3 text-sm font-normal"><option value="" disabled>Pilih pembimbing</option>{teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.full_name}</option>)}</select></label><label className="text-xs font-semibold text-[#47564d]">Kelas<select name="class_id" required defaultValue="" className="mt-1.5 h-11 w-full rounded-xl border border-[#dfe7e1] bg-white px-3 text-sm font-normal"><option value="" disabled>Pilih kelas</option>{classes.map((classRow) => <option key={classRow.id} value={classRow.id}>{classRow.class_name}</option>)}</select></label><button disabled={pending || classes.length === 0 || teachers.length === 0} className="mt-auto inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#0d5c45] px-4 text-xs font-bold text-white disabled:opacity-60"><Plus size={15} />Tetapkan</button><div className="sm:col-span-3"><Feedback state={state} /></div></form>;
}

export function AssignmentDeleteButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const { confirm, alert, Dialog } = useAppDialog();
  async function action() {
    if (pending) return;
    setPending(true);
    const confirmed = await confirm({ title: "Hapus penugasan kelas?", message: "Pembimbing tidak lagi dapat mengelola absensi kelas ini.", confirmLabel: "Hapus penugasan", tone: "danger" });
    if (!confirmed) { setPending(false); return; }
    const formData = new FormData(); formData.set("id", id);
    try {
      const result = await deleteAssignmentAction(formData);
      if (result.error) await alert({ title: "Penugasan belum dihapus", message: result.error, tone: "danger" });
      else { await alert({ title: "Penugasan dihapus", message: result.success ?? "Penugasan kelas berhasil dihapus.", tone: "success" }); router.refresh(); }
    } catch {
      await alert({ title: "Penugasan belum dihapus", message: "Server tidak merespons. Muat ulang halaman dan coba lagi.", tone: "danger" });
    } finally { setPending(false); }
  }
  return <><Dialog /><button type="button" onClick={action} aria-label="Hapus penugasan" disabled={pending} className="flex h-10 w-10 items-center justify-center rounded-xl text-[#a74338] transition hover:bg-[#fff3f0] disabled:opacity-60"><Trash2 size={15} /></button></>;
}

export function StudentForm({ classes }: { classes: ClassRow[] }) {
  const [state, action, pending] = useActionState(saveStudentAction, {});
  return <form action={action} className="grid gap-3 rounded-xl border border-[#edf1ed] p-4 sm:grid-cols-2"><label className="text-xs font-semibold text-[#47564d]">Nama lengkap<input name="full_name" required maxLength={160} className="mt-1.5 h-11 w-full rounded-xl border border-[#dfe7e1] px-3 text-sm font-normal outline-none focus:border-[#70a68c]" /></label><label className="text-xs font-semibold text-[#47564d]">Kelas<select name="class_id" required defaultValue="" className="mt-1.5 h-11 w-full rounded-xl border border-[#dfe7e1] bg-white px-3 text-sm font-normal"><option value="" disabled>Pilih kelas</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.class_name}</option>)}</select></label><label className="text-xs font-semibold text-[#47564d]">Nomor urut daftar hadir<input name="roll_number" type="number" required min={1} className="mt-1.5 h-11 w-full rounded-xl border border-[#dfe7e1] px-3 text-sm font-normal outline-none focus:border-[#70a68c]" /></label><div className="sm:col-span-2"><button disabled={pending || classes.length === 0} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#0d5c45] px-4 text-xs font-bold text-white disabled:opacity-60"><Plus size={14} />{pending ? "Menyimpan…" : "Tambah santri"}</button><Feedback state={state} /></div></form>;
}

export function StudentRemoveButton({ student, compact = false }: { student: StudentRow; compact?: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const { confirm, alert, Dialog } = useAppDialog();
  async function action() {
    if (pending) return;
    setPending(true);
    const confirmed = await confirm({ title: `Hapus ${student.full_name}?`, message: "Jika santri memiliki riwayat absensi, akun akan dinonaktifkan agar catatannya tetap utuh.", confirmLabel: "Hapus santri", tone: "danger" });
    if (!confirmed) { setPending(false); return; }
    const formData = new FormData();
    formData.set("id", student.id);
    try {
      const result = await removeStudentAction(formData);
      await alert({ title: result.error ? "Santri belum dihapus" : "Data santri diperbarui", message: result.error ?? result.success ?? "", tone: result.error ? "danger" : "success" });
      if (!result.error) router.refresh();
    } catch {
      await alert({ title: "Santri belum dihapus", message: "Server tidak merespons. Muat ulang halaman dan coba lagi.", tone: "danger" });
    } finally { setPending(false); }
  }
  async function reactivate() {
    if (pending) return;
    setPending(true);
    const confirmed = await confirm({ title: `Aktifkan kembali ${student.full_name}?`, message: "Santri akan muncul kembali dalam daftar absensi baru.", confirmLabel: "Aktifkan kembali", tone: "info" });
    if (!confirmed) { setPending(false); return; }
    const formData = new FormData();
    formData.set("id", student.id);
    try {
      const result = await reactivateStudentAction(formData);
      await alert({ title: result.error ? "Santri belum diaktifkan" : "Santri diaktifkan", message: result.error ?? result.success ?? "", tone: result.error ? "danger" : "success" });
      if (!result.error) router.refresh();
    } catch {
      await alert({ title: "Santri belum diaktifkan", message: "Server tidak merespons. Muat ulang halaman dan coba lagi.", tone: "danger" });
    } finally { setPending(false); }
  }
  if (!student.is_active) return <><Dialog /><button type="button" onClick={reactivate} aria-label={`Aktifkan kembali ${student.full_name}`} title="Aktifkan kembali" disabled={pending} className={`flex min-h-10 items-center gap-2 rounded-xl border border-[#d7e7dc] bg-white text-xs font-semibold text-[#34704f] transition hover:border-[#b7d7c2] hover:bg-[#f2f8f4] disabled:cursor-wait disabled:opacity-60 ${compact ? "w-10 justify-center px-0" : "whitespace-nowrap px-3"}`}><Check size={14} /><span className={compact ? "hidden" : ""}>{pending ? "Konfirmasi…" : "Aktifkan kembali"}</span></button></>;
  return <><Dialog /><button type="button" onClick={action} aria-label={`Hapus atau nonaktifkan ${student.full_name}`} title="Hapus / nonaktifkan" disabled={pending} className={`flex h-10 items-center gap-2 rounded-xl border border-[#efd0cb] bg-white text-xs font-semibold text-[#a74338] transition hover:border-[#dfa59e] hover:bg-[#fff3f0] disabled:cursor-wait disabled:opacity-60 ${compact ? "w-10 justify-center px-0" : "min-w-[168px] justify-center whitespace-nowrap px-3"}`}><Trash2 size={14} /><span className={compact ? "hidden" : ""}>{pending ? "Konfirmasi…" : "Hapus / nonaktifkan"}</span></button></>;
}

export function StudentEditForm({ student, classes }: { student: StudentRow; classes: ClassRow[] }) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState(saveStudentAction, {});
  if (!editing) return <button type="button" onClick={() => setEditing(true)} className="flex h-10 w-10 items-center justify-center rounded-lg text-[#65736a] hover:bg-[#f2f6f3]" aria-label={`Edit ${student.full_name}`}><Pencil size={15} /></button>;
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"><form role="dialog" aria-modal="true" aria-labelledby="student-edit-title" action={async (formData) => { await action(formData); }} className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"><h2 id="student-edit-title" className="mb-4 font-bold text-[#25342b]">Edit data santri</h2><StudentPhotoUpload student={student} /><input type="hidden" name="id" value={student.id} /><label className="block text-xs font-semibold">Nama<input name="full_name" required defaultValue={student.full_name} className="my-1.5 h-11 w-full rounded-lg border px-3 text-sm font-normal" /></label><label className="mt-3 block text-xs font-semibold">Kelas<select name="class_id" defaultValue={student.class_id} className="my-1.5 h-11 w-full rounded-lg border bg-white px-3 text-sm font-normal">{classes.map((item) => <option key={item.id} value={item.id}>{item.class_name}</option>)}</select></label><label className="mt-3 block text-xs font-semibold">Nomor urut<input name="roll_number" type="number" required min={1} defaultValue={student.roll_number} className="my-1.5 h-11 w-full rounded-lg border px-3 text-sm font-normal" /></label><Feedback state={state} /><div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => setEditing(false)} className="min-h-11 rounded-lg px-4 text-xs font-semibold">Tutup</button><button disabled={pending} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#0d5c45] px-4 text-xs font-bold text-white"><Check size={14} />Simpan</button></div></form></div>;
}
