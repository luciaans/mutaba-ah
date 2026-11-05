"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }
  return <button type="button" onClick={logout} aria-label="Keluar" className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#e7ece8] bg-white text-[#718078] hover:bg-[#f4f7f4]"><LogOut size={16} /></button>;
}
