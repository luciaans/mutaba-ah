"use client";

import { useEffect, useRef } from "react";

export function ConfirmationDialog({
  open, title, description, names, confirmLabel, pending, onConfirm, onCancel,
}: {
  open: boolean; title: string; description: string; names: string[]; confirmLabel: string;
  pending?: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (open) cancelRef.current?.focus(); }, [open]);
  if (!open) return null;
  return <div className="fixed inset-0 z-[70] flex items-end justify-center bg-[#14231b]/45 p-0 sm:items-center sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
    <section role="alertdialog" aria-modal="true" aria-labelledby="dialog-title" aria-describedby="dialog-description" className="w-full max-w-md rounded-t-[24px] bg-white p-5 pb-[calc(20px+env(safe-area-inset-bottom))] shadow-2xl sm:rounded-2xl sm:p-6">
      <h2 id="dialog-title" className="text-base font-bold text-[#26362c]">{title}</h2>
      <p id="dialog-description" className="mt-2 text-xs leading-relaxed text-[#718078]">{description}</p>
      <div className="mt-4 max-h-44 overflow-y-auto rounded-xl bg-[#fff6f4] p-3"><p className="mb-2 text-xs font-bold text-[#a34c40]">{names.length} santri ditandai tidak melaksanakan</p>{names.length ? <ul className="space-y-1.5 text-xs text-[#75423b]">{names.map((name) => <li key={name}>{name}</li>)}</ul> : <p className="text-xs text-[#718078]">Tidak ada santri ditandai X.</p>}</div>
      <div className="mt-5 grid grid-cols-2 gap-2"><button ref={cancelRef} type="button" onClick={onCancel} disabled={pending} className="min-h-12 rounded-xl border border-[#dfe7e1] text-xs font-bold text-[#536158] disabled:opacity-60">Periksa kembali</button><button type="button" onClick={onConfirm} disabled={pending} className="min-h-12 rounded-xl bg-[#0d5c45] text-xs font-bold text-white disabled:opacity-60">{pending ? "Menyimpan…" : confirmLabel}</button></div>
    </section>
  </div>;
}
