export default function Loading() {
  return <main aria-label="Memuat aplikasi" className="min-h-dvh bg-[#f6f8f6] px-5 py-7 sm:px-8"><div className="mx-auto max-w-[1120px] animate-pulse"><div className="h-8 w-48 rounded-lg bg-[#e5ebe6]" /><div className="mt-7 h-48 rounded-[26px] bg-[#dfe9e2]" /><div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <div key={index} className="h-28 rounded-2xl bg-white" />)}</div><div className="mt-6 h-56 rounded-2xl bg-white" /></div></main>;
}
