import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { monthRangeInAppTimeZone, todayInAppTimeZone, weekRangeInAppTimeZone } from "@/lib/time";
import type { Database } from "@/types/database.types";

type StudentRow = Database["public"]["Tables"]["students"]["Row"];
type AttendanceRow = Database["public"]["Tables"]["prayer_attendance"]["Row"];
type ReportRow = Database["public"]["Functions"]["attendance_student_summary"]["Returns"][number];
type PrayerName = "subuh" | "zuhur" | "asar" | "magrib" | "isya";
const PRAYERS: { id: PrayerName; label: string }[] = [{ id: "subuh", label: "Subuh" }, { id: "zuhur", label: "Zuhur" }, { id: "asar", label: "Asar" }, { id: "magrib", label: "Magrib" }, { id: "isya", label: "Isya" }];
const GRAY_FILL = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFE8ECE9" } };

function filePart(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toUpperCase(); }
function dateColumn(date: string) { return Number(date.slice(-2)); }
function monthCaption(date: string) { return new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Pontianak", month: "long", year: "numeric" }).format(new Date(`${date}T12:00:00+07:00`)); }
function dateValues(start: string, end: string) {
  const result: string[] = [];
  const from = new Date(`${start}T00:00:00Z`);
  const to = new Date(`${end}T00:00:00Z`);
  for (const cursor = from; cursor <= to; cursor.setUTCDate(cursor.getUTCDate() + 1)) result.push(cursor.toISOString().slice(0, 10));
  return result;
}
function attendanceIndex(rows: AttendanceRow[]) { return new Map(rows.map((row) => [`${row.student_id}:${row.attendance_date}:${row.prayer_name}`, row.is_missed])); }
function monthlyPercent(done: number, saved: number) { return saved ? `${(done / saved * 100).toFixed(1).replace(".", ",")}%` : "—"; }

function reportHeaders(pondok: string, className: string, academicYear: string, month: string, sheet: ExcelJS.Worksheet, dateCount: number) {
  const last = dateCount + 4;
  const lines = [pondok, "MUTABA’AH", "DAFTAR HADIR SALAT SANTRI", `KELAS ( ${className} )`, `TAHUN PELAJARAN ${academicYear}`, `BULAN : ${month}`];
  lines.forEach((line, index) => {
    sheet.mergeCells(index + 1, 1, index + 1, last);
    const cell = sheet.getCell(index + 1, 1);
    cell.value = line;
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.font = { name: "Arial", size: index === 0 ? 10 : index === 2 ? 12 : 9, bold: index === 0 || index === 2 };
  });
  const headerRow = sheet.addRow(["NO", "NAMA SANTRI", ...Array.from({ length: dateCount }, (_, index) => index + 1), "JUMLAH X", "PERSENTASE"]);
  headerRow.height = 27;
  headerRow.eachCell((cell) => { cell.font = { name: "Arial", size: 8, bold: true }; cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true }; cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE9F1EB" } }; cell.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }; });
  sheet.getColumn(1).width = 5;
  sheet.getColumn(2).width = 31;
  for (let column = 3; column <= dateCount + 2; column += 1) sheet.getColumn(column).width = 4.4;
  sheet.getColumn(dateCount + 3).width = 11;
  sheet.getColumn(dateCount + 4).width = 12;
  sheet.views = [{ state: "frozen", xSplit: 2, ySplit: 7 }];
  sheet.pageSetup = { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.2, right: 0.2, top: 0.35, bottom: 0.35, header: 0.15, footer: 0.15 }, printTitlesRow: "1:7", horizontalDpi: 300, verticalDpi: 300 };
  return 7;
}

function applyMonthlyRows(sheet: ExcelJS.Worksheet, roster: StudentRow[], days: string[], prayer: PrayerName | "combined", index: Map<string, boolean>) {
  for (const student of roster) {
    let xCount = 0;
    let successfulDays = 0;
    let recordedDays = 0;
    const dayCells = days.map((date) => {
      if (prayer === "combined") {
        const daily = PRAYERS.map(({ id }) => index.get(`${student.id}:${date}:${id}`));
        if (daily.some((value) => value === true)) { xCount += 1; recordedDays += 1; return { value: "X", fill: null }; }
        if (daily.every((value) => value === false)) { successfulDays += 1; recordedDays += 1; return { value: "", fill: null }; }
        return { value: "", fill: GRAY_FILL };
      }
      const status = index.get(`${student.id}:${date}:${prayer}`);
      if (status === true) { xCount += 1; recordedDays += 1; return { value: "X", fill: null }; }
      if (status === false) { successfulDays += 1; recordedDays += 1; return { value: "", fill: null }; }
      return { value: "", fill: GRAY_FILL };
    });
    const row = sheet.addRow([student.roll_number, student.full_name, ...dayCells.map((item) => item.value), xCount, monthlyPercent(successfulDays, recordedDays)]);
    row.height = 19;
    row.eachCell((cell, column) => {
      cell.font = { name: "Arial", size: 8, color: column >= 3 && column <= days.length + 2 && cell.value === "X" ? { argb: "FF222222" } : { argb: "FF26352B" } };
      cell.alignment = { horizontal: column === 2 ? "left" : "center", vertical: "middle" };
      cell.border = { bottom: { style: "hair", color: { argb: "FFD9E0DA" } }, left: { style: "hair", color: { argb: "FFD9E0DA" } }, right: { style: "hair", color: { argb: "FFD9E0DA" } } };
      if (column >= 3 && column <= days.length + 2) {
        const day = dayCells[column - 3];
        if (day.fill) cell.fill = day.fill;
      }
    });
  }
}

async function makeMonthlyExcel(pondok: string, className: string, academicYear: string, month: string, roster: StudentRow[], rows: AttendanceRow[]) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "MUTABA'AH"; workbook.created = new Date();
  const index = attendanceIndex(rows);
  const days = dateValues(`${month}-01`, monthRangeInAppTimeZone(`${month}-01`).end);
  for (const prayer of [...PRAYERS.map((item) => item.id), "combined" as const]) {
    const label = prayer === "combined" ? "Rekap Gabungan" : PRAYERS.find((item) => item.id === prayer)?.label ?? prayer;
    const sheet = workbook.addWorksheet(label, { views: [{ state: "frozen", xSplit: 2, ySplit: 7 }] });
    reportHeaders(pondok, className, academicYear, monthCaption(`${month}-01`), sheet, days.length);
    applyMonthlyRows(sheet, roster, days, prayer, index);
    sheet.autoFilter = { from: { row: 7, column: 1 }, to: { row: 7, column: days.length + 4 } };
  }
  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}

function pdfHeader(doc: jsPDF, pondok: string, className: string, academicYear: string, period: string) {
  const width = doc.internal.pageSize.getWidth();
  doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.text(pondok, width / 2, 7, { align: "center" });
  doc.setFontSize(11); doc.text("MUTABA’AH — DAFTAR HADIR SALAT SANTRI", width / 2, 12, { align: "center" });
  doc.setFontSize(7); doc.text(`KELAS ( ${className} )  ·  TAHUN PELAJARAN ${academicYear}  ·  ${period}`, width / 2, 17, { align: "center" });
}

async function makeMonthlyPdf(pondok: string, className: string, academicYear: string, month: string, roster: StudentRow[], rows: AttendanceRow[]) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: [330, 210], compress: true });
  const index = attendanceIndex(rows);
  const days = dateValues(`${month}-01`, monthRangeInAppTimeZone(`${month}-01`).end);
  for (const [prayerIndex, prayer] of [...PRAYERS.map((item) => item.id), "combined" as const].entries()) {
    if (prayerIndex > 0) doc.addPage([330, 210], "landscape");
    const label = prayer === "combined" ? "Rekap Gabungan" : PRAYERS.find((item) => item.id === prayer)?.label ?? prayer;
    const headers = ["NO", "NAMA SANTRI", ...days.map((date) => String(dateColumn(date))), "JUMLAH X", "%"];
    const body = roster.map((student) => {
      let countX = 0; let done = 0; let total = 0;
      const values = days.map((date) => {
        if (prayer === "combined") {
          const daily = PRAYERS.map(({ id }) => index.get(`${student.id}:${date}:${id}`));
          if (daily.some((value) => value === true)) { countX += 1; total += 1; return "X"; }
          if (daily.every((value) => value === false)) { done += 1; total += 1; return ""; }
          return "";
        }
        const status = index.get(`${student.id}:${date}:${prayer}`);
        if (status === true) { countX += 1; total += 1; return "X"; }
        if (status === false) { done += 1; total += 1; return ""; }
        return "";
      });
      return [String(student.roll_number), student.full_name, ...values, String(countX), monthlyPercent(done, total)];
    });
    autoTable(doc, {
      head: [headers], body, startY: 21, margin: { top: 21, right: 5, bottom: 5, left: 5 },
      styles: { font: "helvetica", fontSize: 5.5, cellPadding: 0.7, minCellHeight: 4, lineColor: [180, 188, 182], lineWidth: 0.08, textColor: [35, 43, 38], halign: "center", valign: "middle" },
      headStyles: { fillColor: [232, 239, 234], textColor: [30, 43, 35], fontStyle: "bold", fontSize: 5.5 },
      columnStyles: { 0: { cellWidth: 7 }, 1: { cellWidth: 57, halign: "left" }, [days.length + 2]: { cellWidth: 13 }, [days.length + 3]: { cellWidth: 12 } },
      didParseCell(data) {
        if (data.section !== "body" || data.column.index < 2 || data.column.index > days.length + 1) return;
        const student = roster[data.row.index];
        const date = days[data.column.index - 2];
        const status = prayer === "combined" ? PRAYERS.map(({ id }) => index.get(`${student.id}:${date}:${id}`)) : [index.get(`${student.id}:${date}:${prayer}`)];
        if (status.every((item) => item === undefined) || (prayer === "combined" && !status.some((item) => item === true) && !status.every((item) => item === false))) data.cell.styles.fillColor = [232, 236, 233];
      },
      didDrawPage: () => { pdfHeader(doc, pondok, className, academicYear, `${label.toLocaleUpperCase("id-ID")} · BULAN ${monthCaption(`${month}-01`).toLocaleUpperCase("id-ID")}`); },
    });
  }
  return new Uint8Array(doc.output("arraybuffer"));
}

async function makeSummaryExcel(rows: ReportRow[], period: string, pondok: string) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Rekap Santri", { views: [{ state: "frozen", ySplit: 4 }] });
  for (const [row, value] of [[1, pondok], [2, "MUTABA’AH"], [3, `REKAP MINGGUAN · ${period}`]] as const) { sheet.mergeCells(row, 1, row, 11); sheet.getCell(row, 1).value = value; sheet.getCell(row, 1).alignment = { horizontal: "center" }; sheet.getCell(row, 1).font = { bold: row < 3, size: row === 3 ? 11 : 9 }; }
  const header = sheet.addRow(["NO", "NAMA SANTRI", "KELAS", "TERLAKSANA", "TIDAK TERLAKSANA", "SUBUH X", "ZUHUR X", "ASAR X", "MAGRIB X", "ISYA X", "PERSENTASE"]);
  for (const [index, row] of rows.entries()) sheet.addRow([index + 1, row.full_name, row.class_name, row.performed_count, row.missed_count, row.subuh_missed, row.zuhur_missed, row.asar_missed, row.magrib_missed, row.isya_missed, row.success_percent === null ? "—" : `${row.success_percent}%`]);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } }; header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0D5C45" } };
  sheet.columns = [{ width: 7 }, { width: 31 }, { width: 18 }, { width: 15 }, { width: 19 }, { width: 11 }, { width: 11 }, { width: 11 }, { width: 12 }, { width: 10 }, { width: 13 }];
  sheet.headerFooter.oddFooter = `MUTABA'AH · ${period}`;
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}

async function makeSummaryPdf(rows: ReportRow[], period: string, pondok: string) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
  autoTable(doc, { head: [["NO", "NAMA SANTRI", "KELAS", "TERLAKSANA", "TIDAK TERLAKSANA", "SUBUH X", "ZUHUR X", "ASAR X", "MAGRIB X", "ISYA X", "%"]], body: rows.map((row, index) => [String(index + 1), row.full_name, row.class_name, String(row.performed_count), String(row.missed_count), String(row.subuh_missed), String(row.zuhur_missed), String(row.asar_missed), String(row.magrib_missed), String(row.isya_missed), row.success_percent === null ? "—" : `${row.success_percent}%`]), startY: 19, margin: { top: 19, right: 10, bottom: 10, left: 10 }, styles: { fontSize: 7, cellPadding: 2 }, headStyles: { fillColor: [13, 92, 69] }, didDrawPage: () => { doc.setFontSize(8); doc.text(pondok, doc.internal.pageSize.getWidth() / 2, 6, { align: "center" }); doc.setFontSize(11); doc.text(`MUTABA’AH · REKAP ${period.toLocaleUpperCase("id-ID")}`, doc.internal.pageSize.getWidth() / 2, 12, { align: "center" }); } });
  return new Uint8Array(doc.output("arraybuffer"));
}

async function makeIndividualExcel(student: StudentRow, className: string, month: string, rows: AttendanceRow[]) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Rekap Individu", { views: [{ state: "frozen", ySplit: 5 }] });
  const lines = [process.env.NEXT_PUBLIC_PESANTREN_NAME || "", "MUTABA’AH", `REKAP INDIVIDU · ${student.full_name}`, `KELAS ( ${className} ) · NO. ${student.roll_number}`, `BULAN : ${monthCaption(`${month}-01`)}`];
  lines.forEach((line, index) => { sheet.mergeCells(index + 1, 1, index + 1, 9); sheet.getCell(index + 1, 1).value = line; sheet.getCell(index + 1, 1).alignment = { horizontal: "center" }; sheet.getCell(index + 1, 1).font = { bold: index < 3, size: index === 2 ? 12 : 9 }; });
  sheet.addRow(["TANGGAL", "SUBUH", "ZUHUR", "ASAR", "MAGRIB", "ISYA", "JUMLAH X", "TERCATAT", "PERSENTASE"]);
  const index = attendanceIndex(rows);
  const dates = dateValues(`${month}-01`, monthRangeInAppTimeZone(`${month}-01`).end);
  for (const date of dates) {
    const values = PRAYERS.map(({ id }) => index.get(`${student.id}:${date}:${id}`));
    const saved = values.filter((value) => value !== undefined).length;
    const missed = values.filter((value) => value === true).length;
    const performed = values.filter((value) => value === false).length;
    const row = sheet.addRow([date, ...values.map((value) => value === undefined ? "" : value ? "X" : ""), missed, `${saved}/5`, saved ? monthlyPercent(performed, saved) : "—"]);
    row.eachCell((cell, column) => { cell.alignment = { horizontal: "center", vertical: "middle" }; if (column >= 2 && column <= 6 && values[column - 2] === undefined) cell.fill = GRAY_FILL; });
  }
  sheet.columns = [{ width: 18 }, { width: 13 }, { width: 13 }, { width: 13 }, { width: 13 }, { width: 13 }, { width: 14 }, { width: 14 }, { width: 14 }];
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}

async function makeIndividualPdf(pondok: string, student: StudentRow, className: string, month: string, rows: AttendanceRow[]) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
  const index = attendanceIndex(rows);
  const dates = dateValues(`${month}-01`, monthRangeInAppTimeZone(`${month}-01`).end);
  autoTable(doc, { head: [["TANGGAL", "SUBUH", "ZUHUR", "ASAR", "MAGRIB", "ISYA", "JUMLAH X", "TERCATAT", "%"]], body: dates.map((date) => { const values = PRAYERS.map(({ id }) => index.get(`${student.id}:${date}:${id}`)); const saved = values.filter((value) => value !== undefined).length; const missed = values.filter((value) => value === true).length; const done = values.filter((value) => value === false).length; return [date, ...values.map((value) => value === undefined ? "" : value ? "X" : ""), String(missed), `${saved}/5`, saved ? monthlyPercent(done, saved) : "—"]; }), startY: 17, margin: { top: 17, right: 10, bottom: 10, left: 10 }, styles: { fontSize: 8, cellPadding: 2 }, headStyles: { fillColor: [13, 92, 69] }, didParseCell(data) { if (data.section === "body" && data.column.index >= 1 && data.column.index <= 5 && !index.has(`${student.id}:${dates[data.row.index]}:${PRAYERS[data.column.index - 1].id}`)) data.cell.styles.fillColor = [232, 236, 233]; }, didDrawPage: () => { doc.setFontSize(7); doc.text(pondok, doc.internal.pageSize.getWidth() / 2, 5, { align: "center" }); doc.setFontSize(9); doc.text(`MUTABA’AH · ${student.full_name} · ${className} · ${monthCaption(`${month}-01`)}`, doc.internal.pageSize.getWidth() / 2, 11, { align: "center" }); } });
  return new Uint8Array(doc.output("arraybuffer"));
}

function fileResponse(bytes: Uint8Array, filename: string, format: string) {
  const type = format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new NextResponse(new Blob([copy.buffer]), { headers: { "Content-Type": type, "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`, "Cache-Control": "private, no-store" } });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ format: string }> }) {
  const { format } = await params;
  if (format !== "excel" && format !== "pdf") return NextResponse.json({ error: "Format laporan tidak tersedia." }, { status: 404 });
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Sesi masuk diperlukan." }, { status: 401 });
  const paramsQuery = request.nextUrl.searchParams;
  const kind = paramsQuery.get("jenis") ?? "bulanan";
  const supabase = await createClient();
  const today = todayInAppTimeZone();
  const month = paramsQuery.get("bulan") && /^\d{4}-(0[1-9]|1[0-2])$/.test(paramsQuery.get("bulan") ?? "") && (paramsQuery.get("bulan") ?? "") <= today.slice(0, 7) ? paramsQuery.get("bulan") as string : today.slice(0, 7);
  const classId = paramsQuery.get("kelas");
  const studentId = paramsQuery.get("santri");
  const pondok = process.env.NEXT_PUBLIC_PESANTREN_NAME || "";

  try {
    if (kind === "bulanan") {
      if (!classId) return NextResponse.json({ error: "Pilih kelas untuk laporan bulanan." }, { status: 400 });
      const [{ data: classRow, error: classError }, { data: roster, error: rosterError }] = await Promise.all([
        supabase.from("classes").select("id, class_name, academic_year").eq("id", classId).maybeSingle(),
        supabase.from("students").select("*").eq("class_id", classId).order("roll_number"),
      ]);
      if (classError || rosterError || !classRow) return NextResponse.json({ error: "Kelas tidak ditemukan atau Anda tidak memiliki akses." }, { status: 404 });
      const monthRange = monthRangeInAppTimeZone(`${month}-01`);
      const { data: attendance, error } = await supabase.from("prayer_attendance").select("*").eq("class_id", classId).gte("attendance_date", monthRange.start).lte("attendance_date", monthRange.end);
      if (error) return NextResponse.json({ error: "Catatan laporan belum dapat dimuat." }, { status: 503 });
      const bytes = format === "excel" ? await makeMonthlyExcel(pondok, classRow.class_name, classRow.academic_year, month, roster ?? [], attendance ?? []) : await makeMonthlyPdf(pondok, classRow.class_name, classRow.academic_year, month, roster ?? [], attendance ?? []);
      const filename = `MUTABAAH_${filePart(classRow.class_name)}_${month}.${format === "excel" ? "xlsx" : "pdf"}`;
      return fileResponse(bytes, filename, format);
    }

    if (kind === "individu") {
      if (!studentId) return NextResponse.json({ error: "Pilih data santri untuk laporan individu." }, { status: 400 });
      const { data: student, error: studentError } = await supabase.from("students").select("*").eq("id", studentId).maybeSingle();
      if (studentError || !student) return NextResponse.json({ error: "Data santri tidak ditemukan atau Anda tidak memiliki akses." }, { status: 404 });
      const { data: classRow } = await supabase.from("classes").select("class_name").eq("id", student.class_id).maybeSingle();
      const monthRange = monthRangeInAppTimeZone(`${month}-01`);
      const { data: attendance, error } = await supabase.from("prayer_attendance").select("*").eq("student_id", student.id).gte("attendance_date", monthRange.start).lte("attendance_date", monthRange.end);
      if (error) return NextResponse.json({ error: "Riwayat santri belum dapat dimuat." }, { status: 503 });
      const bytes = format === "excel" ? await makeIndividualExcel(student, classRow?.class_name ?? "Kelas", month, attendance ?? []) : await makeIndividualPdf(pondok, student, classRow?.class_name ?? "Kelas", month, attendance ?? []);
      return fileResponse(bytes, `MUTABAAH_${filePart(student.full_name)}_${month}.${format === "excel" ? "xlsx" : "pdf"}`, format);
    }

    if (kind !== "mingguan") return NextResponse.json({ error: "Jenis laporan tidak tersedia." }, { status: 400 });
    const selectedDate = paramsQuery.get("tanggal") && /^\d{4}-\d{2}-\d{2}$/.test(paramsQuery.get("tanggal") ?? "") && (paramsQuery.get("tanggal") ?? "") <= today ? paramsQuery.get("tanggal") as string : today;
    const week = weekRangeInAppTimeZone(selectedDate);
    const { data: reportRows, error } = await supabase.rpc("attendance_student_summary", { p_start_date: week.start, p_end_date: week.end, p_class_id: classId || null });
    if (error) return NextResponse.json({ error: "Data rekap belum dapat dimuat." }, { status: 503 });
    const bytes = format === "excel" ? await makeSummaryExcel(reportRows ?? [], `${week.start} – ${week.end}`, pondok) : await makeSummaryPdf(reportRows ?? [], `${week.start} – ${week.end}`, pondok);
    return fileResponse(bytes, `MUTABAAH_Rekap_Mingguan_${week.start}.` + (format === "excel" ? "xlsx" : "pdf"), format);
  } catch {
    return NextResponse.json({ error: "Laporan belum dapat dibuat. Silakan coba lagi." }, { status: 500 });
  }
}
