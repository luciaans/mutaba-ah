"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Download, WifiOff, X } from "lucide-react";

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
const noopSubscribe = () => () => undefined;
const isIosDevice = () => typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent) && !("MSStream" in window);
const isStandalone = () => typeof window !== "undefined" && window.matchMedia("(display-mode: standalone)").matches;
const subscribeStandalone = (callback: () => void) => {
  const media = window.matchMedia("(display-mode: standalone)");
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
};

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
  }, []);
  return null;
}

export function NetworkStatusBanner() {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const refresh = () => setOffline(!navigator.onLine);
    refresh(); window.addEventListener("online", refresh); window.addEventListener("offline", refresh);
    return () => { window.removeEventListener("online", refresh); window.removeEventListener("offline", refresh); };
  }, []);
  if (!offline) return null;
  return <div role="status" className="fixed inset-x-0 top-0 z-[80] flex min-h-11 items-center justify-center gap-2 bg-[#7c4a18] px-4 py-2 text-center text-xs font-bold text-white shadow-md"><WifiOff size={15} />Anda sedang offline. Data santri tidak tersedia dan absensi belum dapat disimpan.</div>;
}

export function InstallPrompt() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [installed, setInstalled] = useState(false);
  const ios = useSyncExternalStore(noopSubscribe, isIosDevice, () => false);
  const standalone = useSyncExternalStore(subscribeStandalone, isStandalone, () => false);
  useEffect(() => {
    const beforeInstall = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPromptEvent); };
    const installedEvent = () => { setInstalled(true); setPrompt(null); };
    window.addEventListener("beforeinstallprompt", beforeInstall);
    window.addEventListener("appinstalled", installedEvent);
    return () => { window.removeEventListener("beforeinstallprompt", beforeInstall); window.removeEventListener("appinstalled", installedEvent); };
  }, []);
  if (installed || standalone || (!prompt && !ios)) return null;
  async function install() {
    if (prompt) { await prompt.prompt(); await prompt.userChoice; setPrompt(null); }
    else setShowGuide(true);
  }
  return <>
    <button type="button" onClick={() => void install()} className="inline-flex min-h-12 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/30 bg-white/10 px-2 text-[11px] font-bold text-white hover:bg-white/20 sm:flex-none sm:justify-start sm:gap-2 sm:px-3.5 sm:text-xs"><Download size={15} />Pasang Aplikasi</button>
    {showGuide && <div className="fixed inset-0 z-[90] flex items-end justify-center bg-[#14231b]/45 p-4 sm:items-center"><section role="dialog" aria-modal="true" aria-labelledby="install-title" className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"><div className="flex items-start justify-between gap-3"><div><h2 id="install-title" className="text-sm font-bold text-[#25342b]">Pasang di iPhone atau iPad</h2><p className="mt-2 text-xs leading-relaxed text-[#68756d]">Buka halaman ini di Safari, lalu pilih <strong>Bagikan</strong> dan <strong>Tambah ke Layar Utama</strong>.</p></div><button onClick={() => setShowGuide(false)} aria-label="Tutup panduan" className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-[#f2f5f2]"><X size={16} /></button></div><button onClick={() => setShowGuide(false)} className="mt-5 min-h-11 w-full rounded-xl bg-[#0d5c45] text-xs font-bold text-white">Mengerti</button></section></div>}
  </>;
}
