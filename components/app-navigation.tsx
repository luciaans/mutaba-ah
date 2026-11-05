"use client";

import { useState } from "react";
import Link from "next/link";
import { Activity, BookOpenCheck, ChartNoAxesColumnIncreasing, ClipboardList, FileSearch, House, MoreHorizontal, ShieldUser, UserRound, UsersRound, X } from "lucide-react";
import { Brand } from "@/components/brand";
import { usePathname } from "next/navigation";

const items = [
  { label: "Beranda", href: "/", icon: House },
  { label: "Absensi", href: "/absensi", icon: BookOpenCheck },
  { label: "Santri", href: "/santri", icon: UsersRound },
  { label: "Rekap", href: "/rekap", icon: ChartNoAxesColumnIncreasing },
];

export function Sidebar({ role }: { role: "admin" | "ustaz" }) {
  const pathname = usePathname();
  return (
    <aside className="sidebar fixed inset-y-0 left-0 z-20 flex flex-col border-r border-[#e7ece8] bg-white px-5 py-7">
      <div className="mb-10 px-1"><Brand /></div>
      <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[#9aa59e]">Menu utama</p>
      <nav aria-label="Navigasi utama" className="space-y-1">
        {items.map(({ label, href, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return <Link key={label} href={href} aria-current={active ? "page" : undefined} className="nav-link flex min-h-12 items-center gap-3 rounded-xl px-3 text-[13px] font-semibold text-[#68756e]">
            <Icon size={18} strokeWidth={1.8} aria-hidden="true" />{label}
          </Link>;
        })}
      </nav>
      <Link href="/riwayat" className="nav-link mt-1 flex min-h-12 items-center gap-3 rounded-xl px-3 text-[13px] font-semibold text-[#68756e]"><ClipboardList size={18} strokeWidth={1.8} aria-hidden="true" />Riwayat absensi</Link>
      {role === "admin" && <div className="mt-7"><p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[#9aa59e]">Pengelolaan</p><Link href="/pengguna" className="nav-link flex min-h-12 items-center gap-3 rounded-xl px-3 text-[13px] font-semibold text-[#68756e]"><ShieldUser size={18} strokeWidth={1.8} aria-hidden="true" />Akun pembimbing</Link><Link href="/audit" className="nav-link flex min-h-12 items-center gap-3 rounded-xl px-3 text-[13px] font-semibold text-[#68756e]"><FileSearch size={18} strokeWidth={1.8} aria-hidden="true" />Audit log</Link></div>}
      <Link href="/akun" className="nav-link mt-auto flex min-h-12 items-center gap-3 rounded-xl px-3 text-[13px] font-semibold text-[#68756e]"><UserRound size={18} strokeWidth={1.8} aria-hidden="true" />Akun saya</Link>
      <div className="mt-4 rounded-2xl border border-[#e8eee9] bg-[#f8faf8] p-4">
        <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-[#eaf4ef] text-[#0d5c45]"><Activity size={16} /></div>
        <p className="text-xs font-bold text-[#33453b]">Kebiasaan baik, setiap hari</p>
        <p className="mt-1 text-[11px] leading-relaxed text-[#7b877f]">Pantau ibadah dengan tertib dan penuh perhatian.</p>
      </div>
    </aside>
  );
}

export function BottomNav({ role }: { role: "admin" | "ustaz" }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreItems = [
    { label: "Riwayat absensi", href: "/riwayat", icon: ClipboardList },
    { label: "Kelas dan penugasan", href: "/kelas", icon: UsersRound },
    { label: "Akun saya", href: "/akun", icon: UserRound },
    ...(role === "admin" ? [
      { label: "Akun pembimbing", href: "/pengguna", icon: ShieldUser },
      { label: "Audit log", href: "/audit", icon: FileSearch },
    ] : []),
  ];
  const moreActive = moreItems.some((item) => pathname.startsWith(item.href));
  return (
    <nav aria-label="Navigasi bawah" className="mobile-nav fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-[#e7ece8] bg-white/95 px-2 pt-2 backdrop-blur">
      {moreOpen && <><button type="button" aria-label="Tutup menu lainnya" className="fixed inset-0 z-30 bg-[#14231b]/20" onClick={() => setMoreOpen(false)} /><div className="absolute bottom-[calc(100%+0.75rem)] left-3 right-3 z-40 mx-auto max-w-lg rounded-2xl border border-[#e4ebe5] bg-white p-3 shadow-[0_12px_36px_rgba(25,48,35,0.18)]"><div className="mb-2 flex items-center justify-between px-2"><p className="text-xs font-bold text-[#34443a]">Menu lainnya</p><button type="button" onClick={() => setMoreOpen(false)} aria-label="Tutup" className="flex h-8 w-8 items-center justify-center rounded-lg text-[#7c8980] hover:bg-[#f3f6f3]"><X size={16} /></button></div><div className="grid grid-cols-2 gap-2">{moreItems.map(({ label, href, icon: Icon }) => { const active = pathname.startsWith(href); return <Link key={href} href={href} onClick={() => setMoreOpen(false)} aria-current={active ? "page" : undefined} className={`flex min-h-12 items-center gap-2 rounded-xl px-3 text-left text-xs font-semibold ${active ? "bg-[#eaf4ef] text-[#0d5c45]" : "text-[#536158] hover:bg-[#f5f8f5]"}`}><Icon size={16} aria-hidden="true" />{label}</Link>; })}</div></div></>}
      {items.map(({ label, href, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return <Link key={label} href={href} aria-current={active ? "page" : undefined} className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-semibold ${active ? "text-[#0d5c45]" : "text-[#78847d]"}`}>
          <Icon size={20} strokeWidth={1.9} aria-hidden="true" />{label}
        </Link>;
      })}
      <button type="button" aria-expanded={moreOpen} aria-label="Menu lainnya" onClick={() => setMoreOpen((open) => !open)} className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-semibold ${moreActive || moreOpen ? "text-[#0d5c45]" : "text-[#78847d]"}`}>
        {moreOpen ? <X size={20} strokeWidth={1.9} aria-hidden="true" /> : <MoreHorizontal size={20} strokeWidth={1.9} aria-hidden="true" />}Lainnya
      </button>
    </nav>
  );
}
