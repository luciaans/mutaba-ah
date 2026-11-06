import { LoginForm } from "@/components/login-form";
import { Brand } from "@/components/brand";

export const metadata = { title: "Masuk" };

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#f6f8f6] px-5 py-10">
      <div className="w-full max-w-[420px]">
        <div className="mb-8 flex justify-center"><Brand /></div>
        <section className="rounded-[24px] border border-[#e6ece7] bg-white p-6 shadow-[0_16px_48px_rgba(26,57,40,0.07)] sm:p-8">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#9a8757]">Selamat datang</p>
          <h1 className="mt-2 text-[24px] font-bold tracking-tight text-[#1e2d24]">Masuk ke MUTABA’AH</h1>
          <p className="mt-2 text-sm leading-relaxed text-[#7c8880]">Gunakan akun yang diberikan oleh administrator pondok.</p>
          <div className="mt-7"><LoginForm /></div>
        </section>
        <p className="mt-5 text-center text-[11px] text-[#909b94]">© 2026 MUTABA’AH · Created by <a href="https://github.com/luciaans" target="_blank" rel="noreferrer" className="font-semibold text-[#0d5c45] hover:underline">Lucians</a></p>
      </div>
    </main>
  );
}
