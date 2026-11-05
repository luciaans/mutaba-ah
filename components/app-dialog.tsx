"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";

type DialogOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "success" | "info";
};

type DialogState = DialogOptions & { kind: "confirm" | "alert" };

export function useAppDialog() {
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const resolver = useRef<((confirmed: boolean) => void) | null>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  const close = useCallback((confirmed: boolean) => {
    setDialog(null);
    resolver.current?.(confirmed);
    resolver.current = null;
  }, []);

  const show = useCallback((options: DialogState) => new Promise<boolean>((resolve) => {
    resolver.current = resolve;
    setDialog(options);
  }), []);

  const confirm = useCallback((options: DialogOptions) => show({ ...options, kind: "confirm" }), [show]);
  const alert = useCallback(async (options: DialogOptions) => {
    await show({ ...options, kind: "alert" });
  }, [show]);

  useEffect(() => {
    if (!dialog) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && dialog.kind === "confirm") close(false);
      if (event.key === "Escape" && dialog.kind === "alert") close(true);
    };
    window.addEventListener("keydown", handleKeyDown);
    confirmRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [dialog, close]);

  function Dialog() {
    if (!dialog || typeof document === "undefined") return null;
    const tone = dialog.tone ?? "info";
    const Icon = tone === "danger" ? AlertTriangle : tone === "success" ? CheckCircle2 : Info;
    const iconStyle = tone === "danger" ? "bg-[#fff0ed] text-[#b5483d]" : tone === "success" ? "bg-[#eaf5ed] text-[#34704f]" : "bg-[#edf4ef] text-[#0d5c45]";
    const actionStyle = tone === "danger" && dialog.kind === "confirm" ? "bg-[#a74338] hover:bg-[#91372e]" : "bg-[#0d5c45] hover:bg-[#0a4d3a]";
    return createPortal(<div className="fixed inset-0 z-[90] flex items-end justify-center bg-[#14231b]/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget) close(dialog.kind === "alert"); }}>
      <section role={dialog.kind === "confirm" ? "alertdialog" : "dialog"} aria-modal="true" aria-labelledby="app-dialog-title" aria-describedby="app-dialog-message" className="w-full max-w-md overflow-hidden rounded-t-[26px] border border-white/70 bg-white p-5 pb-[calc(20px+env(safe-area-inset-bottom))] shadow-[0_24px_80px_rgba(12,33,22,0.24)] sm:rounded-[26px] sm:p-6">
        <div className="flex items-start gap-3.5">
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${iconStyle}`}><Icon size={20} /></span>
          <div className="min-w-0 flex-1 pt-0.5"><h2 id="app-dialog-title" className="text-base font-bold leading-snug text-[#26362c]">{dialog.title}</h2><p id="app-dialog-message" className="mt-2 whitespace-pre-line text-[13px] leading-relaxed text-[#6f7d74]">{dialog.message}</p></div>
          <button type="button" aria-label="Tutup dialog" onClick={() => close(dialog.kind === "alert")} className="-mr-1 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[#8a958e] hover:bg-[#f3f6f3] hover:text-[#35463b]"><X size={17} /></button>
        </div>
        <div className={`mt-6 grid gap-2 ${dialog.kind === "confirm" ? "grid-cols-2" : "grid-cols-1"}`}>
          {dialog.kind === "confirm" && <button type="button" onClick={() => close(false)} className="min-h-12 rounded-xl border border-[#dfe7e1] bg-white px-4 text-sm font-semibold text-[#536158] transition hover:bg-[#f6f8f6]">{dialog.cancelLabel ?? "Batal"}</button>}
          <button ref={confirmRef} type="button" onClick={() => close(true)} className={`min-h-12 rounded-xl px-4 text-sm font-bold text-white shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#65a88a] ${actionStyle}`}>{dialog.kind === "confirm" ? dialog.confirmLabel ?? "Ya, lanjutkan" : dialog.confirmLabel ?? "Mengerti"}</button>
        </div>
      </section>
    </div>, document.body);
  }

  return { confirm, alert, Dialog };
}
