"use client";

import { useState } from "react";
import { Eye, EyeOff, LockKeyhole, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginValues } from "@/lib/schemas";
import { Button } from "@/components/ui/button";

export function LoginForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [pending, setPending] = useState(false);
  const form = useForm<LoginValues>({ resolver: zodResolver(loginSchema), defaultValues: { username: "", password: "" } });

  async function handleSubmit(values: LoginValues) {
    setErrorMessage("");
    setPending(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      });
      const result: { error?: string } = await response.json();
      if (!response.ok) { setErrorMessage(result.error ?? "Username atau password salah."); return; }
      router.replace("/");
      router.refresh();
    } catch {
      setErrorMessage("Koneksi bermasalah. Periksa jaringan, lalu coba kembali.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
      <div>
        <label htmlFor="username" className="mb-1.5 block text-xs font-semibold text-[#47564d]">Username</label>
        <div className="flex h-12 items-center gap-3 rounded-xl border border-[#dfe7e1] px-3.5 focus-within:border-[#70a68c] focus-within:ring-2 focus-within:ring-[#e1f0e7]">
          <UserRound size={17} className="text-[#849188]" aria-hidden="true" />
          <input id="username" autoComplete="username" {...form.register("username")} aria-invalid={Boolean(form.formState.errors.username)} aria-describedby={form.formState.errors.username ? "username-error" : undefined} className="h-full min-w-0 flex-1 bg-transparent text-sm text-[#24332a] outline-none placeholder:text-[#a2aca5]" placeholder="Masukkan username" />
        </div>
        {form.formState.errors.username && <p id="username-error" className="mt-1 text-[11px] text-[#a64336]">Username minimal 3 karakter dan hanya boleh memakai huruf kecil, angka, titik, garis bawah, atau tanda hubung.</p>}
      </div>
      <div>
        <label htmlFor="password" className="mb-1.5 block text-xs font-semibold text-[#47564d]">Kata sandi</label>
        <div className="flex h-12 items-center gap-3 rounded-xl border border-[#dfe7e1] px-3.5 focus-within:border-[#70a68c] focus-within:ring-2 focus-within:ring-[#e1f0e7]">
          <LockKeyhole size={17} className="text-[#849188]" aria-hidden="true" />
          <input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" {...form.register("password")} aria-invalid={Boolean(form.formState.errors.password)} className="h-full min-w-0 flex-1 bg-transparent text-sm text-[#24332a] outline-none placeholder:text-[#a2aca5]" placeholder="Masukkan kata sandi" />
          <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"} className="flex h-10 w-10 items-center justify-center rounded-lg text-[#849188] hover:bg-[#f3f6f3] focus-visible:outline-[#0d5c45]">
            {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </div>
      </div>
      {errorMessage && <p role="alert" className="rounded-lg bg-[#fff1ef] px-3 py-2.5 text-xs leading-relaxed text-[#a64336]">{errorMessage}</p>}
      <Button type="submit" disabled={pending} size="lg" className="mt-2 w-full">{pending ? "Memeriksa akun…" : "Masuk"}</Button>
    </form>
  );
}
