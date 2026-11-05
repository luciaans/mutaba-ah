import Image from "next/image";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <Image src="/masjid-mark.svg" alt="" width={42} height={42} priority />
      {!compact && (
        <div className="min-w-0">
          <div className="text-[15px] font-extrabold tracking-[0.12em] text-[#153d30]">MUTABA’AH</div>
          <div className="mt-0.5 text-[10px] font-medium tracking-[0.025em] text-[#78847d]">Monitoring Ibadah Santri</div>
        </div>
      )}
    </div>
  );
}
