import Link from "next/link";
import { FileSearch, ShieldUser, UsersRound } from "lucide-react";
import { BottomNav, Sidebar } from "@/components/app-navigation";
import { ChangePasswordForm } from "@/components/account-forms";
import { LogoutButton } from "@/components/logout-button";
import { requireProfile } from "@/lib/auth";

export const metadata = { title: "Akun Saya" };

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const profile = await requireProfile();
  return <div className="app-shell"><Sidebar role={profile.role} /><main className="main-content min-h-dvh px-5 pb-12 pt-5 sm:px-8 sm:pt-7 lg:px-11"><header className="mx-auto flex max-w-[1000px] items-center justify-between"><div><Link href="/" className="text-xs font-semibold text-[#75827b] hover:text-[#0d5c45]">← Beranda</Link><h1 className="mt-2 text-xl font-bold text-[#1d2b24]">Akun saya</h1></div><LogoutButton /></header><div className="mx-auto mt-7 max-w-[1000px] space-y-5"><section className="rounded-2xl border border-[#e7ece8] bg-white p-5 sm:p-7"><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#9a8757]">Profil</p><h2 className="mt-2 text-lg font-bold text-[#25342b]">{profile.full_name}</h2><p className="mt-1 text-sm text-[#849087]">@{profile.username} <span className="mx-1">·</span><span className="capitalize">{profile.role === "ustaz" ? "Pembimbing" : profile.role}</span></p></section><section className="rounded-2xl border border-[#e7ece8] bg-white p-5 sm:p-7"><h2 className="text-sm font-bold text-[#25342b]">Ganti kata sandi</h2><p className="mt-1 mb-5 text-xs text-[#849087]">Gunakan minimal 8 karakter untuk kata sandi baru.</p><ChangePasswordForm /></section><section className="rounded-2xl border border-[#e7ece8] bg-white p-5 sm:p-7"><h2 className="text-sm font-bold text-[#25342b]">Menu pengelolaan</h2><div className="mt-3 grid gap-2 sm:grid-cols-2">{[{ href: "/kelas", label: "Kelas dan penugasan", icon: UsersRound }, { href: "/riwayat", label: "Riwayat absensi", icon: FileSearch }, ...(profile.role === "admin" ? [{ href: "/pengguna", label: "Akun pembimbing", icon: ShieldUser }, { href: "/audit", label: "Audit log", icon: FileSearch }] : [])].map(({ href, label, icon: Icon }) => <Link key={href} href={href} className="flex min-h-12 items-center gap-3 rounded-xl border border-[#edf1ed] px-3 text-xs font-semibold text-[#536158] hover:bg-[#f7f9f7]"><Icon size={16} className="text-[#0d5c45]" />{label}</Link>)}</div></section></div></main><BottomNav role={profile.role} /></div>;
}
