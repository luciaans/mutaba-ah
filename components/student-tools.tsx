"use client";

import { useMemo, useState, useTransition } from "react";
import ExcelJS from "exceljs";
import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { importStudentsAction } from "@/app/actions/records";
import { buildClassNameLookup, hasClassNameCandidate, isGradeSectionClassName, resolveClassId } from "@/lib/class-name";
import type { Database } from "@/types/database.types";

type ClassRow = Database["public"]["Tables"]["classes"]["Row"];
type StudentRow = Database["public"]["Tables"]["students"]["Row"];
type ImportRow = { class_name: string; roll_number: number; full_name: string };

function downloadWorkbook(buffer: ExcelJS.Buffer, filename: string) {
  const url = URL.createObjectURL(new Blob([buffer as ArrayBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url);
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"' && quoted && text[index + 1] === '"') { field += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { row.push(field); field = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(field); if (row.some((value) => value.trim())) rows.push(row); row = []; field = "";
    } else field += char;
  }
  row.push(field); if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

export function StudentExport({ students, classes }: { students: StudentRow[]; classes: ClassRow[] }) {
  function download() {
    const classNames = new Map(classes.map((item) => [item.id, item.class_name]));
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Santri");
    sheet.addRow(["KELAS", "NO", "NAMA SANTRI", "STATUS"]);
    students.forEach((student) => sheet.addRow([classNames.get(student.class_id) ?? "", student.roll_number, student.full_name, student.is_active ? "Aktif" : "Nonaktif"]));
    void workbook.xlsx.writeBuffer().then((buffer) => downloadWorkbook(buffer, "MUTABAAH_Daftar_Santri.xlsx"));
  }
  return <button onClick={download} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#dfe7e1] bg-white px-3.5 text-xs font-bold text-[#4b5a50] hover:bg-[#f5f8f5]"><Download size={15} />Ekspor Excel</button>;
}

export function StudentImport({ classes, students }: { classes: ClassRow[]; students: StudentRow[] }) {
  const [rows, setRows] = useState<(ImportRow & { error: string })[]>([]);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const classMap = useMemo(() => buildClassNameLookup(classes), [classes]);
  const existing = useMemo(() => ({
    names: new Set(students.map((item) => `${item.class_id}:${item.full_name.trim().toLocaleLowerCase("id-ID")}`)),
    rolls: new Set(students.map((item) => `${item.class_id}:${item.roll_number}`)),
  }), [students]);

  function downloadTemplate() {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Template Santri");
    worksheet.addRow(["KELAS", "NO", "NAMA SANTRI"]);
    void workbook.xlsx.writeBuffer().then((buffer) => downloadWorkbook(buffer, "Template_Import_Santri.xlsx"));
  }

  async function readFile(file: File) {
    setMessage("");
    if (file.size > 5 * 1024 * 1024) { setMessage("Ukuran file maksimal 5 MB."); setRows([]); return; }
    if (!/\.(xlsx|csv)$/i.test(file.name)) { setMessage("Pilih file .xlsx atau .csv."); setRows([]); return; }
    try {
      let rawRows: Record<string, unknown>[];
      let skippedRows = 0;
      if (file.name.toLocaleLowerCase("id-ID").endsWith(".csv")) {
        const parsedRows = parseCsv(await file.text());
        const headers = (parsedRows[0] ?? []).map((item) => item.trim());
        skippedRows = Math.max(0, parsedRows.length - 1001);
        rawRows = parsedRows.slice(1, 1001).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
      } else {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(await file.arrayBuffer());
        const worksheet = workbook.worksheets[0];
        if (!worksheet) throw new Error("Lembar kerja tidak ditemukan.");
        const headerValues = worksheet.getRow(1).values as unknown[];
        const headers = headerValues.slice(1).map((value: unknown) => String(value ?? "").trim());
        rawRows = [];
        for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
          const values = worksheet.getRow(rowNumber).values as unknown[];
          if (!values.some((value: unknown) => String(value ?? "").trim())) continue;
          if (rawRows.length >= 1000) { skippedRows += 1; continue; }
          rawRows.push(Object.fromEntries(headers.map((header: string, index: number) => [header, values[index + 1] ?? ""])));
        }
      }
      const seenNames = new Set<string>();
      const seenRolls = new Set<string>();
      const next = rawRows.slice(0, 1000).map((raw, index) => {
        const normalized = new Map(Object.entries(raw).map(([key, value]) => [key.trim().toLocaleLowerCase("id-ID"), String(value ?? "").trim()]));
        const row: ImportRow = {
          class_name: normalized.get("kelas") ?? "",
          roll_number: Number(normalized.get("no") ?? ""),
          full_name: normalized.get("nama santri") ?? normalized.get("nama") ?? "",
        };
        const reasons: string[] = [];
        const classId = resolveClassId(classMap, row.class_name);
        const canCreateClass = !classId && !hasClassNameCandidate(classMap, row.class_name) && isGradeSectionClassName(row.class_name);
        const classKey = classId ?? (canCreateClass ? `new:${row.class_name.normalize("NFKC").toLocaleLowerCase("id-ID").replace(/[\s./_-]+/g, "")}` : null);
        if (!row.class_name || (!classId && !canCreateClass)) reasons.push("Kelas belum cocok. Masukkan kelas yang sudah dibuat atau format tingkat dan rombel, misalnya 8 A.");
        if (row.class_name.length > 100) reasons.push("Nama kelas maksimal 100 karakter.");
        if (!row.full_name) reasons.push("Nama kosong.");
        if (!Number.isInteger(row.roll_number) || row.roll_number < 1) reasons.push("Nomor urut tidak valid.");
        if (classKey && row.full_name) {
          const nameKey = `${classKey}:${row.full_name.toLocaleLowerCase("id-ID")}`;
          if (existing.names.has(nameKey) || seenNames.has(nameKey)) reasons.push("Nama duplikat dalam kelas.");
          seenNames.add(nameKey);
        }
        if (classKey && Number.isInteger(row.roll_number) && row.roll_number > 0) {
          const rollKey = `${classKey}:${row.roll_number}`;
          if (existing.rolls.has(rollKey) || seenRolls.has(rollKey)) reasons.push("Nomor urut sudah dipakai.");
          seenRolls.add(rollKey);
        }
        return { ...row, error: reasons.join(" ") || (canCreateClass ? `Baris ${index + 2} siap diimpor. Kelas baru “${row.class_name}” akan dibuat.` : `Baris ${index + 2} siap diimpor.`) };
      });
      setRows(next);
      if (skippedRows > 0) setMessage(`${skippedRows} baris dilewati karena batas impor adalah 1.000 baris data.`);
      if (next.length === 0) setMessage("File belum berisi baris data.");
    } catch {
      setMessage("File tidak dapat dibaca. Gunakan template .xlsx atau file .csv.");
      setRows([]);
    }
  }

  function commit() {
    const validRows = rows.map((row, index) => ({ row, index })).filter(({ row }) => row.error.startsWith("Baris "));
    if (!validRows.length) return;
    startTransition(async () => {
      setMessage("Menyimpan data santri...");
      const successfulRows = new Set<number>();
      const failedRows = new Map<number, string>();
      let inserted = 0;
      let processed = 0;

      try {
        for (let offset = 0; offset < validRows.length; offset += 100) {
          const batch = validRows.slice(offset, offset + 100);
          setMessage(`Menyimpan data santri (${offset + batch.length}/${validRows.length})...`);
          const result = await importStudentsAction(batch.map(({ row }) => ({ class_name: row.class_name, roll_number: row.roll_number, full_name: row.full_name })));
          inserted += result.inserted;
          processed += batch.length;

          const globalFailure = result.failed.find((item) => item.row === 0);
          if (globalFailure) {
            batch.forEach(({ index }) => failedRows.set(index, globalFailure.reason));
            continue;
          }

          const batchFailures = new Map(result.failed.map((item) => [item.row - 2, item.reason]));
          batch.forEach(({ index }, batchIndex) => {
            const reason = batchFailures.get(batchIndex);
            if (reason) failedRows.set(index, reason);
            else if (result.inserted > 0) successfulRows.add(index);
            else failedRows.set(index, "Data belum tersimpan. Periksa koneksi lalu coba lagi.");
          });
        }
      } catch {
        const remaining = validRows.length - processed;
        setMessage(`${inserted} santri berhasil disimpan. Koneksi terputus; ${remaining} baris sisanya belum diproses. Periksa daftar sebelum mencoba lagi.`);
      }

      setRows((current) => current.flatMap((row, index) => {
        if (successfulRows.has(index)) return [];
        const reason = failedRows.get(index);
        return reason ? [{ ...row, error: reason }] : [row];
      }));

      if (processed === validRows.length) {
        const failureCount = failedRows.size;
        setMessage(`${inserted} santri berhasil diimpor${failureCount ? `; ${failureCount} baris gagal.` : "."}`);
      }
    });
  }

  const validCount = rows.filter((row) => row.error.startsWith("Baris ")).length;
  return <section className="rounded-2xl border border-[#e7ece8] bg-white p-5 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eaf4ef] text-[#0d5c45]"><FileSpreadsheet size={18} /></div><div><h2 className="text-sm font-bold text-[#25342b]">Impor dan ekspor</h2><p className="mt-1 text-xs text-[#849087]">Pratinjau dan validasi sebelum menyimpan.</p></div></div><div className="flex flex-wrap gap-2"><button onClick={downloadTemplate} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#dfe7e1] px-3 text-xs font-semibold"><Download size={14} />Template</button><label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl bg-[#0d5c45] px-3 text-xs font-bold text-white"><Upload size={14} />Pilih file<input type="file" accept=".xlsx,.csv" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) void readFile(file); event.currentTarget.value = ""; }} /></label></div></div>
    {message && <p role="status" className="mt-4 rounded-lg bg-[#edf6f0] px-3 py-2.5 text-xs text-[#286345]">{message}</p>}
    {rows.length > 0 && <><div className="mt-4 max-h-72 space-y-2 overflow-auto md:hidden">{rows.map((row, index) => <article key={`mobile-${index}-${row.full_name}`} className="rounded-xl border border-[#edf1ed] p-3 text-xs"><div className="flex items-center justify-between gap-2"><span className="font-semibold text-[#748078]">Baris {index + 2}</span><span className={row.error.startsWith("Baris ") ? "font-semibold text-[#34704f]" : "font-semibold text-[#a64336]"}>{row.error.startsWith("Baris ") ? "Siap" : "Perlu diperbaiki"}</span></div><p className="mt-2 font-bold text-[#34443a]">{row.full_name || "Nama kosong"}</p><p className="mt-1 text-[10px] text-[#849087]">{row.class_name || "Kelas kosong"} · No. {row.roll_number || "—"}</p><p className={`mt-2 text-[10px] leading-relaxed ${row.error.startsWith("Baris ") ? "text-[#34704f]" : "text-[#a64336]"}`}>{row.error}</p></article>)}</div><div className="mt-4 hidden max-h-72 overflow-auto rounded-xl border border-[#e7ece8] md:block"><table className="w-full text-left text-xs"><thead className="sticky top-0 bg-[#f7f9f7] text-[#647168]"><tr><th className="p-3">Baris</th><th className="p-3">Kelas</th><th className="p-3">No.</th><th className="p-3">Nama</th><th className="p-3">Validasi</th></tr></thead><tbody>{rows.map((row, index) => <tr key={`${index}-${row.full_name}`} className="border-t border-[#edf1ed]"><td className="p-3">{index + 2}</td><td className="p-3">{row.class_name || "—"}</td><td className="p-3">{row.roll_number || "—"}</td><td className="p-3">{row.full_name || "—"}</td><td className={`p-3 ${row.error.startsWith("Baris ") ? "text-[#34704f]" : "text-[#a64336]"}`}>{row.error}</td></tr>)}</tbody></table></div><div className="mt-3 flex items-center justify-between gap-3"><p className="text-xs text-[#718078]">{validCount} baris siap disimpan</p><button onClick={commit} disabled={!validCount || isPending} className="min-h-11 rounded-xl bg-[#0d5c45] px-4 text-xs font-bold text-white disabled:opacity-50">{isPending ? "Menyimpan…" : "Simpan data valid"}</button></div></>}
  </section>;
}
