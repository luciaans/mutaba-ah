"use client";

import { useState } from "react";
import { ImagePlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database.types";

type Student = Database["public"]["Tables"]["students"]["Row"];

function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      const scale = Math.min(1, 1200 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) { URL.revokeObjectURL(objectUrl); reject(new Error("Foto tidak dapat diproses.")); return; }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(objectUrl);
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Foto tidak dapat diproses.")), "image/webp", 0.82);
    };
    image.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error("Format foto tidak dapat dibaca.")); };
    image.src = objectUrl;
  });
}

export function StudentPhotoUpload({ student }: { student: Student }) {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [pending, setPending] = useState(false);
  async function upload(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/") || !["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 10 * 1024 * 1024) {
      setStatus("Pilih foto JPEG, PNG, atau WebP berukuran maksimal 10 MB."); return;
    }
    setPending(true); setStatus("");
    try {
      const blob = await compressImage(file);
      if (blob.size > 2 * 1024 * 1024) throw new Error("Hasil kompresi masih lebih dari 2 MB.");
      const client = createClient();
      const path = `${student.class_id}/${student.id}/${crypto.randomUUID()}.webp`;
      const { error: uploadError } = await client.storage.from("student-photos").upload(path, blob, { contentType: "image/webp", upsert: false });
      if (uploadError) throw new Error("Foto gagal diunggah. Periksa koneksi dan akses kelas.");
      const { error: updateError } = await client.from("students").update({ photo_url: path }).eq("id", student.id);
      if (updateError) {
        await client.storage.from("student-photos").remove([path]);
        throw new Error("Foto terunggah, tetapi profil belum dapat diperbarui.");
      }
      if (student.photo_url) await client.storage.from("student-photos").remove([student.photo_url]);
      setStatus("Foto berhasil diperbarui."); router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Foto belum dapat disimpan.");
    } finally { setPending(false); }
  }
  return <div className="mb-4 rounded-xl bg-[#f7f9f7] p-3"><label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-[#dfe7e1] bg-white px-3 text-xs font-semibold text-[#4c5b51]"><ImagePlus size={15} />{pending ? "Mengompres foto…" : "Unggah foto santri"}<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={pending} onChange={(event) => { void upload(event.target.files?.[0]); event.currentTarget.value = ""; }} /></label><p className="mt-2 text-[10px] text-[#849087]">Foto dikompres di perangkat sebelum diunggah ke penyimpanan privat.</p>{status && <p role="status" className="mt-2 text-[11px] text-[#536158]">{status}</p>}</div>;
}
