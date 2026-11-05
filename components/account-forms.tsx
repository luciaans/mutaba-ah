"use client";

import { useActionState } from "react";
import { KeyRound, UserPlus, UserRoundCheck, UserRoundX } from "lucide-react";
import { changeOwnPasswordAction, createUstazAction, resetUstazPasswordAction, toggleUstazActiveAction, type ActionState } from "@/app/actions/account";
import { useAppDialog } from "@/components/app-dialog";

function Feedback({ state }: { state: ActionState }) {
  if (state.error) return <p role="alert" className="mt-3 rounded-lg bg-[#fff1ef] px-3 py-2.5 text-xs text-[#a64336]">{state.error}</p>;
  if (state.success) return <div role="status" className="mt-3 rounded-lg bg-[#edf6f0] px-3 py-2.5 text-xs text-[#286345]">{state.success}{state.temporaryPassword && <p className="mt-2 select-all break-all rounded bg-white px-3 py-2 font-mono text-xs font-bold">{state.temporaryPassword}</p>}</div>;
  return null;
}

export function CreateUstazForm() {
  const [state, action, pending] = useActionState(createUstazAction, {});
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <label className="text-xs font-semibold text-[#47564d]">Nama lengkap<input name="full_name" required maxLength={120} className="mt-1.5 h-11 w-full rounded-xl border border-[#dfe7e1] px-3 text-sm font-normal outline-none focus:border-[#70a68c] focus:ring-2 focus:ring-[#e1f0e7]" /></label>
      <label className="text-xs font-semibold text-[#47564d]">Username<input name="username" required minLength={3} maxLength={32} pattern="[a-zA-Z0-9][a-zA-Z0-9._-]*" autoComplete="off" className="mt-1.5 h-11 w-full rounded-xl border border-[#dfe7e1] px-3 text-sm font-normal outline-none focus:border-[#70a68c] focus:ring-2 focus:ring-[#e1f0e7]" /></label>
      <label className="text-xs font-semibold text-[#47564d] sm:col-span-2">Kata sandi awal<input name="password" type="password" required minLength={8} autoComplete="new-password" className="mt-1.5 h-11 w-full rounded-xl border border-[#dfe7e1] px-3 text-sm font-normal outline-none focus:border-[#70a68c] focus:ring-2 focus:ring-[#e1f0e7]" /><span className="mt-1 block font-normal text-[#89958d]">Minimal 8 karakter. Sampaikan kepada pemilik akun secara langsung.</span></label>
      <div className="sm:col-span-2"><button disabled={pending} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#0d5c45] px-4 text-xs font-bold text-white disabled:opacity-60"><UserPlus size={15} />{pending ? "Membuat akun…" : "Buat akun pembimbing"}</button><Feedback state={state} /></div>
    </form>
  );
}

export function ResetPasswordForm({ userId }: { userId: string }) {
  const [state, action, pending] = useActionState(resetUstazPasswordAction, {});
  const { confirm, Dialog } = useAppDialog();
  return <><Dialog /><form onSubmit={async (event) => { event.preventDefault(); const form = event.currentTarget; if (await confirm({ title: "Reset kata sandi akun?", message: "Kata sandi sementara hanya akan ditampilkan sekali. Pastikan Anda dapat menyampaikannya kepada pemilik akun.", confirmLabel: "Reset kata sandi", tone: "danger" })) action(new FormData(form)); }} className="min-w-[240px]"><input type="hidden" name="user_id" value={userId} /><button disabled={pending} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#e2e9e3] px-3 text-xs font-semibold text-[#536158] hover:bg-[#f6f8f6] disabled:opacity-60"><KeyRound size={14} />{pending ? "Memproses…" : "Reset kata sandi"}</button><Feedback state={state} /></form></>;
}

export function ToggleUstazActiveForm({ userId, isActive }: { userId: string; isActive: boolean }) {
  const [state, action, pending] = useActionState(async (_previous: ActionState, formData: FormData) => toggleUstazActiveAction(formData), {});
  const { confirm, Dialog } = useAppDialog();
  return <><Dialog /><form onSubmit={async (event) => { event.preventDefault(); const form = event.currentTarget; const confirmed = await confirm({ title: isActive ? "Nonaktifkan akun pembimbing?" : "Aktifkan kembali akun pembimbing?", message: isActive ? "Sesi login akun ini tidak akan lagi lolos pemeriksaan akses." : "Pemilik akun dapat masuk dan mengelola kelas yang ditugaskan kembali.", confirmLabel: isActive ? "Nonaktifkan akun" : "Aktifkan akun", tone: isActive ? "danger" : "info" }); if (confirmed) action(new FormData(form)); }} className="min-w-[220px]"><input type="hidden" name="user_id" value={userId} /><input type="hidden" name="active" value={String(!isActive)} /><button disabled={pending} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#e2e9e3] px-3 text-xs font-semibold text-[#536158] hover:bg-[#f6f8f6] disabled:opacity-60">{isActive ? <UserRoundX size={14} /> : <UserRoundCheck size={14} />}{pending ? "Memproses…" : isActive ? "Nonaktifkan akun" : "Aktifkan akun"}</button><Feedback state={state} /></form></>;
}

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(changeOwnPasswordAction, {});
  return (
    <form action={action} className="max-w-lg space-y-4">
      <label className="block text-xs font-semibold text-[#47564d]">Kata sandi saat ini<input name="current_password" type="password" required autoComplete="current-password" className="mt-1.5 h-11 w-full rounded-xl border border-[#dfe7e1] px-3 text-sm font-normal outline-none focus:border-[#70a68c] focus:ring-2 focus:ring-[#e1f0e7]" /></label>
      <label className="block text-xs font-semibold text-[#47564d]">Kata sandi baru<input name="password" type="password" required minLength={8} autoComplete="new-password" className="mt-1.5 h-11 w-full rounded-xl border border-[#dfe7e1] px-3 text-sm font-normal outline-none focus:border-[#70a68c] focus:ring-2 focus:ring-[#e1f0e7]" /></label>
      <label className="block text-xs font-semibold text-[#47564d]">Ulangi kata sandi baru<input name="password_confirmation" type="password" required minLength={8} autoComplete="new-password" className="mt-1.5 h-11 w-full rounded-xl border border-[#dfe7e1] px-3 text-sm font-normal outline-none focus:border-[#70a68c] focus:ring-2 focus:ring-[#e1f0e7]" /></label>
      <button disabled={pending} className="min-h-11 rounded-xl bg-[#0d5c45] px-4 text-xs font-bold text-white disabled:opacity-60">{pending ? "Menyimpan…" : "Perbarui kata sandi"}</button><Feedback state={state} />
    </form>
  );
}
