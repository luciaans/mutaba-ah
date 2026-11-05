import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from "docx";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { monthRangeInAppTimeZone, todayInAppTimeZone, weekRangeInAppTimeZone } from "@/lib/time";
import type { Database } from "@/types/database.types";

type AttendanceRow = Database["public"]["Tables"]["prayer_attendance"]["Row"];
type SummaryRow = Database["public"]["Functions"]["attendance_student_summary"]["Returns"][number];
type PrayerName = "subuh" | "zuhur" | "asar" | "magrib" | "isya";
type AbsenceReason = "sakit" | "izin" | "alfa";
const PRAYERS: { id: PrayerName; label: string }[] = [
  { id: "subuh", label: "Subuh" }, { id: "zuhur", label: "Zuhur" }, { id: "asar", label: "Asar" },
  { id: "magrib", label: "Magrib" }, { id: "isya", label: "Isya" },
];
const REASONS: Record<AbsenceReason, string> = { sakit: "Sakit", izin: "Izin", alfa: "Alfa" };
const BORDER = { style: BorderStyle.SINGLE, size: 1, color: "D9E2DC" };

function dateLabel(date: string) {
  return new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Pontianak", day: "numeric", month: "long", year: "numeric" }).format(new Date(`${date}T12:00:00+07:00`));
}

function plain(text: string, options: { bold?: boolean; color?: string; size?: number } = {}) {
  return new Paragraph({
    children: [new TextRun({ text, bold: options.bold, color: options.color ?? "26352B", size: options.size ?? 21, font: "Arial" })],
    spacing: { after: 120 },
  });
}

function sectionHeading(text: string) {
  return new Paragraph({
    spacing: { before: 220, after: 100 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 5, color: "D7E8DE", space: 5 } },
    children: [new TextRun({ text, bold: true, color: "0D5C45", size: 24, font: "Arial" })],
  });
}

function cell(text: string, options: { header?: boolean; width?: number; center?: boolean } = {}) {
  return new TableCell({
    width: options.width ? { size: options.width, type: WidthType.PERCENTAGE } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    shading: options.header ? { fill: "0D5C45", type: ShadingType.CLEAR } : undefined,
    borders: { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER },
    margins: { top: 95, bottom: 95, left: 110, right: 110 },
    children: [new Paragraph({
      alignment: options.center ? AlignmentType.CENTER : AlignmentType.LEFT,
      children: [new TextRun({ text, bold: options.header, color: options.header ? "FFFFFF" : "26352B", size: options.header ? 18 : 19, font: "Arial" })],
    })],
  });
}

function wordResponse(file: Uint8Array, filename: string) {
  const copy = new Uint8Array(file.byteLength);
  copy.set(file);
  return new NextResponse(new Blob([copy.buffer]), { headers: {
    "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    "Cache-Control": "private, no-store",
  } });
}

function createAllStudentsDocument({
  rows, attendance, periodLabel, periodRange, schoolName,
}: {
  rows: SummaryRow[]; attendance: AttendanceRow[]; periodLabel: string; periodRange: string; schoolName: string;
}) {
  const reasonsByStudent = new Map<string, Record<AbsenceReason, number>>();
  for (const row of attendance) {
    if (!row.is_missed) continue;
    const counts = reasonsByStudent.get(row.student_id) ?? { sakit: 0, izin: 0, alfa: 0 };
    counts[(row.absence_reason ?? "alfa") as AbsenceReason] += 1;
    reasonsByStudent.set(row.student_id, counts);
  }
  const totalPerformed = rows.reduce((sum, row) => sum + row.performed_count, 0);
  const totalMissed = rows.reduce((sum, row) => sum + row.missed_count, 0);
  const reportRows = [
    new TableRow({ tableHeader: true, children: [
      cell("No.", { header: true, width: 5, center: true }), cell("Nama santri", { header: true, width: 22 }),
      cell("Kelas", { header: true, width: 11 }), cell("Terlaksana", { header: true, width: 10, center: true }),
      cell("Sakit", { header: true, width: 8, center: true }), cell("Izin", { header: true, width: 8, center: true }),
      cell("Alfa", { header: true, width: 8, center: true }), cell("Tidak terlaksana", { header: true, width: 12, center: true }),
      cell("Rasio", { header: true, width: 8, center: true }),
    ] }),
    ...rows.map((row, index) => {
      const reasons = reasonsByStudent.get(row.student_id) ?? { sakit: 0, izin: 0, alfa: 0 };
      const percentage = row.success_percent === null ? "—" : `${row.success_percent.toLocaleString("id-ID")}%`;
      return new TableRow({ children: [
        cell(String(index + 1), { center: true }), cell(row.full_name), cell(row.class_name),
        cell(String(row.performed_count), { center: true }), cell(String(reasons.sakit), { center: true }),
        cell(String(reasons.izin), { center: true }), cell(String(reasons.alfa), { center: true }),
        cell(String(row.missed_count), { center: true }), cell(percentage, { center: true }),
      ] });
    }),
  ];
  return new Document({
    creator: "MUTABA'AH", title: `${periodLabel} - Semua Santri`, description: "Rekapitulasi ibadah santri",
    sections: [{ properties: { page: { margin: { top: 850, right: 600, bottom: 850, left: 600 } } }, children: [
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [new TextRun({ text: schoolName.toLocaleUpperCase("id-ID"), bold: true, color: "0D5C45", size: 28, font: "Arial" })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [new TextRun({ text: "REKAPITULASI PEMANTAUAN IBADAH SANTRI", bold: true, color: "26352B", size: 24, font: "Arial" })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 260 }, children: [new TextRun({ text: `${periodLabel} · ${periodRange}`, color: "68756D", size: 20, font: "Arial" })] }),
      plain(`Jumlah santri: ${rows.length}   |   Sesi terlaksana: ${totalPerformed}   |   Sesi tidak terlaksana: ${totalMissed}`, { bold: true, color: "0D5C45" }),
      new Paragraph({ spacing: { after: 160 }, children: [new TextRun({ text: "Ringkasan ini memuat data seluruh santri pada kelas yang dapat diakses dan dipilih di aplikasi.", color: "68756D", size: 18, font: "Arial" })] }),
      new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, columnWidths: [500, 2200, 1100, 1000, 800, 800, 800, 1200, 800], rows: reportRows }),
      new Paragraph({ spacing: { before: 220 }, children: [new TextRun({ text: `Dibuat pada ${dateLabel(todayInAppTimeZone())}.`, color: "68756D", size: 18, font: "Arial" })] }),
    ] }],
  });
}

export async function GET(request: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Sesi masuk diperlukan." }, { status: 401 });

  const query = request.nextUrl.searchParams;
  const today = todayInAppTimeZone();
  const requestedDate = query.get("tanggal") ?? today;
  const selectedDate = /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) && requestedDate <= today ? requestedDate : today;
  const period = query.get("periode") === "bulanan" ? "bulanan" : "mingguan";
  const range = period === "bulanan"
    ? monthRangeInAppTimeZone(selectedDate)
    : weekRangeInAppTimeZone(selectedDate);
  const periodLabel = period === "bulanan" ? "Laporan Bulanan" : "Laporan Mingguan";
  const periodRange = `${dateLabel(range.start)} – ${dateLabel(range.end)}`;
  const schoolName = process.env.NEXT_PUBLIC_PESANTREN_NAME || "MUTABA'AH";
  const supabase = await createClient();

  if (query.get("semua") === "true") {
    const requestedClassId = query.get("kelas");
    const { data: classes, error: classesError } = await supabase.from("classes").select("id").order("class_name");
    if (classesError) return NextResponse.json({ error: "Daftar kelas belum dapat dimuat." }, { status: 503 });
    if (requestedClassId && !classes?.some((item) => item.id === requestedClassId)) return NextResponse.json({ error: "Kelas tidak ditemukan atau Anda tidak memiliki akses." }, { status: 404 });
    const classFilter = requestedClassId || null;
    const [{ data: summary, error: summaryError }, { data: attendanceData, error: attendanceError }] = await Promise.all([
      supabase.rpc("attendance_student_summary", { p_start_date: range.start, p_end_date: range.end, p_class_id: classFilter }),
      (async () => {
        let attendanceQuery = supabase.from("prayer_attendance").select("*").gte("attendance_date", range.start).lte("attendance_date", range.end);
        if (classFilter) attendanceQuery = attendanceQuery.eq("class_id", classFilter);
        return attendanceQuery;
      })(),
    ]);
    if (summaryError || attendanceError) return NextResponse.json({ error: "Data rekap belum dapat dimuat." }, { status: 503 });
    const file = await Packer.toBuffer(createAllStudentsDocument({ rows: summary ?? [], attendance: (attendanceData ?? []) as AttendanceRow[], periodLabel, periodRange, schoolName }));
    return wordResponse(new Uint8Array(file), `Rekap_Semua_Santri_${period}_${range.start}.docx`);
  }

  const studentId = query.get("santri") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(studentId)) return NextResponse.json({ error: "Pilih santri yang valid." }, { status: 400 });
  const { data: student, error: studentError } = await supabase.from("students")
    .select("id, full_name, class_id, roll_number")
    .eq("id", studentId).maybeSingle();
  if (studentError || !student) return NextResponse.json({ error: "Santri tidak ditemukan atau Anda tidak memiliki akses." }, { status: 404 });
  const requestedClassId = query.get("kelas");
  if (requestedClassId && requestedClassId !== student.class_id) return NextResponse.json({ error: "Santri tidak termasuk kelas yang dipilih." }, { status: 404 });

  const [{ data: classRow, error: classError }, { data: attendanceData, error: attendanceError }, { data: sessions, error: sessionsError }] = await Promise.all([
    supabase.from("classes").select("class_name, academic_year").eq("id", student.class_id).maybeSingle(),
    supabase.from("prayer_attendance").select("*").eq("student_id", student.id).gte("attendance_date", range.start).lte("attendance_date", range.end).order("attendance_date").order("prayer_name"),
    supabase.from("attendance_sessions").select("prayer_name").eq("class_id", student.class_id).gte("attendance_date", range.start).lte("attendance_date", range.end),
  ]);
  if (classError || attendanceError || sessionsError || !classRow) return NextResponse.json({ error: "Data laporan belum dapat dimuat." }, { status: 503 });

  const attendance = (attendanceData ?? []) as AttendanceRow[];
  const sessionCounts = new Map<PrayerName, number>(PRAYERS.map((prayer) => [prayer.id, 0]));
  for (const session of sessions ?? []) sessionCounts.set(session.prayer_name, (sessionCounts.get(session.prayer_name) ?? 0) + 1);
  const counts = new Map<PrayerName, { performed: number; sakit: number; izin: number; alfa: number; recorded: number }>(
    PRAYERS.map((prayer) => [prayer.id, { performed: 0, sakit: 0, izin: 0, alfa: 0, recorded: 0 }]),
  );
  for (const item of attendance) {
    const summary = counts.get(item.prayer_name)!;
    summary.recorded += 1;
    if (!item.is_missed) summary.performed += 1;
    else {
      const reason = (item.absence_reason ?? "alfa") as AbsenceReason;
      summary[reason] += 1;
    }
  }

  const totalPerformed = attendance.filter((item) => !item.is_missed).length;
  const missed = attendance.filter((item) => item.is_missed);
  const unrecorded = Math.max(0, (sessions ?? []).length - attendance.length);
  const total = attendance.length;
  const percentage = total ? `${(totalPerformed * 100 / total).toFixed(1).replace(".", ",")}%` : "Belum ada data";
  const rows = [
    new TableRow({ tableHeader: true, children: [cell("Waktu salat", { header: true, width: 20 }), cell("Sesi tercatat", { header: true, center: true, width: 16 }), cell("Terlaksana", { header: true, center: true, width: 16 }), cell("Sakit", { header: true, center: true, width: 16 }), cell("Izin", { header: true, center: true, width: 16 }), cell("Alfa", { header: true, center: true, width: 16 })] }),
    ...PRAYERS.map((prayer) => {
      const result = counts.get(prayer.id)!;
      return new TableRow({ children: [cell(prayer.label), cell(String(sessionCounts.get(prayer.id) ?? 0), { center: true }), cell(String(result.performed), { center: true }), cell(String(result.sakit), { center: true }), cell(String(result.izin), { center: true }), cell(String(result.alfa), { center: true })] });
    }),
  ];
  const detailRows = missed.length
    ? missed.map((item) => new TableRow({ children: [cell(dateLabel(item.attendance_date), { width: 34 }), cell(PRAYERS.find((prayer) => prayer.id === item.prayer_name)?.label ?? item.prayer_name, { width: 33 }), cell(REASONS[(item.absence_reason ?? "alfa") as AbsenceReason], { width: 33 })] }))
    : [new TableRow({ children: [new TableCell({ columnSpan: 3, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Tidak ada catatan tidak terlaksana pada periode ini.", color: "34704F", size: 19, font: "Arial" })] })] })] })];

  const document = new Document({
    creator: "MUTABA'AH",
    title: `${periodLabel} - ${student.full_name}`,
    description: "Ringkasan perkembangan ibadah untuk wali santri",
    sections: [{
      properties: { page: { margin: { top: 850, right: 900, bottom: 850, left: 900 } } },
      children: [
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [new TextRun({ text: schoolName.toLocaleUpperCase("id-ID"), bold: true, color: "0D5C45", size: 28, font: "Arial" })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [new TextRun({ text: "LAPORAN PEMANTAUAN IBADAH SANTRI", bold: true, color: "26352B", size: 25, font: "Arial" })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 300 }, children: [new TextRun({ text: periodLabel.toLocaleUpperCase("id-ID"), color: "68756D", size: 20, font: "Arial" })] }),
        sectionHeading("Identitas santri"),
        plain(`Nama: ${student.full_name}`, { bold: true }),
        plain(`Kelas: ${classRow.class_name}  ·  No. urut: ${student.roll_number}`),
        plain(`Periode laporan: ${periodRange}`, { color: "58665D" }),
        sectionHeading("Ringkasan"),
        plain(`Pada periode ini tercatat ${total} sesi salat untuk ${student.full_name}. ${totalPerformed} sesi tercatat terlaksana, ${missed.length} sesi tidak terlaksana, dan ${unrecorded} sesi kelas belum tercatat untuk santri ini.`),
        plain(`Rasio pelaksanaan dari sesi yang tercatat: ${percentage}.`, { bold: true, color: "0D5C45" }),
        new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, columnWidths: [2200, 1760, 1760, 1760, 1760, 1760], rows }),
        sectionHeading("Catatan tidak terlaksana"),
        new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: "Rincian berikut menunjukkan tanggal, waktu salat, dan alasan yang dicatat.", color: "68756D", size: 19, font: "Arial" })] }),
        new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, columnWidths: [3200, 3200, 3200], rows: [new TableRow({ tableHeader: true, children: [cell("Tanggal", { header: true, width: 34 }), cell("Waktu salat", { header: true, width: 33 }), cell("Keterangan", { header: true, width: 33 })] }), ...detailRows] }),
        sectionHeading("Catatan untuk pendampingan"),
        plain(missed.length || unrecorded ? "Mohon dampingi santri dengan komunikasi yang baik, tanyakan kendala yang dihadapi, dan dukung pembiasaan ibadah secara bertahap." : "Terima kasih atas pendampingan yang telah diberikan. Pertahankan kebiasaan baik ini dan lanjutkan komunikasi antara keluarga dan pembimbing."),
        plain("Laporan ini merupakan ringkasan catatan pada aplikasi MUTABA'AH untuk bahan komunikasi dan pendampingan.", { color: "68756D", size: 18 }),
        new Paragraph({ spacing: { before: 450, after: 100 }, children: [new TextRun({ text: `Dibuat pada ${dateLabel(today)}.`, color: "68756D", size: 18, font: "Arial" })] }),
        new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, columnWidths: [5000, 5000], rows: [new TableRow({ children: [
          new TableCell({ borders: { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER }, margins: { top: 130, bottom: 130, left: 140, right: 140 }, children: [plain("Orang tua / wali santri"), new Paragraph({ text: "\n\n\n(........................................)", alignment: AlignmentType.CENTER })] }),
          new TableCell({ borders: { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER }, margins: { top: 130, bottom: 130, left: 140, right: 140 }, children: [plain("Pembimbing"), new Paragraph({ text: "\n\n\n(........................................)", alignment: AlignmentType.CENTER })] }),
        ] })] }),
      ],
    }],
  });
  const file = await Packer.toBuffer(document);
  const filename = `Laporan_${student.full_name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "_")}_${period}_${range.start}.docx`;
  return wordResponse(new Uint8Array(file), filename);
}
